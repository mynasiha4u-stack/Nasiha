import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import AddListingButton from '../components/AddListingButton'
import TopBar from '../components/TopBar'
import ListingDetail, { cleanText } from '../components/ListingDetail'
import { colors, headerGradient, card } from '../theme'

// Filter groups — keep canonical values matching DB attribute_value
// Three filter dropdowns:
//   1. Service Type (uses content.tags — desserts vs event-services from the merged categories)
//   2. Services offered (uses attributes.event_type — decor/planners/florist/etc.)
//   3. Delivery & Setup (subset of attributes — delivery vs on-site setup)
const SERVICE_TYPE_OPTIONS = [
  { value: '',                key: '',                  label: 'All service types' },
  { value: 'desserts',        key: 'desserts',          label: '🍰 Desserts & Drinks' },
  { value: 'event-services',  key: 'event-services',    label: '💐 Catering & Event Services' },
]

const SERVICES_OPTIONS = [
  { value: '',                                          label: 'All services' },
  { value: 'Event Decor',                               label: 'Decor' },
  { value: 'Event Planners',                            label: 'Planners' },
  { value: 'Florist/Garlands',                          label: 'Florist' },
  { value: 'Henna/Mehndi Artist',                       label: 'Mehndi' },
  { value: 'Makeup & Hair',                             label: 'Makeup & Hair' },
  { value: 'Photography & Videography',                 label: 'Photography' },
  { value: 'Cakes, Baked Goods, and More',              label: 'Cakes & Desserts' },
  { value: 'Chai, Coffee, and Speciality Drinks',       label: 'Chai & Drinks' },
]

const DELIVERY_OPTIONS = [
  { value: '',                                          label: 'Delivery or on-site' },
  { value: 'Delivery Offered',                          label: '🚚 Delivery' },
  { value: 'Mobile Pop Up',                             label: '🎪 On-site Setup' },
]

const selectStyle = {
  flex: 1, minWidth: 0, padding: '9px 8px',
  border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10,
  fontSize: 12, fontWeight: 600, color: '#1C2B3A',
  background: 'white', cursor: 'pointer',
  fontFamily: 'inherit', appearance: 'menulist',
}

// Flat lookup table used by VendorCard to render the small tag chips on each card.
// Maps the raw attribute value (e.g. 'Event Decor') -> short display label (e.g. 'Decor').
const ALL_FILTERS = [
  ...SERVICES_OPTIONS.filter(o => o.value).map(o => ({ key: o.value, label: o.label })),
  ...DELIVERY_OPTIONS.filter(o => o.value).map(o => ({ key: o.value, label: o.label })),
]

function VendorCard({ item, onTap }) {
  return (
    <div onClick={() => onTap(item)} style={{ ...card, padding: 16, cursor: 'pointer' }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 6, lineHeight: 1.3 }}>{item.name}</div>
        {/* Type chips */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {(item.types || [])
            .slice()
            .sort((a, b) => ALL_FILTERS.findIndex(f => f.key === a) - ALL_FILTERS.findIndex(f => f.key === b))
            .map(t => {
              const def = ALL_FILTERS.find(f => f.key === t)
              const label = def?.label || t
              return <span key={t} style={{ background: '#E0F7F5', color: '#0F766E', fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5 }}>{label}</span>
            })}
        </div>
      </div>

      {item.description && (
        <div style={{ fontSize: 13, color: '#2a3a4a', lineHeight: 1.6, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {cleanText(item.description)}
        </div>
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
        {item.instagram && (
          <a href={item.instagram.startsWith('http') ? item.instagram : 'https://instagram.com/' + item.instagram.replace('@', '')} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: colors.textPrimary, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', width: 16, height: 16, background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', borderRadius: 4, alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 8, fontWeight: 800 }}>IG</span>
            Instagram
          </a>
        )}
        {!item.phone && !item.email && !item.website && !item.instagram && (
          <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.4)', fontStyle: 'italic', padding: '4px 0' }}>Tap for details</div>
        )}
      </div>
    </div>
  )
}

export default function EventPlanning() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  // Three filter dropdowns
  const [serviceType, setServiceType] = useState('')  // '' | 'desserts' | 'event-services'
  const [serviceFilter, setServiceFilter] = useState('')  // attribute value e.g. 'Event Decor'
  const [deliveryFilter, setDeliveryFilter] = useState('')  // 'Delivery Offered' or 'Mobile Pop Up'

  useEffect(() => {
    async function load() {
      // Get both category IDs
      const { data: cats } = await supabase.from('categories').select('id, slug')
        .in('slug', ['event-services', 'dessert-catering'])
      if (!cats || cats.length === 0) { setLoading(false); return }
      const catIds = cats.map(c => c.id)

      const { data: rows } = await supabase.from('content').select('*')
        .in('category_id', catIds)
        .eq('status', 'published')
        .order('name')

      const ids = (rows || []).map(r => r.id)
      let attrs = []
      if (ids.length > 0) {
        const { data: aRows } = await supabase.from('attributes')
          .select('content_id, attribute_value')
          .in('content_id', ids)
          .eq('attribute_name', 'event_type')
        attrs = aRows || []
      }
      const tById = new Map()
      attrs.forEach(a => {
        if (!tById.has(a.content_id)) tById.set(a.content_id, [])
        tById.get(a.content_id).push(a.attribute_value)
      })

      setItems((rows || []).map(r => ({ ...r, types: tById.get(r.id) || [] })))
      setLoading(false)
    }
    load()
  }, [])

  const filtered = items.filter(item => {
    // Service type: uses tags column
    if (serviceType) {
      if (!Array.isArray(item.tags) || !item.tags.includes(serviceType)) return false
    }
    // Services offered: uses attributes (event_type)
    if (serviceFilter && !(item.types || []).includes(serviceFilter)) return false
    // Delivery vs on-site: uses attributes (event_type)
    if (deliveryFilter && !(item.types || []).includes(deliveryFilter)) return false
    // Search
    if (search.trim()) {
      const s = search.toLowerCase()
      return item.name.toLowerCase().includes(s) ||
        (item.description || '').toLowerCase().includes(s) ||
        (item.types || []).some(t => t.toLowerCase().includes(s))
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: headerGradient, padding: '48px 20px 22px' }}>
        <div style={{ marginBottom: 10 }}>
          <TopBar />
        </div>
        <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/')} style={{ fontSize: 13, fontWeight: 700, color: colors.deep, display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
          <AddListingButton categorySlug="event-services" label="vendor" />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', marginBottom: 2 }}>💐 Desserts, Catering & Event Planning</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.65)' }}>{items.length} vendors for your event</p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Search */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15 }} />
        </div>

        {/* Three filter dropdowns side by side */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <select value={serviceType} onChange={e => setServiceType(e.target.value)} style={selectStyle}>
            {SERVICE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} style={selectStyle}>
            {SERVICES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={deliveryFilter} onChange={e => setDeliveryFilter(e.target.value)} style={selectStyle}>
            {DELIVERY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div style={{ fontSize: 12, color: '#6A7A8A', margin: '12px 0 8px', fontWeight: 500 }}>
          {sorted.length} {sorted.length === 1 ? 'vendor' : 'vendors'}
          {(serviceType || serviceFilter || deliveryFilter) && ' matching your filters'}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6a7a8a' }}>Loading…</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(item => (
            <VendorCard key={item.id} item={item} onTap={() => item.url_slug && navigate(`/desserts-catering-event-planning/${item.url_slug}`)} />
          ))}
        </div>

        {!loading && sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#6a7a8a' }}>No vendors match your filters.</div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

export function EventVendorDetail() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: cats } = await supabase.from('categories').select('id')
        .in('slug', ['event-services', 'dessert-catering'])
      if (!cats?.length) { setLoading(false); return }
      const catIds = cats.map(c => c.id)
      const { data } = await supabase.from('content').select('*')
        .in('category_id', catIds)
        .eq('url_slug', slug).maybeSingle()
      setItem(data)
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading…</div>
  if (!item) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p>Vendor not found.</p>
      <button onClick={() => navigate('/desserts-catering-event-planning')}>← Back</button>
    </div>
  )
  return <ListingDetail item={item} backTo="/desserts-catering-event-planning" backLabel="Desserts, Catering & Event Planning" />
}
