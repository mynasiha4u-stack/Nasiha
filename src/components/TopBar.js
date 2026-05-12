import React from 'react'
import { useNavigate } from 'react-router-dom'
import { colors } from '../theme'

/**
 * TopBar — the Nasiha wordmark shown at the top-left of every page.
 * Tapping it navigates to '/'. Just the logo, like any website.
 */
export default function TopBar() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/')}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        margin: 0,
        fontSize: 32,
        fontWeight: 900,
        color: '#1C2B3A',
        letterSpacing: -1,
        cursor: 'pointer',
        fontFamily: 'inherit',
        lineHeight: 1,
      }}
      aria-label="Nasiha home"
    >
      nasiha
    </button>
  )
}
