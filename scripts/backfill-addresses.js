#!/usr/bin/env node
/**
 * backfill-addresses.js
 *
 * For every published content row that has display_lat + display_lng but no street
 * address, reverse-geocode the coordinates via Google Geocoding API and store the
 * formatted_address into content.address.
 *
 * IDEMPOTENT — re-runnable. Skips rows that already have an address.
 *
 * SKIPS home-cooked-food category by default (CLAUDE.md: city-level only, privacy
 * by design — reverse-geocoding a city centroid would manufacture a fake street
 * address). Override with --include-homecooks ONLY if you understand the implication.
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/backfill-addresses.js [--dry-run] [--limit N] [--include-homecooks]
 *
 * Cost: Google Geocoding API is $5 per 1000 requests after the free tier (currently
 *       10k/month free). For 7,000 rows that's roughly $35, or close to free if your
 *       project is under the monthly free tier.
 *
 * Rate limit: throttled to ~20 QPS (well under Google's 50 QPS sustained limit).
 *             For 7k rows that's ~6 minutes total wall time.
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY
const THROTTLE_MS = 50 // ~20 req/sec — well under Google's 50 QPS limit

if (!SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY env var is required.')
  process.exit(1)
}

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const INCLUDE_HOMECOOKS = argv.includes('--include-homecooks')
const limitIdx = argv.indexOf('--limit')
const LIMIT = limitIdx >= 0 ? parseInt(argv[limitIdx + 1], 10) : Infinity

if (!GOOGLE_KEY && !DRY_RUN) {
  console.error('ERROR: GOOGLE_MAPS_API_KEY env var is required (or pass --dry-run).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function reverseGeocode(lat, lng) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`
  let res
  try {
    res = await fetch(url)
  } catch (e) {
    return { error: 'NETWORK', message: String(e) }
  }
  if (!res.ok) {
    return { error: `HTTP_${res.status}`, message: await res.text().catch(() => '') }
  }
  const data = await res.json()
  if (data.status !== 'OK' || !data.results?.length) {
    return { error: data.status || 'UNKNOWN', message: data.error_message || '' }
  }
  return { formatted: data.results[0].formatted_address }
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'}, limit=${LIMIT === Infinity ? 'none' : LIMIT}, include_homecooks=${INCLUDE_HOMECOOKS}`)

  // 1. Categories map (id → slug)
  const { data: cats, error: catErr } = await supabase.from('categories').select('id, slug, name')
  if (catErr) throw catErr
  const slugById = new Map(cats.map(c => [c.id, c.slug]))
  const nameById = new Map(cats.map(c => [c.id, c.name]))
  const homecookCatId = cats.find(c => c.slug === 'home-cooked-food')?.id

  // 2. Pull all candidates — paginated. Filter in JS for clarity.
  console.log('Fetching candidate rows...')
  const PAGE = 1000
  let allRows = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from('content')
      .select('id, name, display_lat, display_lng, category_id, address, location_address, status')
      .eq('status', 'published')
      .not('display_lat', 'is', null)
      .not('display_lng', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    allRows.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`  ${allRows.length} published rows with coordinates.`)

  // 3. Filter to rows that lack both address and location_address.
  const needsAddress = allRows.filter(r => {
    const a = (r.address || '').trim()
    const la = (r.location_address || '').trim()
    return a.length === 0 && la.length === 0
  })

  // 4. Skip home cooks unless --include-homecooks
  const filtered = INCLUDE_HOMECOOKS
    ? needsAddress
    : needsAddress.filter(r => r.category_id !== homecookCatId)
  const homecookSkipped = needsAddress.length - filtered.length

  const todo = filtered.slice(0, LIMIT)

  // 5. Breakdown by category for the summary
  const byCat = new Map()
  for (const r of filtered) {
    const slug = slugById.get(r.category_id) || 'unknown'
    byCat.set(slug, (byCat.get(slug) || 0) + 1)
  }

  console.log(`\nSummary:`)
  console.log(`  Total rows with coordinates:       ${allRows.length}`)
  console.log(`  Already have address (skip):       ${allRows.length - needsAddress.length}`)
  if (!INCLUDE_HOMECOOKS) {
    console.log(`  Home cooks excluded (privacy):     ${homecookSkipped}`)
  }
  console.log(`  Will reverse-geocode:              ${filtered.length}`)
  if (LIMIT < filtered.length) {
    console.log(`  Limited to first:                  ${todo.length}`)
  }
  console.log(`  Estimated cost:                    $${(todo.length * 5 / 1000).toFixed(2)} (at $5/1000; first 10k/month free)`)
  console.log(`  Estimated wall time:               ~${Math.ceil(todo.length * THROTTLE_MS / 1000)}s`)

  console.log(`\nBreakdown by category:`)
  for (const [slug, count] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${(nameById.get(cats.find(c => c.slug === slug)?.id) || slug).padEnd(35)} ${count}`)
  }

  if (DRY_RUN) {
    console.log(`\nFirst 5 sample candidates:`)
    for (const r of todo.slice(0, 5)) {
      console.log(`  ${r.name}  @ (${r.display_lat}, ${r.display_lng})  [${slugById.get(r.category_id)}]`)
    }
    console.log('\nDRY RUN — no API calls, no DB writes.')
    return
  }

  if (todo.length === 0) {
    console.log('\nNothing to do. Exiting.')
    return
  }

  console.log(`\nReverse-geocoding ${todo.length} rows...`)
  let done = 0, failed = 0, failures = []
  for (const r of todo) {
    const result = await reverseGeocode(r.display_lat, r.display_lng)
    if (result.error) {
      failed++
      failures.push({ id: r.id, name: r.name, error: result.error, message: result.message })
    } else {
      const { error: upErr } = await supabase.from('content')
        .update({ address: result.formatted })
        .eq('id', r.id)
      if (upErr) {
        failed++
        failures.push({ id: r.id, name: r.name, error: 'DB_UPDATE', message: upErr.message })
      } else {
        done++
      }
    }
    process.stdout.write(`\r  ${done + failed}/${todo.length}  (success ${done}, failed ${failed})`)
    await new Promise(r => setTimeout(r, THROTTLE_MS))
  }
  process.stdout.write('\n')
  console.log(`\nDone. ${done} updated, ${failed} failed.`)
  if (failures.length > 0) {
    console.log(`\nFirst 10 failures:`)
    for (const f of failures.slice(0, 10)) {
      console.log(`  [${f.name}] ${f.error}: ${f.message}`)
    }
  }
}

main().catch(e => {
  console.error('\nFATAL:', e)
  process.exit(1)
})
