import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'
import { colors, headerGradient, card, radius } from '../theme'

const CATEGORIES = [
  { icon: '🍽️', label: 'Restaurants',                  path: '/restaurants' },
  { icon: '🕌', label: 'Jummah Timings',               path: '/jummah' },
  { icon: '📅', label: 'Upcoming Events',              path: '/events' },
  { icon: '💐', label: 'Catering & Event Services',    path: '/event-planning' },
  { icon: '👶', label: 'Childcare',                    path: '/childcare' },
  { icon: '👨‍🍳', label: 'Home Cooks',                  path: '/directory?cat=home-cooked-food' },
  { icon: '🏫', label: 'Full Time Islamic Schools',    path: '/full-time-islamic-schools' },
  { icon: '⚖️', label: 'Lawyers',                      path: '/lawyers' },
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
          .select('id, name, metro, url_slug')
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

        {/* Top row: weather pill (left), auth button (right) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <BayAreaWeather />
          <AuthButton />
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
              background: 'white',
              border: '1px solid rgba(255,255,255,0.5)',
              borderRadius: radius.full,
              padding: '6px 14px',
              fontSize: 12, fontWeight: 600,
              color: colors.textPrimary,
              whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>{s}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 16px 0' }}>

        {/* Browse section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>Browse</span>
          <button onClick={() => navigate('/submit')} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: colors.brand, color: 'white', border: 'none',
            borderRadius: 999, padding: '6px 12px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>+ Add a listing</button>
        </div>

        {/* Category tiles — horizontal scroll, 2 rows, with peek + chevron on right edge to hint at scrollability */}
        <div style={{ position: 'relative', marginBottom: 28 }}>
          <div style={{
            display: 'grid',
            gridTemplateRows: 'auto auto',
            gridAutoFlow: 'column',
            gridAutoColumns: '24%',  // ~4 tiles + a peek of the 5th
            gap: 10,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollSnapType: 'x mandatory',
            paddingBottom: 4,
            paddingRight: 24,  // room for the fade so it doesn't obscure last tile
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
          className="tile-scroll-row">
            {CATEGORIES.map(cat => (
              <button key={cat.label} onClick={() => navigate(cat.path)} style={{
                background: '#FFF8F3',
                border: `1px solid rgba(194,65,12,0.12)`,
                borderRadius: radius.md,
                padding: '16px 8px 12px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'flex-start', gap: 8,
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                minHeight: 92,
                scrollSnapAlign: 'start',
              }}>
                <span style={{ fontSize: 26 }}>{cat.icon}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: colors.textPrimary, textAlign: 'center', lineHeight: 1.25 }}>{cat.label}</span>
              </button>
            ))}
          </div>
          {/* Right-edge fade + chevron — hints at more content */}
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 4,
            width: 40,
            background: 'linear-gradient(to right, rgba(247,243,238,0) 0%, #F7F3EE 70%)',
            pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            paddingRight: 4,
          }}>
            <div style={{
              width: 26, height: 26,
              borderRadius: '50%',
              background: 'white',
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: colors.brand, fontWeight: 800,
            }}>›</div>
          </div>
        </div>
        <style>{`
          .tile-scroll-row::-webkit-scrollbar { display: none; }
        `}</style>

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
                    background: ev.image_url ? `url(${ev.image_url}) center/cover` : headerGradient,
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
                  <div style={{ width: 40, height: 40, borderRadius: radius.sm, background: headerGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🕌</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>{m.metro}</div>
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

// --- Weather component ---
// Fetches current Bay Area weather from Open-Meteo (free, no API key).
// Shows: [emoji] [temp]° · Bay Area. Caches in sessionStorage for 30 min.
// --- Auth button (top-right of home) ---
// Shows 'Sign in' when logged out, user initial + menu when logged in.
function AuthButton() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const [open, setOpen] = React.useState(false)

  if (!user) {
    return (
      <div style={{ display: 'inline-flex', gap: 6 }}>
        <button onClick={() => navigate('/auth?mode=login')} style={{
          background: 'rgba(255,255,255,0.85)',
          border: 'none',
          borderRadius: 999,
          padding: '6px 12px',
          fontSize: 12, fontWeight: 700,
          color: '#1C2B3A',
          cursor: 'pointer',
        }}>Log in</button>
        <button onClick={() => navigate('/auth?mode=signup')} style={{
          background: colors.brand,
          border: 'none',
          borderRadius: 999,
          padding: '6px 12px',
          fontSize: 12, fontWeight: 700,
          color: 'white',
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>Sign up</button>
      </div>
    )
  }

  const initial = (profile?.display_name || user.email || '?').charAt(0).toUpperCase()
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: 32, height: 32, borderRadius: '50%',
        background: colors.brand, color: 'white',
        border: 'none', cursor: 'pointer',
        fontSize: 14, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }}>{initial}</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: 'white', borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            border: '1px solid rgba(0,0,0,0.08)',
            minWidth: 180, zIndex: 100,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A' }}>{profile?.display_name || user.email}</div>
              <div style={{ fontSize: 11, color: '#6A7A8A', marginTop: 2 }}>{user.email}</div>
            </div>
            <button onClick={() => { setOpen(false); navigate('/my-listings') }} style={menuItemStyle}>My listings</button>
            <button onClick={async () => { setOpen(false); await signOut(); navigate('/') }} style={{ ...menuItemStyle, color: '#9A3A3A' }}>Sign out</button>
          </div>
        </>
      )}
    </div>
  )
}

const menuItemStyle = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '11px 14px', background: 'white', border: 'none',
  fontSize: 13, fontWeight: 600, color: '#1C2B3A',
  cursor: 'pointer', fontFamily: 'inherit',
}

function BayAreaWeather() {
  const [weather, setWeather] = React.useState(null)

  React.useEffect(() => {
    // Try cache first
    try {
      const cached = sessionStorage.getItem('nasiha_weather_v1')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Date.now() - parsed.ts < 30 * 60 * 1000) {
          setWeather(parsed.data)
          return
        }
      }
    } catch {}

    // Fremont CA — central Bay Area metro
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=37.5485&longitude=-121.9886&current=temperature_2m,weather_code&temperature_unit=fahrenheit'
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!data?.current) return
        const w = {
          temp: Math.round(data.current.temperature_2m),
          code: data.current.weather_code,
        }
        setWeather(w)
        try { sessionStorage.setItem('nasiha_weather_v1', JSON.stringify({ ts: Date.now(), data: w })) } catch {}
      })
      .catch(() => {})
  }, [])

  // Map WMO weather codes to emoji
  // https://open-meteo.com/en/docs (search 'weather_code')
  const emojiForCode = (code) => {
    if (code === 0) return '☀️'  // clear
    if (code === 1 || code === 2) return '🌤️'  // mainly clear / partly cloudy
    if (code === 3) return '☁️'  // overcast
    if (code >= 45 && code <= 48) return '🌫️'  // fog
    if (code >= 51 && code <= 67) return '🌧️'  // drizzle/rain
    if (code >= 71 && code <= 77) return '🌨️'  // snow
    if (code >= 80 && code <= 82) return '🌦️'  // rain showers
    if (code >= 95) return '⛈️'  // thunderstorm
    return '🌤️'
  }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(255,255,255,0.2)',
      borderRadius: 999, padding: '5px 12px',
      backdropFilter: 'blur(8px)',
    }}>
      {weather ? (
        <>
          <span style={{ fontSize: 13 }}>{emojiForCode(weather.code)}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1C2B3A' }}>{weather.temp}°</span>
          <span style={{ fontSize: 12, color: 'rgba(28,43,58,0.55)' }}>·</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(28,43,58,0.75)' }}>Bay Area</span>
        </>
      ) : (
        <>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FCD34D' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(28,43,58,0.75)' }}>Bay Area</span>
        </>
      )}
    </div>
  )
}
