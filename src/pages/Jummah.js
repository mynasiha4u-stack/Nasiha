import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const AREAS = ['All', 'East Bay', 'South Bay', 'Peninsula', 'San Francisco', 'North Bay']

function isSummer() {
  const now = new Date()
  const year = now.getFullYear()
  const march = new Date(year, 2, 1)
  const marchDay = march.getDay()
  const firstSunMarch = marchDay === 0 ? 1 : 8 - marchDay
  const springForward = new Date(year, 2, firstSunMarch + 7)
  const nov = new Date(year, 10, 1)
  const novDay = nov.getDay()
  const firstSunNov = novDay === 0 ? 1 : 8 - novDay
  const fallBack = new Date(year, 10, firstSunNov)
  return now >= springForward && now < fallBack
}

function MosqueInitial({ name }) {
  const initials = name.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join('')
  const colors = ['#b8d8f8', '#c8f0dc', '#fde8c0', '#dddaf8', '#fcd8cc', '#d4edc0']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 12, background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, fontWeight: 700, color: '#1a2a3a', flexShrink: 0,
    }}>{initials || '🕌'}</div>
  )
}

function MosqueCard({ mosque, season }) {
  const times = mosque.jummah_times || {}
  const isFriday = new Date().getDay() === 5
  const entries = []
  for (let i = 1; i <= 3; i++) {
    const j = season === 'winter' ? times[`w${i}j`] : times[`s${i}j`]
    const iq = season === 'winter' ? times[`w${i}iq`] : times[`s${i}iq`]
    if (j) entries.push({ label: `${['1st','2nd','3rd'][i-1]} Jummah`, j, iq })
  }

  return (
    <div style={{
      background: 'white', borderRadius: 16,
      border: '1px solid rgba(0,0,0,0.08)',
      padding: '16px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: entries.length ? 12 : 0 }}>
        <MosqueInitial name={mosque.name} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', lineHeight: 1.3, flex: 1, paddingRight: 8 }}>
              {mosque.name}
            </div>
            {isFriday && (
              <span style={{ background: '#c8f0dc', color: '#0a5c2a', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>Today</span>
            )}
          </div>
          {mosque.location_area && (
            <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.5)', marginTop: 2 }}>📍 {mosque.location_area}</div>
          )}
        </div>
      </div>

      {entries.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {entries.map((e, i) => (
            <div key={i} style={{ background: '#f0f7ff', borderRadius: 10, padding: '8px 14px', flex: 1, minWidth: 100 }}>
              <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.5)', marginBottom: 2 }}>{e.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2a3a' }}>{e.j}</div>
              {e.iq && <div style={{ fontSize: 12, color: '#555', fontWeight: 500, marginTop: 2 }}>Iqama {e.iq}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.4)', marginBottom: 12 }}>Check website for times</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {mosque.display_lat && mosque.display_lng && (
          <a href={`https://maps.apple.com/?daddr=${mosque.display_lat},${mosque.display_lng}`}
            style={{ flex: 1, background: '#e8a040', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, color: 'white', textAlign: 'center', textDecoration: 'none' }}>
            Get Directions
          </a>
        )}
        {mosque.website && (
          <a href={mosque.website} target="_blank" rel="noreferrer"
            style={{ flex: 1, background: '#f0f0f0', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 600, color: '#1a2a3a', textAlign: 'center', textDecoration: 'none' }}>
            Website
          </a>
        )}
        {mosque.phone && (
          <a href={`tel:${mosque.phone}`}
            style={{ background: '#f0f0f0', borderRadius: 10, padding: '10px 14px', fontSize: 16, textDecoration: 'none' }}>
            📞
          </a>
        )}
      </div>
    </div>
  )
}

export default function Jummah() {
  const navigate = useNavigate()
  const [mosques, setMosques] = useState([])
  const [loading, setLoading] = useState(true)
  const [area, setArea] = useState('All')
  const [search, setSearch] = useState('')
  const [season, setSeason] = useState(isSummer() ? 'summer' : 'winter')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: catData } = await supabase.from('categories').select('id').eq('slug', 'mosques').single()
      if (catData) {
        let q = supabase
          .from('content')
          .select('id, name, jummah_times, location_area, display_lat, display_lng, website, phone')
          .eq('category_id', catData.id)
          .eq('status', 'published')
        if (area !== 'All') q = q.eq('location_area', area)
        if (search) q = q.ilike('name', `%${search}%`)
        const { data } = await q.order('location_area').order('name')
        setMosques(data || [])
      }
      setLoading(false)
    }
    load()
  }, [area, search])

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '52px 20px 24px' }}>
        <button onClick={() => navigate('/')} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1a2a3a', marginBottom: 4 }}>🕌 Jummah Timings</h1>
        <p style={{ fontSize: 14, color: 'rgba(26,42,58,0.6)', marginBottom: 16 }}>
          {new Date().getDay() === 5 ? '🟢 Today is Friday · ' : ''}{mosques.length} mosques in the Bay Area
        </p>
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.4)', borderRadius: 20, padding: 3, border: '1px solid rgba(255,255,255,0.7)' }}>
          {['winter', 'summer'].map(s => (
            <button key={s} onClick={() => setSeason(s)} style={{
              padding: '6px 18px', borderRadius: 17, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: season === s ? 'white' : 'transparent',
              color: season === s ? '#1a2a3a' : 'rgba(26,42,58,0.55)',
              boxShadow: season === s ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>
              {s === 'winter' ? '❄️ Winter' : '☀️ Summer'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search mosques..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15 }} />
        </div>
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 16, paddingBottom: 4, scrollbarWidth: 'none' }}>
          {AREAS.map(a => (
            <button key={a} onClick={() => setArea(a)} style={{
              padding: '7px 15px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: area === a ? '#1a2a3a' : 'white', color: area === a ? 'white' : 'rgba(26,42,58,0.6)', border: '1px solid rgba(0,0,0,0.1)',
            }}>{a}</button>
          ))}
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(26,42,58,0.4)', fontSize: 15 }}>Loading mosques...</div>
        ) : mosques.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(26,42,58,0.4)', fontSize: 15 }}>No mosques found</div>
        ) : (
          mosques.map(m => <MosqueCard key={m.id} mosque={m} season={season} />)
        )}
      </div>
      <BottomNav />
    </div>
  )
}
