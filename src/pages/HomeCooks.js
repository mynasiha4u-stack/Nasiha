import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import TopBar from '../components/TopBar'
import AddListingButton from '../components/AddListingButton'
import FilterDropdown from '../components/FilterDropdown'
import ListingDetail from '../components/ListingDetail'
import { colors, headerGradient } from '../theme'

const CUISINE_OPTIONS = [
  { key: 'Desi',           label: '🍛 Desi' },
  { key: 'Middle Eastern', label: '🥙 Middle Eastern' },
  { key: 'American',       label: '🍔 American' },
  { key: 'Bangladeshi',    label: '🇧🇩 Bangladeshi' },
  { key: 'BBQ',            label: '🔥 BBQ' },
  { key: 'Afghan',         label: '🇦🇫 Afghan' },
  { key: 'Fijian',         label: '🇫🇯 Fijian' },
  { key: 'Mexican',        label: '🌮 Mexican' },
  { key: 'Chinese',        label: '🥡 Chinese' },
]

const SERVICE_OPTIONS = [
  { key: 'Delivery Available', label: '🚚 Delivery' },
  { key: 'On Site Prep',       label: '🏠 On-site Prep' },
]

const ALL_TAGS = [...CUISINE_OPTIONS, ...SERVICE_OPTIONS]

const CITY_CACHE_KEY = 'nasiha:user_city_v1'

function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Strip structured "Delivery Offered: ..." / "On Site Prep: ..." trailers that appear
// at the end of many home-cook descriptions. The same info is already shown in tag chips.
function stripStructuredTrailers(text) {
  if (!text) return ''
  return text
    .replace(/Delivery Offered:\s*(Yes|No)\.?/gi, '')
    .replace(/On Site Prep:\s*(Yes|No)\.?/gi, '')
    .replace(/Services Offered:.*$/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

async function reverseGeocodeCity(lat, lng) {
  const key = process.env.REACT_APP_GOOGLE_MAPS_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`)
    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.length) return null
    for (const result of data.results) {
      const locality = (result.address_components || []).find(c => c.types.includes('locality'))
      if (locality) return locality.long_name
    }
    return null
  } catch {
    return null
  }
}

function CityPicker({ cities, value, onChange, detected }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const label = value
    ? `📍 ${value}${detected === value ? ' (you)' : ''}`
    : '📍 Pick your city'

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '9px 12px', borderRadius: 10,
        border: '1px solid rgba(0,0,0,0.12)', background: 'white',
        color: '#1C2B3A', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 6,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'white', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)',
          boxShadow: '0 6px 22px rgba(0,0,0,0.15)', zIndex: 100,
          maxHeight: 320, overflowY: 'auto',
        }}>
          {detected && (
            <button onClick={() => { onChange(detected); setOpen(false) }} style={{
              width: '100%', textAlign: 'left',
              padding: '10px 14px', fontSize: 13, fontWeight: 700,
              background: value === detected ? '#FFF3EB' : 'white',
              color: value === detected ? colors.brand : '#1C2B3A',
              border: 'none', borderBottom: '1px solid rgba(0,0,0,0.08)',
              cursor: 'pointer',
            }}>📍 {detected} (detected)</button>
          )}
          {cities.map(city => (
            <button key={city} onClick={() => { onChange(city); setOpen(false) }} style={{
              width: '100%', textAlign: 'left',
              padding: '10px 14px', fontSize: 13, fontWeight: value === city ? 700 : 500,
              background: value === city ? '#FFF3EB' : 'white',
              color: value === city ? colors.brand : '#1C2B3A',
              border: 'none', borderBottom: '1px solid rgba(0,0,0,0.04)',
              cursor: 'pointer',
            }}>{city}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function ContactButton({ href, external, children, style }) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      onClick={e => e.stopPropagation()}
      style={{
        flex: '1 1 calc(33.333% - 4px)', minWidth: 0,
        background: '#F7F3EE', borderRadius: 10, padding: '8px 0',
        fontSize: 12, fontWeight: 600, color: '#1C2B3A',
        textAlign: 'center', textDecoration: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        ...style,
      }}
    >{children}</a>
  )
}

function HomeCookCard({ item, onTap, distance, picksBadge }) {
  const visibleTags = (item.types || [])
    .filter(t => ALL_TAGS.find(f => f.key === t))
    .sort((a, b) => ALL_TAGS.findIndex(f => f.key === a) - ALL_TAGS.findIndex(f => f.key === b))
    .map(t => ALL_TAGS.find(f => f.key === t))

  const cleanedDesc = stripStructuredTrailers(item.description)
  const preview = cleanedDesc.length > 140 ? cleanedDesc.slice(0, 138).trimEnd() + '…' : cleanedDesc

  const igHref = item.instagram
    ? (item.instagram.startsWith('http') ? item.instagram : 'https://instagram.com/' + item.instagram.replace(/^@/, ''))
    : null
  const fbHref = item.facebook
    ? (item.facebook.startsWith('http') ? item.facebook : 'https://facebook.com/' + item.facebook.replace(/^@/, ''))
    : null
  const waDigits = item.whatsapp ? item.whatsapp.replace(/\D/g, '') : null
  const waHref = waDigits ? `https://wa.me/${waDigits}` : null
  const webHref = item.website
    ? (item.website.startsWith('http') ? item.website : 'https://' + item.website)
    : null

  return (
    <div onClick={onTap} style={{
      background: 'white', borderRadius: 14,
      border: '1px solid rgba(0,0,0,0.06)',
      padding: 14, cursor: 'pointer',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: 'linear-gradient(135deg, #FFE8DC 0%, #FED7BB 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>🍲</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1C2B3A' }}>{item.name}</div>
            {picksBadge && (
              <span style={{ fontSize: 9, fontWeight: 800, color: '#9A6D00', background: '#FFF3CD', padding: '2px 6px', borderRadius: 999, letterSpacing: 0.2 }}>✨ PICK</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            {item.service_area && (
              <div style={{ fontSize: 12, color: '#4a5a6a', fontWeight: 500 }}>📍 Based in {item.service_area}</div>
            )}
            {distance != null && (
              <div style={{ fontSize: 12, color: colors.brand, fontWeight: 700 }}>{distance.toFixed(1)} mi</div>
            )}
          </div>
          {preview && (
            <div style={{
              fontSize: 12, color: '#6A7A8A', lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>{preview}</div>
          )}
        </div>
      </div>

      {visibleTags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {visibleTags.map(t => (
            <span key={t.key} style={{
              fontSize: 10, fontWeight: 700,
              color: '#0F766E', background: '#E0F7F5',
              padding: '3px 7px', borderRadius: 999,
            }}>{t.label}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
        {item.phone && <ContactButton href={`tel:${item.phone}`}>📞 Call</ContactButton>}
        {item.email && <ContactButton href={`mailto:${item.email}`}>✉️ Email</ContactButton>}
        {webHref && <ContactButton href={webHref} external>🌐 Website</ContactButton>}
        {igHref && (
          <ContactButton href={igHref} external>
            <span style={{ display: 'inline-flex', width: 14, height: 14, background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', borderRadius: 3, alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 7, fontWeight: 800 }}>IG</span>
            Instagram
          </ContactButton>
        )}
        {fbHref && (
          <ContactButton href={fbHref} external>
            <span style={{ display: 'inline-flex', width: 14, height: 14, background: '#1877F2', borderRadius: 3, alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 9, fontWeight: 800 }}>f</span>
            Facebook
          </ContactButton>
        )}
        {waHref && <ContactButton href={waHref} external>💬 WhatsApp</ContactButton>}
      </div>
    </div>
  )
}

export default function HomeCooks() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cuisineFilter, setCuisineFilter] = useState(new Set())
  const [serviceFilter, setServiceFilter] = useState(new Set())
  const [sortBy, setSortBy] = useState('nearest') // 'nearest' | 'featured'
  // detectedCity: city name from geolocation+reverse-geocode (cached in localStorage)
  const [detectedCity, setDetectedCity] = useState(null)
  // selectedCity: user's active city — defaults to detected, can be overridden via dropdown
  const [selectedCity, setSelectedCity] = useState(null)
  const [locationDenied, setLocationDenied] = useState(false)

  // Load home cooks + their attribute tags
  useEffect(() => {
    async function load() {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'home-cooked-food').single()
      if (!cat) { setLoading(false); return }

      const { data: rows } = await supabase.from('content').select('*')
        .eq('category_id', cat.id)
        .eq('status', 'published')
        .order('name')

      const ids = (rows || []).map(r => r.id)
      let attrs = []
      if (ids.length > 0) {
        const { data: aRows } = await supabase.from('attributes')
          .select('content_id, attribute_name, attribute_value')
          .in('content_id', ids)
        attrs = aRows || []
      }
      const tagsById = new Map()
      attrs.forEach(a => {
        if (!tagsById.has(a.content_id)) tagsById.set(a.content_id, [])
        tagsById.get(a.content_id).push(a.attribute_value)
      })

      setItems((rows || []).map(r => ({ ...r, types: tagsById.get(r.id) || [] })))
      setLoading(false)
    }
    load()
  }, [])

  // Detect user's city — cache in localStorage so we don't ping Google repeatedly
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CITY_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && parsed.name) {
          setDetectedCity(parsed.name)
          setSelectedCity(prev => prev || parsed.name)
          return
        }
      }
    } catch { /* ignore */ }

    if (!navigator.geolocation) { setLocationDenied(true); return }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const city = await reverseGeocodeCity(lat, lng)
        if (city) {
          try { localStorage.setItem(CITY_CACHE_KEY, JSON.stringify({ name: city, lat, lng })) } catch { /* ignore */ }
          setDetectedCity(city)
          setSelectedCity(prev => prev || city)
        } else {
          setLocationDenied(true)
        }
      },
      () => setLocationDenied(true),
      { timeout: 8000 }
    )
  }, [])

  // Distinct service-area cities from the data (sorted alphabetically)
  const cityOptions = useMemo(() => {
    const set = new Set()
    items.forEach(i => { if (i.service_area) set.add(i.service_area) })
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [items])

  // Coordinates of the selectedCity — taken from any home cook in that city.
  // (Home cooks store city-level lat/lng under display_lat/display_lng.)
  const anchor = useMemo(() => {
    if (!selectedCity) return null
    const match = items.find(i => i.service_area === selectedCity && i.display_lat && i.display_lng)
    if (match) return { lat: match.display_lat, lng: match.display_lng }
    return null
  }, [selectedCity, items])

  // Filter: search + cuisine + service
  const filtered = useMemo(() => items.filter(item => {
    if (cuisineFilter.size > 0) {
      const match = [...cuisineFilter].some(c => (item.types || []).includes(c))
      if (!match) return false
    }
    if (serviceFilter.size > 0) {
      const match = [...serviceFilter].some(s => (item.types || []).includes(s))
      if (!match) return false
    }
    if (search.trim()) {
      const s = search.toLowerCase()
      return (item.name || '').toLowerCase().includes(s) ||
        (item.description || '').toLowerCase().includes(s) ||
        (item.service_area || '').toLowerCase().includes(s) ||
        (item.types || []).some(t => t.toLowerCase().includes(s))
    }
    return true
  }), [items, search, cuisineFilter, serviceFilter])

  // Annotate filtered with distance (relative to selected city anchor)
  const annotated = useMemo(() => filtered.map(item => {
    let dist = null
    if (anchor && item.display_lat && item.display_lng) {
      dist = distanceMiles(anchor.lat, anchor.lng, item.display_lat, item.display_lng)
    }
    return { ...item, _dist: dist }
  }), [filtered, anchor])

  // Sort
  const sorted = useMemo(() => {
    const arr = [...annotated]
    if (sortBy === 'featured') {
      return arr.sort((a, b) => {
        if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1
        return (a.name || '').localeCompare(b.name || '')
      })
    }
    // Near Me — sort by distance to selected city (ties → A–Z). No anchor → A–Z.
    if (!anchor) return arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return arr.sort((a, b) => {
      const da = a._dist
      const db = b._dist
      if (da == null && db == null) return (a.name || '').localeCompare(b.name || '')
      if (da == null) return 1
      if (db == null) return -1
      if (da === db) return (a.name || '').localeCompare(b.name || '')
      return da - db
    })
  }, [annotated, sortBy, anchor])

  // Featured strip — only show when there's at least one featured row matching filters
  const featuredPicks = useMemo(() => annotated.filter(i => i.featured), [annotated])

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 100 }}>
      <div style={{ background: headerGradient, padding: '48px 20px 22px' }}>
        <div style={{ marginBottom: 10 }}><TopBar /></div>
        <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/')} style={{ fontSize: 13, fontWeight: 700, color: colors.deep, display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
          <AddListingButton categorySlug="home-cooked-food" label="home cook" />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', marginBottom: 2 }}>🍲 Home Cooks</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.65)' }}>{items.length} home-based food businesses</p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Search */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search home cooks, cuisine, dishes..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15 }} />
        </div>

        {/* Cuisine + Service filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <FilterDropdown
            label="Cuisine"
            options={CUISINE_OPTIONS}
            selected={cuisineFilter}
            onChange={setCuisineFilter}
            accentColor={colors.brand}
          />
          <FilterDropdown
            label="Service"
            options={SERVICE_OPTIONS}
            selected={serviceFilter}
            onChange={setServiceFilter}
            accentColor={colors.deep}
          />
        </div>

        {/* Sort toggle: Near Me / Featured */}
        <div style={{ display: 'flex', background: 'white', borderRadius: 12, padding: 3, border: `1px solid ${colors.border}`, marginBottom: 10 }}>
          {[
            { key: 'nearest',  label: '📍 Near Me' },
            { key: 'featured', label: '✨ Featured' },
          ].map(s => (
            <button key={s.key} onClick={() => setSortBy(s.key)} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: sortBy === s.key ? colors.deep : 'transparent',
              color: sortBy === s.key ? 'white' : 'rgba(26,42,58,0.5)',
            }}>{s.label}</button>
          ))}
        </div>

        {/* City picker — visible always so user can override the detected city */}
        {sortBy === 'nearest' && cityOptions.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <CityPicker
              cities={cityOptions}
              value={selectedCity}
              detected={detectedCity}
              onChange={setSelectedCity}
            />
          </div>
        )}

        {locationDenied && sortBy === 'nearest' && !selectedCity && (
          <div style={{ background: '#fff8f0', border: '1px solid #e8a040', borderRadius: 12, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📍</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A' }}>Pick a city to sort by proximity</div>
              <div style={{ fontSize: 12, color: '#3A4A5A', marginTop: 2 }}>Location access was denied — choose a city above.</div>
            </div>
          </div>
        )}

        {/* MyNasiha Picks band — only when there are featured rows */}
        {!loading && featuredPicks.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1C2B3A', marginBottom: 6, letterSpacing: 0.2 }}>
              ✨ MyNasiha Picks
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {featuredPicks.map(item => (
                <div
                  key={item.id}
                  onClick={() => item.url_slug && navigate(`/home-cooked-food-catering/${item.url_slug}`)}
                  style={{
                    flex: '0 0 220px', background: 'white', borderRadius: 14,
                    border: '1px solid rgba(0,0,0,0.06)', padding: 12, cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: 'linear-gradient(135deg, #FFE8DC 0%, #FED7BB 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                    }}>🍲</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#1C2B3A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                  </div>
                  {item.service_area && (
                    <div style={{ fontSize: 11, color: '#4a5a6a' }}>📍 {item.service_area}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, color: '#6A7A8A', margin: '12px 0 8px', fontWeight: 500 }}>
          {sorted.length} {sorted.length === 1 ? 'home cook' : 'home cooks'}
          {(cuisineFilter.size > 0 || serviceFilter.size > 0) && ' matching your filters'}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6A7A8A' }}>Loading…</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(item => (
            <HomeCookCard
              key={item.id}
              item={item}
              distance={sortBy === 'nearest' ? item._dist : null}
              picksBadge={!!item.featured}
              onTap={() => item.url_slug && navigate(`/home-cooked-food-catering/${item.url_slug}`)}
            />
          ))}
        </div>

        {!loading && sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#6A7A8A', fontSize: 13 }}>
            No home cooks match. Try clearing filters.
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

export function HomeCookDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'home-cooked-food').single()
      if (!cat) { setLoading(false); return }

      const { data } = await supabase.from('content').select('*')
        .eq('category_id', cat.id)
        .eq('url_slug', slug)
        .single()
      setItem(data)
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6A7A8A' }}>Loading…</div>
  if (!item) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      Not found.
      <button onClick={() => navigate('/home-cooked-food-catering')}>← Back</button>
    </div>
  )

  return <ListingDetail item={item} backTo="/home-cooked-food-catering" backLabel="Home Cooks" />
}
