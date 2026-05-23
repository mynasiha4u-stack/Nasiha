#!/usr/bin/env node
/**
 * assign-place-id.js — assign a specific Google place_id to a content row by URL,
 * verify with the same defensive checks enrich-restaurant.js now applies, then
 * trigger enrichment so the row gets reviews / photos / AI summary immediately.
 *
 * Usage:
 *   node scripts/assign-place-id.js <content_id> "<google_maps_url>"
 *
 * Why this exists: when enrich-restaurant.js refuses a row (address mismatch
 * or place_id collision), the operator drops in here with the verified Google
 * Maps URL of the correct restaurant. This script parses the URL, finds the
 * real place_id, verifies, assigns, and re-enriches.
 *
 * URL parsing — Google Maps place URLs look like:
 *   .../place/<Name>/@<viewport>/data=...!3d<lat>!4d<lng>!...
 * We pull <Name>, <lat>, and <lng> and use findplacefromtext with locationbias
 * to get the canonical place_id (the URL's `1s` field is a hex CID, not a
 * place_id — they're different identifiers).
 */

require('./_loadenv')
const { createClient } = require('@supabase/supabase-js')
const { enrichRestaurant } = require('./enrich-restaurant')

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY

if (!SERVICE_KEY) { console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1) }
if (!GOOGLE_KEY)  { console.error('ERROR: GOOGLE_MAPS_API_KEY required');     process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ─────────────── URL parsing ───────────────
function parseGoogleMapsUrl(url) {
  // /place/<Name>/  — name component
  const nameMatch = url.match(/\/place\/([^/@]+)/)
  const name = nameMatch
    ? decodeURIComponent(nameMatch[1].replace(/\+/g, ' '))
    : null
  // !3d<lat>!4d<lng> — actual pin position (different from @<viewport>)
  const latMatch = url.match(/!3d(-?[\d.]+)/)
  const lngMatch = url.match(/!4d(-?[\d.]+)/)
  return {
    name,
    lat: latMatch ? parseFloat(latMatch[1]) : null,
    lng: lngMatch ? parseFloat(lngMatch[1]) : null,
  }
}

// ─────────────── Google Places lookup with location bias ───────────────
async function findPlaceIdNearLatLng(name, lat, lng) {
  const input = encodeURIComponent(name)
  // locationbias=point:lat,lng strongly biases Google toward this coordinate.
  const url =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${input}&inputtype=textquery` +
    `&fields=place_id,name,formatted_address,geometry` +
    `&locationbias=point:${lat},${lng}` +
    `&key=${GOOGLE_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK' || !data.candidates?.length) {
    return { error: data.status || 'UNKNOWN', message: data.error_message || '' }
  }
  return { result: data.candidates[0] }
}

// ─────────────── Helpers shared with enrich-restaurant.js ───────────────
function extractZip(addr) {
  if (!addr) return null
  const m = addr.match(/\b\d{5}\b/g)
  return m ? m[m.length - 1] : null
}
function extractCity(addr) {
  if (!addr) return null
  const parts = addr.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length < 2) return null
  return parts[1].toLowerCase()
}
function addressesLooselyMatch(a, b) {
  if (!a || !b) return { ok: false, reason: 'one address missing' }
  const zipA = extractZip(a), zipB = extractZip(b)
  if (zipA && zipB) {
    if (zipA === zipB) return { ok: true, reason: `same zip ${zipA}` }
    return { ok: false, reason: `zip mismatch ${zipA} vs ${zipB}` }
  }
  const cityA = extractCity(a), cityB = extractCity(b)
  if (cityA && cityB) {
    if (cityA === cityB) return { ok: true, reason: `same city ${cityA}` }
    return { ok: false, reason: `city mismatch ${cityA} vs ${cityB}` }
  }
  return { ok: false, reason: 'cannot extract zip or city' }
}

async function main() {
  const [contentId, mapsUrl] = process.argv.slice(2)
  if (!contentId || !mapsUrl) {
    console.error('Usage: node scripts/assign-place-id.js <content_id> "<google_maps_url>"')
    process.exit(1)
  }

  // 1. Load the row
  const { data: row, error: rowErr } = await supabase
    .from('content')
    .select('id, name, address, google_place_id, status')
    .eq('id', contentId)
    .single()
  if (rowErr || !row) { console.error(`Content row not found: ${contentId}`); process.exit(1) }

  console.log(`\nRow: ${row.name}`)
  console.log(`     ${row.address || '(no address)'}`)
  console.log(`     current place_id: ${row.google_place_id || '(none)'}\n`)

  // 2. Parse the URL
  const parsed = parseGoogleMapsUrl(mapsUrl)
  if (!parsed.lat || !parsed.lng) {
    console.error('Could not extract lat/lng from URL. Expected format: ...!3d<lat>!4d<lng>...')
    process.exit(1)
  }
  console.log(`Parsed URL: name="${parsed.name}", lat=${parsed.lat}, lng=${parsed.lng}\n`)

  // 3. Look up place_id with location bias on the URL's coords
  const lookup = await findPlaceIdNearLatLng(parsed.name || row.name, parsed.lat, parsed.lng)
  if (lookup.error) {
    console.error(`Places lookup failed: ${lookup.error} ${lookup.message}`)
    process.exit(1)
  }
  const newPlaceId = lookup.result.place_id
  const newFormatted = lookup.result.formatted_address
  console.log(`Google returned: ${lookup.result.name}`)
  console.log(`                 ${newFormatted}`)
  console.log(`                 place_id: ${newPlaceId}\n`)

  // 4. Defensive: address-match against the row's address
  const cmp = addressesLooselyMatch(row.address, newFormatted)
  if (!cmp.ok) {
    console.error(`Refusing to assign — address mismatch (${cmp.reason}).`)
    console.error(`  row address:     ${row.address}`)
    console.error(`  Google address:  ${newFormatted}`)
    console.error(`Either update the row's address first, or pick a different URL.`)
    process.exit(1)
  }
  console.log(`✓ Address match (${cmp.reason})`)

  // 5. Defensive: uniqueness check
  const { data: dup } = await supabase.from('content')
    .select('id, name, address')
    .eq('google_place_id', newPlaceId)
    .neq('id', contentId)
    .maybeSingle()
  if (dup) {
    console.error(`Refusing to assign — place_id ${newPlaceId} already on:`)
    console.error(`  "${dup.name}" (${dup.id}) at ${dup.address}`)
    process.exit(1)
  }
  console.log(`✓ place_id is unique\n`)

  // 6. Assign
  const { error: upErr } = await supabase
    .from('content')
    .update({ google_place_id: newPlaceId })
    .eq('id', contentId)
  if (upErr) { console.error(`UPDATE failed: ${upErr.message}`); process.exit(1) }
  console.log(`✓ place_id assigned. Now enriching…\n`)

  // 7. Trigger enrichment
  try {
    const out = await enrichRestaurant(contentId)
    console.log(`\nDone. Enriched ${out.name}: ${out.sampled_reviews} reviews, ${out.photos_uploaded} photos.`)
  } catch (e) {
    console.error(`\nplace_id assigned but enrichment failed: ${e.message}`)
    console.error(`You can re-run: node scripts/enrich-restaurant.js ${contentId}`)
    process.exit(1)
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
