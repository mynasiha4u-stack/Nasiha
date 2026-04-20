import React from 'react'

export default function AsrHero({ city, onCityTap, children }) {
  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(180deg, #7db8e8 0%, #a8d1f0 22%, #c8e4f8 40%, #e8d4b8 60%, #f0c090 76%, #f8e4b8 100%)',
      padding: '48px 20px 20px',
      overflow: 'hidden',
      minHeight: 0,
    }}>
      {/* Soft clouds */}
      <svg style={{ position:'absolute', top:'18%', left:'4%', opacity:0.15, width:130 }} viewBox="0 0 130 40">
        <ellipse cx="65" cy="25" rx="60" ry="14" fill="white"/>
        <ellipse cx="38" cy="19" rx="32" ry="11" fill="white"/>
        <ellipse cx="95" cy="21" rx="28" ry="10" fill="white"/>
      </svg>
      <svg style={{ position:'absolute', top:'35%', right:'6%', opacity:0.12, width:90 }} viewBox="0 0 90 30">
        <ellipse cx="45" cy="18" rx="40" ry="11" fill="white"/>
        <ellipse cx="28" cy="13" rx="22" ry="8" fill="white"/>
      </svg>

      {/* City toggle */}
      <button
        onClick={onCityTap}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.5)',
          border: '1px solid rgba(255,255,255,0.8)',
          borderRadius: 20, padding: '5px 12px 5px 8px',
          marginBottom: 10, marginTop: 0,
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#e8a040', display: 'inline-block'
        }}/>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1a2a3a' }}>{city}</span>
        <span style={{ fontSize: 10, color: 'rgba(26,42,58,0.5)' }}>▾</span>
      </button>

      {children}
    </div>
  )
}
