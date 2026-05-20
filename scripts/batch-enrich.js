#!/usr/bin/env node
/**
 * batch-enrich.js — runs enrich-restaurant for a list of content IDs with throttling.
 *
 * The list of IDs is a placeholder for now — populate after the 20 names are confirmed.
 * Currently the script will REFUSE TO RUN until you replace `IDS_TO_ENRICH` with actual IDs.
 * This is intentional: I don't want the script to silently run against the wrong rows.
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=... ANTHROPIC_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/batch-enrich.js [--dry-run]
 *
 * --dry-run resolves the IDs to names + addresses and prints what WOULD be enriched.
 * No real run defaults: pass IDs explicitly via the constant or wait until the 20 list is set.
 */

const { enrichRestaurant } = require('./enrich-restaurant')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ─────────────────────────────────────────────────────────────
// THE 20 — REPLACE THIS ARRAY ONCE THE LIST IS CONFIRMED
// Format: array of content UUIDs.
// ─────────────────────────────────────────────────────────────
const IDS_TO_ENRICH = [
  // Example shape:
  // '7b382bfe-e0f5-46b7-bf2b-af97c42b55b5', // Pakwan Restaurant
  // ... 19 more ...
]

const THROTTLE_MS = 500   // 2 QPS, way under any Google/Anthropic limit

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  if (IDS_TO_ENRICH.length === 0) {
    console.error('REFUSING TO RUN: IDS_TO_ENRICH is empty.')
    console.error('Fill in the 20 confirmed content UUIDs before running this script.')
    process.exit(1)
  }

  // Resolve IDs → names so we can confirm what we're about to enrich
  const { data: rows, error } = await supabase
    .from('content')
    .select('id, name, address, ai_enriched_at')
    .in('id', IDS_TO_ENRICH)
  if (error) throw error

  console.log(`Resolved ${rows.length} of ${IDS_TO_ENRICH.length} IDs.`)
  if (rows.length !== IDS_TO_ENRICH.length) {
    const found = new Set(rows.map(r => r.id))
    const missing = IDS_TO_ENRICH.filter(id => !found.has(id))
    console.error('Missing IDs (not found in content):', missing)
    process.exit(1)
  }

  for (const r of rows) {
    const ageNote = r.ai_enriched_at ? ` [already enriched ${r.ai_enriched_at}]` : ''
    console.log(`  ${r.name.padEnd(40).slice(0,40)} — ${r.address?.slice(0, 50) || '(no address)'}${ageNote}`)
  }

  if (dryRun) {
    console.log(`\nDRY RUN — no API calls, no DB writes.`)
    return
  }

  console.log(`\nEnriching ${rows.length} restaurants (throttled to ${1000/THROTTLE_MS} QPS)...`)
  let ok = 0, failed = 0
  const failures = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    process.stdout.write(`\r  [${i+1}/${rows.length}] ${r.name.slice(0, 35).padEnd(35)}`)
    try {
      const result = await enrichRestaurant(r.id)
      ok++
      process.stdout.write(`  ✓ ${result.sampled_reviews} reviews, ${result.photos_uploaded} photos\n`)
    } catch (e) {
      failed++
      failures.push({ id: r.id, name: r.name, error: e.message })
      process.stdout.write(`  ✗ ${e.message}\n`)
    }
    await new Promise(res => setTimeout(res, THROTTLE_MS))
  }

  console.log(`\nDone. ${ok} succeeded, ${failed} failed.`)
  if (failures.length > 0) {
    console.log(`\nFailures:`)
    for (const f of failures) console.log(`  [${f.name}] ${f.error}`)
  }
}

if (!SERVICE_KEY) { console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1) }

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
