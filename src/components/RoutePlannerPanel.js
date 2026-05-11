import React, { useEffect, useRef, useState } from 'react'
import { colors } from '../theme'
import { getPlaces, savePlace, deletePlace } from '../utils/places'

/**
 * RoutePlannerPanel — two-field route planning + saved-places management.
 *
 * Props:
 *   - userLocation: { lat, lng } | null
 *   - initialOrigin: { lat, lng, name } | null
 *   - corridorMiles, onCorridorChange
 *   - onPlan({ origin, destination })
 *   - onClose()
 */
export default function RoutePlannerPanel({ userLocation, initialOrigin, corridorMiles = 2, onCorridorChange, onPlan, onClose }) {
  const [places, setPlaces] = useState(getPlaces())
  const [origin, setOrigin] = useState(initialOrigin || (userLocation ? { ...userLocation, name: 'My Location', kind: 'gps' } : null))
  const [destination, setDestination] = useState(null)

  // 'chip' = showing chips; 'search' = showing autocomplete input
  const [originMode, setOriginMode] = useState('chip')
  // Destination: if user has no saved places, default to search input; else chip mode
  const [destMode, setDestMode] = useState(getPlaces().length > 0 ? 'chip' : 'search')

  // Save-as UI state (only shown after destination is picked AND not already saved)
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [saveAsLabel, setSaveAsLabel] = useState('')

  // Edit place modal
  const [editingPlace, setEditingPlace] = useState(null)

  const originInputRef = useRef(null)
  const destInputRef = useRef(null)
  const originAcRef = useRef(null)
  const destAcRef = useRef(null)

  // Refresh places list (called after save/delete)
  const refreshPlaces = () => setPlaces(getPlaces())

  // Attach autocomplete to origin search input
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
    if (destMode !== 'search' || !destInputRef.current) return
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
      const dest = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        name: place.name || place.formatted_address || 'Destination',
      }
      setDestination(dest)
      const alreadySaved = places.some(p =>
        Math.abs(p.lat - dest.lat) < 0.0005 && Math.abs(p.lng - dest.lng) < 0.0005
      )
      setShowSaveAs(!alreadySaved)
      if (places.length > 0) setDestMode('chip')
    })
    destAcRef.current = ac
  }, [destMode, places])

  const pickSavedAsOrigin = (p) => {
    setOrigin({ lat: p.lat, lng: p.lng, name: p.label, kind: 'saved', placeId: p.id })
  }
  const pickSavedAsDest = (p) => {
    setDestination({ lat: p.lat, lng: p.lng, name: p.label, placeId: p.id })
    setShowSaveAs(false)
  }

  const handleSaveAs = (forceLabel) => {
    const lbl = (forceLabel || saveAsLabel).trim()
    if (!destination || !lbl) return
    savePlace({
      label: lbl,
      name: destination.name,
      lat: destination.lat,
      lng: destination.lng,
    })
    refreshPlaces()
    setShowSaveAs(false)
    setSaveAsLabel('')
  }

  const handleDeletePlace = (id) => {
    if (!window.confirm('Remove this saved place?')) return
    deletePlace(id)
    refreshPlaces()
    setEditingPlace(null)
    if (origin?.placeId === id) setOrigin(null)
    if (destination?.placeId === id) setDestination(null)
  }

  const canPlan = origin && destination
  const handleFind = () => {
    if (!canPlan) return
    onPlan({ origin, destination })
  }

  const sortedPlaces = [...places].sort((a, b) => {
    if (a.id === 'home') return -1
    if (b.id === 'home') return 1
    return a.label.localeCompare(b.label)
  })

  return (
    <div style={{
      background: 'white', borderRadius: 14, padding: 14,
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      border: '1px solid rgba(0,0,0,0.08)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#1C2B3A', flex: 1 }}>🚗 Plan your route</span>
        <button onClick={onClose} style={closeButtonStyle} aria-label="Close">✕</button>
      </div>

      {/* FROM */}
      <FieldRow
        label="FROM"
        mode={originMode}
        chipContent={
          <>
            <Chip
              active={origin?.kind === 'gps'}
              disabled={!userLocation}
              onClick={() => setOrigin(userLocation ? { ...userLocation, name: 'My Location', kind: 'gps' } : null)}
            >📍 My Location</Chip>
            {sortedPlaces.map(p => (
              <Chip
                key={p.id}
                active={origin?.placeId === p.id}
                onClick={() => pickSavedAsOrigin(p)}
                onLongPress={() => setEditingPlace(p)}
              >{p.id === 'home' ? '🏠' : '📍'} {p.label}</Chip>
            ))}
            <Chip
              active={origin?.kind === 'search'}
              onClick={() => { setOriginMode('search'); setTimeout(() => originInputRef.current?.focus(), 50) }}
            >🔍 Other</Chip>
          </>
        }
        searchContent={
          <>
            <input ref={originInputRef} type="text" placeholder="Address, city, place..." autoFocus style={inputStyle} />
            <button onClick={() => setOriginMode('chip')} style={cancelStyle}>cancel</button>
          </>
        }
        subline={origin && originMode === 'chip' && origin.kind !== 'gps' ? truncate(origin.name, 40) : null}
      />

      {/* TO */}
      <FieldRow
        label="TO"
        mode={destMode}
        chipContent={
          <>
            {sortedPlaces.map(p => (
              <Chip
                key={p.id}
                active={destination?.placeId === p.id}
                onClick={() => pickSavedAsDest(p)}
                onLongPress={() => setEditingPlace(p)}
              >{p.id === 'home' ? '🏠' : '📍'} {p.label}</Chip>
            ))}
            <Chip
              active={destination && !destination.placeId}
              onClick={() => { setDestMode('search'); setTimeout(() => destInputRef.current?.focus(), 50) }}
            >🔍 {destination && !destination.placeId ? truncate(destination.name, 16) : 'Other'}</Chip>
          </>
        }
        searchContent={
          <>
            <input ref={destInputRef} type="text" placeholder="Where are you going?" autoFocus style={inputStyle} />
            {sortedPlaces.length > 0 && (
              <button onClick={() => setDestMode('chip')} style={cancelStyle}>cancel</button>
            )}
          </>
        }
        subline={destination && destMode === 'chip' && !destination.placeId ? truncate(destination.name, 40) : null}
      />

      {/* Save-as offer — only after picking a fresh destination */}
      {showSaveAs && destination && (
        <div style={{
          background: '#FFF7F0', borderRadius: 10, padding: 10, marginBottom: 10,
          border: '1px dashed rgba(194,65,12,0.3)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3A4A5A', marginBottom: 6 }}>
            Save this place for next time?
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {!places.some(p => p.id === 'home') && (
              <button onClick={() => handleSaveAs('Home')} style={savePresetStyle}>🏠 Home</button>
            )}
            <button onClick={() => handleSaveAs('Work')} style={savePresetStyle}>💼 Work</button>
            <input
              value={saveAsLabel}
              onChange={e => setSaveAsLabel(e.target.value)}
              placeholder="Custom label..."
              style={{ ...inputStyle, fontSize: 12, padding: '6px 8px', flex: 1, minWidth: 80 }}
            />
            <button
              onClick={() => handleSaveAs()}
              disabled={!saveAsLabel.trim()}
              style={{ ...savePresetStyle, background: saveAsLabel.trim() ? colors.brand : '#D7D2CB', color: 'white', border: 'none' }}
            >Save</button>
            <button onClick={() => setShowSaveAs(false)} style={{ ...cancelStyle, padding: '4px 6px' }}>skip</button>
          </div>
        </div>
      )}

      {/* Edit place inline panel */}
      {editingPlace && (
        <div style={{ background: '#F7F3EE', borderRadius: 10, padding: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3A4A5A', marginBottom: 4 }}>
            {editingPlace.id === 'home' ? '🏠' : '📍'} {editingPlace.label}
          </div>
          <div style={{ fontSize: 11, color: '#6A7A8A', marginBottom: 8 }}>{editingPlace.name}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => handleDeletePlace(editingPlace.id)} style={{ ...savePresetStyle, background: '#fee', color: '#a33', border: '1px solid #fcc' }}>Delete</button>
            <button onClick={() => setEditingPlace(null)} style={cancelStyle}>close</button>
          </div>
        </div>
      )}

      {/* Manage saved places hint */}
      {sortedPlaces.length > 0 && originMode === 'chip' && destMode === 'chip' && !editingPlace && !showSaveAs && (
        <div style={{ fontSize: 10, color: '#9AA5B0', marginBottom: 8, textAlign: 'center' }}>
          Long-press a saved place to edit or delete
        </div>
      )}

      {/* Corridor slider */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#6A7A8A', letterSpacing: 0.5 }}>DETOUR UP TO</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: colors.brand }}>{corridorMiles} mi</span>
        </div>
        <input
          type="range" min="1" max="10" step="0.5"
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
          width: '100%', padding: '10px 14px',
          background: canPlan ? colors.brand : '#D7D2CB',
          color: 'white', border: 'none', borderRadius: 10,
          fontSize: 13, fontWeight: 700,
          cursor: canPlan ? 'pointer' : 'not-allowed',
        }}
      >Find restaurants along the way</button>
    </div>
  )
}

/* ---------- subcomponents & styles ---------- */

function FieldRow({ label, mode, chipContent, searchContent, subline }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#6A7A8A', marginBottom: 4, letterSpacing: 0.5 }}>{label}</div>
      {mode === 'chip' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {chipContent}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {searchContent}
        </div>
      )}
      {subline && <div style={{ fontSize: 11, color: '#6A7A8A', marginTop: 4 }}>{subline}</div>}
    </div>
  )
}

function Chip({ active, disabled, onClick, onLongPress, children }) {
  const pressTimerRef = useRef(null)
  const handleDown = () => {
    if (!onLongPress) return
    pressTimerRef.current = setTimeout(() => {
      onLongPress()
      pressTimerRef.current = null
    }, 600)
  }
  const handleUp = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }
  return (
    <button
      onClick={onClick}
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      onMouseLeave={handleUp}
      onTouchStart={handleDown}
      onTouchEnd={handleUp}
      disabled={disabled}
      style={{
        background: active ? colors.brand : 'white',
        color: active ? 'white' : '#1C2B3A',
        border: active ? 'none' : '1px solid rgba(0,0,0,0.15)',
        borderRadius: 999, padding: '6px 10px',
        fontSize: 11, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
      }}
    >{children}</button>
  )
}

const inputStyle = {
  flex: 1, width: '100%',
  padding: '9px 11px',
  border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8,
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
}
const cancelStyle = {
  background: 'none', border: 'none', color: '#6A7A8A',
  fontSize: 11, cursor: 'pointer',
}
const savePresetStyle = {
  background: 'white', border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 999, padding: '6px 10px',
  fontSize: 11, fontWeight: 700, color: '#1C2B3A',
  cursor: 'pointer',
}
const closeButtonStyle = {
  background: 'none', border: 'none', fontSize: 18, color: '#6A7A8A',
  cursor: 'pointer', padding: 0, lineHeight: 1,
}

function truncate(s, n) {
  if (!s) return s
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
