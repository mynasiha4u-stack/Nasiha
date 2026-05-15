import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ChatPanel from './ChatPanel'
import { colors } from '../theme'

/**
 * Bottom-sheet wrapper that hosts ChatPanel.
 * - Slides up from the bottom on mobile, takes ~72vh.
 * - Tapping the dark backdrop closes the drawer.
 * - "↗ Open full chat" button navigates to /chat for the full experience.
 */
export default function ChatDrawer({ open, onClose, initialDraft }) {
  const navigate = useNavigate()

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 998, animation: 'nasiha-fade-in 180ms ease-out',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#F7F3EE',
        borderTopLeftRadius: 18, borderTopRightRadius: 18,
        height: '72vh', maxHeight: '720px',
        zIndex: 999, display: 'flex', flexDirection: 'column',
        boxShadow: '0 -10px 32px rgba(0,0,0,0.2)',
        animation: 'nasiha-slide-up 220ms ease-out',
        // Center the sheet within the app's 430px mobile column on wider screens
        maxWidth: 430, margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)',
          background: 'white',
          borderTopLeftRadius: 18, borderTopRightRadius: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#1C2B3A' }}>Ask Nasiha</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { onClose(); navigate('/chat') }} style={pillBtn}>↗ Full chat</button>
            <button onClick={onClose} style={{ ...pillBtn, background: 'transparent', color: '#6A7A8A' }}>✕</button>
          </div>
        </div>

        {/* Panel */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <ChatPanel initialDraft={initialDraft} compact={true} />
        </div>
      </div>

      <DrawerAnimations />
    </>
  )
}

const pillBtn = {
  background: colors.brand, color: 'white', border: 'none',
  borderRadius: 999, padding: '6px 12px',
  fontSize: 12, fontWeight: 700, cursor: 'pointer',
}

function DrawerAnimations() {
  // Inject keyframes once
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('nasiha-drawer-anim')) return
    const style = document.createElement('style')
    style.id = 'nasiha-drawer-anim'
    style.textContent = `
      @keyframes nasiha-slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
      @keyframes nasiha-fade-in  { from { opacity: 0 } to { opacity: 1 } }
    `
    document.head.appendChild(style)
  }, [])
  return null
}
