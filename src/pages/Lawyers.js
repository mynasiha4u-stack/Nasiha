import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import ListingDetail, { cleanText } from '../components/ListingDetail'
import { colors, headerGradient, card } from '../theme'

// Order by count (most → fewest), per user preference
const SPECIALTY_FILTERS = [
  { key: 'Immigration Law',                  label: 'Immigration' },
  { key: 'Family Law',                       label: 'Family Law' },
  { key: 'Estate Planning (Wills and Trusts)', label: 'Estate Planning' },
  { key: 'Personal Injury',                  label: 'Personal Injury' },
  { key: 'Criminal Defense',                 label: 'Criminal Defense' },
  { key: 'Real Estate Law',                  label: 'Real Estate' },
]

function LawyerCard({ item, onTap }) {
  return (
    <div onClick={() => onTap(item)} style={{ ...card, padding: 16, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, paddingRight: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 6, lineHeight: 1.3 }}>{item.name}</div>
          {/* Specialty chips inline — sorted to match filter order */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {(item.specialties || [])
              .slice()
              .sort((a, b) => SPECIALTY_FILTERS.findIndex(f => f.key === a) - SPECIALTY_FILTERS.findIndex(f => f.key === b))
              .map(sp => {
                const def = SPECIALTY_FILTERS.find(f => f.key === sp)
                const label = def?.label || sp
                return <span key={sp} style={{ background: '#E0F7F5', color: '#0F766E', fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5 }}>{label}</span>
              })}
          </div>
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
      </div>
    </div>
  )
}

export default function Lawyers() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState(new Set())

  useEffect(() => {
    async function load() {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'lawyers').single()
      if (!cat) { setLoading(false); return }
      const { data: rows } = await supabase.from('content').select('*')
        .eq('category_id', cat.id)
        .eq('status', 'published')
        .order('name')

      // Fetch specialty attribute for each lawyer
      const ids = (rows || []).map(r => r.id)
      let attrs = []
      if (ids.length > 0) {
        const { data: aRows } = await supabase.from('attributes')
          .select('content_id, attribute_name, attribute_value')
          .in('content_id', ids)
          .eq('attribute_name', 'specialty')
        attrs = aRows || []
      }
      const spById = new Map()
      attrs.forEach(a => {
        if (!spById.has(a.content_id)) spById.set(a.content_id, [])
        spById.get(a.content_id).push(a.attribute_value)
      })

      setItems((rows || []).map(r => ({ ...r, specialties: spById.get(r.id) || [] })))
      setLoading(false)
    }
    load()
  }, [])

  const toggleSpecialty = (key) => {
    const next = new Set(specialtyFilter)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSpecialtyFilter(next)
  }

  const filtered = items.filter(item => {
    if (specialtyFilter.size > 0) {
      const has = (item.specialties || []).some(sp => specialtyFilter.has(sp))
      if (!has) return false
    }
    if (search) {
      const s = search.toLowerCase()
      return item.name.toLowerCase().includes(s) ||
        (item.description || '').toLowerCase().includes(s) ||
        (item.specialties || []).some(sp => sp.toLowerCase().includes(s))
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: headerGradient, padding: '48px 20px 22px' }}>
        <button onClick={() => navigate('/')} style={{ fontSize: 13, fontWeight: 700, color: colors.deep, marginBottom: 14, display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', marginBottom: 2 }}>⚖️ Muslim Lawyers</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.65)' }}>{items.length} attorneys</p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Search */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search lawyers..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15 }} />
        </div>

        {/* Specialty filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {SPECIALTY_FILTERS.map(sp => {
            const active = specialtyFilter.has(sp.key)
            return (
              <button key={sp.key} onClick={() => toggleSpecialty(sp.key)}
                style={{
                  background: active ? colors.brand : 'white',
                  color: active ? 'white' : '#1C2B3A',
                  border: active ? 'none' : '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 999, padding: '6px 12px',
                  fontSize: 12, fontWeight: 700,
                  cursor: 'pointer',
                }}>{sp.label}</button>
            )
          })}
        </div>

        <div style={{ fontSize: 12, color: '#6A7A8A', marginBottom: 8, fontWeight: 500 }}>
          {sorted.length} {sorted.length === 1 ? 'result' : 'results'}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6a7a8a' }}>Loading…</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(item => (
            <LawyerCard key={item.id} item={item} onTap={() => item.url_slug && navigate(`/lawyers/${item.url_slug}`)} />
          ))}
        </div>

        {!loading && sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#6a7a8a' }}>No lawyers match your filters.</div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

// Detail page reuses the shared ListingDetail
export function LawyerDetail() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'lawyers').single()
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
      <p>Lawyer not found.</p>
      <button onClick={() => navigate('/lawyers')}>← Back to Lawyers</button>
    </div>
  )
  return <ListingDetail item={item} backTo="/lawyers" backLabel="Lawyers" />
}
