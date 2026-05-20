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
// THE 29 — Phase 4 Slice 1 batch (22 already in DB + 7 added via Google Places)
// ─────────────────────────────────────────────────────────────
const IDS_TO_ENRICH = [
  // 22 already in DB (Bay Area, verified)
  'ff56b980-6b39-4986-beac-5701bd91690e',  // Pakwan Restaurant (Hayward)
  '78203a70-daea-450c-8bdf-fd0e88f5bf7d',  // Bismillah Restaurant (Fremont)
  '2adb11a2-399a-49e5-b9e7-f40aa15ab3a0',  // Charminar Indian Restaurant (Fremont)
  '1eec1518-236e-4e3f-b0b0-4904fbb1dcd5',  // DeAfghanan Cuisine (Fremont)
  '46d5e16b-0be1-4336-a6f7-52d415dac37d',  // Khan Karahi Kabob (Fremont)
  '57034160-2abd-4048-b9a7-6fb3af56e7ab',  // Falafel Flare Hayward
  '27c10d9d-53a0-4e61-a4cb-f1ac3f23b6c8',  // Ghazni Afghan kabobs & Restaurant (Hayward)
  '71e9d468-c63a-42a0-98dc-71234ef0384f',  // Moon Indian Restaurant (Hayward)
  '50338d84-d8c9-4321-9986-8f43a717fe74',  // Khyber Pass Kabob (Dublin)
  'fb4d61b8-fc36-40f9-87ab-16797a0a8580',  // Shalimar Restaurant (Dublin)
  '959b15e9-981a-45bc-b948-7b8857b5aea6',  // Helmand Palace (SF)
  '15e2c41b-1d18-469f-ba40-96947fffc800',  // Aicha (SF)
  'fdaa6ca7-629a-4deb-8a85-a07e25977480',  // Bae Tea Yemen & Arabian Coffee (San Jose)
  '0ca9aec8-4fc6-44d6-85cb-01a72ade469b',  // Gulzaar Halal Restaurant & Catering (San Jose)
  '70629bf1-93de-455b-b743-2dada4856250',  // Dishdash (Sunnyvale)
  '1be28a9d-37bf-4207-b6b6-352bee6bc5e7',  // Heyma Yemeni Coffee (Berkeley)
  '75fa9539-7875-45db-ad68-b6f0823b61a2',  // Afghan Awasana Kabob House (Fremont)
  'ad32b455-0b5f-47a2-b6fa-560b0d521a53',  // Jubba Somali Restaurant (San Jose)
  '44aedb00-558f-4361-898c-a04bce64a473',  // Fremont Afghan Kabob (Fremont)
  '92127ac6-683b-4a06-a08e-e70051efc9cb',  // Kabana Restaurant (Berkeley)
  '8bab27bc-8cd3-4751-a4d2-d0efcad05631',  // Zareen's Restaurant (Palo Alto)
  '4880c89c-1693-40cc-82c0-eb2522386fc6',  // Mirchi Cafe and Masala Pizza (Dublin)
  // 7 newly added via Google Places (2026-05-20)
  'd3418eb2-f68a-4afb-aa64-909975732566',  // Bundoo Khan (Fremont)
  'b05c418b-c77a-4af6-9be9-b9f2c8b5f6f2',  // Maya Halal Taqueria (Union City)
  '7a39ce07-fb15-4b4c-b2d9-aeaf87cdc981',  // Zareen's (Redwood City)
  '0b6483ef-1436-4359-aa8e-82d30b9d3684',  // MAZRA (Redwood City)
  'e82030bf-2811-4951-a518-8fe137769f78',  // HalalStreet Hot Pot | Newark
  'ee99f80f-957b-4d04-9929-6bf5f832b5d4',  // Ma's Restaurant (San Jose)
  'e67fac44-92e7-48d3-99da-4955c1299d7b',  // Crave Subs (Hayward)
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
