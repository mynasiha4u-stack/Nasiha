#!/usr/bin/env node
/**
 * dedup-listings.js
 *
 * Finds and merges duplicate content rows. A duplicate group is defined as:
 *   - same normalized name (lowercased, accents stripped, punctuation stripped,
 *     whitespace collapsed)
 *   - AND coordinates within ~100m of each other (lat/lng rounded to 3 decimal places)
 *
 * Conservative: avoids false positives by requiring BOTH a name match AND a
 * location match. Two different "Pakwan" branches in different cities won't merge.
 *
 * Within each duplicate group:
 *   - The CANONICAL row is the one with the most non-null fields (tiebreak: oldest created_at).
 *   - For each non-canonical row, any field that the canonical has NULL/empty gets
 *     copied from the dup. Then the dup's attributes and embeddings are moved or
 *     deleted, and the dup row itself is deleted.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/dedup-listings.js [--dry-run] [--limit N]
 *
 * Flags:
 *   --dry-run     Show duplicate groups + plan, no DB writes.
 *   --limit N     Only process the first N duplicate groups (useful for a smoke test).
 */

require('./_loadenv')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY env var is required.')
  process.exit(1)
}

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const limitIdx = argv.indexOf('--limit')
const LIMIT = limitIdx >= 0 ? parseInt(argv[limitIdx + 1], 10) : Infinity

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Fields used as merge inputs. Anything else stays on the canonical row.
const MERGE_FIELDS = [
  'description', 'address', 'phone', 'email', 'website', 'whatsapp',
  'instagram', 'facebook', 'image_url', 'service_area', 'metro',
  'jummah_times', 'tags', 'featured', 'verified',
]

function normalizeName(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip combining accent marks
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')      // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

// ~100m clustering: lat/lng rounded to 3 decimal places ≈ 110m * 0.001 = 110m
function coordKey(lat, lng) {
  if (lat == null || lng == null) return null
  return `${lat.toFixed(3)},${lng.toFixed(3)}`
}

function countNonNull(row) {
  let n = 0
  for (const k of Object.keys(row)) {
    const v = row[k]
    if (v == null) continue
    if (typeof v === 'string' && v.trim() === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    n++
  }
  return n
}

// Choose canonical: most non-null fields; tiebreak by oldest created_at.
function pickCanonical(rows) {
  return [...rows].sort((a, b) => {
    const da = countNonNull(a)
    const db = countNonNull(b)
    if (da !== db) return db - da
    return (a.created_at || '').localeCompare(b.created_at || '')
  })[0]
}

function isEmpty(v) {
  if (v == null) return true
  if (typeof v === 'string' && v.trim() === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  return false
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'}, limit=${LIMIT === Infinity ? 'none' : LIMIT}`)

  // 1. Fetch every published row (paginated)
  console.log('Fetching all published rows...')
  const rows = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase.from('content')
      .select('*')
      .eq('status', 'published')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`  ${rows.length} published rows.`)

  // 2. Group by (normalized name + coord cluster)
  const groups = new Map()
  for (const r of rows) {
    const name = normalizeName(r.name)
    if (!name) continue
    const ck = coordKey(r.display_lat, r.display_lng)
    if (!ck) continue
    const key = `${name}@${ck}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }

  // 3. Filter to actual duplicates (group size > 1)
  const dupGroups = [...groups.values()].filter(g => g.length > 1)
  console.log(`  ${dupGroups.length} duplicate groups detected.`)

  let totalDups = 0
  for (const g of dupGroups) totalDups += (g.length - 1)
  console.log(`  ${totalDups} rows would be merged into their canonical counterpart.\n`)

  // 4. Process each group up to LIMIT
  const groupsToProcess = dupGroups.slice(0, LIMIT)
  if (groupsToProcess.length === 0) {
    console.log('Nothing to do. Exiting.')
    return
  }

  console.log(`Sample groups (first 10 of ${dupGroups.length}):`)
  for (const g of dupGroups.slice(0, 10)) {
    const canonical = pickCanonical(g)
    const dups = g.filter(r => r.id !== canonical.id)
    console.log(`\n  "${canonical.name}" @ (${canonical.display_lat?.toFixed(4)}, ${canonical.display_lng?.toFixed(4)}) — ${g.length} rows`)
    console.log(`    KEEP: ${canonical.id} (${countNonNull(canonical)} non-null fields)`)
    for (const d of dups) {
      const wouldCopy = MERGE_FIELDS.filter(f => isEmpty(canonical[f]) && !isEmpty(d[f]))
      console.log(`    DEL : ${d.id} (${countNonNull(d)} non-null fields)${wouldCopy.length ? ' — copies: ' + wouldCopy.join(', ') : ''}`)
    }
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN — no DB writes.')
    return
  }

  // 5. Real run — merge each group
  console.log(`\nMerging ${groupsToProcess.length} groups...`)
  let mergedCount = 0
  let deletedRows = 0
  let failed = 0
  for (const g of groupsToProcess) {
    const canonical = pickCanonical(g)
    const dups = g.filter(r => r.id !== canonical.id)

    try {
      // 5a. Build patch for canonical.
      //   - For most fields: if canonical's field is empty, copy from any dup that has it.
      //   - For 'description' specifically: if canonical AND any dup both have text,
      //     concatenate the dup texts onto the end (separated by blank lines), skipping
      //     any dup text that is already contained in canonical (avoid duplication).
      //     This preserves info instead of silently dropping the dup's description.
      const patch = {}
      for (const f of MERGE_FIELDS) {
        if (isEmpty(canonical[f])) {
          for (const d of dups) {
            if (!isEmpty(d[f])) { patch[f] = d[f]; break }
          }
          continue
        }
        if (f === 'description') {
          const parts = [canonical[f]]
          for (const d of dups) {
            if (isEmpty(d[f])) continue
            const dt = d[f].trim()
            // Skip if any existing part fully contains this text (or vice versa).
            // This catches the common case of the same description copy-pasted twice.
            if (parts.some(p => p.includes(dt) || dt.includes(p))) continue
            parts.push(dt)
          }
          if (parts.length > 1) {
            patch[f] = parts.join('\n\n')
          }
        }
      }
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from('content').update(patch).eq('id', canonical.id)
        if (error) throw new Error(`update canonical: ${error.message}`)
      }

      // 5b. Move attributes from dups to canonical (avoid duplicate (content_id, name, value) collisions)
      // First: pull canonical's existing attributes to avoid re-adding them
      const { data: canonAttrs } = await supabase.from('attributes')
        .select('attribute_name, attribute_value')
        .eq('content_id', canonical.id)
      const existingAttrSet = new Set((canonAttrs || []).map(a => `${a.attribute_name}=${a.attribute_value}`))

      for (const d of dups) {
        const { data: dAttrs } = await supabase.from('attributes')
          .select('id, attribute_name, attribute_value')
          .eq('content_id', d.id)
        for (const a of dAttrs || []) {
          const tag = `${a.attribute_name}=${a.attribute_value}`
          if (existingAttrSet.has(tag)) {
            // dup attribute already on canonical — just delete the dup's
            await supabase.from('attributes').delete().eq('id', a.id)
          } else {
            await supabase.from('attributes').update({ content_id: canonical.id }).eq('id', a.id)
            existingAttrSet.add(tag)
          }
        }
      }

      // 5c. Delete the dup rows. content_embeddings has FK ON DELETE CASCADE from migration 9
      // so embeddings get cleaned up automatically. If any other FK exists without CASCADE,
      // it'd error and we'd see it in the failed count.
      for (const d of dups) {
        const { error } = await supabase.from('content').delete().eq('id', d.id)
        if (error) throw new Error(`delete dup ${d.id}: ${error.message}`)
        deletedRows++
      }

      mergedCount++
    } catch (e) {
      console.error(`\n  Group "${canonical.name}" failed: ${e.message}`)
      failed++
    }
    process.stdout.write(`\r  ${mergedCount + failed}/${groupsToProcess.length}  (merged ${mergedCount}, deleted ${deletedRows}, failed ${failed})`)
  }
  process.stdout.write('\n')
  console.log(`\nDone. ${mergedCount} groups merged, ${deletedRows} duplicate rows deleted, ${failed} failed.`)
}

main().catch(e => {
  console.error('\nFATAL:', e)
  process.exit(1)
})
