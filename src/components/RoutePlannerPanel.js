import React, { useEffect, useRef, useState } from 'react'
import { colors } from '../theme'
import { getHome, setHome as saveHomeUtil } from '../utils/home'

/**
 * RoutePlannerPanel — two-field panel for "On the way" route planning.
 *
 * Props:
 *   - userLocation: { lat, lng } | null — used as default origin
 *   - initialOrigin: { lat, lng, name } | null — optional pre-filled origin
 *   - onPlan({ origin, destination, saveAsHome }) — called when user taps Find
 *   - onClose() — dismiss panel
 *
 * The "From" field:
 *   - Defaults to "📍 My Location" if userLocation is available
 *   - Tappable to switch to a search input + autocomplete
 *   - Also shows quick-pick chips: My Location, Home (if set)
 *
 * The "To" field:
 *   - Autocomplete-only search input
 *   - "Save as Home" checkbox underneath
 */
export default function RoutePlannerPanel({ userLocation, initialOrigin, corridorMiles = 2, onCorridorChange, onPlan, onClose }) {
  const home = getHome()
  const [origin, setOrigin] = useState(initialOrigin || (userLocation ? { ...userLocation, name: 'My Location', kind: 'gps' } : null))
  const [destination, setDestination] = useState(null)
  const [saveAsHome, setSaveAsHome] = useState(false)
  const [originMode, setOriginMode] = useState('chip')  // 'chip' | 'search'

  const originInputRef = useRef(null)
  const destInputRef = useRef(null)
  const originAcRef = useRef(null)
  const destAcRef = useRef(null)

  // Attach autocomplete to origin input when in search mode
  useEffect(() => {
    if (originMode !== 'search' || !originInputRef.current) return
    if (!window.google?.maps?.places) return
    if (originAcRef.current?._inputEl === originInputRef.current) return

    const ac = new window.google.maps.places.Autocomplete(originInputRef.current, {
      types: ['geocode', 'establishment'],
      fields: ['geometry', 'name', 'formatted_address'],
    })
    ac._inputEl = originInputRef.current
    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place.geometry?.location) return
      setOrigin({
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        name: place.name || place.formatted_address || 'Selected',
        kind: 'search',
      })
      setOriginMode('chip')
    })
    originAcRef.current = ac
  }, [originMode])

  // Attach autocomplete to destination input
  useEffect(() => {
    if (!destInputRef.current) return
    if (!window.google?.maps?.places) return
    if (destAcRef.current?._inputEl === destInputRef.current) return

    const ac = new window.google.maps.places.Autocomplete(destInputRef.current, {
      types: ['geocode', 'establishment'],
      fields: ['geometry', 'name', 'formatted_address'],
    })
    ac._inputEl = destInputRef.current
    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place.geometry?.location) return
      setDestination({
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        name: place.name || place.formatted_address || 'Destination',
      })
    })
    destAcRef.current = ac
  }, [])

  const canPlan = origin && destination
  const handleFind = () => {
    if (!canPlan) return
    if (saveAsHome) saveHomeUtil(destination)
    onPlan({ origin, destination, saveAsHome })
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: 14,
      padding: 14,
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      border: '1px solid rgba(0,0,0,0.08)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#1C2B3A', flex: 1 }}>🚗 Plan your route</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', fontSize: 18, color: '#6A7A8A',
          cursor: 'pointer', padding: 0, lineHeight: 1,
        }} aria-label="Close">✕</button>
      </div>

      {/* From */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6A7A8A', marginBottom: 4, letterSpacing: 0.5 }}>FROM</div>
        {originMode === 'chip' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setOrigin(userLocation ? { ...userLocation, name: 'My Location', kind: 'gps' } : null)}
              style={chipStyle(origin?.kind === 'gps')}
              disabled={!userLocation}
            >📍 My Location</button>
            {home && (
              <button
                onClick={() => setOrigin({ ...home, kind: 'home' })}
                style={chipStyle(origin?.kind === 'home')}
              >🏠 Home</button>
            )}
            <button
              onClick={() => { setOriginMode('search'); setTimeout(() => originInputRef.current?.focus(), 50) }}
              style={chipStyle(origin?.kind === 'search')}
            >{origin?.kind === 'search' ? `📍 ${truncate(origin.name, 16)}` : '🔍 Other'}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              ref={originInputRef}
              type="text"
              placeholder="Address, city, place..."
              autoFocus
              style={inputStyle}
            />
            <button onClick={() => setOriginMode('chip')} style={cancelStyle}>cancel</button>
          </div>
        )}
        {origin && originMode === 'chip' && (
          <div style={{ fontSize: 11, color: '#6A7A8A', marginTop: 4 }}>{origin.name}</div>
        )}
      </div>

      {/* To */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6A7A8A', marginBottom: 4, letterSpacing: 0.5 }}>TO</div>
        <input
          ref={destInputRef}
          type="text"
          placeholder="Where are you going?"
          defaultValue={destination?.name || ''}
          style={inputStyle}
        />
        {destination && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer', fontSize: 11, color: '#3A4A5A' }}>
            <input type="checkbox" checked={saveAsHome} onChange={e => setSaveAsHome(e.target.checked)} />
            Save as Home (for quick access later)
          </label>
        )}
      </div>

      {/* Corridor width slider */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#6A7A8A', letterSpacing: 0.5 }}>DETOUR UP TO</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: colors.brand }}>{corridorMiles} mi</span>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          step="0.5"
          value={corridorMiles}
          onChange={(e) => onCorridorChange?.(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: colors.brand }}
        />
      </div>

      {/* Find button */}
      <button
        onClick={handleFind}
        disabled={!canPlan}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: canPlan ? colors.brand : '#D7D2CB',
          color: 'white',
          border: 'none',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          cursor: canPlan ? 'pointer' : 'not-allowed',
        }}
      >
        Find restaurants along the way
      </button>
    </div>
  )
}

const inputStyle = {
  flex: 1,
  width: '100%',
  padding: '9px 11px',
  border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 8,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

const cancelStyle = {
  background: 'none',
  border: 'none',
  color: '#6A7A8A',
  fontSize: 11,
  cursor: 'pointer',
}

function chipStyle(active) {
  return {
    background: active ? colors.brand : 'white',
    color: active ? 'white' : '#1C2B3A',
    border: active ? 'none' : '1px solid rgba(0,0,0,0.15)',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}

function truncate(s, n) {
  if (!s) return s
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
