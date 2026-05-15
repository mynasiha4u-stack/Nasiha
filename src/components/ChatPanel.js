import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { streamChat, listingRoute } from '../lib/chatStream'
import { createConversation, appendMessage, loadConversation, deriveTitle } from '../lib/chatPersist'
import { colors } from '../theme'

/**
 * ChatPanel — the core conversational UI. Renders messages + input + citation cards.
 *
 * Props:
 *   - initialDraft       : optional string to pre-fill the input (e.g. Event Planning primer)
 *   - existingConversationId : optional UUID — load and continue a saved conversation
 *   - onConversationCreated  : called with the new conversation id when persistence kicks in
 *   - compact            : tighter spacing for the drawer view (true) vs full /chat page (false)
 */
export default function ChatPanel({ initialDraft = '', existingConversationId = null, onConversationCreated, compact = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  // messages: [{ id, role, content, retrieval?, status: 'pending'|'streaming'|'done'|'error' }]
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState(initialDraft)
  const [busy, setBusy] = useState(false)
  const [conversationId, setConversationId] = useState(existingConversationId)
  const [loading, setLoading] = useState(!!existingConversationId)
  const abortRef = useRef(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  // Load existing conversation if requested
  useEffect(() => {
    if (!existingConversationId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const rows = await loadConversation(existingConversationId)
        if (cancelled) return
        setMessages(rows.map(r => ({
          id: r.id,
          role: r.role,
          content: r.content,
          // We don't re-fetch retrieval card details for old turns to keep load fast.
          // (Could be added later via a `chat_messages.retrieved_content_ids` lookup.)
          retrieval: null,
          status: 'done',
        })))
      } catch (e) {
        console.error('Load conversation failed:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [existingConversationId])

  // Update draft when the parent changes initialDraft (e.g. event planning primer)
  useEffect(() => { setDraft(initialDraft) }, [initialDraft])

  // Auto-scroll to bottom as messages grow / stream
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Cancel any in-flight stream on unmount
  useEffect(() => () => { abortRef.current && abortRef.current() }, [])

  async function send() {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')

    const userMsg = { id: 'u_' + Date.now(), role: 'user', content: text, status: 'done' }
    const asstMsg = { id: 'a_' + Date.now(), role: 'assistant', content: '', retrieval: null, status: 'pending' }
    const nextMessages = [...messages, userMsg, asstMsg]
    setMessages(nextMessages)
    setBusy(true)

    // Build history from prior turns (everything before the new user message).
    // Send completed turns only — don't include the pending placeholder.
    const history = messages
      .filter(m => m.status === 'done')
      .map(m => ({ role: m.role, content: m.content }))

    // Persist the user message (if logged in)
    let convId = conversationId
    let savedUserMessageId = null
    if (user) {
      try {
        if (!convId) {
          const conv = await createConversation(user.id, deriveTitle(text))
          convId = conv.id
          setConversationId(convId)
          onConversationCreated && onConversationCreated(convId)
        }
        const saved = await appendMessage(convId, 'user', text)
        savedUserMessageId = saved.id
      } catch (e) {
        console.warn('Persist user message failed:', e)
      }
    }

    // Start streaming
    abortRef.current = streamChat({
      message: text,
      history,
      onRetrieval: (listings) => {
        setMessages(prev => prev.map(m =>
          m.id === asstMsg.id ? { ...m, retrieval: listings, status: 'streaming' } : m
        ))
      },
      onDelta: (chunk) => {
        setMessages(prev => prev.map(m =>
          m.id === asstMsg.id ? { ...m, content: m.content + chunk, status: 'streaming' } : m
        ))
      },
      onDone: async () => {
        setBusy(false)
        let finalContent = ''
        let retrievedIds = []
        setMessages(prev => {
          const updated = prev.map(m => {
            if (m.id !== asstMsg.id) return m
            finalContent = m.content
            retrievedIds = (m.retrieval || []).map(l => l.id)
            return { ...m, status: 'done' }
          })
          return updated
        })
        if (user && convId && finalContent) {
          try { await appendMessage(convId, 'assistant', finalContent, retrievedIds) }
          catch (e) { console.warn('Persist assistant message failed:', e) }
        }
      },
      onError: (err) => {
        console.error('Chat stream error:', err)
        setMessages(prev => prev.map(m =>
          m.id === asstMsg.id
            ? { ...m, content: m.content || 'Sorry — something went wrong. Please try again.', status: 'error' }
            : m
        ))
        setBusy(false)
      },
    })
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: '#F7F3EE' }}>
      {/* Messages scroller */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto',
        padding: compact ? '12px 14px' : '16px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {loading && (
          <div style={{ textAlign: 'center', color: '#6A7A8A', fontSize: 13, padding: 20 }}>Loading conversation…</div>
        )}

        {!loading && messages.length === 0 && (
          <EmptyState />
        )}

        {messages.map(m => (
          <Message key={m.id} m={m} compact={compact} onListingTap={(slugRoute) => { navigate(slugRoute) }} />
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        background: 'white',
        display: 'flex', gap: 8, alignItems: 'flex-end',
      }}>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask Nasiha about restaurants, mosques, events…"
          rows={1}
          style={{
            flex: 1, resize: 'none', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12,
            padding: '10px 12px', fontSize: 15, fontFamily: 'inherit',
            outline: 'none', maxHeight: 120, minHeight: 40,
          }}
        />
        <button
          onClick={send}
          disabled={busy || !draft.trim()}
          style={{
            background: busy || !draft.trim() ? '#cccccc' : colors.brand,
            color: 'white', border: 'none', borderRadius: 12,
            padding: '10px 16px', fontSize: 14, fontWeight: 700,
            cursor: busy || !draft.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >{busy ? '…' : 'Send'}</button>
      </div>
    </div>
  )
}

function EmptyState() {
  const examples = [
    'Best biryani in Fremont',
    'Friday prayer near Walnut Creek at 1:30 PM',
    'Home cooks who make desi food',
    'Wedding dessert vendors',
    'Halal Mexican spots in the East Bay',
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 0' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#1C2B3A' }}>Ask Nasiha ✨</div>
      <div style={{ fontSize: 14, color: '#6A7A8A', marginBottom: 6 }}>
        I know every restaurant, mosque, home cook, caterer, school, and event in the database. Ask me anything.
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#9A9A9A', marginTop: 4 }}>Try:</div>
      {examples.map(ex => (
        <div key={ex} style={{
          background: 'white', borderRadius: 10, padding: '10px 12px',
          fontSize: 13, color: '#1C2B3A', border: '1px solid rgba(0,0,0,0.06)',
        }}>{ex}</div>
      ))}
    </div>
  )
}

function Message({ m, compact, onListingTap }) {
  const isUser = m.role === 'user'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '88%',
        background: isUser ? colors.deep : 'white',
        color: isUser ? 'white' : '#1C2B3A',
        borderRadius: 14,
        padding: '10px 13px',
        fontSize: 14, lineHeight: 1.45,
        whiteSpace: 'pre-wrap',
        boxShadow: isUser ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
        border: isUser ? 'none' : '1px solid rgba(0,0,0,0.06)',
      }}>
        {m.status === 'pending' && !m.content
          ? <PendingDots label={m.retrieval == null ? 'Searching listings…' : 'Writing…'} />
          : (m.content || (m.status === 'error' ? 'Something went wrong.' : ''))}
        {m.status === 'streaming' && m.content && <BlinkingCursor />}
      </div>

      {!isUser && m.retrieval && m.retrieval.length > 0 && (
        <CitationStrip listings={m.retrieval} onTap={onListingTap} />
      )}
    </div>
  )
}

function PendingDots({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6A7A8A', fontSize: 13 }}>
      <span style={{ display: 'inline-flex', gap: 3 }}>
        <Dot delay={0} /><Dot delay={150} /><Dot delay={300} />
      </span>
      {label}
    </div>
  )
}

function Dot({ delay }) {
  return (
    <span style={{
      width: 6, height: 6, borderRadius: 999, background: '#9A9A9A', display: 'inline-block',
      animation: `nasiha-pulse 1s ${delay}ms infinite ease-in-out`,
    }} />
  )
}

function BlinkingCursor() {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 14, marginLeft: 2,
      background: '#1C2B3A', verticalAlign: 'middle',
      animation: 'nasiha-blink 1s infinite step-end',
    }} />
  )
}

function CitationStrip({ listings, onTap }) {
  return (
    <div style={{ width: '100%', overflowX: 'auto', scrollbarWidth: 'none' }}>
      <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
        {listings.map(l => {
          const route = listingRoute(l)
          return (
            <button
              key={l.id}
              onClick={() => route && onTap(route)}
              disabled={!route}
              style={{
                flex: '0 0 auto', maxWidth: 200,
                background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
                padding: '8px 10px', textAlign: 'left',
                cursor: route ? 'pointer' : 'default',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1C2B3A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
              <div style={{ fontSize: 10, color: '#6A7A8A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {l.city ? `${categoryEmoji(l.category)} ${l.city}` : categoryEmoji(l.category)}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function categoryEmoji(slug) {
  switch (slug) {
    case 'restaurants':         return '🍽️'
    case 'mosques':             return '🕌'
    case 'home-cooked-food':    return '🍲'
    case 'childcare':           return '👶'
    case 'lawyers':             return '⚖️'
    case 'islamic-schools':     return '🏫'
    case 'dessert-catering':    return '🍰'
    case 'event-services':      return '💐'
    case 'events':              return '📅'
    default:                    return '📍'
  }
}

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('nasiha-chat-anim')) {
  const style = document.createElement('style')
  style.id = 'nasiha-chat-anim'
  style.textContent = `
    @keyframes nasiha-pulse { 0%,80%,100% { opacity:0.3 } 40% { opacity:1 } }
    @keyframes nasiha-blink { 0%,50% { opacity:1 } 50.01%,100% { opacity:0 } }
  `
  document.head.appendChild(style)
}
