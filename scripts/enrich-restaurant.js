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
const DISTILL_SYSTEM = `You distill restaurant reviews into structured insights for a halal restaurant directory.

Output ONLY a single JSON object matching this schema. No prose, no markdown fences.

{
  "known_for_dishes":   [string, ...],   // 3-5 specific dishes mentioned most often in reviews. Empty array if reviews don't mention specific dishes.
  "vibe":               string,          // 1 short sentence on atmosphere/service style (e.g. "casual family spot, no frills, focus on the food")
  "praise_themes":      [string, ...],   // 3-5 things customers consistently praise (short phrases, e.g. "generous portions", "authentic spices")
  "complaint_themes":   [string, ...],   // 2-3 recurring criticisms (short phrases). Empty array if no recurring complaints.
  "halal_notes":        string,          // any halal-related signals from reviews (e.g. "fully halal", "zabihah meat", "owner mentions halal certification"). Empty string if not mentioned.
  "recommended_for":    [string, ...]    // contexts the place is suited for (e.g. "families", "date night", "large catering", "quick weekday lunch", "takeout only")
}

Be HONEST. If reviews don't support a category strongly, return [] or "" — never invent. Each praise/complaint theme should be a SHORT phrase, not a sentence.`

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
      max_tokens: 800,
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
