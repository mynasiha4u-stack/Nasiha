import React from 'react'
import { useNavigate } from 'react-router-dom'
import { colors } from '../theme'

/**
 * TopBar — a small "Nasiha" wordmark + home icon shown at the top of every page.
 * Tapping it navigates to '/'.
 *
 * Use this on every page header so users can always escape back to home
 * without pressing back-back-back.
 */
export default function TopBar() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/')}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.85)',
        border: 'none',
        borderRadius: 999,
        padding: '5px 12px 5px 10px',
        fontSize: 13, fontWeight: 800,
        color: colors.deep,
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
      aria-label="Go to Nasiha home"
    >
      <span style={{ fontSize: 14 }}>🏠</span>
      <span>Nasiha</span>
    </button>
  )
}
