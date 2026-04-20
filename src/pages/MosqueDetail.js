import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

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

export default function MosqueDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [mosque, setMosque] = useState(null)
  const [loading, setLoading] = useState(true)
  const season = isSummer() ? 'summer' : 'winter'

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('content')
        .select('*')
        .eq('url_slug', slug)
        .single()
      setMosque(data)
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'rgba(26,42,58,0.4)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🕌</div>
        <div>Loading...</div>
      </div>
    </div>
  )

  if (!mosque) return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'rgba(26,42,58,0.4)' }}>Mosque not found</div>
    </div>
  )

  const times = mosque.jummah_times || {}
  const entries = []
  for (let i = 1; i <= 3; i++) {
    const j = season === 'summer' ? times[`s${i}j`] : times[`w${i}j`]
    const iq = season === 'summer' ? times[`s${i}iq`] : times[`w${i}iq`]
    if (j) entries.push({ label: `${['1st', '2nd', '3rd'][i-1]} Jummah`, j, iq })
  }

  const directionsUrl = mosque.display_lat && mosque.display_lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${mosque.display_lat},${mosque.display_lng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(mosque.location_address || mosque.name)}`

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>

      {/* Hero header */}
      <div style={{ background: 'linear-gradient(135deg, #2d6a4f 0%, #1a3d2e 100%)', padding: '52px 20px 28px', position: 'relative' }}>
        <button onClick={() => navigate(-1)} style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 16, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🕌</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'white', lineHeight: 1.3, marginBottom: 6 }}>{mosque.name}</h1>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>📍 {mosque.location_area}{mosque.location_address ? ` · ${mosque.location_address}` : ''}</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* Jummah times */}
        <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2a3a' }}>Jummah Times</div>
            <div style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>{season === 'summer' ? '☀️ Summer' : '❄️ Winter'}</div>
          </div>
          {entries.length > 0 ? entries.map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', marginBottom: 6,
              background: '#fff8f0', borderRadius: 10,
              borderLeft: '3px solid #e8a040',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{e.label}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a' }}>
                {e.j}{e.iq ? <span style={{ color: '#555', fontWeight: 500 }}> / Iqama {e.iq}</span> : ''}
              </span>
            </div>
          )) : (
            <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.4)' }}>Check website for times</div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <a href={directionsUrl} target="_blank" rel="noreferrer" style={{
            flex: 1, background: '#e8a040', borderRadius: 12, padding: '13px 0',
            fontSize: 13, fontWeight: 700, color: 'white', textAlign: 'center', textDecoration: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>🗺️ Directions</a>
          {mosque.website && (
            <a href={mosque.website} target="_blank" rel="noreferrer" style={{
              flex: 1, background: 'white', borderRadius: 12, padding: '13px 0',
              fontSize: 13, fontWeight: 700, color: '#1a2a3a', textAlign: 'center', textDecoration: 'none',
              border: '1px solid rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>🌐 Website</a>
          )}
        </div>

        {/* Contact ribbon */}
        <div style={{ background: 'white', borderRadius: 16, padding: '4px 8px', marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-around' }}>
          {mosque.phone && (
            <a href={`tel:${mosque.phone}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', textDecoration: 'none', gap: 4 }}>
              <span style={{ fontSize: 22 }}>📞</span>
              <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Call</span>
            </a>
          )}
          {mosque.email && (
            <a href={`mailto:${mosque.email}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', textDecoration: 'none', gap: 4 }}>
              <span style={{ fontSize: 22 }}>✉️</span>
              <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Email</span>
            </a>
          )}
          {mosque.instagram && (
            <a href={mosque.instagram} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', textDecoration: 'none', gap: 4 }}>
              <span style={{ fontSize: 22 }}>📸</span>
              <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Instagram</span>
            </a>
          )}
          {mosque.facebook && (
            <a href={mosque.facebook} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', textDecoration: 'none', gap: 4 }}>
              <span style={{ fontSize: 22 }}>👥</span>
              <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Facebook</span>
            </a>
          )}
          {mosque.website && (
            <a href={mosque.website} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', textDecoration: 'none', gap: 4 }}>
              <span style={{ fontSize: 22 }}>🌐</span>
              <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Website</span>
            </a>
          )}
        </div>

        {/* Description */}
        {mosque.description && (
          <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2a3a', marginBottom: 10 }}>About</div>
            <div style={{ fontSize: 14, color: 'rgba(26,42,58,0.7)', lineHeight: 1.7 }}>
              {mosque.description.replace(/\d+(st|nd|rd) Jummah:.*?(\n|$)/g, '').trim()}
            </div>
          </div>
        )}

      </div>
      <BottomNav />
    </div>
  )
}
