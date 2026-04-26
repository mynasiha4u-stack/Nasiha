import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const tabs = [
  { path: '/',    icon: '🏠', label: 'Home' },
  { path: '/map', icon: '🗺️', label: 'Map'  },
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
              alignItems: 'center', gap: 2, padding: '7px 0 6px',
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: active ? '#C4500A' : '#6A7A8A'
            }}>{t.label}</span>
            {active && (
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                background: '#E8860A', marginTop: 1,
              }}/>
            )}
          </button>
        )
      })}
    </nav>
  )
}
