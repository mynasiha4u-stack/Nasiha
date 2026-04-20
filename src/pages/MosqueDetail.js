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

function cleanDescription(raw) {
  if (!raw) return ''
  // Description format: "1st Jummah: X    2nd Jummah: Y    Real description starts here"
  // Split on 4 spaces, find where Jummah lines end, take the rest
  const parts = raw.split('    ')
  let startIdx = 0
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim()
    if (p.match(/^\d+(st|nd|rd|th)?\s*Jummah/i) || p.match(/^Iqama/i)) {
      startIdx = i + 1
    }
  }
  const descParts = parts.slice(startIdx)
  return descParts.join(' ').replace(/&nbsp;/g, ' ').trim()
}

export default function MosqueDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [mosque, setMosque] = useState(null)
  const [loading, setLoading] = useState(true)
  const [localSeason, setLocalSeason] = React.useState(isSummer() ? 'summer' : 'winter')
  const season = localSeason

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

  const description = cleanDescription(mosque.description)

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>

      {/* Hero header */}
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '52px 20px 20px' }}>
        <button onClick={() => navigate(-1)} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🕌</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a2a3a', lineHeight: 1.3, marginBottom: 4 }}>{mosque.name}</h1>
        <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)' }}>📍 {mosque.location_area}{mosque.location_address ? ` · ${mosque.location_address}` : ''}</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* Jummah times */}
        <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2a3a' }}>Jummah Times</div>
            <div style={{ display: 'inline-flex', background: '#f0f0f0', borderRadius: 20, padding: 2 }}>
              {['summer', 'winter'].map(s => (
                <button key={s} onClick={e => { e.stopPropagation(); setLocalSeason(s) }} style={{
                  padding: '3px 10px', borderRadius: 18, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600,
                  background: localSeason === s ? '#1a2a3a' : 'transparent',
                  color: localSeason === s ? 'white' : 'rgba(26,42,58,0.5)',
                }}>{s === 'summer' ? '☀️' : '❄️'}</button>
              ))}
            </div>
          </div>
          {entries.length > 0 ? entries.map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', marginBottom: 6,
              background: '#f0edf8', borderRadius: 10,
              borderLeft: '3px solid #9b87c4',
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
          }}>🗺️ Directions</a>
          {mosque.website && (
            <a href={mosque.website} target="_blank" rel="noreferrer" style={{
              flex: 1, background: 'white', borderRadius: 12, padding: '13px 0',
              fontSize: 13, fontWeight: 700, color: '#1a2a3a', textAlign: 'center', textDecoration: 'none',
              border: '1px solid rgba(0,0,0,0.1)',
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
              <div style={{ width: 28, height: 28, background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700 }}>IG</div>
              <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Instagram</span>
            </a>
          )}
          {mosque.facebook && (
            <a href={mosque.facebook} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', textDecoration: 'none', gap: 4 }}>
              <div style={{ width: 28, height: 28, background: '#1877F2', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 900 }}>f</div>
              <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Facebook</span>
            </a>
          )}

        </div>

        {/* Description */}
        {description ? (
          <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 12 }}>About</div>
            <div style={{ fontSize: 14, color: 'rgba(26,42,58,0.75)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
              {description}
            </div>
          </div>
        ) : null}

      </div>
      <BottomNav />
    </div>
  )
}
