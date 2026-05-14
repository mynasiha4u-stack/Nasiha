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
//   { "message": "best biryani in Fremont", "match_count": 10, "category": null }
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
//   OPENAI_API_KEY     — for embeddings
//   ANTHROPIC_API_KEY  — for chat completion
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
- Don't include the LISTINGS block or raw JSON in your reply.`

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

function toPgVector(arr: number[]): string {
  return "[" + arr.join(",") + "]"
}

function buildContextBlock(listings: any[]): string {
  if (listings.length === 0) return "(no listings matched the query)"
  return listings
    .map((l, i) => {
      const lines = [`[${i + 1}] ${l.name}`]
      if (l.category_slug) lines.push(`category: ${l.category_slug}`)
      if (l.service_area) lines.push(`city: ${l.service_area}`)
      else if (l.address) lines.push(`address: ${l.address}`)
      if (l.phone) lines.push(`phone: ${l.phone}`)
      if (l.email) lines.push(`email: ${l.email}`)
      if (l.website) lines.push(`website: ${l.website}`)
      if (l.instagram) lines.push(`instagram: ${l.instagram}`)
      if (l.url_slug) lines.push(`url_slug: ${l.url_slug}`)
      if (l.description) {
        const desc = l.description.replace(/\s+/g, " ").slice(0, 400)
        lines.push(`about: ${desc}${l.description.length > 400 ? "…" : ""}`)
      }
      return lines.join("\n")
    })
    .join("\n---\n")
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  let body: { message?: string; match_count?: number; category?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }

  const message = (body.message || "").trim()
  if (!message) return json({ error: "message is required" }, 400)
  const matchCount = Math.min(Math.max(body.match_count ?? 10, 1), 25)
  const category = body.category || null

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  // 1. Embed the user query
  let queryEmbedding: number[]
  try {
    queryEmbedding = await embedQuery(message)
  } catch (e) {
    console.error("Embed failed:", e)
    return json({ error: "Embedding failed", detail: String(e) }, 500)
  }

  // 2. Hybrid retrieval
  const { data: matches, error: rpcErr } = await supabaseAdmin.rpc("match_content", {
    query_embedding: toPgVector(queryEmbedding),
    query_text: message,
    match_count: matchCount,
    category_filter: category,
  })
  if (rpcErr) {
    console.error("match_content RPC failed:", rpcErr)
    return json({ error: "Retrieval failed", detail: rpcErr.message }, 500)
  }
  const listings = matches || []

  // 3. Build the context block
  const contextBlock = buildContextBlock(listings)
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
      messages: [{ role: "user", content: userPrompt }],
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
    listings: listings.map((l: any) => ({
      id: l.id,
      name: l.name,
      category: l.category_slug,
      city: l.service_area,
      url_slug: l.url_slug,
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
