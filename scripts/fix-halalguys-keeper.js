#!/usr/bin/env node
/**
 * fix-halalguys-keeper.js — one-off fix for The Halal Guys Fremont keeper.
 *
 * Background: there's only one Halal Guys at the Pacific Commons mall in
 * Fremont, but our DB had two rows with two different street references for
 * the same physical place (Pacific Commons Blvd and Curie St). Nas confirmed
 * the OFFICIAL/correct address is "5338 Curie St, Fremont, CA 94538".
 *
 * The keeper row (72279cea) holds the enrichment (place_id, photos, AI
 * summary, 586 reviews) — we don't want to lose that. We just correct its
 * address string. The place_id stays valid (it's Google's canonical id for
 * the restaurant regardless of street string).
 *
 * Sequence:
 *   1. UPDATE content
 *      SET address = '5338 Curie St, Fremont, CA 94538, USA'
 *      WHERE id = 72279cea
 *   2. (separately, via archive-listings.js) archive the dup row 023d7ac1
 *
 * This script does step 1 only. Step 2 is the existing archive-listings.js.
 *
 * We deliberately do NOT clear google_place_id or re-enrich. The current
 * place_id is correct for this physical restaurant. After this UPDATE, the
 * audit script may flag this row as MISMATCH (zip matches but street differs
 * from Google's formatted_address) — that's expected and benign. The
 * formatted_address Google holds is "43840 Pacific Commons Blvd" because
 * that's the mall's primary address in Google's index; the restaurant is the
 * same physical location either way.
 *
 * Usage:
 *   node scripts/fix-halalguys-keeper.js --dry-run
 *   node scripts/fix-halalguys-keeper.js
 */

require('./_loadenv')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) { console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1) }
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const DRY_RUN = process.argv.includes('--dry-run')
const KEEPER_ID = '72279cea-9b17-4d01-b22a-4d3e012cd445'
const CORRECT_ADDRESS = '5338 Curie St, Fremont, CA 94538, USA'

async function main() {
  const { data: row, error } = await supabase.from('content')
    .select('id, name, address, google_place_id, google_rating, google_review_count, ai_enriched_at, photos')
    .eq('id', KEEPER_ID)
    .single()
  if (error || !row) { console.error('Keeper row not found.'); process.exit(1) }

  console.log(`──── Halal Guys keeper (${KEEPER_ID}) ────`)
  console.log(`  current name:     ${row.name}`)
  console.log(`  current address:  ${row.address || '(none)'}`)
  console.log(`  place_id:         ${row.google_place_id || '(none)'}`)
  console.log(`  Google rating:    ${row.google_rating ?? '?'}/5 · ${row.google_review_count ?? '?'} reviews`)
  console.log(`  enriched_at:      ${row.ai_enriched_at || '(never)'}`)
  console.log(`  photos:           ${Array.isArray(row.photos) ? row.photos.length + ' photos' : 'none'}`)
  console.log()
  console.log(`  → will set address = "${CORRECT_ADDRESS}"`)
  console.log(`  → place_id, enrichment, photos all PRESERVED`)
  console.log(`  → (separately) archive duplicate row 023d7ac1 via archive-listings.js`)
  console.log()

  if (DRY_RUN) {
    console.log('DRY RUN — no writes. Re-run without --dry-run to apply.')
    return
  }

  const { error: upErr } = await supabase.from('content')
    .update({ address: CORRECT_ADDRESS })
    .eq('id', KEEPER_ID)
  if (upErr) { console.error(`UPDATE failed: ${upErr.message}`); process.exit(1) }
  console.log(`✓ Keeper address updated. Now run archive-listings.js to archive the duplicate row.`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
