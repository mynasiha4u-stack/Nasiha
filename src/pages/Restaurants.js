import { colors, headerGradient } from '../theme'
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import ListingDetail from '../components/ListingDetail'

const card = { background: 'white', borderRadius: 14, marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }

// Bay Area cities by Muslim population — East Bay first
const POPULAR_CITIES = [
  'Pleasanton', 'San Ramon', 'Danville', 'Walnut Creek', 'Concord',
  'Fremont', 'Hayward', 'San Jose',
]

function popularRank(item) {
  const hay = `${item.location_address || ''} ${item.name || ''}`.toLowerCase()
  for (let i = 0; i < POPULAR_CITIES.length; i++) {
    if (hay.includes(POPULAR_CITIES[i].toLowerCase())) return i
  }
  return 999
}

function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

const HALAL_TIERS = [
  { key: 'all', label: 'All' },
  { key: 'hfsaa_zabihah', label: '🔵 HFSAA Zabihah' },
  { key: 'fully_halal', label: '🟢 Fully Halal' },
  { key: 'partially_halal', label: '🟡 Partially Halal' },
]

const TYPES = [
  { key: 'all', label: 'All' },
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'cafe', label: 'Cafe' },
  { key: 'grocery', label: 'Grocery & Meat' },
  { key: 'dessert', label: 'Dessert' },
]

const tierColors = {
  hfsaa_zabihah: { bg: '#E3F2FD', color: '#0288D1' },
  fully_halal: { bg: '#E8F5E9', color: '#2E7D32' },
  partially_halal: { bg: '#FFF8E1', color: '#9A6D00' },
  unknown: { bg: '#F0EEE8', color: '#666' },
}

function tierLabel(t) {
  if (t === 'hfsaa_zabihah') return 'HFSAA Zabihah'
  if (t === 'fully_halal') return 'Fully Halal'
  if (t === 'partially_halal') return 'Partially Halal'
  return ''
}

function RestaurantCard({ item, onTap, userLocation }) {
  const dist = userLocation && item.display_lat && item.display_lng
    ? distanceMiles(userLocation.lat, userLocation.lng, item.display_lat, item.display_lng)
    : null
  const directionsUrl = item.display_lat && item.display_lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${item.display_lat},${item.display_lng}`
    : item.location_address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.location_address)}`
    : null
  const tc = tierColors[item.halal_tier] || tierColors.unknown
  const cityFromAddr = item.location_address ? item.location_address.split(',')[0] : null
  return (
    <div onClick={() => onTap(item)} style={{ ...card, padding: 16, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, paddingRight: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 3, lineHeight: 1.3 }}>{item.name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: '#4a5a6a', fontWeight: 500 }}>📍 {cityFromAddr || item.location_area || 'Bay Area'}</div>
            {dist !== null && (
              <div style={{ fontSize: 12, color: colors.brand, fontWeight: 700 }}>{dist.toFixed(1)} mi</div>
            )}
          </div>
        </div>
        {item.halal_tier && item.halal_tier !== 'unknown' && (
          <span style={{ background: tc.bg, color: tc.color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0 }}>{tierLabel(item.halal_tier)}</span>
        )}
      </div>
      {(item.cuisine_clean || (item.types && item.types.length > 0)) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {item.cuisine_clean && (
            <span style={{ background: '#F7F3EE', color: '#3A4A5A', fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6 }}>{item.cuisine_clean}</span>
          )}
          {item.types && item.types.filter(t => t !== 'restaurant').map(t => (
            <span key={t} style={{ background: '#FFF0E8', color: '#C2410C', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, textTransform: 'capitalize' }}>{t === 'grocery' ? 'Grocery & Meat' : t}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {directionsUrl && (
          <a href={directionsUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ background: colors.brand, borderRadius: 8, padding: '7px 0', fontSize: 12, fontWeight: 600, color: 'white', textAlign: 'center', textDecoration: 'none' }}>Directions</a>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {item.phone && (
            <a href={`tel:${item.phone}`} onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: colors.textPrimary, textAlign: 'center', textDecoration: 'none' }}>📞 Call</a>
          )}
          {item.website && (
            <a href={item.website.startsWith('http') ? item.website : 'https://' + item.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: colors.textPrimary, textAlign: 'center', textDecoration: 'none' }}>🌐 Website</a>
          )}
          {item.instagram && (
            <a href={item.instagram} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: colors.textPrimary, textAlign: 'center', textDecoration: 'none' }}>📸 IG</a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Restaurants() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [tierFilter, setTierFilter] = useState(searchParams.get('tier') || 'all')
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all')
  const [cuisineFilter, setCuisineFilter] = useState(searchParams.get('cuisine') || 'all')
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'nearest')
  const [userLocation, setUserLocation] = useState(null)
  const [locationDenied, setLocationDenied] = useState(false)

  // Sync filter state to URL params (for sharing + map handoff)
  useEffect(() => {
    const params = {}
    if (search) params.q = search
    if (tierFilter !== 'all') params.tier = tierFilter
    if (typeFilter !== 'all') params.type = typeFilter
    if (cuisineFilter !== 'all') params.cuisine = cuisineFilter
    if (sortBy !== 'nearest') params.sort = sortBy
    setSearchParams(params, { replace: true })
  }, [search, tierFilter, typeFilter, cuisineFilter, sortBy, setSearchParams])

  useEffect(() => {
    if (!navigator.geolocation) { setLocationDenied(true); setSortBy('popular'); return }
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setLocationDenied(true); setSortBy('popular') }
    )
  }, [])

  useEffect(() => {
    async function load() {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'restaurants').single()
      if (!cat) { setLoading(false); return }
      // Fetch restaurants in Bay Area only for v1 (defer national rollout)
      const { data: contentRows } = await supabase.from('content')
        .select('id, name, url_slug, description, phone, email, website, instagram, facebook, location_address, location_area, display_lat, display_lng')
        .eq('category_id', cat.id)
        .eq('status', 'published')
        .eq('location_area', 'Bay Area')
      if (!contentRows) { setLoading(false); return }

      // Only fetch the attribute types we actually need (halal_tier, cuisine_clean, type)
      // This avoids hitting Supabase's row limits with all attribute types
      const ids = contentRows.map(r => r.id)
      const { data: attrs } = await supabase.from('attributes')
        .select('content_id, attribute_name, attribute_value')
        .in('content_id', ids)
        .in('attribute_name', ['halal_tier', 'cuisine_clean', 'type'])
        .limit(10000)

      // Index attributes by content_id
      const byId = new Map()
      ;(attrs || []).forEach(a => {
        if (!byId.has(a.content_id)) byId.set(a.content_id, { types: [] })
        const bucket = byId.get(a.content_id)
        if (a.attribute_name === 'type') bucket.types.push(a.attribute_value)
        else bucket[a.attribute_name] = a.attribute_value
      })

      const enriched = contentRows.map(r => {
        const a = byId.get(r.id) || { types: [] }
        return {
          ...r,
          halal_tier: a.halal_tier || 'unknown',
          cuisine: a.cuisine || null,
          cuisine_clean: a.cuisine_clean || null,
          types: a.types || [],
        }
      })
      setItems(enriched)
      setLoading(false)
    }
    load()
  }, [])

  // Build cuisine filter options dynamically from data
  const cuisines = ['all', ...new Set(items.map(i => i.cuisine_clean).filter(Boolean))].sort((a, b) => {
    if (a === 'all') return -1
    if (b === 'all') return 1
    return a.localeCompare(b)
  })

  const filtered = items.filter(item => {
    if (tierFilter !== 'all' && item.halal_tier !== tierFilter) return false
    if (typeFilter !== 'all' && !(item.types || []).includes(typeFilter)) return false
    if (cuisineFilter !== 'all' && item.cuisine_clean !== cuisineFilter) return false
    if (search) {
      const s = search.toLowerCase()
      return item.name.toLowerCase().includes(s) ||
        (item.cuisine_clean || '').toLowerCase().includes(s) ||
        (item.location_address || '').toLowerCase().includes(s)
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'az') return a.name.localeCompare(b.name)
    if (sortBy === 'nearest' && userLocation) {
      const aHas = a.display_lat && a.display_lng
      const bHas = b.display_lat && b.display_lng
      if (!aHas && !bHas) return a.name.localeCompare(b.name)
      if (!aHas) return 1
      if (!bHas) return -1
      return distanceMiles(userLocation.lat, userLocation.lng, a.display_lat, a.display_lng)
           - distanceMiles(userLocation.lat, userLocation.lng, b.display_lat, b.display_lng)
    }
    const ar = popularRank(a)
    const br = popularRank(b)
    if (ar !== br) return ar - br
    return a.name.localeCompare(b.name)
  })

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: headerGradient, padding: '48px 20px 20px' }}>
        <button onClick={() => navigate('/')} style={{ fontSize: 13, fontWeight: 700, color: colors.deep, marginBottom: 14, display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', marginBottom: 2 }}>🍽️ Restaurants</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.65)' }}>{items.length} halal spots in the Bay Area</p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Search */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search restaurants..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15 }} />
        </div>

        {/* Halal tier filter */}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 8, paddingBottom: 2, scrollbarWidth: 'none' }}>
          {HALAL_TIERS.map(t => (
            <button key={t.key} onClick={() => setTierFilter(t.key)} style={{
              padding: '6px 12px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              background: tierFilter === t.key ? colors.brand : 'white',
              color: tierFilter === t.key ? 'white' : colors.textSecondary,
              border: '1px solid rgba(0,0,0,0.1)',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Type filter */}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 8, paddingBottom: 2, scrollbarWidth: 'none' }}>
          {TYPES.map(t => (
            <button key={t.key} onClick={() => setTypeFilter(t.key)} style={{
              padding: '6px 12px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              background: typeFilter === t.key ? colors.deep : 'white',
              color: typeFilter === t.key ? 'white' : colors.textSecondary,
              border: '1px solid rgba(0,0,0,0.1)',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Cuisine filter */}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 10, paddingBottom: 2, scrollbarWidth: 'none' }}>
          {cuisines.map(c => (
            <button key={c} onClick={() => setCuisineFilter(c)} style={{
              padding: '6px 12px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              background: cuisineFilter === c ? '#1C2B3A' : 'white',
              color: cuisineFilter === c ? 'white' : '#3A4A5A',
              border: '1px solid rgba(0,0,0,0.1)',
            }}>{c === 'all' ? 'All Cuisines' : c}</button>
          ))}
        </div>

        {/* Sort + List/Map */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, display: 'flex', background: 'white', borderRadius: 12, padding: 3, border: `1px solid ${colors.border}` }}>
            {[
              { key: 'nearest', label: '📍 Nearest' },
              { key: 'popular', label: '⭐ Popular' },
              { key: 'az', label: 'A–Z' },
            ].map(s => (
              <button key={s.key} onClick={() => setSortBy(s.key)} disabled={s.key === 'nearest' && locationDenied} style={{
                flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
                cursor: s.key === 'nearest' && locationDenied ? 'not-allowed' : 'pointer',
                fontSize: 12, fontWeight: 600,
                background: sortBy === s.key ? colors.deep : 'transparent',
                color: sortBy === s.key ? 'white' : s.key === 'nearest' && locationDenied ? 'rgba(26,42,58,0.25)' : 'rgba(26,42,58,0.5)',
              }}>{s.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', background: 'white', borderRadius: 12, padding: 3, border: `1px solid ${colors.border}` }}>
            <button style={{ padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: colors.deep, color: 'white', whiteSpace: 'nowrap' }}>☰ List</button>
            <button onClick={() => {
              const qs = searchParams.toString()
              navigate(qs ? `/restaurants/map?${qs}` : '/restaurants/map')
            }} style={{ padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'transparent', color: '#3A4A5A', whiteSpace: 'nowrap' }}>🗺️ Map</button>
          </div>
        </div>

        {locationDenied && (
          <div style={{ background: '#fff8f0', border: '1px solid #e8a040', borderRadius: 12, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📍</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>Enable location for better results</div>
              <div style={{ fontSize: 12, color: '#3A4A5A', marginTop: 2 }}>Sort restaurants by closest to you</div>
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, color: '#6A7A8A', marginBottom: 8, fontWeight: 500 }}>
          {sorted.length} {sorted.length === 1 ? 'result' : 'results'}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#6A7A8A' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>Loading...
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#6A7A8A' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>No restaurants match your filters
          </div>
        ) : sorted.map(item => (
          <RestaurantCard key={item.id} item={item} userLocation={userLocation} onTap={() => item.url_slug && navigate(`/restaurants/${item.url_slug}`)} />
        ))}
      </div>
      <BottomNav />
    </div>
  )
}

// Restaurant detail page — scoped fetch (slug + category) since slugs are no longer globally unique
export function RestaurantDetail() {
  const { slug } = useParams()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'restaurants').single()
      if (!cat) { setLoading(false); return }
      const { data } = await supabase.from('content').select('*')
        .eq('url_slug', slug)
        .eq('category_id', cat.id)
        .single()
      if (!data) { setLoading(false); return }
      // Pull attributes for halal_tier, cuisine, type tags
      const { data: attrs } = await supabase.from('attributes')
        .select('attribute_name, attribute_value')
        .eq('content_id', data.id)
      const attrMap = { types: [] }
      ;(attrs || []).forEach(a => {
        if (a.attribute_name === 'type') attrMap.types.push(a.attribute_value)
        else attrMap[a.attribute_name] = a.attribute_value
      })
      setItem({ ...data, ...attrMap })
      setLoading(false)
    }
    load()
  }, [slug])

  // Build a badge from halal_tier + types for ListingDetail
  let badge = ''
  let badgeColor = { bg: '#F7F3EE', color: '#3A4A5A' }
  if (item) {
    if (item.halal_tier === 'hfsaa_zabihah') { badge = 'HFSAA Zabihah'; badgeColor = { bg: '#E3F2FD', color: '#0288D1' } }
    else if (item.halal_tier === 'fully_halal') { badge = 'Fully Halal'; badgeColor = { bg: '#E8F5E9', color: '#2E7D32' } }
    else if (item.halal_tier === 'partially_halal') { badge = 'Partially Halal'; badgeColor = { bg: '#FFF8E1', color: '#9A6D00' } }
  }

  return (
    <ListingDetail item={item} loading={loading} typeBadge={badge} typeColor={badgeColor} notFoundLabel="Restaurant not found" />
  )
}
