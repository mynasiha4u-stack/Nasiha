import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import ChatDrawer from './ChatDrawer'
import { colors } from '../theme'

/**
 * Floating ✨ button bottom-right that opens ChatDrawer.
 * Hidden on routes where the chat would conflict with the page (auth, admin, full chat page).
 *
 * Also exposes a global `window.openNasihaChat({ draft })` so individual pages
 * (e.g. EventPlanning primer) can launch the drawer with a pre-filled message
 * without prop-drilling through every page.
 */
export default function ChatLauncher() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const location = useLocation()

  // Hide on routes where the chat doesn't belong.
  const HIDDEN_PREFIXES = ['/auth', '/admin', '/chat']
  const hidden = HIDDEN_PREFIXES.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))

  // Expose a global so any page can trigger the drawer with a draft.
  useEffect(() => {
    window.openNasihaChat = (opts = {}) => {
      setDraft(opts.draft || '')
      setOpen(true)
    }
    return () => { try { delete window.openNasihaChat } catch { /* ignore */ } }
  }, [])

  // Reset draft after close so it doesn't leak into the next open
  useEffect(() => { if (!open) setDraft('') }, [open])

  if (hidden) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask Nasiha"
        style={{
          position: 'fixed',
          // Above the BottomNav (~64px), inside the 430px mobile column on wider screens,
          // and pinned 16px from the right edge on narrow viewports.
          bottom: 76,
          right: 'max(16px, calc(50vw - 215px + 16px))',
          width: 54, height: 54, borderRadius: 999,
          background: colors.brand, color: 'white',
          border: 'none', cursor: 'pointer',
          fontSize: 24, fontWeight: 800,
          boxShadow: '0 6px 20px rgba(194,65,12,0.45)',
          zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >✨</button>

      <ChatDrawer open={open} onClose={() => setOpen(false)} initialDraft={draft} />
    </>
  )
}
