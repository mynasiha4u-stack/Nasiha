import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import { colors, headerGradient, card, radius } from '../theme'

const CATEGORIES = [
  { icon: '👨‍🍳', label: 'Home Cooks',     path: '/directory?cat=home-cooked-food' },
  { icon: '🕌', label: 'Jummah',          path: '/jummah' },
  { icon: '🎂', label: 'Desserts',        path: '/directory?cat=dessert-catering' },
  { icon: '👶', label: 'Childcare',       path: '/childcare' },
  { icon: '📅', label: 'Events',          path: '/events' },
  { icon: '🏫', label: 'Schools',         path: '/directory?cat=islamic-schools' },
  { icon: '⚖️', label: 'Lawyers',         path: '/directory?cat=lawyers' },
  { icon: '🍽️', label: 'Restaurants',     path: '/directory?cat=restaurants' },
]

const SUGGESTIONS = ['Halal food near me', 'Jummah times', 'Events this weekend', 'Islamic schools']

export default function Home() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [mosques, setMosques] = useState([])

  useEffect(() => {
    // Fetch upcoming events
    const today = new Date().toISOString().substring(0, 10)
    supabase.from('content')
      .select('id, name, event_date, event_time, event_host, url_slug, image_url')
      .eq('category_id', 'd916a550-c316-40a9-9582-35836417b6cb')
      .eq('status', 'published')
      .gte('event_date', today)
      .order('event_date')
      .limit(4)
      .then(({ data }) => {
        const filtered = (data || []).filter(e => !/jumu.{0,3}ah|jummah/i.test(e.name))
        setEvents(filtered)
      })

    // Fetch featured mosques
    supabase.from('categories').select('id').eq('slug', 'mosques').single()
      .then(({ data: cat }) => {
        if (!cat) return
        supabase.from('content')
          .select('id, name, location_area, url_slug')
          .eq('category_id', cat.id)
          .eq('status', 'published')
          .eq('featured', true)
          .limit(6)
          .then(({ data }) => setMosques(data || []))
      })
  }, [])

  const formatDate = (d) => {
    if (!d) return ''
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: colors.surface, minHeight: '100vh', paddingBottom: 80 }}>

      {/* Hero header */}
      <div style={{
        background: headerGradient,
        padding: '56px 20px 28px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle texture overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.05) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        {/* Location pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: radius.full, padding: '5px 12px',
          marginBottom: 16,
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FCD34D' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(28,43,58,0.75)' }}>Bay Area</span>
        </div>

        {/* Wordmark */}
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: '#1C2B3A', letterSpacing: -1 }}>nasiha</span>
        </div>
        <div style={{ fontSize: 14, color: 'rgba(28,43,58,0.65)', marginBottom: 24, fontWeight: 400 }}>
          Your community, all in one place
        </div>

        {/* Search bar */}
        <div onClick={() => {}} style={{
          background: 'white',
          borderRadius: radius.lg,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'text',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: radius.sm,
            background: colors.brand,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 14 }}>✦</span>
          </div>
          <span style={{ fontSize: 15, color: colors.textMuted, flex: 1 }}>What are you looking for?</span>
        </div>

        {/* Quick suggestions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {SUGGESTIONS.map(s => (
            <button key={s} style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: radius.full,
              padding: '6px 14px',
              fontSize: 12, fontWeight: 500,
              color: 'rgba(255,255,255,0.9)',
              whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
            }}>{s}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 16px 0' }}>

        {/* Browse section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>Browse</span>
          <span style={{ fontSize: 13, color: colors.brand, fontWeight: 600 }}>See all</span>
        </div>

        {/* Category grid — all same card color, icon does the work */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 28 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.label} onClick={() => navigate(cat.path)} style={{
              background: 'white',
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              padding: '16px 8px 12px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 8,
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <span style={{ fontSize: 28 }}>{cat.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: colors.textPrimary, textAlign: 'center', lineHeight: 1.3 }}>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Upcoming Events */}
        {events.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>Upcoming Events</span>
              <span onClick={() => navigate('/events')} style={{ fontSize: 13, color: colors.brand, fontWeight: 600, cursor: 'pointer' }}>See all</span>
            </div>

            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 28, paddingBottom: 4 }}>
              {events.map(ev => (
                <div key={ev.id} onClick={() => navigate(`/events/${ev.url_slug}`)} style={{
                  flexShrink: 0, width: 200, background: 'white',
                  borderRadius: radius.lg, overflow: 'hidden',
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}>
                  <div style={{
                    height: 100,
                    background: ev.image_url ? `url(${ev.image_url}) center/cover` : `linear-gradient(135deg, #1C2B3A 0%, #C2410C 100%)`,
                    position: 'relative',
                  }}>
                    {ev.event_host && (
                      <div style={{
                        position: 'absolute', top: 8, left: 8,
                        background: colors.brand,
                        borderRadius: 5, padding: '2px 7px',
                        fontSize: 9, fontWeight: 700, color: 'white',
                      }}>{ev.event_host}</div>
                    )}
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, marginBottom: 4, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ev.name}</div>
                    <div style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 500 }}>{formatDate(ev.event_date)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Featured Mosques */}
        {mosques.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>Masjids</span>
              <span onClick={() => navigate('/jummah')} style={{ fontSize: 13, color: colors.brand, fontWeight: 600, cursor: 'pointer' }}>See all</span>
            </div>
            {mosques.map(m => (
              <div key={m.id} onClick={() => navigate(`/jummah/${m.url_slug}`)} style={{
                ...card,
                padding: '14px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: radius.sm, background: `linear-gradient(135deg, #1C2B3A, #C2410C)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🕌</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>{m.location_area}</div>
                  </div>
                </div>
                <span style={{ color: colors.textMuted, fontSize: 16 }}>›</span>
              </div>
            ))}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
