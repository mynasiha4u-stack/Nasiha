#!/usr/bin/env node
/**
 * show-enrichments.js — print all enriched listings side-by-side for quality review.
 *
 * Pulls every content row with ai_enriched_summary set (most recent first) and prints
 * a compact, eyeball-able summary for each. Designed for the "is the distillation
 * actually good?" judgment call.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/show-enrichments.js [--limit N]
 */

require('./_loadenv')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) { console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const limitIdx = process.argv.indexOf('--limit')
const LIMIT = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) : 20

// --random N → quality-check mode: random sample across cities, excluding the
// originally-curated 29 IDs so we spot-check the long tail rather than the
// places we already tuned the prompt against.
const randomIdx = process.argv.indexOf('--random')
const RANDOM_N = randomIdx >= 0 ? parseInt(process.argv[randomIdx + 1], 10) : null

// The original Slice 1 IDs (22 already-in-DB + 7 added via Google). These get
// excluded from --random sampling so we judge prompt quality on places we
// didn't hand-curate.
const ORIGINAL_SLICE_IDS = new Set([
  'ff56b980-6b39-4986-beac-5701bd91690e', '78203a70-daea-450c-8bdf-fd0e88f5bf7d',
  '2adb11a2-399a-49e5-b9e7-f40aa15ab3a0', '1eec1518-236e-4e3f-b0b0-4904fbb1dcd5',
  '46d5e16b-0be1-4336-a6f7-52d415dac37d', '57034160-2abd-4048-b9a7-6fb3af56e7ab',
  '27c10d9d-53a0-4e61-a4cb-f1ac3f23b6c8', '71e9d468-c63a-42a0-98dc-71234ef0384f',
  '50338d84-d8c9-4321-9986-8f43a717fe74', 'fb4d61b8-fc36-40f9-87ab-16797a0a8580',
  '959b15e9-981a-45bc-b948-7b8857b5aea6', '15e2c41b-1d18-469f-ba40-96947fffc800',
  'fdaa6ca7-629a-4deb-8a85-a07e25977480', '0ca9aec8-4fc6-44d6-85cb-01a72ade469b',
  '70629bf1-93de-455b-b743-2dada4856250', '1be28a9d-37bf-4207-b6b6-352bee6bc5e7',
  '75fa9539-7875-45db-ad68-b6f0823b61a2', 'ad32b455-0b5f-47a2-b6fa-560b0d521a53',
  '44aedb00-558f-4361-898c-a04bce64a473', '92127ac6-683b-4a06-a08e-e70051efc9cb',
  '8bab27bc-8cd3-4751-a4d2-d0efcad05631', '4880c89c-1693-40cc-82c0-eb2522386fc6',
  'd3418eb2-f68a-4afb-aa64-909975732566', 'b05c418b-c77a-4af6-9be9-b9f2c8b5f6f2',
  '7a39ce07-fb15-4b4c-b2d9-aeaf87cdc981', '0b6483ef-1436-4359-aa8e-82d30b9d3684',
  'e82030bf-2811-4951-a518-8fe137769f78', 'ee99f80f-957b-4d04-9929-6bf5f832b5d4',
  'e67fac44-92e7-48d3-99da-4955c1299d7b',
])

function cityFromAddress(addr) {
  if (!addr) return null
  const parts = addr.split(',').map(p => p.trim()).filter(Boolean)
  return parts.length >= 2 ? parts[1] : null
}

// Picks N rows trying for city diversity. Greedy: sort rows by city occurrence
// in our sample so far (lowest first → spreads across cities), then pick.
function diverseSample(rows, n) {
  const out = []
  const cityCount = new Map()
  const pool = [...rows]
  // shuffle pool first so ties between cities break randomly
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  while (out.length < n && pool.length > 0) {
    // pick the row whose city has been picked the fewest times so far
    let bestIdx = 0
    let bestCount = Infinity
    for (let i = 0; i < pool.length; i++) {
      const city = cityFromAddress(pool[i].address) || '(unknown)'
      const c = cityCount.get(city) || 0
      if (c < bestCount) { bestCount = c; bestIdx = i; if (c === 0) break }
    }
    const picked = pool.splice(bestIdx, 1)[0]
    const city = cityFromAddress(picked.address) || '(unknown)'
    cityCount.set(city, (cityCount.get(city) || 0) + 1)
    out.push(picked)
  }
  return out
}

async function main() {
  // Random-sample mode: pull every enriched row in Bay Area, exclude originals,
  // then pick a city-diverse sample of RANDOM_N.
  if (RANDOM_N != null) {
    // Pull a generous pool to sample from. 1000 covers the whole sweep + then some.
    const { data, error } = await supabase
      .from('content')
      .select('id, name, address, metro, google_rating, google_review_count, ai_enriched_at, ai_enriched_summary, photos')
      .not('ai_enriched_summary', 'is', null)
      .eq('metro', 'Bay Area')
      .limit(1000)
    if (error) { console.error(error); process.exit(1) }
    if (!data || data.length === 0) {
      console.log('No enriched Bay Area listings yet.')
      return
    }
    const pool = data.filter(r => !ORIGINAL_SLICE_IDS.has(r.id))
    console.log(`Random sample of ${RANDOM_N} from ${pool.length} enriched Bay Area listings (excluded ${data.length - pool.length} originals):\n`)
    return display(diverseSample(pool, RANDOM_N))
  }

  // Default: most-recently-enriched, capped at LIMIT
  const { data, error } = await supabase
    .from('content')
    .select('id, name, address, google_rating, google_review_count, ai_enriched_at, ai_enriched_summary, photos')
    .not('ai_enriched_summary', 'is', null)
    .order('ai_enriched_at', { ascending: false })
    .limit(LIMIT)
  if (error) { console.error(error); process.exit(1) }
  if (!data || data.length === 0) {
    console.log('No enriched listings yet. Run batch-enrich first.')
    return
  }

  console.log(`Showing ${data.length} most-recently-enriched listings:\n`)
  display(data)
}

function display(data) {

  for (const r of data) {
    const s = r.ai_enriched_summary || {}
    const cityish = (r.address || '').split(',').slice(1, 2).join('').trim()
    // Confidence shown inline with rating — most important quality signal up top
    const conf = s.confidence ? ` · confidence: ${s.confidence}` : ''
    console.log('═'.repeat(80))
    console.log(`${r.name}${cityish ? ' · ' + cityish : ''}`)
    console.log(`Google: ${r.google_rating ?? '?'}/5  ·  ${r.google_review_count ?? '?'} reviews  ·  ${r.photos?.length || 0} photos${conf}`)
    console.log('─'.repeat(80))
    // Tagline first if present — captures the "who is this for" in one line
    if (s.good_for_summary) console.log(`  tagline:        ${s.good_for_summary}`)
    if (s.signature_strength) console.log(`  signature:      ${s.signature_strength}`)
    if (s.vibe) console.log(`  vibe:           ${s.vibe}`)
    if (s.known_for_dishes?.length) console.log(`  known for:      ${s.known_for_dishes.join(', ')}`)
    if (s.praise_themes?.length) console.log(`  praise:         ${s.praise_themes.join(' · ')}`)
    if (s.complaint_themes?.length) console.log(`  complaints:     ${s.complaint_themes.join(' · ')}`)
    if (s.halal_notes) console.log(`  halal notes:    ${s.halal_notes}`)
    // Prefer new occasion_tags; fall back to old recommended_for for any pre-revamp rows
    const occasions = s.occasion_tags?.length ? s.occasion_tags : s.recommended_for
    if (occasions?.length) console.log(`  occasion tags:  ${occasions.join(', ')}`)
    if (s.minor_tags?.length) console.log(`  minor tags:     ${s.minor_tags.join(' · ')}`)
    if (s.based_on) console.log(`  distilled from: ${s.based_on.sampled_reviews ?? s.based_on.review_count ?? '?'} reviews (${s.based_on.avg_rating ?? '?'}/5 avg)`)
    console.log()
  }
  console.log('═'.repeat(80))
  console.log(`\nTotal: ${data.length} enriched.`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
