import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const TYPE_FILTERS = ['All', 'Community', 'Halaqa', 'Lecture', 'Dinner', 'Fundraiser', 'Youth', 'Class']
const AUDIENCE_FILTERS = ['Everyone', 'Sisters', 'Brothers', 'Youth', 'Families']

const TYPE_COLORS = {
  Community: { bg: '#c8f0dc', color: '#0a5c2a' },
  Halaqa: { bg: '#b8d8f8', color: '#0a3a6a' },
  Lecture: { bg: '#fde8c0', color: '#7a4a00' },
  Dinner: { bg: '#fde8c0', color: '#7a4a00' },
  Fundraiser: { bg: '#dddaf8', color: '#3c2a8a' },
  Youth: { bg: '#ffd6d6', color: '#8a1a1a' },
  Class: { bg: '#d4f0e8', color: '#0a4a2a' },
  Default: { bg: '#f0f0f0', color: '#444' },
}

// Auto-detect event type from title/description
function detectType(name, description) {
  const text = (name + ' ' + (description || '')).toLowerCase()
  if (text.includes('halaqa')) return 'Halaqa'
  if (text.includes('class') || text.includes('school') || text.includes('program') || text.includes('session')) return 'Class'
  if (text.includes('lecture') || text.includes('speaker') || text.includes('talk') || text.includes('imam') || text.includes('sheikh') || text.includes('ustadh')) return 'Lecture'
  if (text.includes('dinner') || text.includes('iftar') || text.includes('potluck') || text.includes('meal')) return 'Dinner'
  if (text.includes('fundrais') || text.includes('gala') || text.includes('donate')) return 'Fundraiser'
  if (text.includes('youth') || text.includes('teen') || text.includes('boy') || text.includes('girl') || text.includes('junior')) return 'Youth'
  if (text.includes('sister') || text.includes('women') || text.includes('mother') || text.includes('mommy')) return 'Community'
  return 'Community'
}

// Auto-detect audience
function detectAudience(name, description) {
  const text = (name + ' ' + (description || '')).toLowerCase()
  if (text.includes('sister') || text.includes("women's") || text.includes('women ') || text.includes('mommy') || text.includes("mother")) return 'Sisters'
  if (text.includes("men's") || text.includes('brother') || text.includes('boys') || text.includes('fathers')) return 'Brothers'
  if (text.includes('teen') || text.includes('youth') || text.includes('high school') || text.includes('middle school')) return 'Youth'
  if (text.includes('family') || text.includes('families') || text.includes('children') || text.includes('kids')) return 'Families'
  return 'All'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${m} ${ampm}`
}

function EventCard({ event, onTap }) {
  const type = detectType(event.name, event.description)
  const audience = detectAudience(event.name, event.description)
  const tc = TYPE_COLORS[type] || TYPE_COLORS.Default

  return (
    <div onClick={() => onTap(event)} style={{
      background: 'white', borderRadius: 16,
      border: '1px solid rgba(0,0,0,0.08)',
      overflow: 'hidden', marginBottom: 12, cursor: 'pointer',
    }}>
      <div style={{ position: 'relative', height: 120, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {event.image_url
          ? <img src={event.image_url} alt={event.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ fontSize: 32, fontWeight: 800, color: 'rgba(26,42,58,0.12)', letterSpacing: 3 }}>
              {(event.location_area || 'MCC').split(' ').map(w => w[0]).join('').substring(0, 3)}
            </div>
        }
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.45)', borderRadius: 7, padding: '4px 9px', fontSize: 11, color: 'white', fontWeight: 700 }}>
          {formatDate(event.event_date)}
        </div>
      </div>

      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
          <span style={{ background: tc.bg, color: tc.color, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{type}</span>
          {audience !== 'All' && <span style={{ background: '#f0f0f0', color: '#555', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6 }}>{audience}</span>}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 3, lineHeight: 1.3 }}>{event.name}</div>
        <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.5)' }}>
          {event.location_area} · {formatTime(event.event_time)}
        </div>
      </div>
    </div>
  )
}

function NewsletterStrip() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  return (
    <div style={{ background: 'linear-gradient(135deg, #1a2a3a 0%, #2d4a6a 100%)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
      {done ? (
        <div style={{ textAlign: 'center', color: 'white', fontSize: 14, fontWeight: 600, padding: '4px 0' }}>✅ You're in! Top events every week.</div>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 4 }}>📬 Top events every week</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 12 }}>Bay Area Muslim events in your inbox every Thursday</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
              style={{ flex: 1, borderRadius: 10, border: 'none', padding: '10px 12px', fontSize: 14, outline: 'none' }} />
            <button onClick={() => email && setDone(true)}
              style={{ background: '#e8a040', border: 'none', borderRadius: 10, padding: '10px 16px', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Subscribe
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function EventDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('content').select('*').eq('url_slug', slug).single()
      .then(({ data }) => { setEvent(data); setLoading(false) })
  }, [slug])

  if (loading) return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'rgba(26,42,58,0.4)' }}><div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>Loading...</div>
    </div>
  )

  if (!event) return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(26,42,58,0.4)' }}>Event not found</div>
    </div>
  )

  const type = detectType(event.name, event.description)
  const audience = detectAudience(event.name, event.description)
  const tc = TYPE_COLORS[type] || TYPE_COLORS.Default

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '52px 20px 20px' }}>
        <button onClick={() => navigate(-1)} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ background: tc.bg, color: tc.color, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{type}</span>
          {audience !== 'All' && <span style={{ background: 'rgba(255,255,255,0.7)', color: '#555', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6 }}>{audience}</span>}
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a2a3a', lineHeight: 1.3, marginBottom: 4 }}>{event.name}</h1>
        <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)' }}>{event.location_area}</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
          {[
            { icon: '📅', label: 'Date', value: formatDate(event.event_date) },
            { icon: '🕐', label: 'Time', value: `${formatTime(event.event_time)}${event.event_end_time ? ` – ${formatTime(event.event_end_time)}` : ''}` },
            { icon: '📍', label: 'Location', value: event.location_address || event.location_area },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{row.icon}</span>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2a3a' }}>{row.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {event.location_address && (
            <a href={`https://www.google.com/maps/search/${encodeURIComponent(event.location_address)}`} target="_blank" rel="noreferrer"
              style={{ flex: 1, background: '#e8a040', border: 'none', borderRadius: 12, padding: '13px 0', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>
              🗺️ Directions
            </a>
          )}
          {event.website && (
            <a href={event.website} target="_blank" rel="noreferrer"
              style={{ flex: 1, background: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '13px 0', color: '#1a2a3a', fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>
              🔗 Event page
            </a>
          )}
        </div>

        {event.description && (
          <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 10 }}>About this event</div>
            <div style={{ fontSize: 14, color: 'rgba(26,42,58,0.75)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{event.description}</div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}

export default function Events() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('All')
  const [audienceFilter, setAudienceFilter] = useState('Everyone')

  useEffect(() => {
    const today = new Date().toISOString().substring(0, 10)
    supabase
      .from('content')
      .select('*')
      .eq('category_id', 'd916a550-c316-40a9-9582-35836417b6cb')
      .eq('status', 'published')
      .gte('event_date', today)
      .order('event_date')
      .then(({ data }) => { setEvents(data || []); setLoading(false) })
  }, [])

  const filtered = events.filter(e => {
    const type = detectType(e.name, e.description)
    const audience = detectAudience(e.name, e.description)
    if (typeFilter !== 'All' && type !== typeFilter) return false
    if (audienceFilter !== 'Everyone' && audience !== audienceFilter && audience !== 'All') return false
    return true
  })

  const now = new Date()
  const endOfWeek = new Date(now); endOfWeek.setDate(now.getDate() + (7 - now.getDay()))
  const endOfNextWeek = new Date(endOfWeek); endOfNextWeek.setDate(endOfWeek.getDate() + 7)

  const groups = [
    { label: 'This Week', events: filtered.filter(e => new Date(e.event_date) <= endOfWeek) },
    { label: 'Next Week', events: filtered.filter(e => new Date(e.event_date) > endOfWeek && new Date(e.event_date) <= endOfNextWeek) },
    { label: 'Upcoming', events: filtered.filter(e => new Date(e.event_date) > endOfNextWeek) },
  ].filter(g => g.events.length > 0)

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '48px 20px 20px' }}>
        <button onClick={() => navigate('/')} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a2a3a', marginBottom: 2 }}>📅 Events</h1>
        <p style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)' }}>{events.length} Bay Area Muslim events</p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <NewsletterStrip />

        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 8, paddingBottom: 2, scrollbarWidth: 'none' }}>
          {TYPE_FILTERS.map(f => (
            <button key={f} onClick={() => setTypeFilter(f)} style={{
              padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: typeFilter === f ? '#1a2a3a' : 'white',
              color: typeFilter === f ? 'white' : 'rgba(26,42,58,0.6)',
              border: '1px solid rgba(0,0,0,0.1)',
            }}>{f}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 16, paddingBottom: 2, scrollbarWidth: 'none' }}>
          {AUDIENCE_FILTERS.map(f => (
            <button key={f} onClick={() => setAudienceFilter(f)} style={{
              padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: audienceFilter === f ? '#9b87c4' : 'white',
              color: audienceFilter === f ? 'white' : 'rgba(26,42,58,0.6)',
              border: '1px solid rgba(0,0,0,0.1)',
            }}>{f}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(26,42,58,0.4)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>Loading events...
          </div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(26,42,58,0.4)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>No events match your filters
          </div>
        ) : groups.map(group => (
          <div key={group.label}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(26,42,58,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{group.label}</div>
            {group.events.map(e => <EventCard key={e.id} event={e} onTap={() => navigate(`/events/${e.url_slug}`)} />)}
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  )
}
