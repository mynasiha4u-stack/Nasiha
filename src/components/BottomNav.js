import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { colors } from '../theme'

const tabs = [
  { path: '/',    icon: '🏠', label: 'Home',    matches: (p) => p === '/' },
  { path: '/map', icon: '🗺️', label: 'Map',     matches: (p) => p === '/map' || p.endsWith('/map') },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user } = useAuth()

  // Account tab handles its own routing based on auth state
  const accountActive = pathname === '/account' || pathname.startsWith('/account/') || pathname === '/my-listings' || pathname === '/admin/review' || pathname === '/auth'
  const accountTarget = user ? '/account' : '/auth?mode=login'
  const accountLabel = user ? 'Account' : 'Sign in'
  const accountIcon = user ? '👤' : '→'

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430,
      background: 'white',
      borderTop: `1px solid rgba(0,0,0,0.08)`,
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 100,
    }}>
      {tabs.map(t => {
        const active = t.matches(pathname)
        return (
          <button key={t.path} onClick={() => navigate(t.path)} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 2, padding: '8px 0 7px',
            background: 'none', border: 'none', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: active ? colors.brand : colors.textMuted }}>{t.label}</span>
            {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: colors.brand }} />}
          </button>
        )
      })}

      {/* Account tab — third position */}
      <button onClick={() => navigate(accountTarget)} style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 2, padding: '8px 0 7px',
        background: 'none', border: 'none', cursor: 'pointer',
      }}>
        <span style={{ fontSize: 22 }}>{accountIcon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: accountActive ? colors.brand : colors.textMuted }}>{accountLabel}</span>
        {accountActive && <div style={{ width: 4, height: 4, borderRadius: '50%', background: colors.brand }} />}
      </button>
    </nav>
  )
}
