// supabase/functions/chat-completion/index.ts
//
// Phase 1 chat backend.
//
// Pipeline:
//   1. Embed the user's message via OpenAI (text-embedding-3-small).
//   2. Hybrid retrieval via the match_content() Postgres RPC (vector + FTS, RRF-merged).
//   3. Build a context block from the top N listings.
//   4. Stream from Anthropic Messages API (claude-haiku-4-5-20251001).
//
// REQUEST:
//   POST /functions/v1/chat-completion
//   {
//     "message": "what about for vegetarians?",
//     "history": [                                  // optional: prior turns for context
//       { "role": "user",      "content": "best biryani in Fremont" },
//       { "role": "assistant", "content": "..." }
//     ],
//     "match_count": 10,                            // optional, default 10
//     "category": null                              // optional category_slug filter
//   }
//
// IMPORTANT: retrieval ALWAYS runs on the latest `message` only, never on the history.
// History is forwarded to Anthropic for conversational continuity but doesn't pollute
// the embedding query — that's deliberate, otherwise follow-ups retrieve stale matches.
//
// RESPONSE: text/event-stream
//   The very first SSE event is a custom "retrieval" event whose data is JSON:
//     event: retrieval
//     data: {"listings":[{"id":"...","name":"...","category":"...","url_slug":"...","vec_rank":1,"fts_rank":3,"rrf_score":0.034}, ...]}
//
//   Then the native Anthropic stream is forwarded as-is — content_block_delta events
//   containing text. Final event is `event: done`.
//
// SECRETS expected in Supabase:
//   OPENAI_API_KEY        — for embeddings
//   ANTHROPIC_API_KEY     — for chat completion + intent extraction
//   GOOGLE_MAPS_API_KEY   — for geocoding location mentions
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — auto-provided
//
// CALL FROM FRONTEND (Phase 2):
//   const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-completion`, {
//     method: 'POST',
//     headers: { 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
//     body: JSON.stringify({ message })
//   })
//   // Parse SSE from res.body.getReader()

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const EMBED_MODEL = "text-embedding-3-small"
const CHAT_MODEL  = "claude-haiku-4-5-20251001"  // per CLAUDE.md

const SYSTEM_PROMPT = `You are Nasiha, a warm and helpful guide to Muslim life in the Bay Area.

You help users find restaurants, mosques, home cooks, caterers, lawyers, schools, childcare, and events from the Nasiha knowledge graph.

RULES:
- Answer ONLY using the listings provided in the LISTINGS block below.
- Never invent listings, phone numbers, addresses, hours, or any other detail.
- If the listings don't contain what the user is asking for, say so honestly and suggest what they could ask instead.
- When recommending a place, mention the city and one specific detail (cuisine, what they're known for) so the user can pick.
- Keep responses concise — 2-4 short paragraphs or a tight bulleted list, not an essay.
- Use the user's tone: casual if they're casual.
- Never make up a URL. If you reference a listing the user can open, use the url_slug as provided.
- Don't include the LISTINGS block or raw JSON in your reply.

LOCATION + DISTANCE rules:
- If a listing has "distance_miles", that's the radial (straight-line) distance from a location the user mentioned. Quote it naturally ("about 2 miles from there").
- These are straight-line miles, NOT drive time. Don't claim a specific drive time unless the user gave you one. A reasonable rule of thumb: in town, 1 mile ≈ 2 minutes of driving.
- If the user asked "within N minutes" or "within N miles", every listing returned is already within that radius — just present them in order, closest first.
- If the user asked about a route (e.g. "on my way from A to B"), the distance is measured to the destination, not along the route. Be honest: "this is close to your destination" rather than claiming it's on the way.
- Never recommend a place whose distance_miles exceeds the user's stated radius.

MOSQUES — Jummah times rule:
- For mosques, if a listing includes a "current_jummah_times" line, those are THE active prayer times for today's season. Use those.
- The description field may contain older or seasonal times — IGNORE those in favor of current_jummah_times.
- Do not label times as "summer" or "winter" to the user — just give the times.`

async function embedQuery(text: string): Promise<number[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")!
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  })
  if (!res.ok) throw new Error(`OpenAI embed ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.data[0].embedding
}

// Cheap Haiku call to extract structured intent (location, radius, category)
// from the user's message. Runs in parallel with the embedding step.
interface QueryIntent {
  location: string | null
  radius_miles: number | null
  category: string | null
}

const VALID_CATEGORIES = new Set([
  "restaurants", "mosques", "home-cooked-food", "childcare",
  "lawyers", "islamic-schools", "dessert-catering", "event-services", "events",
])

function parseIntentJSON(text: string): any {
  // Strip ``` or ```json fences if Haiku added them despite instructions
  let s = text.trim()
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim()
  // Find the outermost { ... } even if there's leading prose
  const first = s.indexOf("{")
  const last = s.lastIndexOf("}")
  if (first === -1 || last === -1 || last < first) return null
  try { return JSON.parse(s.slice(first, last + 1)) } catch { return null }
}

// Module-level debug capture so the request handler can surface the last
// intent-extraction result via the retrieval SSE event (test-chat prints it).
// This is for development visibility while we tune the geo path.
interface IntentDebug {
  raw: string | null
  parsed: any
  http_error: string | null
}
let lastIntentDebug: IntentDebug = { raw: null, parsed: null, http_error: null }

async function extractQueryIntent(message: string): Promise<QueryIntent> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")!
  const systemPrompt = `Extract structured intent from a user message about places. Output ONLY a single JSON object, no prose, no markdown fences.

Schema:
{
  "location": string | null,     // place/area/address mentioned. For "from X to Y" use Y (the destination). Examples: "Fremont", "near SFO", "12 Arundel Dr Hayward". null if no location mentioned.
  "radius_miles": number | null, // if user says "within N miles" use N. If "within N minutes" use roughly N/2 (typical city driving). If user says "near X" without a number, return null. Cap at 30.
  "category": string | null      // EXACTLY one of: restaurants, mosques, home-cooked-food, childcare, lawyers, islamic-schools, dessert-catering, event-services, events. null if user is asking generically (e.g. "places", "spots", "food").
}`
  lastIntentDebug = { raw: null, parsed: null, http_error: null }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        max_tokens: 300,
        system: systemPrompt,
        // Prefill `{` so Haiku continues into a JSON object on the first token.
        messages: [
          { role: "user", content: message },
          { role: "assistant", content: "{" },
        ],
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      lastIntentDebug.http_error = `${res.status}: ${errText.slice(0, 300)}`
      console.warn("Intent extraction HTTP error:", res.status, errText)
      return { location: null, radius_miles: null, category: null }
    }
    const data = await res.json()
    const rawText = data.content?.[0]?.text || ""
    const fullText = "{" + rawText
    lastIntentDebug.raw = fullText.slice(0, 500)
    const parsed = parseIntentJSON(fullText)
    if (!parsed) {
      console.warn("Intent extraction: could not parse JSON from:", JSON.stringify(fullText).slice(0, 200))
      return { location: null, radius_miles: null, category: null }
    }
    lastIntentDebug.parsed = parsed
    const location = typeof parsed.location === "string" && parsed.location.length > 0 ? parsed.location : null
    const radius_miles = typeof parsed.radius_miles === "number" && parsed.radius_miles > 0
      ? Math.min(parsed.radius_miles, 30)
      : null
    let category: string | null = null
    if (typeof parsed.category === "string" && VALID_CATEGORIES.has(parsed.category)) {
      category = parsed.category
    } else if (parsed.category && typeof parsed.category === "string") {
      console.warn("Intent extraction: invalid category dropped:", parsed.category)
    }
    console.log("Intent extracted:", JSON.stringify({ location, radius_miles, category }))
    return { location, radius_miles, category }
  } catch (e) {
    lastIntentDebug.http_error = String(e)
    console.warn("Intent extraction failed:", e)
    return { location: null, radius_miles: null, category: null }
  }
}

// Google Geocoding REST. Returns lat/lng of the first match, or null.
// Captures error info in a module-level var so the request handler can include
// it in the debug payload of the retrieval SSE event.
interface GeocodeDebug {
  status: string | null
  error_message: string | null
  exception: string | null
}
let lastGeocodeDebug: GeocodeDebug = { status: null, error_message: null, exception: null }

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  lastGeocodeDebug = { status: null, error_message: null, exception: null }
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY")
  if (!key) {
    lastGeocodeDebug.exception = "GOOGLE_MAPS_API_KEY not set"
    console.warn("GOOGLE_MAPS_API_KEY not set — geocoding skipped")
    return null
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${key}`
    const res = await fetch(url)
    const data = await res.json()
    lastGeocodeDebug.status = data.status || `HTTP_${res.status}`
    lastGeocodeDebug.error_message = data.error_message || null
    if (data.status !== "OK") {
      console.warn(`Geocode status=${data.status} for "${location}"; error_message=${data.error_message || "(none)"}`)
      return null
    }
    if (!data.results?.length) {
      console.warn(`Geocode returned 0 results for "${location}"`)
      return null
    }
    const r = data.results[0]
    const loc = r.geometry?.location
    if (!loc) return null
    console.log(`Geocoded "${location}" → "${r.formatted_address}" (${loc.lat}, ${loc.lng})`)
    return { lat: loc.lat, lng: loc.lng, formatted: r.formatted_address || location }
  } catch (e) {
    lastGeocodeDebug.exception = String(e)
    console.warn("Geocoding failed:", e)
    return null
  }
}

function toPgVector(arr: number[]): string {
  return "[" + arr.join(",") + "]"
}

function buildContextBlock(listings: any[], jummahByMosqueId: Map<string, string>): string {
  if (listings.length === 0) return "(no listings matched the query)"
  return listings
    .map((l, i) => {
      const lines = [`[${i + 1}] ${l.name}`]
      if (l.category_slug) lines.push(`category: ${l.category_slug}`)
      if (l.service_area) lines.push(`city: ${l.service_area}`)
      else if (l.address) lines.push(`address: ${l.address}`)
      if (typeof l.distance_miles === "number")
        lines.push(`distance_miles: ${l.distance_miles.toFixed(1)}`)
      if (l.phone) lines.push(`phone: ${l.phone}`)
      if (l.email) lines.push(`email: ${l.email}`)
      if (l.website) lines.push(`website: ${l.website}`)
      if (l.instagram) lines.push(`instagram: ${l.instagram}`)
      if (l.url_slug) lines.push(`url_slug: ${l.url_slug}`)
      // Mosques: inject live current-season Jummah times so the model can't
      // accidentally cite stale times from a description that hardcodes them.
      if (l.category_slug === "mosques" && jummahByMosqueId.has(l.id)) {
        lines.push(`current_jummah_times: ${jummahByMosqueId.get(l.id)}`)
      }
      if (l.description) {
        const desc = l.description.replace(/\s+/g, " ").slice(0, 400)
        lines.push(`about: ${desc}${l.description.length > 400 ? "…" : ""}`)
      }
      return lines.join("\n")
    })
    .join("\n---\n")
}

// Returns true if the current instant is in US Pacific Daylight Time (March–November).
// Edge functions run on UTC; we ask Intl for the Pacific timezone abbreviation.
function isPacificDST(): boolean {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      timeZoneName: "short",
    }).formatToParts(new Date())
    const tz = parts.find(p => p.type === "timeZoneName")?.value
    return tz === "PDT"
  } catch {
    // Conservative fallback: assume DST May–October so a deploy from a weird
    // runtime doesn't silently flip everyone to winter times.
    const m = new Date().getUTCMonth()
    return m >= 2 && m <= 9
  }
}

function formatJummahForSeason(times: any, isSummer: boolean): string | null {
  if (!times || typeof times !== "object") return null
  const prefix = isSummer ? "s" : "w"
  const slots: string[] = []
  for (let i = 1; i <= 4; i++) {
    const j = times[`${prefix}${i}j`]
    const iq = times[`${prefix}${i}iq`]
    if (j) slots.push(iq ? `${j} (iqama ${iq})` : j)
  }
  return slots.length > 0 ? slots.join(", ") : null
}

// Fetch jummah_times for any mosques in the retrieved set and format them for the
// current Pacific-time season.
async function fetchJummahForMosques(supabase: any, listings: any[]): Promise<Map<string, string>> {
  const mosqueIds = listings.filter(l => l.category_slug === "mosques").map(l => l.id)
  if (mosqueIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from("content")
    .select("id, jummah_times")
    .in("id", mosqueIds)
  if (error || !data) return new Map()
  const isSummer = isPacificDST()
  const out = new Map<string, string>()
  for (const r of data) {
    const formatted = formatJummahForSeason(r.jummah_times, isSummer)
    if (formatted) out.set(r.id, formatted)
  }
  return out
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  let body: {
    message?: string
    history?: Array<{ role: "user" | "assistant"; content: string }>
    match_count?: number
    category?: string
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }

  const message = (body.message || "").trim()
  if (!message) return json({ error: "message is required" }, 400)
  const matchCount = Math.min(Math.max(body.match_count ?? 10, 1), 25)
  const category = body.category || null
  // Cap history at 10 turns (20 messages) so context stays bounded.
  const history = Array.isArray(body.history)
    ? body.history.filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-20)
    : []

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  // 1. Embed the user query + extract structured intent in parallel.
  //    Intent extraction is a small Haiku call (~$0.001) that tells us if the
  //    user mentioned a location and whether they specified a radius.
  let queryEmbedding: number[]
  let intent: QueryIntent
  try {
    [queryEmbedding, intent] = await Promise.all([
      embedQuery(message),
      extractQueryIntent(message),
    ])
  } catch (e) {
    console.error("Embed/intent failed:", e)
    return json({ error: "Pre-retrieval failed", detail: String(e) }, 500)
  }

  // 1b. If a location was extracted, geocode it (Google) so we can pass coords
  //     to match_content for distance-aware ranking.
  let nearCoords: { lat: number; lng: number; formatted: string } | null = null
  if (intent.location) {
    nearCoords = await geocodeLocation(intent.location)
  }

  // 2. Hybrid retrieval (now with optional geographic bias).
  //    category filter precedence: explicit param > extracted intent.
  const effectiveCategory = category || intent.category
  const { data: matches, error: rpcErr } = await supabaseAdmin.rpc("match_content", {
    query_embedding: toPgVector(queryEmbedding),
    query_text: message,
    match_count: matchCount,
    category_filter: effectiveCategory,
    near_lat: nearCoords?.lat ?? null,
    near_lng: nearCoords?.lng ?? null,
    radius_miles: nearCoords ? intent.radius_miles : null,
  })
  if (rpcErr) {
    console.error("match_content RPC failed:", rpcErr)
    return json({ error: "Retrieval failed", detail: rpcErr.message }, 500)
  }
  const listings = matches || []

  // 2b. For mosques in the retrieved set, fetch jummah_times and format the live
  // (current-season) times. This sidesteps the static description, which would
  // otherwise cause the chat to cite winter times in summer (and vice versa).
  const jummahByMosqueId = await fetchJummahForMosques(supabaseAdmin, listings)

  // 3. Build the context block
  const contextBlock = buildContextBlock(listings, jummahByMosqueId)
  const userPrompt = `User question: ${message}\n\nLISTINGS:\n${contextBlock}\n\nAnswer the user using only these listings.`

  // 4. Call Anthropic with streaming
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 1024,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [
        ...history,
        { role: "user", content: userPrompt },
      ],
    }),
  })
  if (!anthropicRes.ok || !anthropicRes.body) {
    const errText = await anthropicRes.text()
    console.error("Anthropic error:", anthropicRes.status, errText)
    return json({ error: "Chat completion failed", status: anthropicRes.status, detail: errText }, 500)
  }

  // 5. Stream: prepend a custom "retrieval" SSE event, then forward Anthropic's stream
  const encoder = new TextEncoder()
  const retrievalSummary = {
    location: nearCoords ? {
      name: nearCoords.formatted,
      lat: nearCoords.lat,
      lng: nearCoords.lng,
      radius_miles: intent.radius_miles,
    } : null,
    debug: {
      intent,
      intent_raw: lastIntentDebug.raw,
      intent_http_error: lastIntentDebug.http_error,
      geocode_attempted: !!intent.location,
      geocode_result: nearCoords ? nearCoords.formatted : null,
      geocode_status: lastGeocodeDebug.status,
      geocode_error: lastGeocodeDebug.error_message,
      geocode_exception: lastGeocodeDebug.exception,
      google_key_set: !!Deno.env.get("GOOGLE_MAPS_API_KEY"),
    },
    listings: listings.map((l: any) => ({
      id: l.id,
      name: l.name,
      category: l.category_slug,
      city: l.service_area,
      url_slug: l.url_slug,
      distance_miles: l.distance_miles,
      vec_rank: l.vec_rank,
      fts_rank: l.fts_rank,
      rrf_score: l.rrf_score,
    })),
  }
  const retrievalEvent = `event: retrieval\ndata: ${JSON.stringify(retrievalSummary)}\n\n`

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(retrievalEvent))

      const reader = anthropicRes.body!.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }
      } catch (e) {
        console.error("Stream read error:", e)
      } finally {
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
