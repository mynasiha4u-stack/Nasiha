#!/usr/bin/env node
/**
 * audit-place-id-matches.js — READ-ONLY audit. No data changes.
 *
 * For every Bay Area published restaurant that has both a google_place_id AND
 * an address, call Google Place Details on the stored place_id, compare the
 * returned formatted_address against the row's address, categorize:
 *
 *   MATCH      — zip codes (or city as fallback) match
 *   MISMATCH   — zip/city disagree → likely wrong place_id assigned
 *   AMBIGUOUS  — couldn't extract zip/city from one side; needs human eye
 *   ERROR      — Google rejected the place_id (NOT_FOUND, REQUEST_DENIED, etc.)
 *
 * Usage:
 *   node scripts/audit-place-id-matches.js [--limit N]
 *
 * Cost: 1 Place Details call per row (~$17/1000, free under Pro SKU). For
 * ~287 rows that's ~$5 list price, $0 effective.
 * Time: ~1.5 min (throttled to 5 QPS).
 */

require('./_loadenv')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY

if (!SERVICE_KEY) { console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1) }
if (!GOOGLE_KEY)  { console.error('ERROR: GOOGLE_MAPS_API_KEY required');     process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const THROTTLE_MS = 200

const limitIdx = process.argv.indexOf('--limit')
const LIMIT = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity

// Same helpers as enrich-restaurant.js (kept duplicated to keep this script standalone)
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
function classify(rowAddr, googleAddr) {
  if (!rowAddr || !googleAddr) return { code: 'AMBIGUOUS', reason: 'one address missing' }
  const zipA = extractZip(rowAddr), zipB = extractZip(googleAddr)
  if (zipA && zipB) {
    if (zipA === zipB) return { code: 'MATCH',    reason: `zip ${zipA}` }
    return                    { code: 'MISMATCH', reason: `zip ${zipA} vs ${zipB}` }
  }
  const cityA = extractCity(rowAddr), cityB = extractCity(googleAddr)
  if (cityA && cityB) {
    if (cityA === cityB) return { code: 'MATCH',    reason: `city ${cityA} (no zip)` }
    return                      { code: 'MISMATCH', reason: `city ${cityA} vs ${cityB} (no zip)` }
  }
  return { code: 'AMBIGUOUS', reason: 'cannot extract zip or city from one side' }
}

async function getPlaceFormattedAddress(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,name&key=${GOOGLE_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK') return { error: data.status, message: data.error_message || '' }
  return { name: data.result?.name, formatted: data.result?.formatted_address || '' }
}

async function main() {
  console.log('Fetching candidates (Bay Area, published, has place_id + address)...')
  const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'restaurants').single()
  const { data, error } = await supabase.from('content')
    .select('id, name, address, google_place_id')
    .eq('category_id', cat.id)
    .eq('status', 'published')
    .eq('metro', 'Bay Area')
    .not('google_place_id', 'is', null)
    .not('address', 'is', null)
    .limit(2000)
  if (error) { console.error(error); process.exit(1) }

  const todo = data.slice(0, LIMIT)
  console.log(`  ${todo.length} rows to audit (of ${data.length} candidates).\n`)

  const results = { MATCH: [], MISMATCH: [], AMBIGUOUS: [], ERROR: [] }
  for (let i = 0; i < todo.length; i++) {
    const r = todo[i]
    const res = await getPlaceFormattedAddress(r.google_place_id)
    if (res.error) {
      results.ERROR.push({ ...r, error: `${res.error} ${res.message}` })
    } else {
      const cls = classify(r.address, res.formatted)
      results[cls.code].push({ ...r, google_addr: res.formatted, google_name: res.name, reason: cls.reason })
    }
    process.stdout.write(`\r  ${i + 1}/${todo.length}  match=${results.MATCH.length}  mismatch=${results.MISMATCH.length}  amb=${results.AMBIGUOUS.length}  err=${results.ERROR.length}`)
    await new Promise(r => setTimeout(r, THROTTLE_MS))
  }
  process.stdout.write('\n\n')

  // Report
  console.log('═'.repeat(80))
  console.log(`SUMMARY — ${todo.length} rows audited`)
  console.log('═'.repeat(80))
  console.log(`  MATCH:     ${results.MATCH.length}  (${Math.round(results.MATCH.length / todo.length * 100)}%)`)
  console.log(`  MISMATCH:  ${results.MISMATCH.length}  ← these likely have the wrong place_id`)
  console.log(`  AMBIGUOUS: ${results.AMBIGUOUS.length}  ← need human eye`)
  console.log(`  ERROR:     ${results.ERROR.length}  ← Google rejected the place_id`)
  console.log()

  if (results.MISMATCH.length > 0) {
    console.log('─'.repeat(80))
    console.log('MISMATCH details:')
    console.log('─'.repeat(80))
    for (const r of results.MISMATCH) {
      console.log(`  [${r.id}]  ${r.name}`)
      console.log(`     row addr:    ${r.address}`)
      console.log(`     google addr: ${r.google_addr}   (Google name: "${r.google_name}")`)
      console.log(`     reason:      ${r.reason}`)
      console.log()
    }
  }

  if (results.AMBIGUOUS.length > 0) {
    console.log('─'.repeat(80))
    console.log('AMBIGUOUS details (first 10):')
    console.log('─'.repeat(80))
    for (const r of results.AMBIGUOUS.slice(0, 10)) {
      console.log(`  [${r.id}]  ${r.name}`)
      console.log(`     row addr:    ${r.address}`)
      console.log(`     google addr: ${r.google_addr}`)
      console.log(`     reason:      ${r.reason}`)
      console.log()
    }
    if (results.AMBIGUOUS.length > 10) console.log(`  …+${results.AMBIGUOUS.length - 10} more`)
  }

  if (results.ERROR.length > 0) {
    console.log('─'.repeat(80))
    console.log('ERROR details:')
    console.log('─'.repeat(80))
    for (const r of results.ERROR) {
      console.log(`  [${r.id}]  ${r.name}  —  ${r.error}`)
    }
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
