// chatStream.js — browser-side SSE client for the chat-completion Edge Function.
//
// Usage:
//   const abort = streamChat({
//     message,
//     history,           // [{role, content}, ...] for follow-up turns
//     category,          // optional category_slug filter
//     onRetrieval: (listings) => { ... },     // citation cards available
//     onDelta:     (text)     => { ... },     // append streamed text
//     onDone:      ()         => { ... },
//     onError:     (err)      => { ... },
//   })
//   // abort() cancels in-flight request

import { supabase } from './supabase'

const ENDPOINT = `${supabase.supabaseUrl}/functions/v1/chat-completion`

export function streamChat({ message, history = [], category = null, matchCount = 10, onRetrieval, onDelta, onDone, onError }) {
  const controller = new AbortController()

  ;(async () => {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabase.supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, history, category, match_count: matchCount }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
      }
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE events are separated by blank lines
        let idx
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const raw = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          dispatch(raw)
        }
      }
      if (buffer.trim()) dispatch(buffer)

      onDone && onDone()
    } catch (e) {
      if (e.name === 'AbortError') return
      onError && onError(e)
    }
  })()

  function dispatch(raw) {
    const lines = raw.split('\n')
    let event = 'message'
    let data = ''
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (!data) return

    if (event === 'retrieval') {
      try { onRetrieval && onRetrieval(JSON.parse(data).listings || []) } catch { /* ignore */ }
      return
    }
    if (event === 'done') return
    if (event === 'content_block_delta') {
      try {
        const p = JSON.parse(data)
        if (p.delta && p.delta.type === 'text_delta' && onDelta) onDelta(p.delta.text)
      } catch { /* ignore */ }
    }
    // Other anthropic events (message_start/stop, ping, etc.) ignored for the UI.
  }

  return () => controller.abort()
}

// Map a content row's category_slug → the React route prefix for its detail page.
const ROUTE_BY_CATEGORY = {
  restaurants:                '/restaurants',
  mosques:                    '/jummah',
  'home-cooked-food':         '/home-cooked-food-catering',
  childcare:                  '/childcare',
  lawyers:                    '/lawyers',
  'islamic-schools':          '/full-time-islamic-schools',
  'dessert-catering':         '/desserts-catering-event-planning',
  'event-services':           '/desserts-catering-event-planning',
  events:                     '/events',
}

export function listingRoute(listing) {
  const prefix = ROUTE_BY_CATEGORY[listing.category]
  if (!prefix || !listing.url_slug) return null
  return `${prefix}/${listing.url_slug}`
}
