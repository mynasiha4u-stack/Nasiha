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
  { mosque: 'MCC East Bay',        area: 'East Bay',  url: 'https://mcceastbay.org/?post_type=tribe_events&ical=1' },
  { mosque: 'MCA Santa Clara',     area: 'South Bay', url: 'https://www.mcabayarea.org/?post_type=tribe_events&ical=1' },
  { mosque: 'ICF Fremont',         area: 'East Bay',  url: 'https://icfbayarea.com/?post_type=tribe_events&ical=1' },
  { mosque: 'ICL Livermore',       area: 'East Bay',  url: 'https://iclivermore.org/?post_type=tribe_events&ical=1' },
  { mosque: 'SRVIC San Ramon',     area: 'East Bay',  url: 'https://srvic.org/?post_type=tribe_events&ical=1' },
  { mosque: 'WVMA Los Gatos',      area: 'South Bay', url: 'https://wvmuslim.org/?post_type=tribe_events&ical=1' },
  { mosque: 'Lamorinda',           area: 'East Bay',  url: 'https://lamorindamuslims.org/?post_type=tribe_events&ical=1' },
  { mosque: 'Yaseen Foundation',   area: 'Peninsula', url: 'https://www.yaseen.org/?post_type=tribe_events&ical=1' },
]

// --- Classification logic (uses both title and description) ---

function classifyEvent(name, description) {
  const title = name.toLowerCase()
  const desc = (description || '').toLowerCase()
  const both = title + ' ' + desc

  // EVENT TYPE — title is primary signal, description confirms
  let types = []

  if (title.includes('halaqa')) types.push('Halaqa')
  else if (/quran|tafseer|tafsir|fiqh|hadith|islamic studies|lecture series|weekly class|seerah|aqeedah/.test(both)) types.push('Islamic Learning')
  else if (/zumba|hike|hiking|bike|fitness|sport|outdoor|walk|run|yoga|swim/.test(both)) types.push('Wellness')
  else if (/mommy|toddler|preschool|parenting|children'?s program|playgroup|kids program/.test(both)) types.push('Family & Kids')
  else if (/fundrais|gala|donation|annual dinner|banquet|tables @/.test(both)) types.push('Fundraiser')
  else if (/matrimon|singles|marriage event|speed meet/.test(both)) types.push('Matrimonial')
  else if (/palestine|gaza|political|civic|advocacy|social justice|human rights/.test(both)) types.push('Civic')
  else if (/book club|reading group|film|poetry|art show|culture night/.test(both)) types.push('Arts & Culture')
  else if (/food festival|suhoor fest|iftar dinner|halal food|restaurant night|pop.?up/.test(both)) types.push('Food & Drink')
  else types.push('Community')

  // Add second type if clearly applicable
  if (!types.includes('Wellness') && /zumba|hike|bike|fitness|sport/.test(both)) types.push('Wellness')
  if (!types.includes('Food & Drink') && /iftar dinner|suhoor|potluck|community dinner/.test(title)) types.push('Food & Drink')
  if (!types.includes('Civic') && /palestine|gaza/.test(both)) types.push('Civic')

  types = types.slice(0, 2)

  // AUDIENCE — title is primary, description adds context
  const isFamilyContext = /famil|mommy|toddler|preschool|parent|playgroup|ages [1-5]|ages one to/.test(title)
  const audiences = []

  // Sisters — title signal or explicit description signal
  if (/sister|women'?s|girls|female|mommy|mothers?/.test(title)) audiences.push('Sisters Only')
  else if (/sisters only|women only|for women|for sisters/.test(desc)) audiences.push('Sisters Only')

  // Brothers — title signal (not family context) or explicit description signal
  const brothersTitle = /\bmen'?s\b|brothers?|boys? halaqa|boys? program|adhan.*boys|for men\b/.test(title)
  if (brothersTitle && !isFamilyContext) audiences.push('Brothers Only')
  else if (/brothers only|men only|for brothers\b/.test(desc)) audiences.push('Brothers Only')

  // Youth — title or clear description signal
  if (/youth|teen|high school|middle school|elementary|junior|ages 1[2-9]/.test(title)) audiences.push('Youth')
  else if (/for teens|for youth|ages 12|ages 13|ages 14|ages 15|grades [6-9]/.test(desc)) audiences.push('Youth')

  // Families — title or description signal
  if (/famil|toddler|preschool|parenting|mommy|children'?s/.test(title)) audiences.push('Families')
  else if (/for families|bring your kids|children welcome|family friendly/.test(desc)) audiences.push('Families')

  if (audiences.length === 0) audiences.push('General Public')

  return { types, audiences }
}

// --- Utilities ---

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
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

async function fetchEventImage(url) {
  if (!url) return null
  try {
    const html = await fetchUrl(url)
    // Try multiple image patterns
    const match =
      html.match(/property="og:image"\s+content="([^"]+)"/) ||
      html.match(/content="([^"]+)"\s+property="og:image"/) ||
      html.match(/name="twitter:image"\s+content="([^"]+)"/) ||
      html.match(/content="([^"]+)"\s+name="twitter:image"/) ||
      html.match(/class="tribe-events-event-image"[^>]*>\s*<img[^>]+src="([^"]+)"/) ||
      html.match(/<img[^>]+class="[^"]*wp-post-image[^"]*"[^>]+src="([^"]+)"/) ||
      html.match(/<img[^>]+src="(https:\/\/mcceastbay\.org\/wp-content\/uploads\/[^"]+\.(?:jpg|jpeg|png|webp))"/)
    return match ? match[1] : null
  } catch { return null }
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
    if (summary.toLowerCase().includes('*canceled*')) continue
    if (summary.toLowerCase().includes('*cancelled*')) continue
    if (/^private\s*event\s*$/i.test(summary.trim())) continue

    const parseDate = (dt) => {
      if (!dt) return null
      const clean = dt.replace('T', '').replace('Z', '')
      const y = clean.substring(0,4), mo = clean.substring(4,6), d = clean.substring(6,8)
      const h = clean.length > 8 ? clean.substring(8,10) : '00'
      const mi = clean.length > 10 ? clean.substring(10,12) : '00'
      return `${y}-${mo}-${d}T${h}:${mi}:00`
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
  const slug = title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 45)
    .replace(/-+$/, '')
  return slug + '-' + (date ? date.substring(0, 10) : '')
}

// --- Main sync ---

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

    // Classify event
    const { types, audiences } = classifyEvent(event.summary, event.description)

    // Fetch image
    let imageUrl = null
    if (event.url) {
      process.stdout.write(`  📸 "${event.summary.substring(0, 35)}"... `)
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
      image_url: imageUrl,
      event_type: types[0] || 'Community',
      event_audience: audiences,
      status: 'published',
      submitted_by: 'sync',
      event_host: feed.mosque,
      internal_notes: feed.mosque,
    })

    if (error) {
      console.log(`  ❌ ${error.message}`)
    } else {
      inserted++
      console.log(`  ✅ ${event.summary.substring(0, 55)} [${types.join('+')}] [${audiences.join('+')}]`)
    }
  }
  console.log(`  Done — ${inserted} inserted, ${skipped} already existed`)
}

// Backfill missing data on existing events
async function backfill() {
  console.log('\n🔄 Backfilling existing events...')

  // Get events missing image_url or event_type
  const { data: events } = await supabase
    .from('content')
    .select('id, name, description, website, image_url, event_type, event_audience, instagram')
    .eq('category_id', EVENTS_CATEGORY_ID)
    .not('website', 'is', null)

  if (!events || events.length === 0) { console.log('  Nothing to backfill'); return }

  for (const event of events) {
    const updates = {}

    // Fix classification if missing
    if (!event.event_type) {
      const { types, audiences } = classifyEvent(event.name, event.description)
      updates.event_type = types[0] || 'Community'
      updates.event_audience = audiences
    }

    // Fix image if missing (check instagram field too from old hack)
    if (!event.image_url) {
      if (event.instagram && event.instagram.startsWith('http')) {
        updates.image_url = event.instagram
        updates.instagram = null
      } else if (event.website) {
        process.stdout.write(`  📸 "${event.name.substring(0, 35)}"... `)
        const img = await fetchEventImage(event.website)
        updates.image_url = img || null
        console.log(img ? '✅' : '—')
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('content').update(updates).eq('id', event.id)
    }
  }
  console.log('  Backfill complete')
}

async function main() {
  console.log('🕌 Nasiha Event Sync')
  console.log('====================')
  for (const feed of FEEDS) await syncFeed(feed)
  await backfill()
  console.log('\n✅ Done')
}
main().catch(console.error)
