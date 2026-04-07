import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const AREAS = ['All', 'East Bay', 'South Bay', 'Peninsula', 'San Francisco', 'North Bay']

function parseJummahTimes(description) {
  if (!description) return []
  const times = []
  const lines = description.split('\n')
  for (const line of lines) {
    const jummahMatch = line.match(/(\d+(?:st|nd|rd|th))\s+Jummah[:\s]+(\d+:\d+\s*(?:AM|PM))/i)
    if (jummahMatch) {
      const iqamaMatch = line.match(/[Ii]qama.*?(\d+:\d+\s*(?:AM|PM))/i)
      times.push({
        label: jummahMatch[1],
        time: jummahMatch[2].trim(),
        iqama: iqamaMatch ? iqamaMatch[1].trim() : null,
      })
    }
  }
  return times
}

function MosqueInitial({ name }) {
  const initials = name.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join('')
  const colors = ['#b8d8f8', '#c8f0dc', '#fde8c0', '#dddaf8', '#fcd8cc', '#d4edc0']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 12, background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16, fontWeight: 700, color: '#1a2a3a', flexShrink: 0,
    }}>{initials || '🕌'}</div>
  )
}

function MosqueCard({ mosque }) {
  const times = parseJummahTimes(mosque.description)
  const now = new Date()
  const isFriday = now.getDay() === 5

  return (
    <div style={{
      background: 'white', borderRadius: 16,
      border: '1px solid rgba(0,0,0,0.08)',
      padding: '16px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <MosqueInitial name={mosque.name} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', lineHeight: 1.3, flex: 1, paddingRight: 8 }}>
              {mosque.name}
            </div>
            {isFriday && (
              <span style={{
                background: '#c8f0dc', color: '#0a5c2a',
                fontSize: 10, fontWeight: 700,
                padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap',
              }}>Today</span>
            )}
          </div>
          {mosque.location_area && (
            <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.5)', marginTop: 2 }}>
              📍 {mosque.location_area}
            </div>
          )}
        </div>
      </div>

      {/* Jummah + Iqama times */}
      {times.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {times.map((t, i) => (
            <div key={i} style={{
              background: '#f0f7ff', borderRadius: 10,
              padding: '8px 14px', flex: 1, minWidth: 100,
            }}>
              <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.5)', marginBottom: 3 }}>
                {t.label} Jummah
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2a3a', marginBottom: t.iqama ? 4 : 0 }}>
                {t.time}
              </div>
              {t.iqama && (
                <div style={{ fontSize: 12, color: '#e8a040', fontWeight: 600 }}>
                  Iqama {t.iqama}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.4)', marginBottom: 12 }}>
          Check website for times
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {mosque.display_lat && mosque.display_lng && (
          <a
            href={`https://maps.apple.com/?daddr=${mosque.display_lat},${mosque.display_lng}`}
            style={{
              flex: 1, background: '#e8a040', borderRadius: 10,
              padding: '10px 0', fontSize: 13, fontWeight: 700,
              color: 'white', textAlign: 'center', textDecoration: 'none',
            }}
          >Get Directions</a>
        )}
        {mosque.website && (
          <a
            href={mosque.website}
            target="_blank"
            rel="noreferrer"
            style={{
              flex: 1, background: '#f0f0f0', borderRadius: 10,
              padding: '10px 0', fontSize: 13, fontWeight: 600,
              color: '#1a2a3a', textAlign: 'center', textDecoration: 'none',
            }}
          >Website</a>
        )}
        {mosque.phone && (
          <a
            href={`tel:${mosque.phone}`}
            style={{
              background: '#f0f0f0', borderRadius: 10,
              padding: '10px 14px', fontSize: 16, textDecoration: 'none',
            }}
          >📞</a>
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

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: catData } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', 'mosques')
        .single()

      if (catData) {
        let q = supabase
          .from('content')
          .select('id, name, description, location_area, display_lat, display_lng, website, phone')
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

  const isFriday = new Date().getDay() === 5

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>

      <div style={{
        background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)',
        padding: '52px 20px 24px',
      }}>
        <button onClick={() => navigate('/')} style={{
          fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 14,
          display: 'block', background: 'none', border: 'none',
        }}>← Back</button>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1a2a3a', marginBottom: 4 }}>
          🕌 Jummah Timings
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(26,42,58,0.6)' }}>
          {isFriday ? '🟢 Today is Friday · ' : ''}{mosques.length} mosques in the Bay Area
        </p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        <div style={{
          background: 'white', borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '11px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search mosques..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 16, paddingBottom: 4, scrollbarWidth: 'none' }}>
          {AREAS.map(a => (
            <button key={a} onClick={() => setArea(a)} style={{
              padding: '7px 15px', borderRadius: 20, whiteSpace: 'nowrap',
              fontSize: 13, fontWeight: 600,
              background: area === a ? '#1a2a3a' : 'white',
              color: area === a ? 'white' : 'rgba(26,42,58,0.6)',
              border: '1px solid rgba(0,0,0,0.1)',
            }}>{a}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(26,42,58,0.4)', fontSize: 15 }}>
            Loading mosques...
          </div>
        ) : mosques.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(26,42,58,0.4)', fontSize: 15 }}>
            No mosques found
          </div>
        ) : (
          mosques.map(m => <MosqueCard key={m.id} mosque={m} />)
        )}
      </div>

      <BottomNav />
    </div>
  )
}
