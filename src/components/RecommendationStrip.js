import React, { useState, useRef, useEffect } from 'react'
import { colors } from '../theme'

function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

const TIER_BADGE = {
  hfsaa_zabihah: { bg: '#E3F2FD', color: '#0288D1', label: 'HFSAA' },
  fully_halal: { bg: '#E8F5E9', color: '#2E7D32', label: 'Fully Halal' },
  partially_halal: { bg: '#FFF8E1', color: '#9A6D00', label: 'Partial' },
}

function gradientFor(name) {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return `linear-gradient(135deg, hsl(${h}, 55%, 75%), hsl(${(h + 50) % 360}, 60%, 60%))`
}

function cityFromAddress(addr) {
  if (!addr) return null
  const parts = addr.split(',').map(p => p.trim()).filter(Boolean)
  return parts.length >= 2 ? parts[1] : null
}

/**
 * Always-visible recommendation strip — swipeable card.
 *
 * Props:
 *   items           - filtered restaurant list (we sort by distance, take top 10)
 *   userLocation    - {lat, lng} or null
 *   onCardTap       - (item) => void (open detail page)
 *   onActiveChange  - (item) => void (called when active card changes; map can re-center/highlight)
 *   variant         - 'list' (compact, no shadow, no fixed positioning) | 'map' (floating overlay at bottom)
 */
export default function RecommendationStrip({ items, userLocation, onCardTap, onActiveChange, variant = 'list' }) {
  const [index, setIndex] = useState(0)
  const startX = useRef(null)
  const containerRef = useRef(null)

  const recs = (() => {
    if (!userLocation) return [...items].slice(0, 10)
    const withCoords = items.filter(i => i.display_lat && i.display_lng)
    return withCoords
      .map(i => ({ ...i, _dist: distanceMiles(userLocation.lat, userLocation.lng, i.display_lat, i.display_lng) }))
      .sort((a, b) => a._dist - b._dist)
      .slice(0, 10)
  })()

  // When recs change (filter changes), reset index
  useEffect(() => { setIndex(0) }, [recs.length, recs[0]?.id])

  // Notify parent when active changes
  useEffect(() => {
    if (onActiveChange && recs[index]) onActiveChange(recs[index])
  }, [index, recs, onActiveChange])

  if (recs.length === 0) return null

  const r = recs[index]
  const tier = TIER_BADGE[r.halal_tier]
  const dist = userLocation && r.display_lat && r.display_lng
    ? distanceMiles(userLocation.lat, userLocation.lng, r.display_lat, r.display_lng)
    : null
  const directionsUrl = r.display_lat && r.display_lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${r.display_lat},${r.display_lng}`
    : null
  const city = cityFromAddress(r.location_address)

  const next = () => setIndex(i => (i + 1) % recs.length)
  const prev = () => setIndex(i => (i - 1 + recs.length) % recs.length)

  // Touch handlers for swipe
  const onTouchStart = (e) => { startX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (startX.current === null) return
    const dx = e.changedTouches[0].clientX - startX.current
    if (Math.abs(dx) > 40) { dx < 0 ? next() : prev() }
    startX.current = null
  }

  const containerStyle = variant === 'map'
    ? {
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: 398,
        zIndex: 5,
      }
    : { width: '100%', marginBottom: 12 }

  return (
    <div style={containerStyle}>
      {/* Header strip */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 4px', marginBottom: 6,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: variant === 'map' ? 'white' : '#3A4A5A', textShadow: variant === 'map' ? '0 1px 3px rgba(0,0,0,0.5)' : 'none' }}>
          💡 Recommendations · {index + 1} of {recs.length}
        </span>
        <span style={{ fontSize: 10, color: variant === 'map' ? 'rgba(255,255,255,0.85)' : '#8A99A8', textShadow: variant === 'map' ? '0 1px 3px rgba(0,0,0,0.5)' : 'none' }}>
          swipe →
        </span>
      </div>

      {/* The card */}
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          background: 'white', borderRadius: 14,
          boxShadow: variant === 'map' ? '0 6px 24px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        {/* Photo placeholder strip on the left */}
        <div style={{
          width: 86, flexShrink: 0,
          background: gradientFor(r.name),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}>🍽️</div>

        {/* Content */}
        <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div onClick={() => onCardTap && onCardTap(r)} style={{
            fontSize: 13, fontWeight: 800, color: '#1C2B3A', cursor: 'pointer',
            lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{r.name}</div>

          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            {dist !== null && <span style={{ fontSize: 10, color: colors.brand, fontWeight: 700 }}>{dist.toFixed(1)} mi</span>}
            {city && <span style={{ fontSize: 10, color: '#6A7A8A' }}>· {city}</span>}
          </div>

          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 'auto' }}>
            {tier && <span style={{ background: tier.bg, color: tier.color, fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 3 }}>{tier.label}</span>}
            {r.cuisine_clean && <span style={{ background: '#F7F3EE', color: '#3A4A5A', fontSize: 8, fontWeight: 600, padding: '2px 5px', borderRadius: 3 }}>{r.cuisine_clean}</span>}
            {(r.types || []).filter(t => t !== 'restaurant').slice(0, 1).map(t => {
              const lab = t === 'grocery' ? 'Grocery' : t.charAt(0).toUpperCase() + t.slice(1)
              return <span key={t} style={{ background: '#FFF0E8', color: '#C2410C', fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 3 }}>{lab}</span>
            })}
          </div>
        </div>

        {/* Navigation buttons stacked on the right */}
        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={prev} aria-label="Previous" style={{
            flex: 1, width: 32, background: 'white', border: 'none',
            fontSize: 14, fontWeight: 700, color: '#1C2B3A', cursor: 'pointer',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}>‹</button>
          <button onClick={next} aria-label="Next" style={{
            flex: 1, width: 32, background: 'white', border: 'none',
            fontSize: 14, fontWeight: 700, color: '#1C2B3A', cursor: 'pointer',
          }}>›</button>
        </div>
      </div>

      {/* Directions row below the card */}
      {directionsUrl && (
        <a href={directionsUrl} target="_blank" rel="noreferrer" style={{
          display: 'block', marginTop: 6,
          background: colors.brand, borderRadius: 10, padding: '8px 0',
          fontSize: 12, fontWeight: 700, color: 'white', textAlign: 'center', textDecoration: 'none',
        }}>Directions to {r.name.length > 20 ? r.name.slice(0, 18) + '…' : r.name}</a>
      )}
    </div>
  )
}
