import { colors, headerGradient } from '../theme'
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import TopBar from '../components/TopBar'
import ListingDetail from '../components/ListingDetail'
import RecommendationStrip from '../components/RecommendationStrip'
import FilterDropdown from '../components/FilterDropdown'
import LocationSearch from '../components/LocationSearch'

const card = { background: 'white', borderRadius: 14, marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }

// Bay Area cities by Muslim population — East Bay first
const POPULAR_CITIES = [
  'Pleasanton', 'San Ramon', 'Danville', 'Walnut Creek', 'Concord',
  'Fremont', 'Hayward', 'San Jose',
]

function popularRank(item) {
  const hay = `${item.address || ''} ${item.name || ''}`.toLowerCase()
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

function cityFromAddress(addr) {
  if (!addr) return null
  // US-style: "123 Main St, City, ST 94538, USA" — second comma-separated part is the city
  const parts = addr.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length >= 2) return parts[1]
  return null
}

function RestaurantCard({ item, onTap, userLocation }) {
  const dist = userLocation && item.display_lat && item.display_lng
    ? distanceMiles(userLocation.lat, userLocation.lng, item.display_lat, item.display_lng)
    : null
  const directionsUrl = item.display_lat && item.display_lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${item.display_lat},${item.display_lng}`
    : item.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`
    : null
  const tc = tierColors[item.halal_tier] || tierColors.unknown
  const city = cityFromAddress(item.address)
  return (
    <div onClick={() => onTap(item)} style={{ ...card, padding: 16, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, paddingRight: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 3, lineHeight: 1.3 }}>{item.name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {city && <div style={{ fontSize: 12, color: '#4a5a6a', fontWeight: 500 }}>📍 {city}</div>}
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
  // Multi-select: each filter is a Set. Empty Set means "All" (no filter).
  const parseSet = (key) => {
    const v = searchParams.get(key)
    return new Set(v ? v.split(',') : [])
  }
  const [tierFilter, setTierFilter] = useState(parseSet('tier'))
  const [typeFilter, setTypeFilter] = useState(parseSet('type'))
  const [cuisineFilter, setCuisineFilter] = useState(parseSet('cuisine'))
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'nearest')
  const [userLocation, setUserLocation] = useState(null)
  const [locationDenied, setLocationDenied] = useState(false)
  // Search-nearby location (overrides Bay Area filter when set)
  const [nearbyLocation, setNearbyLocation] = useState(null)

  // Sync filter state -> URL (Sets serialized as comma-separated)
  useEffect(() => {
    const params = {}
    if (search) params.q = search
    if (tierFilter.size > 0) params.tier = [...tierFilter].join(',')
    if (typeFilter.size > 0) params.type = [...typeFilter].join(',')
    if (cuisineFilter.size > 0) params.cuisine = [...cuisineFilter].join(',')
    if (sortBy !== 'nearest') params.sort = sortBy
    setSearchParams(params, { replace: true })
  }, [search, tierFilter, typeFilter, cuisineFilter, sortBy, setSearchParams])

  // Toggle a value in a Set-based filter; "all" key clears it
  const toggleSetFilter = (setter, currentSet, key) => {
    if (key === 'all') { setter(new Set()); return }
    const next = new Set(currentSet)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setter(next)
  }

  useEffect(() => {
    if (!navigator.geolocation) { setLocationDenied(true); setSortBy('popular'); return }
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setLocationDenied(true); setSortBy('popular') }
    )
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'restaurants').single()
      if (!cat) { setLoading(false); return }

      // Build query: either bounding box around nearbyLocation, or Bay Area
      let query = supabase.from('content')
        .select('id, name, url_slug, description, phone, email, website, instagram, facebook, address, metro, display_lat, display_lng')
        .eq('category_id', cat.id)
        .eq('status', 'published')
        .not('display_lat', 'is', null)

      if (nearbyLocation) {
        // ~30 miles ≈ 0.43° lat. Adjust lng by latitude.
        const latRange = 0.43
        const lngRange = latRange / Math.cos(nearbyLocation.lat * Math.PI / 180)
        query = query
          .gte('display_lat', nearbyLocation.lat - latRange)
          .lte('display_lat', nearbyLocation.lat + latRange)
          .gte('display_lng', nearbyLocation.lng - lngRange)
          .lte('display_lng', nearbyLocation.lng + lngRange)
          .limit(500)
      } else {
        query = query.eq('metro', 'Bay Area')
      }

      const { data: contentRows } = await query
      if (!contentRows) { setLoading(false); return }

      // Chunk by content_ids: Supabase caps each query at 1000 rows server-side regardless of .limit/.range.
      const ids = contentRows.map(r => r.id)
      const CHUNK = 200
      let attrs = []
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK)
        const { data: page } = await supabase.from('attributes')
          .select('content_id, attribute_name, attribute_value')
          .in('content_id', slice)
          .in('attribute_name', ['halal_tier', 'cuisine_clean', 'type'])
        if (page) attrs = attrs.concat(page)
      }

      // Index attributes by content_id
      const byId = new Map()
      attrs.forEach(a => {
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
  }, [nearbyLocation])

  // Build cuisine filter options dynamically from data
  const cuisines = ['all', ...new Set(items.map(i => i.cuisine_clean).filter(Boolean))].sort((a, b) => {
    if (a === 'all') return -1
    if (b === 'all') return 1
    return a.localeCompare(b)
  })

  const filtered = items.filter(item => {
    if (tierFilter.size > 0 && !tierFilter.has(item.halal_tier)) return false
    if (typeFilter.size > 0 && !(item.types || []).some(t => typeFilter.has(t))) return false
    if (cuisineFilter.size > 0 && !cuisineFilter.has(item.cuisine_clean)) return false
    if (search) {
      const s = search.toLowerCase()
      return item.name.toLowerCase().includes(s) ||
        (item.cuisine_clean || '').toLowerCase().includes(s) ||
        (item.address || '').toLowerCase().includes(s)
    }
    return true
  })

  // Distance anchor: when "search nearby" is set, sort by distance to that point.
  // Otherwise sort by distance to the user's current location.
  const anchor = nearbyLocation || userLocation

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'az') return a.name.localeCompare(b.name)
    if ((sortBy === 'nearest' || nearbyLocation) && anchor) {
      const aHas = a.display_lat && a.display_lng
      const bHas = b.display_lat && b.display_lng
      if (!aHas && !bHas) return a.name.localeCompare(b.name)
      if (!aHas) return 1
      if (!bHas) return -1
      return distanceMiles(anchor.lat, anchor.lng, a.display_lat, a.display_lng)
           - distanceMiles(anchor.lat, anchor.lng, b.display_lat, b.display_lng)
    }
    const ar = popularRank(a)
    const br = popularRank(b)
    if (ar !== br) return ar - br
    return a.name.localeCompare(b.name)
  })

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: headerGradient, padding: '48px 20px 22px' }}>
        <div style={{ marginBottom: 10 }}>
          <TopBar />
        </div>
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => navigate('/')} style={{ fontSize: 13, fontWeight: 700, color: colors.deep, display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', marginBottom: 2 }}>🍽️ Restaurants</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.65)' }}>
          {nearbyLocation
            ? `${items.length} halal spots near ${nearbyLocation.name}`
            : `${items.length} halal spots in the Bay Area`}
        </p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Nearby location search */}
        <div style={{ marginBottom: 10 }}>
          <LocationSearch
            variant="list"
            placeholder="📍 Search nearby city, address, place..."
            currentLabel={nearbyLocation?.name}
            onSelect={(loc) => setNearbyLocation(loc)}
            onClear={() => setNearbyLocation(null)}
          />
        </div>

        {/* Search */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search restaurants..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15 }} />
        </div>

        {/* 3 inline filter dropdowns */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <FilterDropdown
            label="Halal Type"
            options={HALAL_TIERS.filter(t => t.key !== 'all')}
            selected={tierFilter}
            onChange={setTierFilter}
            accentColor={colors.brand}
          />
          <FilterDropdown
            label="Category"
            options={TYPES.filter(t => t.key !== 'all')}
            selected={typeFilter}
            onChange={setTypeFilter}
            accentColor={colors.deep}
          />
          <FilterDropdown
            label="Cuisine"
            options={cuisines.filter(c => c !== 'all').map(c => ({ key: c, label: c }))}
            selected={cuisineFilter}
            onChange={setCuisineFilter}
            accentColor="#1C2B3A"
          />
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

        {/* Top recommendation strip — small, swipeable, scrolls away naturally */}
        <RecommendationStrip
          items={filtered}
          userLocation={anchor}
          onCardTap={(r) => r.url_slug && navigate(`/restaurants/${r.url_slug}`)}
          variant="list"
        />

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
          <RestaurantCard key={item.id} item={item} userLocation={anchor} onTap={() => item.url_slug && navigate(`/restaurants/${item.url_slug}`)} />
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
