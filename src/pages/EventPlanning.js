import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import ListingDetail, { cleanText } from '../components/ListingDetail'
import { colors, headerGradient, card } from '../theme'

// Filter groups — keep canonical values matching DB attribute_value
const FILTER_GROUPS = [
  {
    title: 'Services',
    filters: [
      { key: 'Event Decor',                          label: 'Decor' },
      { key: 'Event Planners',                       label: 'Planners' },
      { key: 'Florist/Garlands',                     label: 'Florist' },
      { key: 'Henna/Mehndi Artist',                  label: 'Mehndi' },
      { key: 'Makeup & Hair',                        label: 'Makeup & Hair' },
      { key: 'Photography & Videography',            label: 'Photography' },
    ],
  },
  {
    title: 'Desserts & Drinks',
    filters: [
      { key: 'Cakes, Baked Goods, and More',         label: 'Cakes & Desserts' },
      { key: 'Chai, Coffee, and Speciality Drinks',  label: 'Chai & Drinks' },
    ],
  },
  {
    title: 'Format',
    filters: [
      { key: 'Delivery Offered',                     label: '🚚 Delivery' },
      { key: 'Mobile Pop Up',                        label: '🎪 On-site Setup' },
    ],
  },
]

// Flat lookup for chip rendering
const ALL_FILTERS = FILTER_GROUPS.flatMap(g => g.filters)

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
          <a href={item.instagram.startsWith('http') ? item.instagram : 'https://instagram.com/' + item.instagram.replace('@', '')} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: colors.textPrimary, textAlign: 'center', textDecoration: 'none' }}>📷 Instagram</a>
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
  const [typeFilter, setTypeFilter] = useState(new Set())

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

  const toggleType = (key) => {
    const next = new Set(typeFilter)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setTypeFilter(next)
  }

  const filtered = items.filter(item => {
    if (typeFilter.size > 0) {
      const has = (item.types || []).some(t => typeFilter.has(t))
      if (!has) return false
    }
    if (search) {
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
        <button onClick={() => navigate('/')} style={{ fontSize: 13, fontWeight: 700, color: colors.deep, marginBottom: 14, display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', marginBottom: 2 }}>🎉 Event Planning & Catering</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.65)' }}>{items.length} vendors for your event</p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Search */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15 }} />
        </div>

        {/* Grouped filter chips */}
        {FILTER_GROUPS.map(group => (
          <div key={group.title} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6A7A8A', letterSpacing: 0.5, marginBottom: 6 }}>{group.title.toUpperCase()}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {group.filters.map(f => {
                const active = typeFilter.has(f.key)
                return (
                  <button key={f.key} onClick={() => toggleType(f.key)}
                    style={{
                      background: active ? colors.brand : 'white',
                      color: active ? 'white' : '#1C2B3A',
                      border: active ? 'none' : '1px solid rgba(0,0,0,0.12)',
                      borderRadius: 999, padding: '6px 12px',
                      fontSize: 12, fontWeight: 700,
                      cursor: 'pointer',
                    }}>{f.label}</button>
                )
              })}
            </div>
          </div>
        ))}

        <div style={{ fontSize: 12, color: '#6A7A8A', margin: '12px 0 8px', fontWeight: 500 }}>
          {sorted.length} {sorted.length === 1 ? 'vendor' : 'vendors'}
          {typeFilter.size > 0 && ` matching ${typeFilter.size} filter${typeFilter.size > 1 ? 's' : ''}`}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6a7a8a' }}>Loading…</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(item => (
            <VendorCard key={item.id} item={item} onTap={() => item.url_slug && navigate(`/event-planning/${item.url_slug}`)} />
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
      <button onClick={() => navigate('/event-planning')}>← Back</button>
    </div>
  )
  return <ListingDetail item={item} backTo="/event-planning" backLabel="Event Planning" />
}
