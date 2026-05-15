import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import ChatPanel from '../components/ChatPanel'
import { useAuth } from '../lib/AuthContext'
import { listConversations, deleteConversation } from '../lib/chatPersist'
import { colors, headerGradient } from '../theme'

/**
 * /chat — full-screen chat.
 * Auth users get a left sidebar of prior conversations (with new + delete).
 * Anonymous users get a single panel; suggestion to sign in to save history.
 */
export default function Chat() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeConvId = searchParams.get('c') || null
  const [conversations, setConversations] = useState([])
  const [showSidebar, setShowSidebar] = useState(false)
  // Bump this to force ChatPanel to remount with a fresh state (new chat / switch chat).
  const [panelKey, setPanelKey] = useState(0)

  // Load conversation list for auth users
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listConversations(user.id)
        if (!cancelled) setConversations(rows)
      } catch (e) { console.error('listConversations failed:', e) }
    })()
    return () => { cancelled = true }
  }, [user, panelKey])

  function newChat() {
    setSearchParams({}, { replace: true })
    setShowSidebar(false)
    setPanelKey(k => k + 1)
  }

  function openConv(id) {
    setSearchParams({ c: id }, { replace: true })
    setShowSidebar(false)
    setPanelKey(k => k + 1)
  }

  async function removeConv(id) {
    if (!window.confirm('Delete this conversation?')) return
    try {
      await deleteConversation(id)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (activeConvId === id) newChat()
    } catch (e) { alert('Failed: ' + e.message) }
  }

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: headerGradient, padding: '48px 20px 22px' }}>
        <div style={{ marginBottom: 10 }}><TopBar /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={() => navigate('/')} style={backBtn}>← Back</button>
          {user && (
            <button onClick={() => setShowSidebar(s => !s)} style={pillBtn}>
              {showSidebar ? '✕ Close' : '☰ History'}
            </button>
          )}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', marginBottom: 2 }}>✨ Ask Nasiha</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.65)' }}>
          {user ? 'Your conversation history is saved.' : 'Sign in to save your conversation history.'}
        </p>
      </div>

      {/* Sidebar overlay (auth users) */}
      {showSidebar && user && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 30,
        }} onClick={() => setShowSidebar(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, right: '20%',
            maxWidth: 320,
            background: 'white', padding: '20px 14px', overflowY: 'auto',
            boxShadow: '6px 0 20px rgba(0,0,0,0.15)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: '#1C2B3A' }}>Your conversations</div>
            <button onClick={newChat} style={{
              width: '100%', textAlign: 'left', padding: '10px 12px',
              background: colors.brand, color: 'white', border: 'none', borderRadius: 10,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 14,
            }}>+ New chat</button>

            {conversations.length === 0 && (
              <div style={{ fontSize: 13, color: '#6A7A8A' }}>No conversations yet.</div>
            )}

            {conversations.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4,
                background: c.id === activeConvId ? '#FFF3EB' : 'transparent',
                borderRadius: 8,
              }}>
                <button onClick={() => openConv(c.id)} style={{
                  flex: 1, textAlign: 'left', padding: '8px 10px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: '#1C2B3A',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{c.title || 'Untitled chat'}</button>
                <button onClick={() => removeConv(c.id)} aria-label="Delete" style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#9A9A9A', fontSize: 14, padding: '4px 8px',
                }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat panel — flex-1 so it fills remaining vertical space */}
      <div style={{ flex: 1, minHeight: 0, paddingBottom: 64 /* clear BottomNav */ }}>
        <ChatPanel
          key={panelKey}
          existingConversationId={activeConvId}
          onConversationCreated={(id) => setSearchParams({ c: id }, { replace: true })}
          compact={false}
        />
      </div>

      <BottomNav />
    </div>
  )
}

const backBtn = {
  fontSize: 13, fontWeight: 700, color: colors.deep,
  background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer',
  padding: '6px 12px', borderRadius: 999,
}
const pillBtn = {
  fontSize: 12, fontWeight: 700, color: 'white',
  background: colors.deep, border: 'none', cursor: 'pointer',
  padding: '6px 12px', borderRadius: 999,
}
