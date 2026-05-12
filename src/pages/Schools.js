import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import ListingDetail, { cleanText } from '../components/ListingDetail'
import { colors, headerGradient, card } from '../theme'

const GRADE_FILTERS = [
  { key: 'Pre-K',                       label: 'Pre-K' },
  { key: 'Kindergarten',                label: 'Kindergarten' },
  { key: 'Grade School (1st - 8th)',    label: 'Grade School (1–8)' },
  { key: 'High School (9th - 12th)',    label: 'High School (9–12)' },
]

function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function SchoolCard({ item, onTap, userLocation }) {
  const dist = userLocation && item.display_lat && item.display_lng
    ? distanceMiles(userLocation.lat, userLocation.lng, item.display_lat, item.display_lng)
    : null
  const directionsUrl = item.display_lat && item.display_lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${item.display_lat},${item.display_lng}`
    : null

  return (
    <div onClick={() => onTap(item)} style={{ ...card, padding: 16, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, paddingRight: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 3, lineHeight: 1.3 }}>{item.name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {item.metro && <div style={{ fontSize: 12, color: '#4a5a6a', fontWeight: 500 }}>📍 {item.metro}</div>}
            {dist !== null && (
              <div style={{ fontSize: 12, color: colors.brand, fontWeight: 700 }}>{dist.toFixed(1)} mi</div>
            )}
          </div>
        </div>
      </div>

      {/* Grade chips */}
      {item.grades && item.grades.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {item.grades.map(g => {
            const def = GRADE_FILTERS.find(f => f.key === g)
            if (!def) return null
            return <span key={g} style={{ background: '#FFF0E8', color: '#C2410C', fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5 }}>{def.label}</span>
          })}
        </div>
      )}

      {item.description && (
        <div style={{ fontSize: 13, color: '#2a3a4a', lineHeight: 1.6, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {cleanText(item.description)}
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
          {item.email && (
            <a href={`mailto:${item.email}`} onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: colors.textPrimary, textAlign: 'center', textDecoration: 'none' }}>✉️ Email</a>
          )}
          {item.website && (
            <a href={item.website.startsWith('http') ? item.website : 'https://' + item.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: colors.textPrimary, textAlign: 'center', textDecoration: 'none' }}>🌐 Website</a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Schools() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState(new Set())  // multi-select
  const [sortBy, setSortBy] = useState('nearest')
  const [userLocation, setUserLocation] = useState(null)

  useEffect(() => {
    if (!navigator.geolocation) { setSortBy('az'); return }
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setSortBy('az')
    )
  }, [])

  useEffect(() => {
    async function load() {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'islamic-schools').single()
      if (!cat) { setLoading(false); return }
      const { data: rows } = await supabase.from('content').select('*')
        .eq('category_id', cat.id)
        .eq('status', 'published')
        .order('name')

      // Fetch grades attribute for each school
      const ids = (rows || []).map(r => r.id)
      let attrs = []
      if (ids.length > 0) {
        const { data: aRows } = await supabase.from('attributes')
          .select('content_id, attribute_name, attribute_value')
          .in('content_id', ids)
          .eq('attribute_name', 'grade')
        attrs = aRows || []
      }
      const gradesById = new Map()
      attrs.forEach(a => {
        if (!gradesById.has(a.content_id)) gradesById.set(a.content_id, [])
        gradesById.get(a.content_id).push(a.attribute_value)
      })

      setItems((rows || []).map(r => ({ ...r, grades: gradesById.get(r.id) || [] })))
      setLoading(false)
    }
    load()
  }, [])

  const toggleGrade = (key) => {
    const next = new Set(gradeFilter)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setGradeFilter(next)
  }

  const filtered = items.filter(item => {
    if (gradeFilter.size > 0) {
      const has = (item.grades || []).some(g => gradeFilter.has(g))
      if (!has) return false
    }
    if (search) {
      const s = search.toLowerCase()
      return item.name.toLowerCase().includes(s) ||
        (item.description || '').toLowerCase().includes(s) ||
        (item.metro || '').toLowerCase().includes(s)
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
    return a.name.localeCompare(b.name)
  })

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: headerGradient, padding: '48px 20px 22px' }}>
        <button onClick={() => navigate('/')} style={{ fontSize: 13, fontWeight: 700, color: colors.deep, marginBottom: 14, display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', marginBottom: 2 }}>🏫 Islamic Schools</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.65)' }}>{items.length} schools in the Bay Area</p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Search */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search schools..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15 }} />
        </div>

        {/* Grade filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {GRADE_FILTERS.map(g => {
            const active = gradeFilter.has(g.key)
            return (
              <button key={g.key} onClick={() => toggleGrade(g.key)}
                style={{
                  background: active ? colors.brand : 'white',
                  color: active ? 'white' : '#1C2B3A',
                  border: active ? 'none' : '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 999, padding: '6px 12px',
                  fontSize: 12, fontWeight: 700,
                  cursor: 'pointer',
                }}>{g.label}</button>
            )
          })}
        </div>

        {/* List/Map toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <div style={{ display: 'inline-flex', background: 'white', borderRadius: 12, padding: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
            <button style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#1C2B3A', color: 'white' }}>☰ List</button>
            <button onClick={() => navigate('/schools/map')} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'transparent', color: '#3A4A5A' }}>🗺️ Map</button>
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#6A7A8A', marginBottom: 8, fontWeight: 500 }}>
          {sorted.length} {sorted.length === 1 ? 'result' : 'results'}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6a7a8a' }}>Loading…</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(item => (
            <SchoolCard key={item.id} item={item} userLocation={userLocation} onTap={() => item.url_slug && navigate(`/schools/${item.url_slug}`)} />
          ))}
        </div>

        {!loading && sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#6a7a8a' }}>No schools match your filters.</div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

// Detail page reuses the shared ListingDetail
export function SchoolDetail() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'islamic-schools').single()
      if (!cat) { setLoading(false); return }
      const { data } = await supabase.from('content').select('*')
        .eq('category_id', cat.id).eq('url_slug', slug).maybeSingle()
      setItem(data)
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading…</div>
  if (!item) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p>School not found.</p>
      <button onClick={() => navigate('/schools')}>← Back to Schools</button>
    </div>
  )
  return <ListingDetail item={item} backTo="/schools" backLabel="Schools" />
}
