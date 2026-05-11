import React, { useEffect, useRef, useState } from 'react'
import { colors } from '../theme'
import { getHome, setHome as saveHomeUtil } from '../utils/home'

/**
 * LocationPicker — a dropdown that lets the user pick a "current location" mode:
 *   - GPS (user's actual location)
 *   - Home (if set)
 *   - Search (type any address)
 *
 * Returns to parent via onChange({ lat, lng, name, kind: 'gps' | 'home' | 'search' }).
 */
export default function LocationPicker({ value, onChange, userLocation, variant = 'list' }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('list')  // 'list' | 'searchHome' | 'searchOther'
  const home = getHome()
  const wrapRef = useRef(null)
  const searchInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const [text, setText] = useState('')

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setMode('list')
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Attach autocomplete when search modes are active
  useEffect(() => {
    if (mode === 'list' || !searchInputRef.current) return
    if (!window.google?.maps?.places) return
    if (autocompleteRef.current?._inputEl === searchInputRef.current) return

    const ac = new window.google.maps.places.Autocomplete(searchInputRef.current, {
      types: ['geocode', 'establishment'],
      fields: ['geometry', 'name', 'formatted_address'],
    })
    ac._inputEl = searchInputRef.current
    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place.geometry?.location) return
      const lat = place.geometry.location.lat()
      const lng = place.geometry.location.lng()
      const name = place.name || place.formatted_address || 'Selected'
      if (mode === 'searchHome') {
        saveHomeUtil({ lat, lng, name })
        onChange?.({ lat, lng, name, kind: 'home' })
      } else {
        onChange?.({ lat, lng, name, kind: 'search' })
      }
      setOpen(false)
      setMode('list')
      setText('')
    })
    autocompleteRef.current = ac
  }, [mode, onChange])

  const handleSelectGPS = () => {
    if (!userLocation) {
      alert('Location not yet detected. Please allow location access.')
      return
    }
    onChange?.({ lat: userLocation.lat, lng: userLocation.lng, name: 'My Location', kind: 'gps' })
    setOpen(false)
  }
  const handleSelectHome = () => {
    if (!home) {
      setMode('searchHome')
      setTimeout(() => searchInputRef.current?.focus(), 50)
      return
    }
    onChange?.({ lat: home.lat, lng: home.lng, name: 'Home', kind: 'home' })
    setOpen(false)
  }

  // Label shown on the button
  const label = value?.kind === 'gps' ? '📍 My Location'
              : value?.kind === 'home' ? '🏠 Home'
              : value?.name ? `📍 ${value.name.length > 18 ? value.name.slice(0, 16) + '…' : value.name}`
              : '📍 My Location'

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'white', border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 999, padding: '7px 12px',
        fontSize: 12, fontWeight: 700, color: '#1C2B3A',
        cursor: 'pointer',
        boxShadow: variant === 'map' ? '0 2px 6px rgba(0,0,0,0.12)' : 'none',
        whiteSpace: 'nowrap',
      }}>
        <span>{label}</span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          background: 'white', borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          border: '1px solid rgba(0,0,0,0.08)',
          minWidth: 240, zIndex: 100,
          overflow: 'hidden',
        }}>
          {mode === 'list' && (
            <>
              <button onClick={handleSelectGPS} style={dropdownItem(value?.kind === 'gps')}>
                <span style={{ fontSize: 16 }}>📍</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>My Location</div>
                  <div style={{ fontSize: 11, color: '#6A7A8A' }}>{userLocation ? 'Detected' : 'Not detected'}</div>
                </div>
              </button>
              <button onClick={handleSelectHome} style={dropdownItem(value?.kind === 'home')}>
                <span style={{ fontSize: 16 }}>🏠</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Home</div>
                  <div style={{ fontSize: 11, color: '#6A7A8A' }}>{home ? home.name : 'Tap to set'}</div>
                </div>
              </button>
              {home && (
                <button onClick={() => setMode('searchHome')} style={dropdownItem(false)}>
                  <span style={{ fontSize: 16 }}>✏️</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Change Home</div>
                  </div>
                </button>
              )}
              <button onClick={() => { setMode('searchOther'); setTimeout(() => searchInputRef.current?.focus(), 50) }} style={dropdownItem(false)}>
                <span style={{ fontSize: 16 }}>🔍</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Pick another place</div>
                  <div style={{ fontSize: 11, color: '#6A7A8A' }}>Search address, city</div>
                </div>
              </button>
            </>
          )}

          {(mode === 'searchHome' || mode === 'searchOther') && (
            <div style={{ padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6A7A8A', marginBottom: 6 }}>
                {mode === 'searchHome' ? 'Set Home address' : 'Pick a place'}
              </div>
              <input
                ref={searchInputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Address, city, place..."
                autoFocus
                style={{
                  width: '100%', padding: '9px 10px',
                  border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8,
                  fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button onClick={() => { setMode('list'); setText('') }} style={{
                marginTop: 6, background: 'none', border: 'none',
                color: '#6A7A8A', fontSize: 12, cursor: 'pointer',
              }}>← Back</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function dropdownItem(active) {
  return {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '10px 12px',
    background: active ? '#FFF0E8' : 'white',
    border: 'none', borderBottom: '1px solid rgba(0,0,0,0.05)',
    cursor: 'pointer', textAlign: 'left',
  }
}
