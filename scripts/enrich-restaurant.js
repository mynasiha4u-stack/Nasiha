#!/usr/bin/env node
/**
 * enrich-restaurant.js — single-restaurant Phase 4 pipeline.
 *
 * For a given content row:
 *   1. Look up the Google place_id from name + address (Place Find Text)
 *   2. Fetch Place Details (rating, count, up to 5 reviews, photo refs)
 *   3. Upload top 3 photos to Supabase Storage at listing-images/google/<place_id>/N.jpg
 *   4. Insert each review into the `signals` table (idempotent via UNIQUE (source, source_id))
 *   5. Run Claude Haiku 4.5 to distill structured insights
 *   6. UPDATE content with ai_enriched_summary + google_* + photos
 *
 * Idempotent. Re-running on the same row replaces summary + skips already-imported reviews.
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=... ANTHROPIC_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/enrich-restaurant.js <content-id>
 *
 * Module API: enrichRestaurant(contentId) — exported for batch use.
 */

require('./_loadenv')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_KEY  = process.env.GOOGLE_MAPS_API_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const CHAT_MODEL = 'claude-haiku-4-5-20251001'

if (!SERVICE_KEY) { console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1) }
if (!GOOGLE_KEY)  { console.error('ERROR: GOOGLE_MAPS_API_KEY required');     process.exit(1) }
if (!ANTHROPIC_KEY) { console.error('ERROR: ANTHROPIC_API_KEY required');     process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ─────────────────────────────────────────────────────────────
// Google Places: find + details + photo
// ─────────────────────────────────────────────────────────────
async function findPlaceId(name, address) {
  const query = encodeURIComponent(`${name} ${address || ''}`.trim())
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id,name,formatted_address&key=${GOOGLE_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK' || !data.candidates?.length) {
    return { error: data.status || 'UNKNOWN', message: data.error_message || '' }
  }
  return { place_id: data.candidates[0].place_id, matched: data.candidates[0] }
}

async function getPlaceDetails(placeId) {
  const fields = [
    'name', 'formatted_address', 'formatted_phone_number', 'website',
    'rating', 'user_ratings_total', 'price_level',
    'reviews', 'photos', 'types', 'opening_hours',
  ].join(',')
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK') {
    return { error: data.status, message: data.error_message || '' }
  }
  return { result: data.result }
}

// Returns Buffer (the jpeg bytes). Places Photo redirects to the actual image URL.
async function fetchPlacePhoto(photoReference, maxWidth = 800) {
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_KEY}`
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`Photo fetch failed: ${res.status}`)
  const arrayBuf = await res.arrayBuffer()
  return new Uint8Array(arrayBuf)
}

// ─────────────────────────────────────────────────────────────
// Claude distillation — structured JSON via prefilled `{`
// ─────────────────────────────────────────────────────────────
const DISTILL_SYSTEM = `You are summarizing Google reviews for a Muslim community directory called Nasiha. Your output drives both a public restaurant listing page and an AI chat that helps people find places to eat. Quality matters — this prompt will run across thousands of restaurants, so every word you write needs to differentiate this restaurant from the next one in its category.

Your job: read the provided reviews and return a single JSON object matching the schema below. Be specific, honest, and useful. Never invent details that aren't supported by the reviews.

CORE RULES — read carefully, these are non-negotiable:

1. No filler vocabulary. Words like "cozy," "warm," "welcoming," "casual," "family-friendly," "family-owned," "authentic," "delicious," "great food" are banned as primary descriptors. They are not wrong, they are empty — they apply to every restaurant. You may use them only if combined with a specific detail that makes them meaningful (e.g., "family-owned by the original Lahore chef's daughter" is fine; "family-owned" alone is not).

2. Evidence threshold for every claim. A theme, dish, or tag is only included if either:
   - At least 2 separate reviewers mention it, OR
   - One reviewer mentions it with concrete specifics (a named dish, a specific scenario, a verifiable fact)
   Single vague mentions ("good service," "loved the food") do not qualify.

3. Specific beats general, every time. "Chapli kabab with house green chutney" beats "good kababs." "Counter-order, 30 seats, gets a midday office crowd" beats "casual." If you cannot be specific, omit the field rather than fill it.

4. Honest about thin data. If only 1-3 reviews are provided or reviews are vague, your summary should be shorter and you should set "confidence": "low". Do not pad. Better to say less and be right than say more and guess.

   IMPORTANT EXCEPTION — sparse listing fill rule: even when overall confidence is "low", you should STILL fill "vibe" and "known_for_dishes" with whatever neutral structural info exists in the reviews (seating type, what dishes are named at all, basic order pattern). A sparse listing with nothing in vibe / known_for_dishes is uninformative. Only leave these fields null/empty if the reviews truly contain nothing usable about them. The other fields (signature_strength, praise_themes, complaint_themes, occasion_tags) should still respect the evidence threshold and may stay empty.

5. No marketing voice. Write like a knowledgeable friend giving a tip, not a brochure. Avoid superlatives unless specifically supported. Restraint signals trustworthiness.

OUTPUT SCHEMA:

{
  "known_for_dishes": [
    "Up to 5 specific dishes that reviewers repeatedly name. Use the dish names as customers say them (e.g., 'chapli kabab', not 'minced meat patty'). Order by frequency of mention. If fewer than 3 dishes have strong support, return fewer."
  ],
  "signature_strength": "One sentence on what this restaurant does better than the typical place in its category. Must be specific and supported by multiple reviews. If no clear standout exists, return null — do not invent one.",
  "vibe": "One or two sentences describing the physical space and atmosphere through concrete specifics: seating type, decor, noise, crowd, service style, time of day patterns. Avoid generic comfort words unless paired with specifics. Example: 'Counter-order setup with 25 seats and a steady weekday lunch crowd of nearby office workers; bright fluorescent lighting, paper plates, no frills.' Not: 'Casual and welcoming family spot.'",
  "praise_themes": [
    "Up to 4 distinctive things reviewers consistently praise. Each item must be specific (not 'good food' or 'friendly staff'). Format: short noun phrase, no marketing language. Example: 'Bread baked to order in visible tandoor' not 'fresh bread'."
  ],
  "complaint_themes": [
    "Up to 3 patterns of complaint that appear across multiple reviews. Single one-off complaints do not qualify. Include only patterns. Be neutral — describe, don't judge. Example: 'Service noticeably slow on Friday evenings' not 'terrible service'."
  ],
  "halal_notes": "What the reviews and restaurant info actually say about halal status. Possible values: explicit halal claim with detail, implicit (no alcohol / Muslim-owned cues), unclear, or null. If unclear, say 'No explicit halal information in reviews — verify with restaurant.' Never assume halal without evidence.",
  "occasion_tags": [
    "Array drawn ONLY from this fixed vocabulary of 13 tags. Multiple tags allowed. Include a tag ONLY if reviews or venue characteristics genuinely support it:",
    "date_night              — quieter atmosphere, ambiance suitable for adult conversation, dressier or memorable setting",
    "family_with_kids        — kid menu, high chairs, tolerant of noise/mess, family-portion options",
    "big_groups              — accommodates 8+, long tables, family-style platters, group reservations",
    "outdoor_seating         — patio, sidewalk seating, garden",
    "late_night              — open past 10pm with full menu",
    "quick_lunch             — counter service or fast turnaround, eat in under 30 min",
    "business_meeting        — quiet enough for conversation, professional atmosphere",
    "prayer_facilities       — prayer room or accommodations mentioned",
    "takeout_friendly        — well-suited for takeout (sturdy packaging, items travel well, dedicated pickup)",
    "large_catering_orders   — explicitly takes catering, party trays, or large group orders",
    "vegetarian_friendly     — meaningful vegetarian selection beyond a token dish; reviewers mention vegetarian options favorably",
    "solo_friendly           — comfortable to eat alone (counter/bar seating, quick meals, no awkwardness mentioned)",
    "cheap_eats              — under ~\\$15/person for a full meal; reviewers note value or affordable pricing",
    "If the reviews don't support a tag, leave it off. Do not guess. Better to return [] than to invent.",
    "DO NOT invent tags outside this list of 13."
  ],
  "minor_tags": [
    "Free-form short-phrase array of 3-7 atmospheric details that don't deserve to be filterable tags but add color to the listing. Examples: 'long-term ownership', 'menu in Urdu', 'prayer space available', 'Persian-Afghan fusion', 'regulars greeted by name'. Keep each short and supported by reviews. These are NOT user-filterable — distinct from occasion_tags."
  ],
  "good_for_summary": "One short phrase (5-10 words) capturing the strongest 'who is this place for' takeaway. Used as a tagline. Example: 'Quick weekday lunch for Pakistani office workers.' Not: 'Great food for everyone.'",
  "based_on": {
    "review_count": "integer — number of reviews analyzed",
    "avg_rating": "float — average rating from the source"
  },
  "confidence": "high | medium | low — based on review count and consistency. Use 'low' if fewer than 5 reviews or if reviews contradict each other significantly."
}

TONE CALIBRATION — examples of what good looks like:

❌ Bad: "Cozy family-owned spot with warm, welcoming atmosphere and authentic Pakistani flavors. Generous portions and friendly staff."
✅ Good: "Self-serve counter with about 30 seats, paper plates, busy at lunch with a regular office crowd. Owner often greets repeat customers by name. Order at the counter, food arrives in 5-10 minutes."

❌ Bad praise: "fresh ingredients, friendly staff, authentic flavors, generous portions"
✅ Good praise: "bread baked to order in visible tandoor", "chapli kabab made when ordered, not pre-cooked", "green chutney with strong cilantro and chili — distinctive"

❌ Bad complaint: "service is bad"
✅ Good complaint: "service noticeably slower on Friday evenings, multiple reviews mention 20-30 min waits"

❌ Bad halal note: "Halal food."
✅ Good halal note: "Multiple reviewers explicitly confirm halal; restaurant displays halal certification per one review."

❌ Bad occasion tags: ["date_night", "family_with_kids", "big_groups", "quick_lunch"] (everything checked, no discrimination)
✅ Good occasion tags: ["family_with_kids", "takeout_friendly"] (only what reviews actually support)

FINAL CHECK before returning JSON:
- Did I use any banned filler words as primary descriptors? Strip them.
- Is every claim supported by the reviews?
- Did I include any occasion tag without clear evidence? Remove it.
- Would another restaurant in this category produce a nearly identical summary? If yes, mine isn't specific enough — sharpen it.
- Did I match the schema exactly? No extra fields, no missing required fields.

Return ONLY the JSON object. No preamble, no explanation.`

function parseDistillJSON(text) {
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first === -1 || last === -1 || last < first) return null
  try { return JSON.parse(s.slice(first, last + 1)) } catch { return null }
}

async function distillReviews(restaurantName, details) {
  const reviews = details.reviews || []
  const reviewBlocks = reviews.map((r, i) => {
    const d = r.relative_time_description || ''
    return `[Review ${i + 1} — ${r.rating}/5 stars, ${d}, by ${r.author_name}]\n"${(r.text || '').replace(/\s+/g, ' ').slice(0, 800)}"`
  }).join('\n\n')

  const userPrompt = `Restaurant: ${restaurantName}
Google rating: ${details.rating || '?'} / 5  (${details.user_ratings_total || '?'} total reviews)
${details.formatted_address ? 'Address: ' + details.formatted_address : ''}
${details.types?.length ? 'Google categories: ' + details.types.join(', ') : ''}

Reviews:
${reviewBlocks || '(no review text available)'}

Distill into the JSON schema.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 1200,
      system: DISTILL_SYSTEM,
      messages: [
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: '{' }, // prefill — forces JSON output
      ],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const raw = '{' + (data.content?.[0]?.text || '')
  const parsed = parseDistillJSON(raw)
  if (!parsed) throw new Error(`Failed to parse distillation JSON: ${raw.slice(0, 300)}`)
  return parsed
}

// ─────────────────────────────────────────────────────────────
// Main per-restaurant enrichment
// ─────────────────────────────────────────────────────────────
async function enrichRestaurant(contentId) {
  // 1. Fetch the row
  const { data: row, error: rowErr } = await supabase
    .from('content')
    .select('id, name, address, google_place_id')
    .eq('id', contentId)
    .single()
  if (rowErr || !row) throw new Error(`Content row not found: ${contentId}`)

  // 2. Find or reuse place_id
  let placeId = row.google_place_id
  if (!placeId) {
    const lookup = await findPlaceId(row.name, row.address)
    if (lookup.error) throw new Error(`Place lookup failed: ${lookup.error} ${lookup.message}`)
    placeId = lookup.place_id
  }

  // 3. Fetch Place Details
  const detailsRes = await getPlaceDetails(placeId)
  if (detailsRes.error) throw new Error(`Place details failed: ${detailsRes.error} ${detailsRes.message}`)
  const details = detailsRes.result

  // 4. Upload top 3 photos
  const photoUrls = []
  for (const p of (details.photos || []).slice(0, 3)) {
    try {
      const bytes = await fetchPlacePhoto(p.photo_reference)
      const path = `google/${placeId}/${photoUrls.length}.jpg`
      const { error: upErr } = await supabase.storage.from('listing-images')
        .upload(path, bytes, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) {
        console.warn(`  photo upload skipped: ${upErr.message}`)
        continue
      }
      const { data: pub } = supabase.storage.from('listing-images').getPublicUrl(path)
      photoUrls.push(pub.publicUrl)
    } catch (e) {
      console.warn(`  photo skipped: ${e.message}`)
    }
  }

  // 5. Insert reviews into signals (idempotent via UNIQUE source+source_id)
  for (const r of (details.reviews || [])) {
    // Google review API doesn't expose a stable review id directly; compose one from author + time.
    const sourceId = `${placeId}:${r.author_name}:${r.time}`
    const payload = {
      content_id: contentId,
      source: 'google',
      source_id: sourceId,
      trust_tier: 1,
      raw_text: r.text || '',
      author: r.author_name || null,
      review_rating: r.rating ?? null,
      review_date: r.time ? new Date(r.time * 1000).toISOString() : null,
      raw_payload: r,
    }
    const { error: insErr } = await supabase.from('signals')
      .upsert(payload, { onConflict: 'source,source_id', ignoreDuplicates: false })
    if (insErr) console.warn(`  signal insert: ${insErr.message}`)
  }

  // 6. Claude distillation
  const summary = await distillReviews(row.name, details)
  summary.based_on = {
    review_count: details.user_ratings_total ?? null,
    avg_rating: details.rating ?? null,
    sampled_reviews: (details.reviews || []).length,
  }
  summary.last_enriched_at = new Date().toISOString()

  // 7. Update content
  const update = {
    ai_enriched_summary: summary,
    ai_enriched_at: new Date().toISOString(),
    google_place_id: placeId,
    google_rating: details.rating ?? null,
    google_review_count: details.user_ratings_total ?? null,
    photos: photoUrls.length > 0 ? photoUrls : null,
  }
  const { error: updErr } = await supabase.from('content').update(update).eq('id', contentId)
  if (updErr) throw new Error(`Content update failed: ${updErr.message}`)

  return {
    content_id: contentId,
    name: row.name,
    place_id: placeId,
    google_rating: details.rating,
    google_review_count: details.user_ratings_total,
    sampled_reviews: (details.reviews || []).length,
    photos_uploaded: photoUrls.length,
    summary,
  }
}

module.exports = { enrichRestaurant }

// CLI entry
if (require.main === module) {
  const id = process.argv[2]
  if (!id) {
    console.error('Usage: node scripts/enrich-restaurant.js <content-id>')
    process.exit(1)
  }
  enrichRestaurant(id)
    .then(out => { console.log(JSON.stringify(out, null, 2)) })
    .catch(e => { console.error('FATAL:', e.message); process.exit(1) })
}
