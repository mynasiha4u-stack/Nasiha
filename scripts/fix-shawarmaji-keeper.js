#!/usr/bin/env node
/**
 * fix-shawarmaji-keeper.js — one-off fix for the Shawarmaji Oakland keeper row.
 *
 * Background: there's only ONE real Shawarmaji in Oakland (2100 Franklin St
 * Suite 2190). The DB had two rows, both with wrong addresses. We're keeping
 * row 60cf4906 (already enriched), updating its address to the correct one,
 * and clearing its google_place_id so next enrich resolves the correct one.
 *
 * What this script does:
 *   1. UPDATE content set address = correct, google_place_id = NULL
 *      WHERE id = 60cf4906
 *   2. Trigger enrich-restaurant on that id so it re-resolves with the new
 *      address (defensive checks now in place will guard against mis-match).
 *
 * Usage:
 *   node scripts/fix-shawarmaji-keeper.js --dry-run
 *   node scripts/fix-shawarmaji-keeper.js
 */

require('./_loadenv')
const { createClient } = require('@supabase/supabase-js')
const { enrichRestaurant } = require('./enrich-restaurant')

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) { console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1) }
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const DRY_RUN = process.argv.includes('--dry-run')
const KEEPER_ID = '60cf4906-832c-45df-b28d-4bb9497f9036'
const CORRECT_ADDRESS = '2100 Franklin St Suite 2190, Oakland, CA 94612, USA'

async function main() {
  const { data: row, error } = await supabase.from('content')
    .select('id, name, address, google_place_id, ai_enriched_at')
    .eq('id', KEEPER_ID)
    .single()
  if (error || !row) { console.error('Keeper row not found.'); process.exit(1) }

  console.log(`──── Shawarmaji keeper (60cf4906) ────`)
  console.log(`  current name:     ${row.name}`)
  console.log(`  current address:  ${row.address || '(none)'}`)
  console.log(`  current place_id: ${row.google_place_id || '(none)'}`)
  console.log(`  enriched at:      ${row.ai_enriched_at || '(never)'}`)
  console.log()
  console.log(`  → will set address = "${CORRECT_ADDRESS}"`)
  console.log(`  → will clear google_place_id`)
  console.log(`  → will then re-enrich (new place_id resolved with defensive checks)`)
  console.log()

  if (DRY_RUN) {
    console.log('DRY RUN — no writes. Re-run without --dry-run to apply.')
    return
  }

  const { error: upErr } = await supabase.from('content')
    .update({ address: CORRECT_ADDRESS, google_place_id: null })
    .eq('id', KEEPER_ID)
  if (upErr) { console.error(`UPDATE failed: ${upErr.message}`); process.exit(1) }
  console.log(`✓ address + place_id updated. Re-enriching…\n`)

  try {
    const out = await enrichRestaurant(KEEPER_ID)
    console.log(`\n✓ Done. ${out.name}: ${out.sampled_reviews} reviews, ${out.photos_uploaded} photos.`)
    console.log(`  new place_id: ${out.place_id}`)
  } catch (e) {
    console.error(`\nplace_id cleared + address fixed, but enrichment failed: ${e.message}`)
    console.error(`Re-run: node scripts/enrich-restaurant.js ${KEEPER_ID}`)
    process.exit(1)
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
