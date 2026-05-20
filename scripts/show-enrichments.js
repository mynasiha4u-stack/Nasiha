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

async function main() {
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

  for (const r of data) {
    const s = r.ai_enriched_summary || {}
    const cityish = (r.address || '').split(',').slice(1, 2).join('').trim()
    console.log('═'.repeat(80))
    console.log(`${r.name}${cityish ? ' · ' + cityish : ''}`)
    console.log(`Google: ${r.google_rating ?? '?'}/5  ·  ${r.google_review_count ?? '?'} reviews  ·  ${r.photos?.length || 0} photos`)
    console.log('─'.repeat(80))
    if (s.vibe) console.log(`  vibe:           ${s.vibe}`)
    if (s.known_for_dishes?.length) console.log(`  known for:      ${s.known_for_dishes.join(', ')}`)
    if (s.praise_themes?.length) console.log(`  praise:         ${s.praise_themes.join(' · ')}`)
    if (s.complaint_themes?.length) console.log(`  complaints:     ${s.complaint_themes.join(' · ')}`)
    if (s.halal_notes) console.log(`  halal notes:    ${s.halal_notes}`)
    if (s.recommended_for?.length) console.log(`  good for:       ${s.recommended_for.join(', ')}`)
    if (s.based_on) console.log(`  distilled from: ${s.based_on.sampled_reviews ?? '?'} sampled reviews (${s.based_on.avg_rating ?? '?'}/5 avg)`)
    console.log()
  }
  console.log('═'.repeat(80))
  console.log(`\nTotal: ${data.length} enriched.`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
