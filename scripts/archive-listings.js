#!/usr/bin/env node
/**
 * archive-listings.js — archive 5 specific content rows determined invalid
 * during Phase 4 sweep cleanup. Sets status='archived' + appends a note to
 * internal_notes explaining why.
 *
 * The 5 rows were verified manually against Google Maps and either:
 *   - are duplicates of correctly-enriched rows
 *   - are permanently closed
 *   - are phantom listings (no real restaurant at the address)
 *
 * Usage:
 *   node scripts/archive-listings.js --dry-run   # show the rows + plan, no writes
 *   node scripts/archive-listings.js             # actually archive
 *
 * Re-runnable: if a row is already archived, skip it.
 */

require('./_loadenv')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) { console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1) }
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const DRY_RUN = process.argv.includes('--dry-run')

// Each row was reviewed manually. Reason becomes the internal_notes append.
const TO_ARCHIVE = [
  {
    id: 'dcf81fc5-5f19-420a-b39c-12f3ced84174',
    label: 'Shawarmaji (2128 Broadway, Oakland) — duplicate',
    reason: 'Archived 2026-05-23: only one Shawarmaji exists in Oakland (2100 Franklin St). This row had a wrong Broadway address; keeper row 60cf4906 was updated to the correct Franklin St address.',
  },
  {
    id: '40f4174e-faee-48a0-9cba-d4368ba79041',
    label: 'Bab Al-Yemen (10 Hegenberger Rd, Oakland) — closed',
    reason: 'Archived 2026-05-23: permanently closed per Google Maps verification.',
  },
  {
    id: '576642f5-07c8-4c91-ace9-3ca83da380dc',
    label: 'Bab Al-Yemen (5916 International Blvd, Oakland) — closed',
    reason: 'Archived 2026-05-23: permanently closed per Google Maps verification (despite prior AI enrichment).',
  },
  {
    id: '023d7ac1-adab-4854-9c74-71053a812fd9',
    label: 'The Halal Guys (5338 Curie St, Fremont) — phantom',
    reason: 'Archived 2026-05-23: no Halal Guys exists at this address per Google Maps. Likely a phantom KML import row. The real Fremont Halal Guys is at Pacific Commons (separate row, correctly enriched).',
  },
  {
    id: 'fd7c888c-e96b-4b07-a8fe-0871a4d5722e',
    label: "Ike's Sandwiches (College Av & Claremont Av, Oakland) — phantom",
    reason: 'Archived 2026-05-23: no Ike\'s exists at this intersection per Google Maps. Likely a phantom KML import row.',
  },
]

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN — no writes' : 'WRITE'}`)
  console.log(`${TO_ARCHIVE.length} rows queued for archive.\n`)

  for (const entry of TO_ARCHIVE) {
    const { data: row, error } = await supabase.from('content')
      .select('id, name, address, status, internal_notes, ai_enriched_at')
      .eq('id', entry.id)
      .maybeSingle()
    if (error) { console.log(`  ✗ ${entry.label} — fetch error: ${error.message}`); continue }
    if (!row) { console.log(`  ✗ ${entry.label} — row not found in DB`); continue }

    console.log(`──── ${entry.label} ────`)
    console.log(`  id:       ${row.id}`)
    console.log(`  name:     ${row.name}`)
    console.log(`  address:  ${row.address || '(none)'}`)
    console.log(`  status:   ${row.status}`)
    console.log(`  enriched: ${row.ai_enriched_at ? 'yes' : 'no'}`)
    console.log(`  reason:   ${entry.reason}`)

    if (row.status === 'archived') {
      console.log(`  → already archived, skipping`)
      console.log()
      continue
    }

    if (DRY_RUN) {
      console.log(`  → [dry-run] would set status='archived' + append to internal_notes`)
      console.log()
      continue
    }

    const newNotes = [row.internal_notes, entry.reason].filter(Boolean).join('\n\n')
    const { error: upErr } = await supabase.from('content')
      .update({ status: 'archived', internal_notes: newNotes })
      .eq('id', entry.id)
    if (upErr) { console.log(`  ✗ UPDATE failed: ${upErr.message}`) }
    else       { console.log(`  ✓ archived`) }
    console.log()
  }

  if (DRY_RUN) console.log('DRY RUN — no writes. Re-run without --dry-run to apply.')
  else console.log('Done.')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
