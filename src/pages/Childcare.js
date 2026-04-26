import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const AREAS = ['All', 'East Bay', 'South Bay', 'Peninsula', 'San Francisco', 'North Bay']

function cleanDesc(text) {
  if (!text) return ''
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/Age Group:/g, '\nAge Group:')
    .replace(/Delivery Offered:/g, '\nDelivery Offered:')
    .replace(/On Site Prep:/g, '\nOn Site Prep:')
    .replace(/Services:/g, '\nServices:')
    .replace(/Location:/g, '\nLocation:')
    .replace(/Price:/g, '\nPrice:')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

$1')
    .replace(/;\s*/g, ';
')
    .replace(/:\s+/g, ':
')
    .replace(/
{3,}/g, '

')
    .trim()
}

const TYPE_COLORS = {
  'Daycare':     { bg: '#fde8c0', color: '#7a4a00' },
  'Preschool':   { bg: '#dddaf8', color: '#3c2a8a' },
  'Nanny':       { bg: '#c8f0dc', color: '#0a5c2a' },
  'Babysitter':  { bg: '#ffd6e8', color: '#8a1a4a' },
  'Elder Care':  { bg: '#b8d8f8', color: '#0a3a6a' },
  'Other':       { bg: '#f0f0f0', color: '#444' },
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
      background: 'white', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)',
      padding: 16, marginBottom: 12, cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, paddingRight: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 3, lineHeight: 1.3 }}>{item.name}</div>
          <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.5)' }}>📍 {item.location_area}{item.location_address ? ` · ${item.location_address.split(',')[0]}` : ''}</div>
        </div>
        <span style={{ background: tc.bg, color: tc.color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0 }}>{type}</span>
      </div>
      {item.description && (
        <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {cleanDesc(item.description)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {item.phone && (
          <a href={`tel:${item.phone}`} onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#f5f5f5', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textAlign: 'center', textDecoration: 'none' }}>📞 Call</a>
        )}
        {item.email && (
          <a href={`mailto:${item.email}`} onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#f5f5f5', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textAlign: 'center', textDecoration: 'none' }}>✉️ Email</a>
        )}
        {item.website && (
          <a href={item.website.startsWith('http') ? item.website : 'https://' + item.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#f5f5f5', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textAlign: 'center', textDecoration: 'none' }}>🌐 Website</a>
        )}
        {item.facebook && (
          <a href={item.facebook} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#f5f5f5', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textAlign: 'center', textDecoration: 'none' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><div style={{ width: 14, height: 14, background: '#1877F2', borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 900 }}>f</div> Facebook</div>
          </a>
        )}
        {item.instagram && (
          <a href={item.instagram} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 70, background: '#f5f5f5', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textAlign: 'center', textDecoration: 'none' }}>📸 IG</a>
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
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('content').select('*').eq('url_slug', slug).single()
      .then(({ data }) => { setItem(data); setLoading(false) })
  }, [slug])

  if (loading) return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'rgba(26,42,58,0.4)' }}><div style={{ fontSize: 32, marginBottom: 8 }}>👶</div>Loading...</div>
    </div>
  )
  if (!item) return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(26,42,58,0.4)' }}>Not found</div>
    </div>
  )

  const type = detectType(item.name, item.description)
  const tc = TYPE_COLORS[type] || TYPE_COLORS.Other

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '52px 20px 20px' }}>
        <button onClick={() => navigate(-1)} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <span style={{ background: tc.bg, color: tc.color, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, marginBottom: 10, display: 'inline-block' }}>{type}</span>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a2a3a', lineHeight: 1.3, marginBottom: 4 }}>{item.name}</h1>
        <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)' }}>📍 {item.location_area}{item.location_address ? ` · ${item.location_address}` : ''}</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Contact actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {item.phone && (
            <a href={`tel:${item.phone}`} style={{ flex: 1, minWidth: 100, background: '#e8943a', borderRadius: 12, padding: '13px 0', color: 'white', fontWeight: 700, fontSize: 13, textAlign: 'center', textDecoration: 'none' }}>📞 Call</a>
          )}
          {item.website && (
            <a href={item.website} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 100, background: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '13px 0', color: '#1a2a3a', fontWeight: 700, fontSize: 13, textAlign: 'center', textDecoration: 'none' }}>🌐 Website</a>
          )}
          {item.email && (
            <a href={`mailto:${item.email}`} style={{ flex: 1, minWidth: 100, background: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '13px 0', color: '#1a2a3a', fontWeight: 700, fontSize: 13, textAlign: 'center', textDecoration: 'none' }}>✉️ Email</a>
          )}
        </div>

        {/* Contact ribbon */}
        {(item.phone || item.email || item.instagram || item.facebook || item.whatsapp) && (
          <div style={{ background: 'white', borderRadius: 16, padding: '4px 8px', marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-around' }}>
            {item.phone && (
              <a href={`tel:${item.phone}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px', textDecoration: 'none', gap: 3 }}>
                <span style={{ fontSize: 20 }}>📞</span>
                <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Call</span>
              </a>
            )}
            {item.whatsapp && (
              <a href={`https://wa.me/${item.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px', textDecoration: 'none', gap: 3 }}>
                <span style={{ fontSize: 20 }}>💬</span>
                <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>WhatsApp</span>
              </a>
            )}
            {item.email && (
              <a href={`mailto:${item.email}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px', textDecoration: 'none', gap: 3 }}>
                <span style={{ fontSize: 20 }}>✉️</span>
                <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Email</span>
              </a>
            )}
            {item.instagram && (
              <a href={item.instagram} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px', textDecoration: 'none', gap: 3 }}>
                <div style={{ width: 26, height: 26, background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 800 }}>IG</div>
                <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Instagram</span>
              </a>
            )}
            {item.facebook && (
              <a href={item.facebook} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px', textDecoration: 'none', gap: 3 }}>
                <div style={{ width: 26, height: 26, background: '#1877F2', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 15, fontWeight: 900 }}>f</div>
                <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Facebook</span>
              </a>
            )}
          </div>
        )}

        {/* Location */}
        {item.location_address && (
          <div style={{ background: 'white', borderRadius: 16, padding: 14, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Location</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2a3a' }}>{item.location_address}</div>
            </div>
            <a href={`https://www.google.com/maps/search/${encodeURIComponent(item.location_address)}`} target="_blank" rel="noreferrer"
              style={{ background: '#e8943a', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: 'white', textDecoration: 'none' }}>
              🗺️ Map
            </a>
          </div>
        )}

        {/* Description */}
        {item.description && (
          <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 10 }}>About</div>
            <div style={{ fontSize: 14, color: 'rgba(26,42,58,0.75)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{cleanDesc(item.description)}</div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
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
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '48px 20px 20px' }}>
        <button onClick={() => navigate('/')} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a2a3a', marginBottom: 2 }}>👶 Childcare</h1>
        <p style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)' }}>{items.length} providers in the Bay Area</p>
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
              background: area === a ? '#1a2a3a' : 'white',
              color: area === a ? 'white' : 'rgba(26,42,58,0.6)',
              border: '1px solid rgba(0,0,0,0.1)',
            }}>{a}</button>
          ))}
        </div>

        {/* List / Map toggle */}
        <div style={{ display: 'flex', background: 'white', borderRadius: 12, padding: 3, border: '1px solid rgba(0,0,0,0.08)', marginBottom: 16 }}>
          <button style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#1a2a3a', color: 'white' }}>☰ List View</button>
          <button onClick={() => navigate('/childcare/map')} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'transparent', color: 'rgba(26,42,58,0.5)' }}>🗺️ Map View</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(26,42,58,0.4)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👶</div>Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(26,42,58,0.4)' }}>
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
