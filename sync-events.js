/**
 * Nasiha Event Sync Script
 * Fetches MCC East Bay events from their iCal feed and saves to Supabase
 * 
 * Run with: node sync-events.js
 */

const https = require('https')
const { createClient } = require('@supabase/supabase-js')

// Supabase config
const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1eW1oeGZob3FyeXhuanVicnl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY2OTMsImV4cCI6MjA5MTAwMjY5M30.yP_jGHNmJcGKaKXF7O-ctJaO8iqhujqZ8AKSGc_yGSY'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Events category ID
const EVENTS_CATEGORY_ID = 'd916a550-c316-40a9-9582-35836417b6cb'

// iCal feeds to sync
const FEEDS = [
  {
    mosque: 'MCC East Bay',
    area: 'East Bay',
    url: 'https://mcceastbay.org/?post_type=tribe_events&ical=1',
  }
]

// Fetch a URL and return the text
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

// Parse iCal text into array of event objects
function parseICal(text) {
  const events = []
  const blocks = text.split('BEGIN:VEVENT')
  
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]
    const get = (key) => {
      const match = block.match(new RegExp(`${key}[^:]*:([^\r\n]+)`))
      return match ? match[1].trim() : null
    }

    const summary = get('SUMMARY')
    const dtstart = get('DTSTART')
    const dtend = get('DTEND')
    const location = get('LOCATION')
    const description = get('DESCRIPTION')
    const url = get('URL')
    const uid = get('UID')

    // Get image from ATTACH field
    const attachMatch = block.match(/ATTACH[^:]*:(https?:\/\/[^\r\n]+\.(jpg|jpeg|png|webp|gif))/i)
    const image = attachMatch ? attachMatch[1] : null

    if (!summary || !dtstart) continue

    // Skip cancelled and private events
    if (summary.toLowerCase().includes('*canceled*')) continue
    if (summary.toLowerCase().includes('*cancelled*')) continue
    if (summary.toLowerCase().trim() === 'private event') continue

    // Parse date
    const parseDate = (dt) => {
      if (!dt) return null
      const clean = dt.replace(/[TZ]/g, ' ').trim()
      const year = clean.substring(0, 4)
      const month = clean.substring(4, 6)
      const day = clean.substring(6, 8)
      const hour = clean.substring(9, 11) || '00'
      const min = clean.substring(11, 13) || '00'
      return `${year}-${month}-${day}T${hour}:${min}:00`
    }

    events.push({
      uid,
      summary,
      dtstart: parseDate(dtstart),
      dtend: parseDate(dtend),
      location: location ? location.replace(/\\,/g, ',').replace(/\\n/g, ' ') : null,
      description: description ? description.replace(/\\n/g, '\n').replace(/\\,/g, ',').substring(0, 1000) : null,
      url,
      image,
    })
  }
  return events
}

// Generate a slug from event title and date
function makeSlug(title, date) {
  const slug = title.toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50)
  const dateStr = date ? date.substring(0, 10) : ''
  return `${slug}-${dateStr}`
}

// Main sync function
async function syncFeed(feed) {
  console.log(`\nFetching ${feed.mosque}...`)
  
  let raw
  try {
    raw = await fetchUrl(feed.url)
  } catch (err) {
    console.log(`  ❌ Failed to fetch: ${err.message}`)
    return
  }

  if (!raw.includes('BEGIN:VCALENDAR')) {
    console.log(`  ❌ Not a valid iCal feed`)
    return
  }

  const events = parseICal(raw)
  console.log(`  Found ${events.length} events`)

  // Only future events
  const now = new Date().toISOString()
  const future = events.filter(e => e.dtstart && e.dtstart > now)
  console.log(`  ${future.length} upcoming events`)

  let inserted = 0
  let skipped = 0

  for (const event of future) {
    const slug = makeSlug(event.summary, event.dtstart)
    
    // Check if already exists
    const { data: existing } = await supabase
      .from('content')
      .select('id')
      .eq('url_slug', slug)
      .single()

    if (existing) {
      skipped++
      continue
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
      console.log(`  ❌ Error inserting "${event.summary}": ${error.message}`)
    } else {
      inserted++
      console.log(`  ✅ ${event.summary} (${event.dtstart?.substring(0, 10)})`)
    }
  }

  console.log(`  Done — ${inserted} inserted, ${skipped} already existed`)
}

async function main() {
  console.log('🕌 Nasiha Event Sync')
  console.log('====================')
  
  for (const feed of FEEDS) {
    await syncFeed(feed)
  }
  
  console.log('\n✅ Sync complete')
}

main().catch(console.error)
