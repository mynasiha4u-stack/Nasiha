import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import TopBar from '../components/TopBar'
import AddListingButton from '../components/AddListingButton'
import FilterDropdown from '../components/FilterDropdown'
import ListingDetail, { cleanText } from '../components/ListingDetail'
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

function HomeCookCard({ item, onTap }) {
  const visibleTags = (item.types || [])
    .filter(t => ALL_TAGS.find(f => f.key === t))
    .sort((a, b) => ALL_TAGS.findIndex(f => f.key === a) - ALL_TAGS.findIndex(f => f.key === b))
    .map(t => ALL_TAGS.find(f => f.key === t))

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
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1C2B3A', marginBottom: 3 }}>{item.name}</div>
          {item.description && (
            <div style={{
              fontSize: 12, color: '#6A7A8A', lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>{cleanText(item.description, 140)}</div>
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
        {item.phone && (
          <a href={`tel:${item.phone}`} onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#1C2B3A', textAlign: 'center', textDecoration: 'none' }}>📞 Call</a>
        )}
        {item.website && (
          <a href={item.website.startsWith('http') ? item.website : 'https://' + item.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#1C2B3A', textAlign: 'center', textDecoration: 'none' }}>🌐 Website</a>
        )}
        {item.instagram && (
          <a href={item.instagram.startsWith('http') ? item.instagram : 'https://instagram.com/' + item.instagram.replace('@', '')} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#1C2B3A', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', width: 16, height: 16, background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', borderRadius: 4, alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 8, fontWeight: 800 }}>IG</span>
            Instagram
          </a>
        )}
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

  const filtered = items.filter(item => {
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
      return item.name.toLowerCase().includes(s) ||
        (item.description || '').toLowerCase().includes(s) ||
        (item.types || []).some(t => t.toLowerCase().includes(s))
    }
    return true
  })

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
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search home cooks, cuisine, dishes..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15 }} />
        </div>

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

        <div style={{ fontSize: 12, color: '#6A7A8A', margin: '12px 0 8px', fontWeight: 500 }}>
          {filtered.length} {filtered.length === 1 ? 'home cook' : 'home cooks'}
          {(cuisineFilter.size > 0 || serviceFilter.size > 0) && ' matching your filters'}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6A7A8A' }}>Loading…</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(item => (
            <HomeCookCard key={item.id} item={item} onTap={() => item.url_slug && navigate(`/home-cooked-food-catering/${item.url_slug}`)} />
          ))}
        </div>

        {!loading && filtered.length === 0 && (
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
