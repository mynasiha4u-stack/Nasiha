#!/usr/bin/env node
/**
 * test-chat.js
 *
 * Calls the deployed chat-completion Edge Function and shows:
 *   1. The retrieved listings (id, name, category, city, RRF ranks).
 *   2. The streamed answer as it comes in.
 *
 * Usage:
 *   node scripts/test-chat.js "best biryani in Fremont"
 *   node scripts/test-chat.js "Friday prayer near Walnut Creek at 1:30 PM"
 *   node scripts/test-chat.js --category restaurants "good for a date night"
 *
 * Flags:
 *   --category <slug>   Restrict retrieval to one category (e.g. restaurants, mosques).
 *   --k <N>             match_count to ask for (default 10, max 25).
 *   --url <URL>         Override the Supabase Functions URL (default: production project).
 */

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1eW1oeGZob3FyeXhuanVicnl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY2OTMsImV4cCI6MjA5MTAwMjY5M30.yP_jGHNmJcGKaKXF7O-ctJaO8iqhujqZ8AKSGc_yGSY'

const argv = process.argv.slice(2)
let category = null
let matchCount = 10
let url = `${SUPABASE_URL}/functions/v1/chat-completion`
const positional = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--category') category = argv[++i]
  else if (a === '--k') matchCount = parseInt(argv[++i], 10)
  else if (a === '--url') url = argv[++i]
  else positional.push(a)
}
const message = positional.join(' ').trim()
if (!message) {
  console.error('Usage: node scripts/test-chat.js [--category SLUG] [--k N] "your question"')
  process.exit(1)
}

async function main() {
  console.log(`> ${message}${category ? `  (category=${category})` : ''}\n`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, category, match_count: matchCount }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`HTTP ${res.status}: ${text}`)
    process.exit(1)
  }
  if (!res.body) {
    console.error('No response body — function did not stream.')
    process.exit(1)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answerStarted = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by blank lines
    let idx
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      handleEvent(raw)
    }
  }

  function handleEvent(raw) {
    const lines = raw.split('\n')
    let event = 'message'
    let data = ''
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (!data) return

    if (event === 'retrieval') {
      try {
        const payload = JSON.parse(data)
        if (payload.debug) {
          console.log('─── Debug ───')
          console.log('  intent:           ', JSON.stringify(payload.debug.intent))
          if (payload.debug.intent_raw) console.log('  intent_raw:       ', JSON.stringify(payload.debug.intent_raw).slice(0, 200))
          if (payload.debug.intent_http_error) console.log('  intent_http_error:', payload.debug.intent_http_error)
          console.log('  google_key_set:   ', payload.debug.google_key_set)
          console.log('  geocode_attempted:', payload.debug.geocode_attempted)
          console.log('  geocode_status:   ', payload.debug.geocode_status)
          if (payload.debug.geocode_error) console.log('  geocode_error:    ', payload.debug.geocode_error)
          if (payload.debug.geocode_exception) console.log('  geocode_exception:', payload.debug.geocode_exception)
          console.log('  geocode_result:   ', payload.debug.geocode_result)
        }
        if (payload.location) {
          const r = payload.location.radius_miles ? `, radius ${payload.location.radius_miles}mi` : ''
          console.log(`─── Near: ${payload.location.name}${r} ───`)
        }
        printRetrieval(payload.listings)
      } catch (e) {
        console.error('Bad retrieval payload:', data)
      }
      return
    }
    if (event === 'done') {
      process.stdout.write('\n')
      return
    }
    if (event === 'content_block_delta') {
      try {
        const payload = JSON.parse(data)
        if (payload.delta && payload.delta.type === 'text_delta') {
          if (!answerStarted) {
            console.log('\n─── Answer ───')
            answerStarted = true
          }
          process.stdout.write(payload.delta.text)
        }
      } catch { /* ignore parse errors on non-text events */ }
    }
    // Other Anthropic events (message_start, content_block_start, message_delta,
    // message_stop, ping) are useful for debug but not needed for the test view.
  }
}

function printRetrieval(listings) {
  console.log(`─── Retrieved ${listings.length} listing(s) ───`)
  if (listings.length === 0) {
    console.log('  (none)')
    return
  }
  const w = Math.max(...listings.map(l => (l.name || '').length))
  for (const l of listings) {
    const name = (l.name || '').padEnd(Math.min(w, 50))
    const cat  = (l.category || '').padEnd(18)
    const city = (l.city || '').padEnd(14)
    const v = l.vec_rank != null ? `v#${l.vec_rank}`.padStart(5) : '  -  '
    const f = l.fts_rank != null ? `f#${l.fts_rank}`.padStart(5) : '  -  '
    const s = (l.rrf_score != null ? l.rrf_score.toFixed(4) : '   -  ').padStart(7)
    const d = (l.distance_miles != null ? `${l.distance_miles.toFixed(1)}mi` : '   -  ').padStart(7)
    console.log(`  ${name.slice(0, 50)}  ${cat}  ${city}  ${d}  ${v} ${f}  rrf=${s}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
