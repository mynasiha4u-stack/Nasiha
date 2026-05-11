import React, { useEffect, useRef, useState } from 'react'
import { colors } from '../theme'

/**
 * LocationSearch — Google Places Autocomplete input.
 *
 * Props:
 *   - onSelect({ lat, lng, name }) — called when user picks a place
 *   - onClear() — called when user clears the search
 *   - placeholder — input placeholder
 *   - variant: 'map' | 'list' — controls styling
 *   - currentLabel — if set, shown as a pill (e.g. "Searching near: Houston, TX [clear]")
 *
 * Google Places Autocomplete is loaded as part of the Google Maps script
 * (the &libraries=marker&v=weekly already pulls in places automatically when needed,
 * but we explicitly load `places` here too for safety).
 */
export default function LocationSearch({ onSelect, onClear, placeholder = 'Search nearby address...', variant = 'list', currentLabel = null }) {
  const inputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [text, setText] = useState('')

  // Ensure the 'places' library is loaded
  useEffect(() => {
    function placesAvailable() {
      return !!(window.google && window.google.maps && window.google.maps.places)
    }
    if (placesAvailable()) {
      setReady(true)
      return
    }

    // If a maps script is already loading/loaded but without 'places',
    // we need to load places explicitly. Google's loader is idempotent —
    // loading the script again with different libraries just adds them.
    const scriptSrc = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=marker,places&v=weekly`
    const existingWithPlaces = document.querySelector(`script[src*="libraries=marker,places"], script[src*="libraries=places"]`)
    if (!existingWithPlaces) {
      const script = document.createElement('script')
      script.src = scriptSrc
      script.async = true
      script.onload = () => {
        // After load, places might still be initializing; poll briefly
        let attempts = 0
        const poll = setInterval(() => {
          attempts++
          if (placesAvailable()) {
            setReady(true)
            clearInterval(poll)
          } else if (attempts > 20) {
            clearInterval(poll)
            console.warn('[LocationSearch] Places library did not become available after script load')
          }
        }, 150)
      }
      script.onerror = () => console.error('[LocationSearch] Failed to load Google Maps script')
      document.head.appendChild(script)
    } else {
      // Already loading — poll until ready
      let attempts = 0
      const poll = setInterval(() => {
        attempts++
        if (placesAvailable()) {
          setReady(true)
          clearInterval(poll)
        } else if (attempts > 40) {
          clearInterval(poll)
          console.warn('[LocationSearch] Places library never became available')
        }
      }, 200)
      return () => clearInterval(poll)
    }
  }, [])

  // Attach autocomplete to the input
  useEffect(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['geocode', 'establishment'],
      fields: ['geometry', 'name', 'formatted_address'],
    })
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace()
      if (!place.geometry?.location) return
      const lat = place.geometry.location.lat()
      const lng = place.geometry.location.lng()
      const name = place.name || place.formatted_address || 'Selected location'
      onSelect && onSelect({ lat, lng, name })
      setText('')
      // Blur to dismiss any open dropdown
      inputRef.current.blur()
    })
  }, [ready, onSelect])

  const handleClear = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setText('')
    if (inputRef.current) inputRef.current.value = ''
    onClear && onClear()
  }

  // If there's a current "searching near" label, show that instead of the input
  if (currentLabel) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'white', borderRadius: 999,
        padding: '8px 14px',
        border: `1.5px solid ${colors.brand}`,
        boxShadow: variant === 'map' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
        cursor: 'default',
      }}>
        <span style={{ fontSize: 14 }}>📍</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: colors.brand, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          Near: {currentLabel}
        </span>
        <button onClick={handleClear} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 14, color: '#6A7A8A', padding: 0, lineHeight: 1,
        }} aria-label="Clear">✕</button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'white', borderRadius: 12,
      padding: '9px 12px',
      border: '1px solid rgba(0,0,0,0.08)',
      boxShadow: variant === 'map' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
    }}>
      <span style={{ fontSize: 14, opacity: 0.6 }}>📍</span>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, border: 'none', outline: 'none',
          fontSize: 13, fontFamily: 'inherit', color: '#1C2B3A',
          background: 'transparent',
        }}
      />
    </div>
  )
}
