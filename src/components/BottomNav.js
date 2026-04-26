import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const tabs = [
  { path: '/',        icon: '🏠', label: 'Home'   },
  { path: '/map',     icon: '🗺️', label: 'Map'    },
  { path: '/jummah',  icon: '🕌', label: 'Jummah' },
  { path: '/events',  icon: '📅', label: 'Events' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430,
      background: 'white',
      borderTop: '1px solid rgba(0,0,0,0.08)',
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 100,
    }}>
      {tabs.map(t => {
        const active = pathname === t.path
        return (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3, padding: '10px 0 8px',
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 26 }}>{t.icon}</span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: active ? '#1a2a3a' : 'rgba(26,42,58,0.35)'
            }}>{t.label}</span>
            {active && (
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                background: '#e8a040', marginTop: 1,
              }}/>
            )}
          </button>
        )
      })}
    </nav>
  )
}
