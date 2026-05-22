// src/lib/listingTags.js
//
// Two pure utilities used by Restaurants card + ListingDetail + chat context build:
//
// 1. effectiveOccasionTags(row) — applies nasiha_tag_overrides on top of
//    ai_enriched_summary.occasion_tags. The resulting array is the canonical
//    set of tags for display + chat context.
//
// 2. rankTagsByRarity(tags, countsMap, max) — sorts tags by rarity (fewer
//    restaurants having the tag = more distinctive = surface first) and
//    returns the top `max`. Used to cap visible tags at 3-4 per listing
//    without losing data — the full set is still in row.ai_enriched_summary
//    for chat retrieval.
//
// Also: emoji + display-label helper for known occasion tags.

const OCCASION_TAG_META = {
  date_night:            { emoji: '🍷', label: 'Date night' },
  family_with_kids:      { emoji: '👨‍👩‍👧', label: 'Family with kids' },
  big_groups:            { emoji: '🍽️', label: 'Big groups' },
  outdoor_seating:       { emoji: '☀️', label: 'Outdoor seating' },
  late_night:            { emoji: '🌙', label: 'Late night' },
  quick_lunch:           { emoji: '⚡', label: 'Quick lunch' },
  business_meeting:      { emoji: '💼', label: 'Business meeting' },
  prayer_facilities:     { emoji: '🕌', label: 'Prayer facilities' },
  takeout_friendly:      { emoji: '🥡', label: 'Takeout-friendly' },
  large_catering_orders: { emoji: '🎉', label: 'Catering' },
  vegetarian_friendly:   { emoji: '🥬', label: 'Vegetarian-friendly' },
  solo_friendly:         { emoji: '🧍', label: 'Solo-friendly' },
  cheap_eats:            { emoji: '💲', label: 'Cheap eats' },
}

export function tagMeta(tag) {
  return OCCASION_TAG_META[tag] || { emoji: '•', label: tag.replace(/_/g, ' ') }
}

/**
 * Effective tags after applying admin overrides.
 *
 * effective = (claude_tags ∪ force_add) − force_remove
 * Preserves insertion order, with claude tags first then any force-added tags
 * that weren't already present.
 */
export function effectiveOccasionTags(row) {
  const fromClaude = Array.isArray(row?.ai_enriched_summary?.occasion_tags)
    ? row.ai_enriched_summary.occasion_tags
    : []
  const overrides = row?.nasiha_tag_overrides || {}
  const forceAdd = Array.isArray(overrides.force_add) ? overrides.force_add : []
  const forceRemove = new Set(Array.isArray(overrides.force_remove) ? overrides.force_remove : [])

  const seen = new Set()
  const out = []
  for (const t of fromClaude) {
    if (forceRemove.has(t) || seen.has(t)) continue
    out.push(t)
    seen.add(t)
  }
  for (const t of forceAdd) {
    if (forceRemove.has(t) || seen.has(t)) continue
    out.push(t)
    seen.add(t)
  }
  return out
}

/**
 * Cap to top `max` tags by rarity. Tags absent from countsMap are treated
 * as MAXIMALLY rare (high distinctiveness, surface first) so newly-introduced
 * tags don't get buried before the next stats refresh.
 *
 * countsMap: Map<string, number> — count of restaurants having that tag.
 */
export function rankTagsByRarity(tags, countsMap, max = 4) {
  if (!Array.isArray(tags) || tags.length === 0) return []
  const counts = countsMap || new Map()
  return [...tags]
    .sort((a, b) => (counts.get(a) ?? -1) - (counts.get(b) ?? -1))
    .slice(0, max)
}

/**
 * Fetches occasion_tag_counts via the SQL function migration_16 created.
 * Returns Map<tag, count>. Safe to call multiple times — supabase caches.
 *
 * supabase: the supabase-js client
 */
export async function fetchTagCounts(supabase) {
  try {
    const { data, error } = await supabase.rpc('get_occasion_tag_counts')
    if (error) return new Map()
    return new Map((data || []).map(r => [r.tag, Number(r.count)]))
  } catch {
    return new Map()
  }
}

/**
 * Tagline displayed publicly. Override takes priority over Claude's good_for_summary.
 * Returns null if nothing to show.
 */
export function effectiveTagline(row) {
  if (row?.nasiha_tagline_override && row.nasiha_tagline_override.trim().length > 0) {
    return row.nasiha_tagline_override
  }
  const s = row?.ai_enriched_summary
  if (s && typeof s.good_for_summary === 'string' && s.good_for_summary.trim().length > 0) {
    return s.good_for_summary
  }
  return null
}
