import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const EVENT_TYPES = ['Halaqa', 'Islamic Learning', 'Wellness', 'Family & Kids', 'Community', 'Fundraiser', 'Matrimonial', 'Civic', 'Arts & Culture', 'Food & Drink']
const AUDIENCES = ['General Public', 'Sisters Only', 'Brothers Only', 'Youth', 'Families']

const TYPE_COLORS = {
  'Halaqa':          { bg: '#dddaf8', color: '#3c2a8a' },
  'Islamic Learning':{ bg: '#fde8c0', color: '#7a4a00' },
  'Wellness':        { bg: '#c8f0dc', color: '#0a5c2a' },
  'Family & Kids':   { bg: '#ffd6e8', color: '#8a1a4a' },
  'Community':       { bg: '#b8d8f8', color: '#0a3a6a' },
  'Fundraiser':      { bg: '#f8d4b0', color: '#7a3a00' },
  'Matrimonial':     { bg: '#f0d4f8', color: '#5a1a7a' },
  'Civic':           { bg: '#d4e8f0', color: '#0a3a5a' },
  'Arts & Culture':  { bg: '#f8e4b0', color: '#6a4a00' },
  'Food & Drink':    { bg: '#d4f0e8', color: '#0a4a2a' },
  'Default':         { bg: '#f0f0f0', color: '#444' },
}

function detectTypes(name, description) {
  const text = (name + ' ' + (description || '')).toLowerCase()
  const types = []

  if (text.includes('halaqa')) { types.push('Halaqa'); }
  else if (text.includes('quran') || text.includes('tafseer') || text.includes('tafsir') || text.includes('fiqh') || text.includes('hadith') || text.includes('islamic studies') || text.includes('lecture series') || text.includes('weekly class')) types.push('Islamic Learning')
  else if (text.includes('zumba') || text.includes('hike') || text.includes('hiking') || text.includes('bike') || text.includes('fitness') || text.includes('sport') || text.includes('outdoor') || text.includes('walk') || text.includes('run')) types.push('Wellness')
  else if (text.includes('mommy') || text.includes('toddler') || text.includes('preschool') || text.includes('parenting') || text.includes('children') || text.includes('kids program') || text.includes('playgroup')) types.push('Family & Kids')
  else if (text.includes('fundrais') || text.includes('gala') || text.includes('donation') || text.includes('tables @')) types.push('Fundraiser')
  else if (text.includes('matrimon') || text.includes('singles') || text.includes('marriage')) types.push('Matrimonial')
  else if (text.includes('palestine') || text.includes('gaza') || text.includes('political') || text.includes('civic') || text.includes('advocacy') || text.includes('social justice')) types.push('Civic')
  else if (text.includes('book club') || text.includes('reading group') || text.includes('film') || text.includes('art') || text.includes('poetry') || text.includes('culture')) types.push('Arts & Culture')
  else if (text.includes('food') || text.includes('dinner') || text.includes('iftar') || text.includes('suhoor') || text.includes('potluck') || text.includes('meal') || text.includes('burger') || text.includes('restaurant')) types.push('Food & Drink')
  else types.push('Community')

  // Add a second type if applicable
  if (types[0] !== 'Wellness' && (text.includes('zumba') || text.includes('hike') || text.includes('bike') || text.includes('fitness'))) types.push('Wellness')
  if (types[0] !== 'Food & Drink' && (text.includes('dinner') || text.includes('iftar') || text.includes('potluck'))) types.push('Food & Drink')

  return types.slice(0, 2)
}

function detectAudiences(name, description) {
  // Use title as primary signal — much more reliable than description
  const title = name.toLowerCase()
  const desc = (description || '').toLowerCase()
  const audiences = []

  // Sisters — title mentions women/sisters/girls explicitly
  if (/sister|women'?s|girls|female|mommy|mothers?/.test(title)) audiences.push('Sisters Only')

  // Brothers — title mentions men/brothers/boys explicitly, not as part of a family program
  // Exclude "boys AND girls" or family programs
  const hasBoysMen = /men'?s|brothers?|boys? halaqa|boys? program|adhan program for boys/.test(title)
  const isFamilyContext = /famil|mommy|toddler|preschool|parent/.test(title)
  if (hasBoysMen && !isFamilyContext) audiences.push('Brothers Only')

  // Youth — title mentions teens/youth/school age
  if (/youth|teen|high school|middle school|elementary|junior/.test(title)) audiences.push('Youth')

  // Families — title mentions family/kids/toddler/parenting
  if (/famil|toddler|preschool|parenting|mommy|children'?s/.test(title)) audiences.push('Families')

  if (audiences.length === 0) audiences.push('General Public')
  return audiences
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
  return `${hour % 12 || 12}:${m} ${ampm}`
}

function TypeBadge({ type }) {
  const tc = TYPE_COLORS[type] || TYPE_COLORS.Default
  return <span style={{ background: tc.bg, color: tc.color, fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 5, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>{type}</span>
}

function AudienceBadge({ audience }) {
  return <span style={{ background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5 }}>{audience}</span>
}

function EventCard({ event, onTap }) {
  const types = detectTypes(event.name, event.description)
  const audiences = detectAudiences(event.name, event.description)
  const tc = TYPE_COLORS[types[0]] || TYPE_COLORS.Default
  const imageUrl = event.instagram // we store image in instagram field temporarily

  return (
    <div onClick={() => onTap(event)} style={{
      background: 'white', borderRadius: 16,
      border: '1px solid rgba(0,0,0,0.08)',
      overflow: 'hidden', marginBottom: 12, cursor: 'pointer',
    }}>
      <div style={{ position: 'relative', height: 130, background: tc.bg, overflow: 'hidden' }}>
        {imageUrl
          ? <img src={imageUrl} alt={event.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 800, color: 'rgba(26,42,58,0.1)', letterSpacing: 3 }}>
              {event.location_area?.split(' ').map(w => w[0]).join('').substring(0, 3)}
            </div>
        }
        {/* Date badge top right */}
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', borderRadius: 7, padding: '4px 9px', fontSize: 11, color: 'white', fontWeight: 700 }}>
          {formatDate(event.event_date)}
        </div>
        {/* Type + audience badges bottom left */}
        <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {types.map(t => <TypeBadge key={t} type={t} />)}
          {audiences.filter(a => a !== 'General Public').map(a => <AudienceBadge key={a} audience={a} />)}
        </div>
      </div>

      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 3, lineHeight: 1.3 }}>{event.name}</div>
        <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.5)' }}>
          {event.location_area} · {formatTime(event.event_time)}
        </div>
      </div>
    </div>
  )
}

function FiltersPanel({ activeTypes, activeAudiences, onTypesChange, onAudiencesChange, onClose }) {
  const [localTypes, setLocalTypes] = useState(activeTypes)
  const [localAudiences, setLocalAudiences] = useState(activeAudiences)

  const toggleType = (t) => setLocalTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  const toggleAudience = (a) => setLocalAudiences(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} />
      <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', maxHeight: '75vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1a2a3a' }}>Filters</div>
          <button onClick={() => { setLocalTypes([]); setLocalAudiences([]) }} style={{ fontSize: 13, color: '#9b87c4', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(26,42,58,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Event Type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {EVENT_TYPES.map(t => {
            const active = localTypes.includes(t)
            const tc = TYPE_COLORS[t] || TYPE_COLORS.Default
            return (
              <button key={t} onClick={() => toggleType(t)} style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: active ? tc.bg : '#f5f5f5',
                color: active ? tc.color : 'rgba(26,42,58,0.6)',
                border: active ? `1.5px solid ${tc.color}` : '1.5px solid transparent',
              }}>{t}</button>
            )
          })}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(26,42,58,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Audience</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {AUDIENCES.map(a => {
            const active = localAudiences.includes(a)
            return (
              <button key={a} onClick={() => toggleAudience(a)} style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: active ? '#1a2a3a' : '#f5f5f5',
                color: active ? 'white' : 'rgba(26,42,58,0.6)',
                border: '1.5px solid transparent',
              }}>{a}</button>
            )
          })}
        </div>

        <button onClick={() => { onTypesChange(localTypes); onAudiencesChange(localAudiences); onClose() }} style={{
          width: '100%', background: '#1a2a3a', color: 'white', border: 'none',
          borderRadius: 14, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>
          Apply Filters {(localTypes.length + localAudiences.length) > 0 ? `(${localTypes.length + localAudiences.length})` : ''}
        </button>
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

  const types = detectTypes(event.name, event.description)
  const audiences = detectAudiences(event.name, event.description)
  const imageUrl = event.instagram

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '52px 20px 20px' }}>
        <button onClick={() => navigate(-1)} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {types.map(t => <TypeBadge key={t} type={t} />)}
          {audiences.filter(a => a !== 'General Public').map(a => (
            <span key={a} style={{ background: 'rgba(26,42,58,0.12)', color: 'rgba(26,42,58,0.7)', fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 5 }}>{a}</span>
          ))}
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a2a3a', lineHeight: 1.3, marginBottom: 4 }}>{event.name}</h1>
        <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)' }}>{event.location_area}</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {imageUrl && (
          <img src={imageUrl} alt={event.name} style={{ width: '100%', borderRadius: 16, marginBottom: 12, objectFit: 'cover', maxHeight: 220 }} />
        )}

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
              style={{ flex: 1, background: '#e8a040', border: 'none', borderRadius: 12, padding: '13px 0', color: 'white', fontWeight: 700, fontSize: 13, textDecoration: 'none', textAlign: 'center' }}>
              🗺️ Directions
            </a>
          )}
          {event.website && (
            <a href={event.website} target="_blank" rel="noreferrer"
              style={{ flex: 1, background: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '13px 0', color: '#1a2a3a', fontWeight: 700, fontSize: 13, textDecoration: 'none', textAlign: 'center' }}>
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
  const [showPast, setShowPast] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [activeTypes, setActiveTypes] = useState([])
  const [activeAudiences, setActiveAudiences] = useState([])

  useEffect(() => {
    const today = new Date().toISOString().substring(0, 10)
    const query = supabase
      .from('content')
      .select('*')
      .eq('category_id', 'd916a550-c316-40a9-9582-35836417b6cb')
      .eq('status', 'published')
      .order('event_date', { ascending: !showPast })

    if (showPast) {
      query.lt('event_date', today).limit(30)
    } else {
      query.gte('event_date', today)
    }

    query.then(({ data }) => { setEvents(data || []); setLoading(false) })
  }, [showPast])

  const filtered = events.filter(e => {
    if (activeTypes.length > 0) {
      const types = detectTypes(e.name, e.description)
      if (!types.some(t => activeTypes.includes(t))) return false
    }
    if (activeAudiences.length > 0) {
      const audiences = detectAudiences(e.name, e.description)
      if (!audiences.some(a => activeAudiences.includes(a))) return false
    }
    return true
  })

  const today = new Date()
  const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + (7 - today.getDay()))
  const endOfNextWeek = new Date(endOfWeek); endOfNextWeek.setDate(endOfWeek.getDate() + 7)

  const groups = showPast ? [{ label: 'Past Events', events: filtered }] : [
    { label: 'This Week', events: filtered.filter(e => new Date(e.event_date) <= endOfWeek) },
    { label: 'Next Week', events: filtered.filter(e => new Date(e.event_date) > endOfWeek && new Date(e.event_date) <= endOfNextWeek) },
    { label: 'Upcoming', events: filtered.filter(e => new Date(e.event_date) > endOfNextWeek) },
  ].filter(g => g.events.length > 0)

  const filterCount = activeTypes.length + activeAudiences.length

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '48px 20px 20px' }}>
        <button onClick={() => navigate('/')} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a2a3a', marginBottom: 2 }}>📅 Events</h1>
        <p style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)' }}>{events.length} Bay Area Muslim events</p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <NewsletterStrip />

        {/* Top controls row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          {/* Upcoming / Past toggle */}
          <div style={{ display: 'inline-flex', background: 'white', borderRadius: 12, padding: 3, border: '1px solid rgba(0,0,0,0.08)', flex: 1 }}>
            <button onClick={() => setShowPast(false)} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: !showPast ? '#1a2a3a' : 'transparent',
              color: !showPast ? 'white' : 'rgba(26,42,58,0.5)',
            }}>Upcoming</button>
            <button onClick={() => setShowPast(true)} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: showPast ? '#1a2a3a' : 'transparent',
              color: showPast ? 'white' : 'rgba(26,42,58,0.5)',
            }}>Past</button>
          </div>

          {/* Filters button */}
          <button onClick={() => setShowFilters(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: filterCount > 0 ? '#1a2a3a' : 'white',
            color: filterCount > 0 ? 'white' : 'rgba(26,42,58,0.7)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            ⚙️ Filters {filterCount > 0 ? `(${filterCount})` : ''}
          </button>
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

      {showFilters && (
        <FiltersPanel
          activeTypes={activeTypes}
          activeAudiences={activeAudiences}
          onTypesChange={setActiveTypes}
          onAudiencesChange={setActiveAudiences}
          onClose={() => setShowFilters(false)}
        />
      )}

      <BottomNav />
    </div>
  )
}
