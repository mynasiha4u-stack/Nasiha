#!/usr/bin/env node
/**
 * sweep-enrich.js — Phase 4 scale-out: enrich every published Bay Area restaurant.
 *
 * Difference from batch-enrich.js:
 *   - batch-enrich runs on a hardcoded list of IDs (used for the curated 29 slice)
 *   - sweep-enrich queries the DB for ALL published Bay Area restaurants, skipping
 *     any already enriched (unless --force).
 *
 * SAFETY: --dry-run shows count + cost estimate + sample first 10 rows.
 * Always start there before kicking off the real sweep.
 *
 * Usage:
 *   node scripts/sweep-enrich.js --dry-run        (count + cost; no API calls or writes)
 *   node scripts/sweep-enrich.js                  (real run, skips already-enriched rows)
 *   node scripts/sweep-enrich.js --force          (real run, re-enriches everything regardless)
 *   node scripts/sweep-enrich.js --limit 50       (cap the run to first 50 — useful for incremental)
 *
 * Throttled to ~2 QPS (matches batch-enrich). For 700 rows that's ~6 min.
 *
 * Env vars auto-loaded from .env.scripts.local.
 */

require('./_loadenv')
const { enrichRestaurant } = require('./enrich-restaurant')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) { console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1) }

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const FORCE   = argv.includes('--force')
const limitIdx = argv.indexOf('--limit')
const LIMIT = limitIdx >= 0 ? parseInt(argv[limitIdx + 1], 10) : Infinity

const THROTTLE_MS = 500   // 2 QPS

// Per-restaurant cost estimate.
// Google: 1 Find Place + 1 Details + 3 Photos = 5 calls × ~$0.005 = ~$0.025 (free under Pro SKU)
// Claude: ~6k input + ~700 output Haiku 4.5 tokens ≈ $0.007
// Total: ~$0.03 list, ~$0.007 real (Google portion free up to 5k/mo cap)
const COST_PER_RESTAURANT_USD = 0.007

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'}, force=${FORCE}, limit=${LIMIT === Infinity ? 'none' : LIMIT}`)

  // 1. Resolve restaurants category id
  const { data: cat, error: catErr } = await supabase.from('categories').select('id').eq('slug', 'restaurants').single()
  if (catErr || !cat) { console.error('Could not load restaurants category'); process.exit(1) }

  // 2. Pull all candidates — Bay Area, published, paginated.
  // Filter is metro = 'Bay Area' (matches what the Restaurants page surfaces).
  console.log('Fetching Bay Area published restaurants...')
  const PAGE = 1000
  const allRows = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from('content')
      .select('id, name, address, metro, ai_enriched_at, ai_enriched_summary')
      .eq('category_id', cat.id)
      .eq('status', 'published')
      .eq('metro', 'Bay Area')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    allRows.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`  ${allRows.length} Bay Area published restaurants total.`)

  // 3. Filter to ones that need enrichment
  const alreadyEnriched = allRows.filter(r => r.ai_enriched_at != null).length
  const candidates = FORCE
    ? allRows
    : allRows.filter(r => r.ai_enriched_at == null)
  const toProcess = candidates.slice(0, LIMIT)

  // 4. Cost estimate
  const estCost = (toProcess.length * COST_PER_RESTAURANT_USD).toFixed(2)
  const estTimeS = Math.ceil(toProcess.length * THROTTLE_MS / 1000)

  console.log(`\nSummary:`)
  console.log(`  Bay Area published restaurants:    ${allRows.length}`)
  console.log(`  Already enriched (skipped):        ${FORCE ? 0 : alreadyEnriched}`)
  console.log(`  Will enrich this run:              ${toProcess.length}${LIMIT < candidates.length ? `  (capped from ${candidates.length} by --limit)` : ''}`)
  console.log(`  Estimated Claude cost:             ~$${estCost}  (Google portion $0 under Pro SKU cap if total monthly Places calls < 5,000)`)
  console.log(`  Estimated wall time:               ~${Math.floor(estTimeS / 60)}m ${estTimeS % 60}s`)

  // Sanity check: rough Google Places call total this run
  const googleCalls = toProcess.length * 5  // find + details + 3 photos
  console.log(`  Estimated Google Places calls:     ${googleCalls}  (free up to 5,000/mo Pro SKU cap)`)
  if (googleCalls > 5000) {
    console.log(`  ⚠  This run alone would EXCEED the 5,000/mo Pro SKU cap by ${googleCalls - 5000} calls.`)
    console.log(`     Overage billed at standard SKU pricing (~$5/1000 = ~$${((googleCalls - 5000) * 0.005).toFixed(2)} extra).`)
  }

  if (DRY_RUN) {
    console.log(`\nFirst 10 sample candidates:`)
    for (const r of toProcess.slice(0, 10)) {
      console.log(`  ${r.name.padEnd(40).slice(0,40)}  —  ${(r.address || '').slice(0, 50)}`)
    }
    console.log(`\nDRY RUN — no API calls, no DB writes.`)
    return
  }

  if (toProcess.length === 0) {
    console.log('\nNothing to do. Exiting.')
    return
  }

  // 5. Real enrichment loop
  console.log(`\nEnriching ${toProcess.length} restaurants (throttled to ${1000 / THROTTLE_MS} QPS)...`)
  let ok = 0, failed = 0
  const failures = []
  for (let i = 0; i < toProcess.length; i++) {
    const r = toProcess[i]
    process.stdout.write(`\r  [${i+1}/${toProcess.length}] ${r.name.slice(0, 40).padEnd(40)}`)
    try {
      const result = await enrichRestaurant(r.id)
      ok++
      process.stdout.write(`  ✓ ${result.sampled_reviews} reviews, ${result.photos_uploaded} photos\n`)
    } catch (e) {
      failed++
      failures.push({ id: r.id, name: r.name, error: e.message })
      process.stdout.write(`  ✗ ${e.message.slice(0, 60)}\n`)
    }
    await new Promise(res => setTimeout(res, THROTTLE_MS))
  }

  console.log(`\nDone. ${ok} succeeded, ${failed} failed.`)
  if (failures.length > 0) {
    console.log(`\nFirst 20 failures (re-run later or investigate):`)
    for (const f of failures.slice(0, 20)) console.log(`  [${f.name}] ${f.error}`)
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
