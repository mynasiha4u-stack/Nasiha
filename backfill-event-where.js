#!/usr/bin/env node
/**
 * Backfill event addresses by parsing "Where: ..." from existing descriptions.
 *
 * For each event in the events category where address is null (or just falls back
 * to the mosque), parse the description for a 'Where:' label. If found:
 *   1. Update the event's address field
 *   2. Geocode the venue to get real coords
 *   3. Update display_lat / display_lng
 *
 * Run once: node backfill-event-where.js
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const https = require('https')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function extractWhereFromDescription(desc) {
  if (!desc) return null
  const plain = desc
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
  const m = plain.match(/(?:^|\n)\s*(?:Where|Location|Venue|Address)\s*[:：]\s*([^\n]+?)(?:\n|$)/i)
  if (!m) return null
  let extracted = m[1].trim()
  extracted = extracted.replace(/\s*\|\s*$/, '')
  extracted = extracted.replace(/\s+(?:When|Time|Cost|Fee|RSVP|Register)\s*[:：].*$/i, '')
  if (extracted.length < 3 || extracted.length > 200) return null
  return extracted
}

async function geocode(address) {
  if (!GOOGLE_MAPS_API_KEY) return null
  if (!address) return null
  // Bias toward Bay Area by appending CA if no state info
  const queryAddress = /\b(CA|California|, [A-Z]{2}\b)/.test(address) ? address : `${address}, CA`
  const encoded = encodeURIComponent(queryAddress)
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_MAPS_API_KEY}`
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.status === 'OK' && json.results[0]) {
            const loc = json.results[0].geometry.location
            resolve({ lat: loc.lat, lng: loc.lng })
          } else {
            resolve(null)
          }
        } catch {
          resolve(null)
        }
      })
    }).on('error', () => resolve(null))
  })
}

async function main() {
  console.log('Fetching events category...')
  const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'events').single()
  if (!cat) { console.error('No events category'); process.exit(1) }

  console.log('Fetching events with descriptions...')
  const { data: events, error } = await supabase
    .from('content')
    .select('id, name, address, description, event_host')
    .eq('category_id', cat.id)
    .eq('status', 'published')
    .not('description', 'is', null)

  if (error) { console.error(error); process.exit(1) }
  console.log(`Found ${events.length} events with descriptions`)

  let updated = 0
  let skipped = 0
  let parseFailed = 0

  for (const ev of events) {
    // Only re-parse if address is missing OR very short (e.g., "CA")
    const hasRealAddress = ev.address && ev.address.length > 5 && /\d/.test(ev.address)
    if (hasRealAddress) {
      skipped++
      continue
    }

    const venue = extractWhereFromDescription(ev.description)
    if (!venue) {
      parseFailed++
      continue
    }

    process.stdout.write(`📍 ${ev.name.substring(0, 40).padEnd(40)} → ${venue.substring(0, 40)}... `)
    const coords = await geocode(venue)

    const updates = { address: venue, location_address: venue }
    if (coords) {
      updates.display_lat = coords.lat
      updates.display_lng = coords.lng
      console.log('✅')
    } else {
      console.log('— (no geocode, address saved without coords)')
    }

    await supabase.from('content').update(updates).eq('id', ev.id)
    updated++
    // Slow down geocoding requests to avoid rate limits
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (had real address): ${skipped}, Parse failed: ${parseFailed}`)
}

main().catch(e => { console.error(e); process.exit(1) })
