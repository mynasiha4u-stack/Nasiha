import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AsrHero from '../components/AsrHero'
import BottomNav from '../components/BottomNav'

const CATEGORIES = [
  { icon: '🍛', label: 'Home Cooks',  bg: '#c8f0dc', path: '/directory?cat=home-cooked-food' },
  { icon: '🕌', label: 'Jummah Timings',      bg: '#b8d8f8', path: '/jummah' },
  { icon: '🎂', label: 'Desserts',    bg: '#fde8c0', path: '/directory?cat=dessert-catering' },
  { icon: '👶', label: 'Childcare',   bg: '#dddaf8', path: '/directory?cat=childcare' },
  { icon: '📅', label: 'Events',      bg: '#fcd8cc', path: '/events' },
  { icon: '🏫', label: 'Schools',     bg: '#d4edc0', path: '/directory?cat=islamic-schools' },
  { icon: '⚖️', label: 'Lawyers',     bg: '#b8d8f8', path: '/directory?cat=lawyers' },
  { icon: '☕', label: 'Cafes',       bg: '#fde8c0', path: '/directory?cat=restaurants' },
]

const FEATURED_EVENTS = [
  { id: 1, title: 'Sisters Healing Circle', mosque: 'MCC East Bay', date: 'Sun Apr 7', time: '11am', bg: '#c8f0dc', tag: 'Community', tagBg: '#c8f0dc', tagColor: '#0a5c2a', free: true },
  { id: 2, title: "Brothers Halaqa Night", mosque: 'ICF Fremont', date: 'Fri Apr 12', time: '8pm', bg: '#b8d8f8', tag: 'Youth', tagBg: '#b8d8f8', tagColor: '#0a3a6a', free: true },
  { id: 3, title: 'Monthly Mawlid', mosque: 'MCC East Bay', date: 'Sat Apr 13', time: '6:30pm', bg: '#fde8c0', tag: 'Lecture', tagBg: '#fde8c0', tagColor: '#7a4a00', free: true },
]

export default function Home() {
  const navigate = useNavigate()
  const [city] = useState('Bay Area')
  const [query, setQuery] = useState('')
  const [featured, setFeatured] = useState([])

  useEffect(() => {
    async function loadFeatured() {
      const { data } = await supabase
        .from('content')
        .select('id, name, description, location_area, url_slug, category_id')
        .eq('status', 'published')
        .eq('content_type', 'listing')
        .limit(3)
      if (data) setFeatured(data)
    }
    loadFeatured()
  }, [])

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: 'white', minHeight: '100vh', paddingBottom: 80 }}>

      <AsrHero city={city} onCityTap={() => alert('City picker coming soon')}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#1a2a3a', letterSpacing: -0.5 }}>nasiha</span>
          <span style={{ fontSize: 15, fontWeight: 500, color: 'rgba(26,42,58,0.6)' }}>Your community, all in one place</span>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.9)',
          borderRadius: 16, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, background: '#e8a040',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15,
          }}>✦</div>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="What are you looking for?"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: '#1a2a3a' }}
          />
          {query && (
            <button onClick={() => alert(`Searching: ${query}`)} style={{
              width: 30, height: 30, borderRadius: 9, background: '#e8a040',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 14, border: 'none',
            }}>→</button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 7, marginTop: 10, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          {['Halal food near me', 'Jummah times', 'Events this weekend'].map(c => (
            <button key={c} onClick={() => setQuery(c)} style={{
              fontSize: 12, color: 'rgba(26,42,58,0.65)',
              background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.75)',
              borderRadius: 20, padding: '5px 12px', whiteSpace: 'nowrap',
            }}>{c}</button>
          ))}
        </div>
      </AsrHero>

      <div style={{ padding: '24px 16px 0' }}>

        {/* Categories */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Browse</span>
          <span style={{ fontSize: 13, color: '#7db8e8' }}>See all</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 32 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.label} onClick={() => navigate(cat.path)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 8, padding: '16px 4px 14px',
              background: cat.bg, borderRadius: 16, border: 'none', cursor: 'pointer',
            }}>
              <span style={{ fontSize: 26 }}>{cat.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.3, color: '#1a2a3a' }}>
                {cat.label}
              </span>
            </button>
          ))}
        </div>

        {/* Featured Events */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>This weekend</span>
          <button onClick={() => navigate('/events')} style={{ fontSize: 13, color: '#7db8e8', background: 'none', border: 'none', cursor: 'pointer' }}>
            All events
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16, paddingBottom: 4, scrollbarWidth: 'none', marginBottom: 32 }}>
          {FEATURED_EVENTS.map(ev => (
            <button key={ev.id} onClick={() => navigate('/events')} style={{
              minWidth: 200, flexShrink: 0, background: 'white',
              borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)',
              overflow: 'hidden', textAlign: 'left', cursor: 'pointer',
              padding: 0,
            }}>
              <div style={{
                height: 80, background: ev.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 700, color: 'rgba(26,42,58,0.2)',
                letterSpacing: 2, position: 'relative',
              }}>
                {ev.mosque.split(' ').filter(w => w.length > 2).slice(0,2).map(w => w[0]).join('')}
                {ev.free && (
                  <div style={{
                    position: 'absolute', top: 8, left: 8,
                    background: '#e8a040', borderRadius: 6,
                    padding: '3px 7px', fontSize: 10, color: 'white', fontWeight: 700,
                  }}>Free</div>
                )}
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(0,0,0,0.28)', borderRadius: 6,
                  padding: '3px 7px', fontSize: 10, color: 'white', fontWeight: 600,
                }}>{ev.date}</div>
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{
                  display: 'inline-block', background: ev.tagBg, color: ev.tagColor,
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, marginBottom: 5,
                }}>{ev.tag}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2a3a', marginBottom: 3, lineHeight: 1.3 }}>
                  {ev.title}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.5)' }}>
                  {ev.mosque} · {ev.time}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Featured Vendors */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Featured</span>
          <span style={{ fontSize: 13, color: '#7db8e8' }}>See all</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {featured.length > 0 ? featured.map(v => (
            <div key={v.id} style={{
              background: 'white', borderRadius: 14,
              border: '1px solid rgba(0,0,0,0.08)',
              padding: '14px', display: 'flex', gap: 12, alignItems: 'center',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: '#fde8c0', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1a2a3a',
              }}>
                {v.name.split(' ').filter(w => w.length > 1).slice(0,2).map(w => w[0].toUpperCase()).join('')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 2 }}>
                  {v.name}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {v.location_area || 'Bay Area'}
                </div>
              </div>
              <span style={{ color: '#e8a040', fontSize: 18, flexShrink: 0 }}>→</span>
            </div>
          )) : (
            <div style={{ background: '#f7f7f7', borderRadius: 14, padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'rgba(26,42,58,0.4)' }}>Featured vendors coming soon</div>
            </div>
          )}
        </div>

      </div>
      <BottomNav />
    </div>
  )
}
