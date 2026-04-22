import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const EVENT_TYPES = ['Halaqa', 'Islamic Learning', 'Wellness', 'Family & Kids', 'Community', 'Fundraiser', 'Matrimonial', 'Civic', 'Arts & Culture', 'Food & Drink']
const AUDIENCES = ['General Public', 'Sisters Only', 'Brothers Only', 'Youth', 'Families']
const MOSQUES = ['MCC East Bay', 'MCA Santa Clara', 'ICF Fremont', 'ICL Livermore', 'SRVIC San Ramon', 'WVMA Los Gatos', 'Lamorinda', 'Yaseen Foundation']

const TYPE_COLOR = { bg: '#e8943a', color: 'white' }
const AUDIENCE_COLOR = { bg: '#9b87c4', color: 'white' }

function detectTypes(name, description) {
  const title = name.toLowerCase()
  const desc = (description || '').toLowerCase()
  const both = title + ' ' + desc
  let types = []
  if (title.includes('halaqa')) types.push('Halaqa')
  else if (/quran|tafseer|tafsir|fiqh|hadith|islamic studies|lecture series|weekly class|seerah|aqeedah/.test(both)) types.push('Islamic Learning')
  else if (/zumba|hike|hiking|bike|fitness|sport|outdoor|walk|run|yoga|swim/.test(both)) types.push('Wellness')
  else if (/mommy|toddler|preschool|parenting|children'?s program|playgroup|kids program/.test(both)) types.push('Family & Kids')
  else if (/fundrais|gala|donation|annual dinner|banquet|tables @/.test(both)) types.push('Fundraiser')
  else if (/matrimon|singles|marriage event|speed meet/.test(both)) types.push('Matrimonial')
  else if (/palestine|gaza|political|civic|advocacy|social justice|human rights/.test(both)) types.push('Civic')
  else if (/book club|reading group|film|poetry|art show|culture night/.test(both)) types.push('Arts & Culture')
  else if (/food festival|suhoor fest|iftar dinner|halal food|restaurant night|pop.?up/.test(both)) types.push('Food & Drink')
  else types.push('Community')
  if (!types.includes('Wellness') && /zumba|hike|bike|fitness|sport/.test(both)) types.push('Wellness')
  if (!types.includes('Food & Drink') && /iftar dinner|suhoor|potluck|community dinner/.test(title)) types.push('Food & Drink')
  if (!types.includes('Civic') && /palestine|gaza/.test(both)) types.push('Civic')
  return types.slice(0, 2)
}

function detectAudiences(name, description) {
  const title = name.toLowerCase()
  const desc = (description || '').toLowerCase()
  const isFamilyContext = /famil|mommy|toddler|preschool|parent|playgroup|ages [1-5]|ages one to/.test(title)
  const audiences = []
  if (/sister|women'?s|girls|female|mommy|mothers?/.test(title)) audiences.push('Sisters Only')
  else if (/sisters only|women only|for women|for sisters/.test(desc)) audiences.push('Sisters Only')
  const brothersTitle = /\bmen'?s\b|brothers?|boys? halaqa|boys? program|adhan.*boys|for men\b/.test(title)
  if (brothersTitle && !isFamilyContext) audiences.push('Brothers Only')
  else if (/brothers only|men only|for brothers\b/.test(desc)) audiences.push('Brothers Only')
  if (/youth|teen|high school|middle school|elementary|junior|ages 1[2-9]/.test(title)) audiences.push('Youth')
  else if (/for teens|for youth|ages 12|ages 13|ages 14|ages 15|grades [6-9]/.test(desc)) audiences.push('Youth')
  if (/famil|toddler|preschool|parenting|mommy|children'?s/.test(title)) audiences.push('Families')
  else if (/for families|bring your kids|children welcome|family friendly/.test(desc)) audiences.push('Families')
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
  return <span style={{ background: TYPE_COLOR.bg, color: TYPE_COLOR.color, fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5 }}>{type}</span>
}

function AudienceBadge({ audience }) {
  return <span style={{ background: AUDIENCE_COLOR.bg, color: AUDIENCE_COLOR.color, fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5 }}>{audience}</span>
}

function EventCard({ event, onTap }) {
  const types = event.event_type ? [event.event_type] : detectTypes(event.name, event.description)
  const audiences = (event.event_audience && event.event_audience.length > 0) ? event.event_audience : detectAudiences(event.name, event.description)
  const imageUrl = event.image_url || event.instagram

  return (
    <div onClick={() => onTap(event)} style={{
      background: 'white', borderRadius: 16,
      border: '1px solid rgba(0,0,0,0.08)',
      overflow: 'hidden', marginBottom: 12, cursor: 'pointer',
    }}>
      <div style={{ position: 'relative', height: 130, background: '#f0edf8', overflow: 'hidden' }}>
        {imageUrl
          ? <img src={imageUrl} alt={event.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 800, color: 'rgba(26,42,58,0.1)', letterSpacing: 3 }}>
              {event.location_area?.split(' ').map(w => w[0]).join('').substring(0, 3)}
            </div>
        }
        {/* Mosque name top-left */}
        {(event.event_host || event.internal_notes) && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, color: 'white' }}>
            {event.event_host || event.internal_notes}
          </div>
        )}
        {/* Type + audience badges bottom-left */}
        <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {types.map(t => <TypeBadge key={t} type={t} />)}
          {audiences.filter(a => a !== 'General Public').map(a => <AudienceBadge key={a} audience={a} />)}
        </div>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 6, lineHeight: 1.3 }}>{event.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2a3a' }}>{formatDate(event.event_date)}</span>
          {event.event_time && <>
            <span style={{ fontSize: 10, color: 'rgba(26,42,58,0.3)' }}>·</span>
            <span style={{ fontSize: 12, color: 'rgba(26,42,58,0.6)' }}>{formatTime(event.event_time)}</span>
          </>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {(event.event_host || event.internal_notes) && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1a2a3a', background: '#f0f0f0', padding: '2px 7px', borderRadius: 5 }}>{event.event_host || event.internal_notes}</span>
          )}
          <span style={{ fontSize: 11, color: 'rgba(26,42,58,0.4)' }}>{event.location_area}</span>
        </div>
      </div>
    </div>
  )
}

// Compact inline calendar for date filtering on main page
function InlineCalendar({ selectedDate, onChange, onClose }) {
  const today = new Date()
  const [viewMonth, setViewMonth] = React.useState(today.getMonth())
  const [viewYear, setViewYear] = React.useState(today.getFullYear())
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const monthName = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) } else setViewMonth(m => m-1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) } else setViewMonth(m => m+1) }

  const toDateStr = (d) => `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const isPast = (d) => new Date(viewYear, viewMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const isSelected = (d) => selectedDate === toDateStr(d)
  const isToday = (d) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(i)

  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '12px 14px', marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#1a2a3a', padding: '2px 6px' }}>‹</button>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2a3a' }}>{monthName}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {selectedDate && <button onClick={() => { onChange(null); onClose() }} style={{ fontSize: 11, color: '#9b87c4', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>}
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#1a2a3a', padding: '2px 6px' }}>›</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {['S','M','T','W','T','F','S'].map((d,i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(26,42,58,0.35)', padding: '2px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((d, i) => (
          <div key={i} onClick={() => { if (d && !isPast(d)) { onChange(isSelected(d) ? null : toDateStr(d)); if (!isSelected(d)) onClose() } }}
            style={{
              textAlign: 'center', padding: '5px 0', borderRadius: 7, fontSize: 12,
              fontWeight: isSelected(d) ? 700 : 400,
              background: isSelected(d) ? '#e8943a' : 'transparent',
              color: isSelected(d) ? 'white' : isPast(d) || !d ? 'rgba(26,42,58,0.2)' : isToday(d) ? '#e8943a' : '#1a2a3a',
              cursor: d && !isPast(d) ? 'pointer' : 'default',
            }}>{d || ''}</div>
        ))}
      </div>
    </div>
  )
}

// Compact filters panel — slide up from bottom, just type + audience
function FiltersPanel({ activeTypes, activeAudiences, activeMosques, onTypesChange, onAudiencesChange, onMosquesChange, onClose }) {
  const [localTypes, setLocalTypes] = useState(activeTypes)
  const [localAudiences, setLocalAudiences] = useState(activeAudiences)
  const [localMosques, setLocalMosques] = useState(activeMosques)
  const toggleType = (t) => setLocalTypes(prev => prev.includes(t) ? prev.filter(x => x!==t) : [...prev,t])
  const toggleAudience = (a) => setLocalAudiences(prev => prev.includes(a) ? prev.filter(x => x!==a) : [...prev,a])
  const toggleMosque = (m) => setLocalMosques(prev => prev.includes(m) ? prev.filter(x => x!==m) : [...prev,m])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.35)' }} />
      <div style={{ background: 'white', borderRadius: '18px 18px 0 0', padding: '16px 16px 32px', maxHeight: '40vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a' }}>Filters</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={() => { setLocalTypes([]); setLocalAudiences([]) }} style={{ fontSize: 12, color: '#9b87c4', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
            <button onClick={() => { onTypesChange(localTypes); onAudiencesChange(localAudiences); onClose() }} style={{ background: '#1a2a3a', color: 'white', border: 'none', borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Apply {(localTypes.length + localAudiences.length) > 0 ? `(${localTypes.length + localAudiences.length})` : ''}
            </button>
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 800, color: '#1a2a3a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Event Type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {EVENT_TYPES.map(t => (
            <button key={t} onClick={() => toggleType(t)} style={{
              padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: localTypes.includes(t) ? TYPE_COLOR.bg : '#f0f0f0',
              color: localTypes.includes(t) ? 'white' : '#1a2a3a',
              border: 'none',
            }}>{t}</button>
          ))}
        </div>

        <div style={{ fontSize: 10, fontWeight: 800, color: '#1a2a3a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Audience</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {AUDIENCES.map(a => (
            <button key={a} onClick={() => toggleAudience(a)} style={{
              padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: localAudiences.includes(a) ? AUDIENCE_COLOR.bg : '#f0f0f0',
              color: localAudiences.includes(a) ? 'white' : '#1a2a3a',
              border: 'none',
            }}>{a}</button>
          ))}
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
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 12 }}>The best Bay Area Muslim events, every week</div>
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

  const types = event.event_type ? [event.event_type] : detectTypes(event.name, event.description)
  const audiences = (event.event_audience && event.event_audience.length > 0) ? event.event_audience : detectAudiences(event.name, event.description)
  const imageUrl = event.image_url || event.instagram

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '52px 20px 20px' }}>
        <button onClick={() => navigate(-1)} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {types.map(t => <TypeBadge key={t} type={t} />)}
          {audiences.filter(a => a !== 'General Public').map(a => <AudienceBadge key={a} audience={a} />)}
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a2a3a', lineHeight: 1.3, marginBottom: 4 }}>{event.name}</h1>
        <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)' }}>{event.location_area}</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {imageUrl && <img src={imageUrl} alt={event.name} style={{ width: '100%', borderRadius: 16, marginBottom: 12, objectFit: 'cover', maxHeight: 220 }} />}

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
  const [showFilters, setShowFilters] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [activeTypes, setActiveTypes] = useState([])
  const [activeAudiences, setActiveAudiences] = useState([])
  const [activeMosques, setActiveMosques] = useState([])
  const [activeDate, setActiveDate] = useState(null)

  useEffect(() => {
    const today = new Date().toISOString().substring(0, 10)
    supabase
      .from('content')
      .select('*')
      .eq('category_id', 'd916a550-c316-40a9-9582-35836417b6cb')
      .eq('status', 'published')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .then(({ data }) => {
        // Filter out Jummah events on display too
        const filtered = (data || []).filter(e => !/jumu.?ah|jummah/i.test(e.name))
        setEvents(filtered)
        setLoading(false)
      })
  }, [])

  const filtered = events.filter(e => {
    if (activeDate && e.event_date !== activeDate) return false
    if (activeTypes.length > 0) {
      const types = e.event_type ? [e.event_type] : detectTypes(e.name, e.description)
      if (!types.some(t => activeTypes.includes(t))) return false
    }
    if (activeAudiences.length > 0) {
      const audiences = (e.event_audience && e.event_audience.length > 0) ? e.event_audience : detectAudiences(e.name, e.description)
      if (!audiences.some(a => activeAudiences.includes(a))) return false
    }
    if (activeMosques.length > 0 && !activeMosques.includes(e.event_host || e.internal_notes)) return false
    return true
  })

  const today = new Date()
  const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + (7 - today.getDay()))
  const endOfNextWeek = new Date(endOfWeek); endOfNextWeek.setDate(endOfWeek.getDate() + 7)

  const groups = [
    { label: 'This Week', events: filtered.filter(e => new Date(e.event_date) <= endOfWeek) },
    { label: 'Next Week', events: filtered.filter(e => new Date(e.event_date) > endOfWeek && new Date(e.event_date) <= endOfNextWeek) },
    { label: 'Upcoming', events: filtered.filter(e => new Date(e.event_date) > endOfNextWeek) },
  ].filter(g => g.events.length > 0)

  const filterCount = activeTypes.length + activeAudiences.length + activeMosques.length + (activeDate ? 1 : 0)

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '48px 20px 20px' }}>
        <button onClick={() => navigate('/')} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a2a3a', marginBottom: 2 }}>📅 Events</h1>
        <p style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)' }}>{events.length} Bay Area Muslim events</p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <NewsletterStrip />

        {/* Mosque scrolling filter */}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 8, paddingBottom: 2, scrollbarWidth: 'none' }}>
          <button onClick={() => setActiveMosques([])} style={{ padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: activeMosques.length === 0 ? '#1a2a3a' : 'white', color: activeMosques.length === 0 ? 'white' : '#1a2a3a', border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }}>All</button>
          {MOSQUES.map(m => (
            <button key={m} onClick={() => setActiveMosques(activeMosques.includes(m) ? activeMosques.filter(x => x !== m) : [...activeMosques, m])} style={{ padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: activeMosques.includes(m) ? '#1a2a3a' : 'white', color: activeMosques.includes(m) ? 'white' : '#1a2a3a', border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }}>{m}</button>
          ))}
        </div>

        {/* Date + Filters row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <button onClick={() => { setShowCalendar(c => !c); setShowFilters(false) }} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: activeDate ? '#e8943a' : 'white',
            color: activeDate ? 'white' : '#1a2a3a',
            border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
            padding: '9px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>📅 {activeDate ? formatDate(activeDate).replace(/\w+, /, '') : 'Date'}</button>
          <button onClick={() => { setShowFilters(f => !f); setShowCalendar(false) }} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: (activeTypes.length + activeAudiences.length) > 0 ? '#1a2a3a' : 'white',
            color: (activeTypes.length + activeAudiences.length) > 0 ? 'white' : '#1a2a3a',
            border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
            padding: '9px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>⚙️ {(activeTypes.length + activeAudiences.length) > 0 ? `Filters (${activeTypes.length + activeAudiences.length})` : 'Filters'}</button>
        </div>

        {/* Inline calendar */}
        {showCalendar && (
          <InlineCalendar
            selectedDate={activeDate}
            onChange={setActiveDate}
            onClose={() => setShowCalendar(false)}
          />
        )}

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
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(26,42,58,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, marginLeft: -16, marginRight: -16, padding: '8px 16px', position: 'sticky', top: 0, zIndex: 5, background: '#f5f5f5' }}>{group.label}</div>
            {group.events.map(e => <EventCard key={e.id} event={e} onTap={() => navigate(`/events/${e.url_slug}`)} />)}
          </div>
        ))}
      </div>

      {showFilters && (
        <FiltersPanel
          activeTypes={activeTypes}
          activeAudiences={activeAudiences}
          activeMosques={activeMosques}
          onTypesChange={setActiveTypes}
          onAudiencesChange={setActiveAudiences}
          onMosquesChange={setActiveMosques}
          onClose={() => setShowFilters(false)}
        />
      )}
      <BottomNav />
    </div>
  )
}
