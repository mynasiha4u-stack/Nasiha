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

function MosqueIcon() {
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 12, background: '#f0f0f0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 26, flexShrink: 0,
    }}>🕌</div>
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
        <MosqueIcon />
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
        <div style={{ marginBottom: 14 }}>
          {entries.map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', marginBottom: 6,
              background: '#fff8f0',
              borderRadius: 10,
              borderLeft: '3px solid #e8a040',
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#888',
                textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 70,
              }}>{e.label}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a' }}>
                {e.j}{e.iq ? <span style={{ color: '#555', fontWeight: 500 }}> / Iqama {e.iq}</span> : ''}
              </span>
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
        <p style={{ fontSize: 14, color: 'rgba(26,42,58,0.6)', marginBottom: 4 }}>
          {new Date().getDay() === 5 ? '🟢 Today is Friday · ' : ''}{mosques.length} mosques in the Bay Area
        </p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: '#f5f5f5', paddingBottom: 12,
        }}>
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', marginBottom: 10 }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search mosques..."
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15 }} />
          </div>
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 10, paddingBottom: 2, scrollbarWidth: 'none' }}>
            {AREAS.map(a => (
              <button key={a} onClick={() => setArea(a)} style={{
                padding: '7px 15px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: area === a ? '#1a2a3a' : 'white', color: area === a ? 'white' : 'rgba(26,42,58,0.6)', border: '1px solid rgba(0,0,0,0.1)',
              }}>{a}</button>
            ))}
          </div>
          <div style={{ display: 'flex', background: 'white', borderRadius: 12, padding: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
            {['winter', 'summer'].map(s => (
              <button key={s} onClick={() => setSeason(s)} style={{
                flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: season === s ? '#1a2a3a' : 'transparent',
                color: season === s ? 'white' : 'rgba(26,42,58,0.5)',
              }}>
                {s === 'winter' ? '❄️ Winter' : '☀️ Summer'}
              </button>
            ))}
          </div>
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
