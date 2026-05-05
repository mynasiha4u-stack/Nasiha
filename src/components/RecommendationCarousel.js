import React, { useState } from 'react'
import { colors } from '../theme'

function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

const TIER_BADGE = {
  hfsaa_zabihah: { bg: '#E3F2FD', color: '#0288D1', label: 'HFSAA Zabihah' },
  fully_halal: { bg: '#E8F5E9', color: '#2E7D32', label: 'Fully Halal' },
  partially_halal: { bg: '#FFF8E1', color: '#9A6D00', label: 'Partially Halal' },
}

// A pleasant gradient placeholder hash'd from the restaurant name (so each gets a unique color)
function gradientFor(name) {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return `linear-gradient(135deg, hsl(${h}, 55%, 78%), hsl(${(h + 40) % 360}, 60%, 65%))`
}

/**
 * Floating "Need a recommendation?" carousel.
 * Props:
 *   items       - filtered list of restaurants (we'll sort by distance and take top 10)
 *   userLocation - {lat, lng} or null
 *   onCardTap   - (item) => void  // navigate to detail
 *   bottomOffset - number (px); default 80 to clear BottomNav. Map page can pass less.
 */
export default function RecommendationCarousel({ items, userLocation, onCardTap, bottomOffset = 80 }) {
  const [expanded, setExpanded] = useState(false)
  const [index, setIndex] = useState(0)

  // Build top-10 closest list from incoming filtered items
  const recs = (() => {
    if (!userLocation) {
      // Without location, just take first 10 alphabetically — better than nothing
      return [...items].slice(0, 10)
    }
    const withCoords = items.filter(i => i.display_lat && i.display_lng)
    return withCoords
      .map(i => ({ ...i, _dist: distanceMiles(userLocation.lat, userLocation.lng, i.display_lat, i.display_lng) }))
      .sort((a, b) => a._dist - b._dist)
      .slice(0, 10)
  })()

  if (recs.length === 0) return null

  // Collapsed pill
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          position: 'fixed', bottom: bottomOffset, right: 16, zIndex: 50,
          background: colors.brand, color: 'white',
          border: 'none', borderRadius: 999,
          padding: '11px 16px', fontSize: 13, fontWeight: 700,
          boxShadow: '0 4px 14px rgba(194,65,12,0.35)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 7,
        }}
        aria-label="Need a recommendation"
      >
        💡 Need a recommendation?
      </button>
    )
  }

  const r = recs[index]
  const tier = TIER_BADGE[r.halal_tier]
  const dist = userLocation && r.display_lat && r.display_lng
    ? distanceMiles(userLocation.lat, userLocation.lng, r.display_lat, r.display_lng)
    : null
  const directionsUrl = r.display_lat && r.display_lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${r.display_lat},${r.display_lng}`
    : null

  return (
    <div style={{
      position: 'fixed', bottom: bottomOffset, right: 16, zIndex: 50,
      width: 290, background: 'white', borderRadius: 16,
      boxShadow: '0 8px 28px rgba(0,0,0,0.2)',
      overflow: 'hidden',
    }}>
      {/* Header strip */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', background: colors.brand, color: 'white',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>💡 Recommendation {index + 1} of {recs.length}</span>
        <button
          onClick={() => { setExpanded(false); setIndex(0) }}
          style={{ background: 'none', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          aria-label="Close"
        >×</button>
      </div>

      {/* Photo placeholder */}
      <div style={{
        height: 110, background: gradientFor(r.name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36,
      }}>
        🍽️
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        <div
          onClick={() => onCardTap && onCardTap(r)}
          style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary, cursor: 'pointer', marginBottom: 4, lineHeight: 1.25 }}
        >{r.name}</div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          {dist !== null && (
            <span style={{ fontSize: 11, color: colors.brand, fontWeight: 700 }}>{dist.toFixed(1)} mi</span>
          )}
          {tier && (
            <span style={{ background: tier.bg, color: tier.color, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{tier.label}</span>
          )}
          {r.cuisine_clean && (
            <span style={{ background: '#F7F3EE', color: '#3A4A5A', fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}>{r.cuisine_clean}</span>
          )}
        </div>

        {/* Action row: directions + nav arrows */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => setIndex(i => (i - 1 + recs.length) % recs.length)}
            style={{ background: '#F7F3EE', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 14, fontWeight: 700, color: colors.textPrimary, cursor: 'pointer' }}
            aria-label="Previous"
          >‹</button>

          {directionsUrl && (
            <a href={directionsUrl} target="_blank" rel="noreferrer" style={{
              flex: 1, background: colors.brand, borderRadius: 8, padding: '8px 0',
              fontSize: 12, fontWeight: 700, color: 'white', textAlign: 'center', textDecoration: 'none',
            }}>Directions</a>
          )}

          <button
            onClick={() => setIndex(i => (i + 1) % recs.length)}
            style={{ background: '#F7F3EE', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 14, fontWeight: 700, color: colors.textPrimary, cursor: 'pointer' }}
            aria-label="Next"
          >›</button>
        </div>
      </div>
    </div>
  )
}
