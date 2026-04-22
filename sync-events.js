/**
 * Nasiha Event Sync Script
 * Fetches mosque iCal feeds and saves events to Supabase
 * Run with: node sync-events.js
 */

const https = require('https')
const http = require('http')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1eW1oeGZob3FyeXhuanVicnl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY2OTMsImV4cCI6MjA5MTAwMjY5M30.yP_jGHNmJcGKaKXF7O-ctJaO8iqhujqZ8AKSGc_yGSY'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const EVENTS_CATEGORY_ID = 'd916a550-c316-40a9-9582-35836417b6cb'

const FEEDS = [
  { mosque: 'MCC East Bay', area: 'East Bay', url: 'https://mcceastbay.org/?post_type=tribe_events&ical=1' },
]

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

// Fetch og:image from an event page
async function fetchEventImage(url) {
  if (!url) return null
  try {
    const html = await fetchUrl(url)
    const match = html.match(/property="og:image"\s+content="([^"]+)"/) ||
                  html.match(/content="([^"]+)"\s+property="og:image"/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

function parseICal(text) {
  const events = []
  const blocks = text.split('BEGIN:VEVENT')
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]
    const get = (key) => {
      const match = block.match(new RegExp(`${key}[^:]*:([^\r\n]+(?:\r?\n[ \t][^\r\n]+)*)`))
      return match ? match[1].replace(/\r?\n[ \t]/g, '').trim() : null
    }
    const summary = get('SUMMARY')
    const dtstart = get('DTSTART')
    const dtend = get('DTEND')
    const location = get('LOCATION')
    const description = get('DESCRIPTION')
    const url = get('URL')
    const uid = get('UID')
    if (!summary || !dtstart) continue
    // Skip cancelled and private
    if (summary.toLowerCase().includes('*canceled*')) continue
    if (summary.toLowerCase().includes('*cancelled*')) continue
    if (summary.toLowerCase().trim() === 'private event') continue
    if (summary.toLowerCase().trim() === 'private event ') continue

    const parseDate = (dt) => {
      if (!dt) return null
      const clean = dt.replace('T', '').replace('Z', '')
      const year = clean.substring(0, 4)
      const month = clean.substring(4, 6)
      const day = clean.substring(6, 8)
      const hour = clean.length > 8 ? clean.substring(8, 10) : '00'
      const min = clean.length > 10 ? clean.substring(10, 12) : '00'
      return `${year}-${month}-${day}T${hour}:${min}:00`
    }

    events.push({
      uid,
      summary: summary.replace(/\\,/g, ',').replace(/\\n/g, ' '),
      dtstart: parseDate(dtstart),
      dtend: parseDate(dtend),
      location: location ? location.replace(/\\,/g, ',').replace(/\\n/g, ' ') : null,
      description: description ? description.replace(/\\n/g, '\n').replace(/\\,/g, ',').substring(0, 1500) : null,
      url,
    })
  }
  return events
}

function makeSlug(title, date) {
  return title.toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50)
    .replace(/-+$/, '') + '-' + (date ? date.substring(0, 10) : '')
}

async function syncFeed(feed) {
  console.log(`\nFetching ${feed.mosque}...`)
  let raw
  try { raw = await fetchUrl(feed.url) }
  catch (err) { console.log(`  ❌ Failed: ${err.message}`); return }
  if (!raw.includes('BEGIN:VCALENDAR')) { console.log(`  ❌ Not iCal`); return }

  const events = parseICal(raw)
  const now = new Date().toISOString()
  const future = events.filter(e => e.dtstart && e.dtstart > now)
  console.log(`  Found ${future.length} upcoming events`)

  let inserted = 0, skipped = 0

  for (const event of future) {
    const slug = makeSlug(event.summary, event.dtstart)
    const { data: existing } = await supabase.from('content').select('id').eq('url_slug', slug).single()
    if (existing) { skipped++; continue }

    // Fetch image from event page
    let imageUrl = null
    if (event.url) {
      process.stdout.write(`  📸 Fetching image for "${event.summary.substring(0, 40)}"... `)
      imageUrl = await fetchEventImage(event.url)
      console.log(imageUrl ? '✅' : '—')
    }

    const { error } = await supabase.from('content').insert({
      content_type: 'listing',
      category_id: EVENTS_CATEGORY_ID,
      name: event.summary,
      description: event.description,
      location_address: event.location,
      location_area: feed.area,
      event_date: event.dtstart ? event.dtstart.substring(0, 10) : null,
      event_time: event.dtstart ? event.dtstart.substring(11, 16) : null,
      event_end_time: event.dtend ? event.dtend.substring(11, 16) : null,
      website: event.url,
      url_slug: slug,
      status: 'published',
      submitted_by: 'sync',
    })

    if (error) {
      console.log(`  ❌ Error: ${error.message}`)
    } else {
      // Store image in a metadata field if we got one
      if (imageUrl) {
        await supabase.from('content').update({ instagram: imageUrl }).eq('url_slug', slug)
      }
      inserted++
      console.log(`  ✅ ${event.summary.substring(0, 60)} (${event.dtstart?.substring(0, 10)})`)
    }
  }
  console.log(`  Done — ${inserted} inserted, ${skipped} already existed`)
}

async function main() {
  console.log('🕌 Nasiha Event Sync'); console.log('====================')
  for (const feed of FEEDS) await syncFeed(feed)
  console.log('\n✅ Sync complete')
}
main().catch(console.error)
