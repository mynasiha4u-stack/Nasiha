#!/usr/bin/env node
/**
 * add-places-via-google.js — verify a list of restaurants via Google Places and
 * create a new content row for each.
 *
 * For each {name, city} pair:
 *   1. Find Place from Text (name + city → place_id, lightly verifying we got
 *      the right place via the formatted_address)
 *   2. Place Details (full info: address, coords, phone, website, rating, count)
 *   3. INSERT into content with status='published', category='restaurants',
 *      metro='Bay Area', owner_id=admin, google_place_id, etc.
 *
 * Idempotent: if a row with the same google_place_id already exists, the script
 * skips it (you can re-run safely).
 *
 * SAFETY: --dry-run shows the 7 lookups + what WOULD be created without any DB
 * write. Always start there before running for real.
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/add-places-via-google.js [--dry-run]
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_KEY   = process.env.GOOGLE_MAPS_API_KEY

if (!SERVICE_KEY) { console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1) }

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')

if (!GOOGLE_KEY && !DRY_RUN) {
  console.error('ERROR: GOOGLE_MAPS_API_KEY required (or pass --dry-run, which still requires it to look up but skips DB writes).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Admin user id from CLAUDE.md
const ADMIN_USER_ID = '27c3e4a0-bf91-4071-af28-e4ac39ca7e25'

// ─────────────────────────────────────────────────────────────
// THE LIST — 7 confirmed real Bay Area places not in our DB.
// Each entry: { name as you'd say it, city as a location hint for Google }.
// ─────────────────────────────────────────────────────────────
const PLACES_TO_ADD = [
  { name: 'Bundoo Khan',           city: 'Fremont, CA' },
  { name: 'Maya Taqueria',         city: 'Union City, CA' },
  { name: "Zareen's",              city: 'Redwood City, CA' },
  { name: 'Mazra',                 city: 'Redwood City, CA' },
  { name: 'Halal Street Hot Pot',  city: 'Bay Area, CA' },
  { name: "Ma's Chinese",          city: 'Bay Area, CA' },
  { name: 'Crave Deli',            city: 'Hayward, CA' },
]

// ─────────────────────────────────────────────────────────────
// Google Places: find + details
// ─────────────────────────────────────────────────────────────
async function findPlace(name, locationHint) {
  const query = encodeURIComponent(`${name} ${locationHint}`.trim())
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id,name,formatted_address&key=${GOOGLE_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK' || !data.candidates?.length) {
    return { error: data.status || 'UNKNOWN', message: data.error_message || '' }
  }
  return { result: data.candidates[0] }
}

async function getPlaceDetails(placeId) {
  const fields = [
    'name', 'formatted_address', 'formatted_phone_number', 'website',
    'rating', 'user_ratings_total', 'geometry', 'types',
  ].join(',')
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK') return { error: data.status, message: data.error_message || '' }
  return { result: data.result }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function slugify(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function uniqueSlug(baseSlug) {
  let slug = baseSlug, suffix = 1
  while (true) {
    const { data } = await supabase.from('content').select('id').eq('url_slug', slug).maybeSingle()
    if (!data) return slug
    suffix++
    slug = `${baseSlug}-${suffix}`
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN — no DB writes' : 'WRITE'}`)
  console.log(`${PLACES_TO_ADD.length} places to look up.\n`)

  // Resolve restaurants category id once
  const { data: cat, error: catErr } = await supabase.from('categories').select('id').eq('slug', 'restaurants').single()
  if (catErr || !cat) { console.error('Could not load restaurants category'); process.exit(1) }
  const RESTAURANT_CAT_ID = cat.id

  let added = 0, skipped = 0, failed = 0

  for (const place of PLACES_TO_ADD) {
    console.log(`\n── ${place.name} (${place.city}) ──`)

    // 1. Find Place
    const f = await findPlace(place.name, place.city)
    if (f.error) {
      console.log(`  ✗ Find Place failed: ${f.error} ${f.message}`)
      failed++
      continue
    }
    const placeId = f.result.place_id
    console.log(`  → found: ${f.result.name}  —  ${f.result.formatted_address}`)
    console.log(`    place_id: ${placeId}`)

    // 2. Check if already in our DB by google_place_id (idempotency)
    const { data: existing } = await supabase.from('content')
      .select('id, name, status')
      .eq('google_place_id', placeId)
      .maybeSingle()
    if (existing) {
      console.log(`  ⚠ already in content (id=${existing.id}, name="${existing.name}", status=${existing.status}) — skipping`)
      skipped++
      continue
    }

    // 3. Place Details
    const d = await getPlaceDetails(placeId)
    if (d.error) {
      console.log(`  ✗ Place Details failed: ${d.error} ${d.message}`)
      failed++
      continue
    }
    const det = d.result
    const lat = det.geometry?.location?.lat
    const lng = det.geometry?.location?.lng

    console.log(`    address:    ${det.formatted_address || '(none)'}`)
    console.log(`    coords:     (${lat}, ${lng})`)
    console.log(`    phone:      ${det.formatted_phone_number || '(none)'}`)
    console.log(`    website:    ${det.website || '(none)'}`)
    console.log(`    google:     ${det.rating ?? '?'}/5  ·  ${det.user_ratings_total ?? '?'} reviews`)
    console.log(`    types:      ${(det.types || []).slice(0, 5).join(', ') || '(none)'}`)

    if (DRY_RUN) {
      console.log(`  [dry-run] would INSERT new content row`)
      continue
    }

    // 4. Build the row
    const baseSlug = slugify(det.name || place.name)
    const slug = await uniqueSlug(baseSlug)

    const row = {
      content_type:    'listing',
      category_id:     RESTAURANT_CAT_ID,
      name:            det.name || place.name,
      address:         det.formatted_address || null,
      display_lat:     lat ?? null,
      display_lng:     lng ?? null,
      phone:           det.formatted_phone_number || null,
      website:         det.website || null,
      status:          'published',
      metro:           'Bay Area',
      submitted_by:    'admin',
      owner_id:        ADMIN_USER_ID,
      google_place_id: placeId,
      google_rating:   det.rating ?? null,
      google_review_count: det.user_ratings_total ?? null,
      url_slug:        slug,
      location_privacy: 'public',
    }

    const { data: inserted, error: insErr } = await supabase.from('content')
      .insert(row)
      .select('id, name, url_slug')
      .single()
    if (insErr) {
      console.log(`  ✗ INSERT failed: ${insErr.message}`)
      failed++
      continue
    }
    console.log(`  ✓ inserted: id=${inserted.id}, slug=${inserted.url_slug}`)
    added++
  }

  console.log(`\n────────────────────────────────────────`)
  console.log(`Summary: ${added} added, ${skipped} skipped (already in DB), ${failed} failed.`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
