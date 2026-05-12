import { colors, headerGradient, card, radius } from '../theme'
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import TopBar from '../components/TopBar'

const EVENT_TYPES = ['Halaqa', 'Islamic Learning', 'Wellness', 'Family & Kids', 'Community', 'Fundraiser', 'Matrimonial', 'Civic', 'Arts & Culture', 'Food & Drink']
const AUDIENCES = ['General Public', 'Sisters Only', 'Brothers Only', 'Youth', 'Families']
const MOSQUES = ['MCC East Bay', 'MCA Santa Clara', 'ICF Fremont', 'SRVIC San Ramon', 'WVMA Los Gatos', 'Lamorinda']

const TYPE_COLOR = { bg: '#e8943a', color: 'white' }
const AUDIENCE_COLOR = { bg: '#9b87c4', color: 'white' }

// True only for URLs that look like an actual image (not an Instagram/Facebook link, etc).
function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false
  const lower = url.toLowerCase().trim()
  if (!lower.startsWith('http')) return false
  // Common image extensions
  if (/\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|#|$)/i.test(lower)) return true
  // Known image-hosting paths (Supabase storage, common CDNs)
  if (lower.includes('supabase.co/storage') || lower.includes('cloudinary.com') || lower.includes('imgur.com')) return true
  // Skip Instagram/Facebook/site URLs that aren't images
  if (/instagram\.com|facebook\.com|twitter\.com|x\.com|tiktok\.com|youtube\.com|linkedin\.com/.test(lower)) return false
  return false  // unknown → don't risk a broken img tag
}

// Strip HTML tags and decode common entities for clean display in <div>{text}</div>
function stripHtml(html) {
  if (!html || typeof html !== 'string') return ''
  return html
    // Convert breaks/paragraphs to newlines first
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?p[^>]*>/gi, '')
    .replace(/<\/?div[^>]*>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    // Collapse excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

// True if the address is a meaningful venue (not just "CA" or other state codes).
// Real addresses have either a street number or a building/place name with multiple words.
function isRealAddress(addr) {
  if (!addr || typeof addr !== 'string') return false
  const trimmed = addr.trim()
  if (trimmed.length < 5) return false
  // Just a state code like "CA", "CA, USA", "California", etc — not useful
  if (/^(CA|California|United States|USA|US|N\/A)[\s,.]*$/i.test(trimmed)) return false
  return true
}

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
  // Only use real image URLs — Instagram links etc are not valid <img src> values
  const imageUrl = isValidImageUrl(event.image_url) ? event.image_url : null
  const eventDate = event.event_date ? new Date(event.event_date + 'T00:00:00') : null

  return (
    <div onClick={() => onTap(event)} style={{
      background: 'white', borderRadius: 16,
      border: '1px solid rgba(0,0,0,0.08)',
      overflow: 'hidden', marginBottom: 12, cursor: 'pointer',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Top section: 130px tall — image OR brand-tinted placeholder. Same height either way. */}
      <div style={{ position: 'relative', height: 130, background: imageUrl ? '#f0edf8' : 'linear-gradient(135deg, #FFE8DC 0%, #FED7BB 100%)', overflow: 'hidden' }}>
        {imageUrl
          ? <img src={imageUrl} alt={event.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 56, opacity: 0.35, lineHeight: 1 }}>📅</span>
            </div>
        }
        {/* Mosque name top-left */}
        {(event.event_host || event.internal_notes) && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: '#E8860A', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, color: 'white' }}>
            {event.event_host || event.internal_notes}
          </div>
        )}
      </div>

      {/* Bottom section: date block (always) + event details. Same layout regardless of image. */}
      <div style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Date block — always present */}
        {eventDate && (
          <div style={{
            background: 'white',
            border: `1.5px solid ${colors.brand}`,
            borderRadius: 10,
            padding: '6px 0',
            minWidth: 56,
            textAlign: 'center',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: colors.brand, letterSpacing: 1, textTransform: 'uppercase', lineHeight: 1.3 }}>
              {eventDate.toLocaleDateString('en-US', { month: 'short' })}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', lineHeight: 1.05 }}>
              {eventDate.getDate()}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#6A7A8A', letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 1.3 }}>
              {eventDate.toLocaleDateString('en-US', { weekday: 'short' })}
            </div>
          </div>
        )}

        {/* Right column: name + time/venue + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 6, lineHeight: 1.3 }}>{event.name}</div>
          {event.event_time && (
            <div style={{ fontSize: 12, color: '#3A4A5A', marginBottom: 3 }}>
              🕐 {formatTime(event.event_time)}
            </div>
          )}
          {(event.event_host || isRealAddress(event.address)) && (
            <div style={{ fontSize: 12, color: '#3A4A5A', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📍 {isRealAddress(event.address) ? event.address : event.event_host}
            </div>
          )}
          {(types.length > 0 || audiences.filter(a => a !== 'General Public').length > 0) && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {types.map(t => <TypeBadge key={t} type={t} />)}
              {audiences.filter(a => a !== 'General Public').map(a => <AudienceBadge key={a} audience={a} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Compact event row used in the List view mode
function EventListRow({ event, onTap, distanceLabel }) {
  const venueName = isRealAddress(event.address) ? event.address : (event.event_host || event.internal_notes)
  return (
    <div onClick={() => onTap(event)} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'white',
      padding: '11px 12px',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
      cursor: 'pointer',
    }}>
      {event.event_time && (
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.brand, minWidth: 62, flexShrink: 0 }}>
          {formatTime(event.event_time)}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.name}</div>
        {venueName && (
          <div style={{ fontSize: 11, color: '#6A7A8A', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {venueName}
          </div>
        )}
      </div>
      {distanceLabel && (
        <div style={{ fontSize: 11, fontWeight: 700, color: colors.brand, flexShrink: 0 }}>{distanceLabel}</div>
      )}
      <div style={{ fontSize: 14, color: '#9AA5B0', flexShrink: 0 }}>›</div>
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
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: colors.textPrimary, padding: '2px 6px' }}>‹</button>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>{monthName}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {selectedDate && <button onClick={() => { onChange(null); onClose() }} style={{ fontSize: 11, color: '#9b87c4', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>}
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: colors.textPrimary, padding: '2px 6px' }}>›</button>
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
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>Filters</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={() => { setLocalTypes([]); setLocalAudiences([]) }} style={{ fontSize: 12, color: '#9b87c4', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
            <button onClick={() => { onTypesChange(localTypes); onAudiencesChange(localAudiences); onClose() }} style={{ background: colors.deep, color: 'white', border: 'none', borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Apply {(localTypes.length + localAudiences.length) > 0 ? `(${localTypes.length + localAudiences.length})` : ''}
            </button>
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 800, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Event Type</div>
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

        <div style={{ fontSize: 10, fontWeight: 800, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Audience</div>
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
    <div style={{
      background: 'linear-gradient(135deg, #1C2B3A 0%, #2D4458 100%)',
      borderRadius: 16, padding: 18, marginBottom: 16,
      boxShadow: '0 4px 16px rgba(28,43,58,0.15)',
    }}>
      {done ? (
        <div style={{ textAlign: 'center', color: 'white', fontSize: 14, fontWeight: 700, padding: '4px 0' }}>✅ You're in. Top events coming Monday.</div>
      ) : (
        <>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'white', marginBottom: 6, lineHeight: 1.25 }}>
            Top 5 Muslim events — straight to your inbox
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 14 }}>Free, every Monday. No spam, just what's worth showing up for.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
              style={{ flex: 1, borderRadius: 10, border: 'none', padding: '11px 12px', fontSize: 14, outline: 'none' }} />
            <button onClick={() => email && setDone(true)}
              style={{ background: '#E8860A', border: 'none', borderRadius: 10, padding: '11px 18px', color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              Get them
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
      <div style={{ textAlign: 'center', color: '#6A7A8A' }}><div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>Loading...</div>
    </div>
  )
  if (!event) return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6A7A8A' }}>Event not found</div>
    </div>
  )

  const types = event.event_type ? [event.event_type] : detectTypes(event.name, event.description)
  const audiences = (event.event_audience && event.event_audience.length > 0) ? event.event_audience : detectAudiences(event.name, event.description)
  const imageUrl = isValidImageUrl(event.image_url) ? event.image_url : null

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header — navigation only */}
      <div style={{ background: headerGradient, padding: '48px 20px 18px' }}>
        <div style={{ marginBottom: 10 }}>
          <TopBar />
        </div>
        <button onClick={() => navigate(-1)} style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A', display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Event hero — image if real, otherwise brand-tinted fallback */}
        {imageUrl ? (
          <img src={imageUrl} alt={event.name} style={{ width: '100%', borderRadius: 16, marginBottom: 12, objectFit: 'cover', maxHeight: 220 }} />
        ) : (
          <div style={{
            width: '100%', height: 160, borderRadius: 16, marginBottom: 12,
            background: 'linear-gradient(135deg, #FFE8DC 0%, #FED7BB 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 72, opacity: 0.35 }}>📅</span>
          </div>
        )}

        {/* Event name + badges */}
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1C2B3A', lineHeight: 1.3, marginBottom: 8 }}>{event.name}</h1>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {types.map(t => <TypeBadge key={t} type={t} />)}
          {audiences.filter(a => a !== 'General Public').map(a => <AudienceBadge key={a} audience={a} />)}
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
          {[
            { icon: '📅', label: 'Date', value: formatDate(event.event_date) },
            { icon: '🕐', label: 'Time', value: `${formatTime(event.event_time)}${event.event_end_time ? ` – ${formatTime(event.event_end_time)}` : ''}` },
            { icon: '📍', label: 'Location', value: isRealAddress(event.address) ? event.address : (event.event_host || 'See event details') },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{row.icon}</span>
              <div>
                <div style={{ fontSize: 10, color: '#6A7A8A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>{row.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(event.display_lat || event.address) && (
            <a href={event.display_lat && event.display_lng
                ? `https://www.google.com/maps/dir/?api=1&destination=${event.display_lat},${event.display_lng}`
                : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.address)}`}
              target="_blank" rel="noreferrer"
              style={{ flex: 1, background: '#E8860A', border: 'none', borderRadius: 12, padding: '13px 0', color: 'white', fontWeight: 700, fontSize: 13, textDecoration: 'none', textAlign: 'center' }}>
              Directions
            </a>
          )}
          {event.website && (
            <a href={event.website} target="_blank" rel="noreferrer"
              style={{ flex: 1, background: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '13px 0', color: colors.textPrimary, fontWeight: 700, fontSize: 13, textDecoration: 'none', textAlign: 'center' }}>
              🔗 Event page
            </a>
          )}
        </div>

        {event.description && (
          <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 10 }}>About this event</div>
            <div style={{ fontSize: 14, color: 'rgba(26,42,58,0.75)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{stripHtml(event.description)}</div>
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
  const [mosques, setMosques] = useState([])  // for fallback coords by event_host
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(null)
  const [thisWeekend, setThisWeekend] = useState(false)
  const [today, setToday] = useState(false)
  // View density: 'cards' (default) or 'list' (compact, grouped by date)
  const [viewMode, setViewMode] = useState('cards')
  const [showCalendar, setShowCalendar] = useState(false)
  const [activeTypes, setActiveTypes] = useState([])
  const [activeAudiences, setActiveAudiences] = useState([])
  const [activeMosques, setActiveMosques] = useState([])
  const [activeDate, setActiveDate] = useState(null)
  // Near-me sorting
  const [sortByNear, setSortByNear] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [locationDenied, setLocationDenied] = useState(false)

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
        const filtered = (data || []).filter(e => !/jumu.{0,3}ah|jummah|jumu|friday prayer/i.test(e.name))
        setEvents(filtered)
        setLoading(false)
      })

    // Also load mosques (for fallback coords by event_host name)
    supabase.from('categories').select('id').eq('slug', 'mosques').single()
      .then(({ data: cat }) => {
        if (!cat) return
        return supabase.from('content')
          .select('name, display_lat, display_lng')
          .eq('category_id', cat.id)
          .eq('status', 'published')
          .not('display_lat', 'is', null)
      })
      .then(res => { if (res?.data) setMosques(res.data) })
  }, [])

  // Request browser location when user toggles Near me on
  const handleNearMeToggle = () => {
    if (sortByNear) {
      setSortByNear(false)
      return
    }
    if (userLocation) {
      setSortByNear(true)
      return
    }
    if (!navigator.geolocation) {
      alert('Location not supported on this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setSortByNear(true)
      },
      err => {
        console.warn('Geolocation denied:', err)
        setLocationDenied(true)
      },
      { timeout: 10000 }
    )
  }

  // Distance helper (miles) — used to sort by Near me
  const distMi = (lat1, lng1, lat2, lng2) => {
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return Infinity
    const R = 3958.8
    const toRad = x => x * Math.PI / 180
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2) ** 2
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  // Get effective coords for an event — falls back to host mosque if event has none
  const eventCoords = (e) => {
    if (e.display_lat != null && e.display_lng != null) return { lat: e.display_lat, lng: e.display_lng }
    const host = e.event_host || e.internal_notes
    if (!host) return null
    // Try exact match first, then substring match (handles "MCA Santa Clara" → "MCA - Muslim Community Association (Santa Clara)")
    const exactMatch = mosques.find(m => m.name === host)
    if (exactMatch) return { lat: exactMatch.display_lat, lng: exactMatch.display_lng }
    const hostLower = host.toLowerCase()
    const fuzzy = mosques.find(m => {
      const nameLower = m.name.toLowerCase()
      return nameLower.includes(hostLower) || hostLower.split(' ').every(part => nameLower.includes(part.toLowerCase()))
    })
    if (fuzzy) return { lat: fuzzy.display_lat, lng: fuzzy.display_lng }
    return null
  }

  // Calculate this weekend dates
  const todayDate = new Date()
  const dayOfWeek = todayDate.getDay()
  const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 0
  const daysUntilSun = (0 - dayOfWeek + 7) % 7 || 7
  const satDate = new Date(todayDate); satDate.setDate(todayDate.getDate() + daysUntilSat)
  const sunDate = new Date(todayDate); sunDate.setDate(todayDate.getDate() + (dayOfWeek === 0 ? 0 : daysUntilSun))
  const satStr = satDate.toISOString().substring(0, 10)
  const sunStr = sunDate.toISOString().substring(0, 10)

  const todayStr = todayDate.toISOString().substring(0, 10)

  const filtered = events.filter(e => {
    if (today && e.event_date !== todayStr) return false
    if (thisWeekend && e.event_date !== satStr && e.event_date !== sunStr) return false
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

  const nowDate = new Date()
  const endOfWeek = new Date(nowDate); endOfWeek.setDate(nowDate.getDate() + (7 - nowDate.getDay()))
  const endOfNextWeek = new Date(endOfWeek); endOfNextWeek.setDate(endOfWeek.getDate() + 7)

  const groups = [
    { label: 'This Week', events: filtered.filter(e => new Date(e.event_date) <= endOfWeek) },
    { label: 'Next Week', events: filtered.filter(e => new Date(e.event_date) > endOfWeek && new Date(e.event_date) <= endOfNextWeek) },
    { label: 'Upcoming', events: filtered.filter(e => new Date(e.event_date) > endOfNextWeek) },
  ].filter(g => g.events.length > 0)

  const filterCount = activeTypes.length + activeAudiences.length + activeMosques.length + (activeDate ? 1 : 0)

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: headerGradient, padding: '48px 20px 22px' }}>
        <button onClick={() => navigate('/')} style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A', display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', marginBottom: 2 }}>📅 Upcoming Events</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.65)' }}>{events.length} Bay Area Muslim events</p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <NewsletterStrip />

        {/* Top row: View toggle (left) + Sort toggle (right) */}
        <div style={{ display: 'flex', marginBottom: 10, alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'inline-flex',
            background: 'white',
            borderRadius: 999,
            border: '1px solid rgba(0,0,0,0.1)',
            padding: 3,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <button onClick={() => setViewMode('cards')} style={{
              padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              background: viewMode === 'cards' ? '#1C2B3A' : 'transparent',
              color: viewMode === 'cards' ? 'white' : '#3A4A5A',
            }}>Cards</button>
            <button onClick={() => setViewMode('list')} style={{
              padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              background: viewMode === 'list' ? '#1C2B3A' : 'transparent',
              color: viewMode === 'list' ? 'white' : '#3A4A5A',
            }}>List</button>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            display: 'inline-flex',
            background: 'white',
            borderRadius: 999,
            border: '1px solid rgba(0,0,0,0.1)',
            padding: 3,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <button onClick={() => setSortByNear(false)} style={{
              padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              background: !sortByNear ? '#1C2B3A' : 'transparent',
              color: !sortByNear ? 'white' : '#3A4A5A',
            }}>By date</button>
            <button onClick={handleNearMeToggle} style={{
              padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              background: sortByNear ? '#1C2B3A' : 'transparent',
              color: sortByNear ? 'white' : '#3A4A5A',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>📍 Near me</button>
          </div>
        </div>
        {locationDenied && (
          <div style={{ fontSize: 11, color: '#9A3A3A', marginBottom: 8 }}>
            Location access blocked. Enable in your browser settings to sort by distance.
          </div>
        )}

        {/* Date filter row: Today / This Weekend / Pick a date */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { setToday(t => !t); setThisWeekend(false); setActiveDate(null) }} style={{
            padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            background: today ? '#e8943a' : 'white',
            color: today ? 'white' : '#1a2a3a',
            border: '1px solid rgba(0,0,0,0.1)',
          }}>Today</button>
          <button onClick={() => { setThisWeekend(t => !t); setToday(false); setActiveDate(null) }} style={{
            padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            background: thisWeekend ? '#e8943a' : 'white',
            color: thisWeekend ? 'white' : '#1a2a3a',
            border: '1px solid rgba(0,0,0,0.1)',
          }}>This Weekend</button>
          <button onClick={() => { setShowCalendar(c => !c); setShowFilters(false); setToday(false); setThisWeekend(false) }} style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            background: activeDate ? '#e8943a' : 'white',
            color: activeDate ? 'white' : '#1a2a3a',
            border: '1px solid rgba(0,0,0,0.1)', borderRadius: 20,
            padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>📅 {activeDate ? formatDate(activeDate).replace(/\w+, /, '') : 'Pick a date'}</button>
        </div>

        {/* Mosque scrolling filter */}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 8, paddingBottom: 2, scrollbarWidth: 'none' }}>
          <button onClick={() => setActiveMosques([])} style={{ padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: activeMosques.length === 0 ? '#1a2a3a' : 'white', color: activeMosques.length === 0 ? 'white' : '#1a2a3a', border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }}>All</button>
          {MOSQUES.map(m => (
            <button key={m} onClick={() => setActiveMosques(activeMosques.includes(m) ? activeMosques.filter(x => x !== m) : [...activeMosques, m])} style={{ padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: activeMosques.includes(m) ? '#1a2a3a' : 'white', color: activeMosques.includes(m) ? 'white' : '#1a2a3a', border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }}>{m}</button>
          ))}
        </div>

        {/* Event Type + Audience filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <button onClick={() => { setShowFilters(v => v === 'type' ? null : 'type'); setShowCalendar(false) }} style={{
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
            background: activeTypes.length > 0 ? TYPE_COLOR.bg : 'white',
            color: activeTypes.length > 0 ? 'white' : '#1a2a3a',
            border: '1px solid rgba(0,0,0,0.1)', borderRadius: 20,
            padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>Event Type {activeTypes.length > 0 ? `(${activeTypes.length})` : '▾'}</button>

          <button onClick={() => { setShowFilters(v => v === 'audience' ? null : 'audience'); setShowCalendar(false) }} style={{
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
            background: activeAudiences.length > 0 ? AUDIENCE_COLOR.bg : 'white',
            color: activeAudiences.length > 0 ? 'white' : '#1a2a3a',
            border: '1px solid rgba(0,0,0,0.1)', borderRadius: 20,
            padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>Audience {activeAudiences.length > 0 ? `(${activeAudiences.length})` : '▾'}</button>
        </div>

        {/* Event Type dropdown */}
        {showFilters === 'type' && (
          <div style={{ background: 'white', borderRadius: 14, padding: 12, marginBottom: 8, border: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EVENT_TYPES.map(t => (
                <button key={t} onClick={() => setActiveTypes(prev => prev.includes(t) ? prev.filter(x => x!==t) : [...prev,t])} style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: activeTypes.includes(t) ? TYPE_COLOR.bg : '#f0f0f0',
                  color: activeTypes.includes(t) ? 'white' : '#1a2a3a', border: 'none',
                }}>{t}</button>
              ))}
            </div>
          </div>
        )}

        {/* Audience dropdown */}
        {showFilters === 'audience' && (
          <div style={{ background: 'white', borderRadius: 14, padding: 12, marginBottom: 8, border: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {AUDIENCES.map(a => (
                <button key={a} onClick={() => setActiveAudiences(prev => prev.includes(a) ? prev.filter(x => x!==a) : [...prev,a])} style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: activeAudiences.includes(a) ? AUDIENCE_COLOR.bg : '#f0f0f0',
                  color: activeAudiences.includes(a) ? 'white' : '#1a2a3a', border: 'none',
                }}>{a}</button>
              ))}
            </div>
          </div>
        )}

        {/* Inline calendar */}
        {showCalendar && (
          <InlineCalendar
            selectedDate={activeDate}
            onChange={setActiveDate}
            onClose={() => setShowCalendar(false)}
          />
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#6A7A8A' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>Loading events...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#6A7A8A' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>No events match your filters
          </div>
        ) : (() => {
          // Build the events array we'll render — apply Near me sort if enabled
          let renderItems
          if (sortByNear && userLocation) {
            renderItems = [...filtered]
              .map(e => {
                const coords = eventCoords(e)
                const dist = coords ? distMi(userLocation.lat, userLocation.lng, coords.lat, coords.lng) : Infinity
                const label = isFinite(dist)
                  ? (dist < 1 ? `${(dist * 5280 / 1000).toFixed(1)}k ft` : `${dist.toFixed(1)} mi`)
                  : null
                return { event: e, distLabel: label, dist }
              })
              .sort((a, b) => a.dist - b.dist)
          } else {
            renderItems = filtered.map(e => ({ event: e, distLabel: null }))
          }

          if (viewMode === 'list') {
            // List view — group by date, compact rows
            const byDate = new Map()
            renderItems.forEach(item => {
              const key = item.event.event_date || 'no-date'
              if (!byDate.has(key)) byDate.set(key, [])
              byDate.get(key).push(item)
            })
            return (
              <div style={{ borderRadius: 12, overflow: 'hidden', background: 'white', border: '1px solid rgba(0,0,0,0.08)' }}>
                {Array.from(byDate.entries()).map(([date, items]) => (
                  <div key={date}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: colors.brand,
                      letterSpacing: 0.5, textTransform: 'uppercase',
                      padding: '10px 12px 6px', background: '#FFF8F3',
                      borderBottom: '1px solid rgba(194,65,12,0.08)',
                    }}>
                      {date === 'no-date' ? 'No date' : formatDate(date)}
                    </div>
                    {items.map(({ event, distLabel }) => (
                      <EventListRow key={event.id} event={event} distanceLabel={distLabel} onTap={() => navigate(`/events/${event.url_slug}`)} />
                    ))}
                  </div>
                ))}
              </div>
            )
          }

          // Cards view (default)
          if (sortByNear && userLocation) {
            // Flat distance-sorted cards
            return (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#3A4A5A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Sorted by distance
                </div>
                {renderItems.map(({ event, distLabel }) => (
                  <div key={event.id} style={{ position: 'relative' }}>
                    {distLabel && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8, zIndex: 2,
                        background: 'white', borderRadius: 999, padding: '3px 10px',
                        fontSize: 11, fontWeight: 700, color: colors.brand,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                      }}>{distLabel}</div>
                    )}
                    <EventCard event={event} onTap={() => navigate(`/events/${event.url_slug}`)} />
                  </div>
                ))}
              </>
            )
          }
          // Cards grouped by date scope
          return groups.map(group => (
            <div key={group.label}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#3A4A5A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, marginLeft: -16, marginRight: -16, padding: '8px 16px', position: 'sticky', top: 0, zIndex: 5, background: '#F7F3EE' }}>{group.label}</div>
              {group.events.map(e => <EventCard key={e.id} event={e} onTap={() => navigate(`/events/${e.url_slug}`)} />)}
            </div>
          ))
        })()}
      </div>


      <BottomNav />
    </div>
  )
}
