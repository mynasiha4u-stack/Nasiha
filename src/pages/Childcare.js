import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import ListingDetail, { cleanText } from '../components/ListingDetail'
import { colors, headerGradient, card, radius } from '../theme'

const AREAS = ['All', 'East Bay', 'South Bay', 'Peninsula', 'San Francisco', 'North Bay']

function cleanDesc(text) {
  if (!text) return ''
  const nl = '\n'
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/Age Group:/g, nl + 'Age Group:')
    .replace(/Delivery Offered:/g, nl + 'Delivery Offered:')
    .replace(/On Site Prep:/g, nl + 'On Site Prep:')
    .replace(/Services Offered:/g, nl + 'Services Offered:')
    .replace(/Services:/g, nl + 'Services:')
    .replace(/Location:/g, nl + 'Location:')
    .replace(/Price:/g, nl + 'Price:')
    .replace(/Hours:/g, nl + 'Hours:')
    .replace(/Contact:/g, nl + 'Contact:')
    .replace(/About:/g, nl + 'About:')
    .trim()
}


const TYPE_COLORS = {
  'Daycare':     { bg: '#C4500A', color: '#FFFFFF' },
  'Preschool':   { bg: '#5C2D7A', color: '#FFFFFF' },
  'Nanny':       { bg: '#8B1A4A', color: '#FFFFFF' },
  'Babysitter':  { bg: '#0A4A5C', color: '#FFFFFF' },
  'Elder Care':  { bg: '#1A2F5C', color: '#FFFFFF' },
  'Other':       { bg: '#3A4A5A', color: '#FFFFFF' },
}

function detectType(name, description) {
  const title = name.toLowerCase()
  const text = (name + ' ' + (description || '')).toLowerCase()
  // Title is primary signal
  if (title.includes('nanny')) return 'Nanny'
  if (title.includes('babysit') || title.includes('sitter')) return 'Babysitter'
  if (title.includes('elder') || title.includes('senior')) return 'Elder Care'
  if (title.includes('preschool') || title.includes('pre-school')) return 'Preschool'
  if (title.includes('daycare') || title.includes('day care')) return 'Daycare'
  // Fall back to description
  if (text.includes('nanny')) return 'Nanny'
  if (text.includes('babysit') || text.includes('sitter')) return 'Babysitter'
  if (text.includes('preschool') || text.includes('pre-school')) return 'Preschool'
  if (text.includes('daycare') || text.includes('day care')) return 'Daycare'
  if (text.includes('elder') || text.includes('senior')) return 'Elder Care'
  return 'Other'
}

function ChildcareCard({ item, onTap }) {
  const type = detectType(item.name, item.description)
  const tc = TYPE_COLORS[type] || TYPE_COLORS.Other
  return (
    <div onClick={() => onTap(item)} style={{
      ...card, padding: 16, cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, paddingRight: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 3, lineHeight: 1.3 }}>{item.name}</div>
          <div style={{ fontSize: 12, color: '#4a5a6a', fontWeight: 500 }}>📍 {item.location_area}{item.location_address ? ` · ${item.location_address.split(',')[0]}` : ''}</div>
        </div>
        <span style={{ background: tc.bg, color: tc.color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0 }}>{type}</span>
      </div>
      {item.description && (
        <div style={{ fontSize: 13, color: '#2a3a4a', lineHeight: 1.6, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {cleanText(item.description)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {item.phone && (
          <a href={`tel:${item.phone}`} onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textAlign: 'center', textDecoration: 'none' }}>📞 Call</a>
        )}
        {item.email && (
          <a href={`mailto:${item.email}`} onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textAlign: 'center', textDecoration: 'none' }}>✉️ Email</a>
        )}
        {item.website && (
          <a href={item.website.startsWith('http') ? item.website : 'https://' + item.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textAlign: 'center', textDecoration: 'none' }}>🌐 Website</a>
        )}
        {item.facebook && (
          <a href={item.facebook} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textAlign: 'center', textDecoration: 'none' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><div style={{ width: 14, height: 14, background: '#1877F2', borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 900 }}>f</div> Facebook</div>
          </a>
        )}
        {item.instagram && (
          <a href={item.instagram} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#F7F3EE', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textAlign: 'center', textDecoration: 'none' }}>📸 IG</a>
        )}
        {!item.phone && !item.email && !item.website && !item.facebook && (
          <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.3)' }}>Tap for details</div>
        )}
      </div>
    </div>
  )
}

export function ChildcareDetail() {
  const { slug } = useParams()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('content').select('*').eq('url_slug', slug).single()
      .then(({ data }) => { setItem(data); setLoading(false) })
  }, [slug])

  const type = item ? detectType(item.name, item.description) : ''
  const tc = TYPE_COLORS[type] || TYPE_COLORS.Other

  return (
    <ListingDetail item={item} loading={loading} typeBadge={type} typeColor={tc} notFoundLabel="Provider not found" />
  )
}

export default function Childcare() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [area, setArea] = useState('All')

  useEffect(() => {
    async function load() {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'childcare').single()
      if (!cat) { setLoading(false); return }
      const { data } = await supabase.from('content').select('*')
        .eq('category_id', cat.id)
        .eq('status', 'published')
        .order('name')
      setItems(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = items.filter(item => {
    if (area !== 'All' && item.location_area !== area) return false
    if (search) {
      const s = search.toLowerCase()
      return item.name.toLowerCase().includes(s) ||
        (item.description || '').toLowerCase().includes(s) ||
        (item.location_area || '').toLowerCase().includes(s) ||
        (item.location_address || '').toLowerCase().includes(s)
    }
    return true
  })

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(180deg, #1A2F5C 0%, #5C2D7A 40%, #8B1A4A 70%, #C4500A 100%)', padding: '48px 20px 20px' }}>
        <button onClick={() => navigate('/')} style={{ fontSize: 14, color: 'rgba(28,43,58,0.65)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', marginBottom: 2 }}>👶 Childcare</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.65)' }}>{items.length} providers in the Bay Area</p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Search */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search childcare providers..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15 }} />
        </div>

        {/* Area filter */}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 10, paddingBottom: 2, scrollbarWidth: 'none' }}>
          {AREAS.map(a => (
            <button key={a} onClick={() => setArea(a)} style={{
              padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              background: area === a ? colors.deep : 'white',
              color: area === a ? 'white' : colors.textSecondary,
              border: '1px solid rgba(0,0,0,0.1)',
            }}>{a}</button>
          ))}
        </div>

        {/* List / Map toggle */}
        <div style={{ display: 'flex', background: 'white', borderRadius: 12, padding: 3, border: `1px solid ${colors.border}`, marginBottom: 16 }}>
          <button style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: colors.deep, color: 'white' }}>☰ List View</button>
          <button onClick={() => navigate('/childcare/map')} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'transparent', color: '#3A4A5A' }}>🗺️ Map View</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#6A7A8A' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👶</div>Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#6A7A8A' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👶</div>No providers found
          </div>
        ) : filtered.map(item => (
          <ChildcareCard key={item.id} item={item} onTap={() => item.url_slug && navigate(`/childcare/${item.url_slug}`)} />
        ))}
      </div>
      <BottomNav />
    </div>
  )
}
