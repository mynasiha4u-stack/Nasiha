import React, { useState } from 'react'
import { useNavigate, useParams, Routes, Route } from 'react-router-dom'
import BottomNav from '../components/BottomNav'

const EVENTS = [
  {
    id: 1, slug: 'sisters-healing-circle-mcc-eastbay',
    title: 'Sisters Healing Circle',
    mosque: 'MCC East Bay', area: 'East Bay',
    date: '2026-04-27', dateLabel: 'Sun Apr 27', time: '11:00 AM', endTime: '1:00 PM',
    type: 'Community', audience: 'Sisters',
    free: true, image: null, bg: '#c8f0dc',
    description: 'A safe and nurturing space for sisters to gather, reflect, and support one another. Come as you are.',
    location: '5724 W Las Positas Blvd, Pleasanton, CA',
  },
  {
    id: 2, slug: 'brothers-halaqa-night-icf',
    title: 'Brothers Halaqa Night',
    mosque: 'ICF Fremont', area: 'East Bay',
    date: '2026-04-25', dateLabel: 'Fri Apr 25', time: '8:00 PM', endTime: '10:00 PM',
    type: 'Halaqa', audience: 'Brothers',
    free: true, image: null, bg: '#b8d8f8',
    description: 'Weekly halaqa for brothers covering topics in Islamic spirituality and contemporary life.',
    location: '3000 Scott Blvd, Fremont, CA',
  },
  {
    id: 3, slug: 'monthly-mawlid-mcc-eastbay',
    title: 'Monthly Mawlid & Dinner',
    mosque: 'MCC East Bay', area: 'East Bay',
    date: '2026-05-03', dateLabel: 'Sun May 3', time: '6:30 PM', endTime: '9:00 PM',
    type: 'Dinner', audience: 'All',
    free: true, image: null, bg: '#fde8c0',
    description: 'Join us for a beautiful evening of dhikr, nasheeds, and a community dinner in honor of the Prophet ﷺ.',
    location: '5724 W Las Positas Blvd, Pleasanton, CA',
  },
  {
    id: 4, slug: 'islamic-parenting-workshop-mca',
    title: 'Islamic Parenting Workshop',
    mosque: 'MCA Santa Clara', area: 'South Bay',
    date: '2026-05-10', dateLabel: 'Sun May 10', time: '2:00 PM', endTime: '5:00 PM',
    type: 'Lecture', audience: 'Families',
    free: false, image: null, bg: '#dddaf8',
    description: 'A practical workshop for parents navigating raising Muslim children in the Bay Area. Childcare provided.',
    location: '3003 Scott Blvd, Santa Clara, CA',
  },
  {
    id: 5, slug: 'youth-leadership-srvic',
    title: 'Youth Leadership Summit',
    mosque: 'SRVIC San Ramon', area: 'East Bay',
    date: '2026-05-17', dateLabel: 'Sun May 17', time: '10:00 AM', endTime: '4:00 PM',
    type: 'Youth', audience: 'Youth',
    free: true, image: null, bg: '#ffd6d6',
    description: 'A full day program for Muslim teens to develop leadership, public speaking, and community service skills.',
    location: '7586 Balmoral Way, San Ramon, CA',
  },
  {
    id: 6, slug: 'ramadan-fundraiser-gala-wvma',
    title: 'Annual Fundraiser Gala',
    mosque: 'WVMA Los Gatos', area: 'South Bay',
    date: '2026-05-24', dateLabel: 'Sat May 24', time: '6:00 PM', endTime: '10:00 PM',
    type: 'Fundraiser', audience: 'All',
    free: false, image: null, bg: '#d4f0e8',
    description: 'Our annual gala fundraiser supporting mosque expansion and community programs. Dinner and speakers included.',
    location: '14000 Fruitvale Ave, Saratoga, CA',
  },
]

const TYPE_FILTERS = ['All', 'Community', 'Halaqa', 'Lecture', 'Dinner', 'Fundraiser', 'Youth', 'Class']
const AUDIENCE_FILTERS = ['Everyone', 'Sisters', 'Brothers', 'Youth', 'Families']
const MOSQUE_FILTERS = ['All Mosques', 'MCC East Bay', 'MCA Santa Clara', 'ICF Fremont', 'SRVIC San Ramon', 'WVMA Los Gatos']

const TYPE_COLORS = {
  Community: { bg: '#c8f0dc', color: '#0a5c2a' },
  Halaqa: { bg: '#b8d8f8', color: '#0a3a6a' },
  Lecture: { bg: '#fde8c0', color: '#7a4a00' },
  Dinner: { bg: '#fde8c0', color: '#7a4a00' },
  Fundraiser: { bg: '#dddaf8', color: '#3c2a8a' },
  Youth: { bg: '#ffd6d6', color: '#8a1a1a' },
  Class: { bg: '#d4f0e8', color: '#0a4a2a' },
}

function EventCard({ event, onTap }) {
  const tc = TYPE_COLORS[event.type] || { bg: '#f0f0f0', color: '#444' }
  return (
    <div onClick={() => onTap(event)} style={{
      background: 'white', borderRadius: 16,
      border: '1px solid rgba(0,0,0,0.08)',
      overflow: 'hidden', marginBottom: 12, cursor: 'pointer',
    }}>
      {/* Image / placeholder */}
      <div style={{ position: 'relative', height: 130, background: event.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {event.image
          ? <img src={event.image} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ fontSize: 38, fontWeight: 800, color: 'rgba(26,42,58,0.15)', letterSpacing: 3 }}>
              {event.mosque.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('')}
            </div>
        }
        {/* Date badge */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(0,0,0,0.45)', borderRadius: 7,
          padding: '4px 9px', fontSize: 11, color: 'white', fontWeight: 700,
        }}>{event.dateLabel}</div>
        {/* Free badge */}
        {event.free && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: '#4caf50', borderRadius: 7,
            padding: '4px 9px', fontSize: 11, color: 'white', fontWeight: 700,
          }}>Free</div>
        )}
      </div>

      <div style={{ padding: '12px 14px' }}>
        {/* Type + Audience tags */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ background: tc.bg, color: tc.color, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{event.type}</span>
          {event.audience !== 'All' && (
            <span style={{ background: '#f0f0f0', color: '#555', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6 }}>{event.audience}</span>
          )}
        </div>

        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2a3a', marginBottom: 4, lineHeight: 1.3 }}>{event.title}</div>
        <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.5)', marginBottom: 0 }}>
          {event.mosque} · {event.time} · {event.area}
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
      background: 'linear-gradient(135deg, #1a2a3a 0%, #2d4a6a 100%)',
      borderRadius: 16, padding: '16px', marginBottom: 16,
    }}>
      {done ? (
        <div style={{ textAlign: 'center', color: 'white', fontSize: 14, fontWeight: 600, padding: '4px 0' }}>
          ✅ You're in! Top events every week.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 4 }}>📬 Top events every week</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 12 }}>Bay Area Muslim events in your inbox every Thursday</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{ flex: 1, borderRadius: 10, border: 'none', padding: '10px 12px', fontSize: 14, outline: 'none' }}
            />
            <button
              onClick={() => email && setDone(true)}
              style={{ background: '#e8a040', border: 'none', borderRadius: 10, padding: '10px 16px', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >Subscribe</button>
          </div>
        </>
      )}
    </div>
  )
}

export function EventDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const event = EVENTS.find(e => e.slug === slug)

  if (!event) return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(26,42,58,0.4)' }}>Event not found</div>
    </div>
  )

  const tc = TYPE_COLORS[event.type] || { bg: '#f0f0f0', color: '#444' }

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '52px 20px 20px' }}>
        <button onClick={() => navigate(-1)} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <span style={{ background: tc.bg, color: tc.color, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{event.type}</span>
          {event.audience !== 'All' && <span style={{ background: 'rgba(255,255,255,0.7)', color: '#555', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6 }}>{event.audience}</span>}
          {event.free && <span style={{ background: '#4caf50', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>Free</span>}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a2a3a', lineHeight: 1.3, marginBottom: 4 }}>{event.title}</h1>
        <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)' }}>{event.mosque} · {event.area}</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Event image */}
        {event.image && (
          <img src={event.image} alt={event.title} style={{ width: '100%', borderRadius: 16, marginBottom: 12, objectFit: 'cover', maxHeight: 200 }} />
        )}

        {/* Details card */}
        <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
          {[
            { icon: '📅', label: 'Date', value: event.dateLabel },
            { icon: '🕐', label: 'Time', value: `${event.time}${event.endTime ? ` – ${event.endTime}` : ''}` },
            { icon: '📍', label: 'Location', value: event.location },
            { icon: '💰', label: 'Cost', value: event.free ? 'Free' : 'Paid — check event page' },
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

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button style={{ flex: 1, background: '#e8a040', border: 'none', borderRadius: 12, padding: '13px 0', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            🗺️ Directions
          </button>
          <button style={{ flex: 1, background: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '13px 0', color: '#1a2a3a', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            🔗 Share
          </button>
        </div>

        {/* Description */}
        {event.description && (
          <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 10 }}>About this event</div>
            <div style={{ fontSize: 14, color: 'rgba(26,42,58,0.75)', lineHeight: 1.75 }}>{event.description}</div>
          </div>
        )}

        {/* Hosted by */}
        <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Hosted by</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a' }}>{event.mosque}</div>
          </div>
          <button style={{ background: '#f0f0f0', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#1a2a3a', cursor: 'pointer' }}>
            View mosque →
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}

export default function Events() {
  const navigate = useNavigate()
  const [typeFilter, setTypeFilter] = useState('All')
  const [audienceFilter, setAudienceFilter] = useState('Everyone')
  const [mosqueFilter, setMosqueFilter] = useState('All Mosques')

  const filtered = EVENTS.filter(e => {
    if (typeFilter !== 'All' && e.type !== typeFilter) return false
    if (audienceFilter !== 'Everyone' && e.audience !== audienceFilter && e.audience !== 'All') return false
    if (mosqueFilter !== 'All Mosques' && e.mosque !== mosqueFilter) return false
    return true
  })

  // Group by this weekend / next weekend / upcoming
  const now = new Date()
  const endOfWeek = new Date(now); endOfWeek.setDate(now.getDate() + (7 - now.getDay()))
  const endOfNextWeek = new Date(endOfWeek); endOfNextWeek.setDate(endOfWeek.getDate() + 7)

  const groups = [
    { label: 'This Weekend', events: filtered.filter(e => new Date(e.date) <= endOfWeek) },
    { label: 'Next Weekend', events: filtered.filter(e => new Date(e.date) > endOfWeek && new Date(e.date) <= endOfNextWeek) },
    { label: 'Upcoming', events: filtered.filter(e => new Date(e.date) > endOfNextWeek) },
  ].filter(g => g.events.length > 0)

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '48px 20px 20px' }}>
        <button onClick={() => navigate('/')} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a2a3a', marginBottom: 2 }}>📅 Events</h1>
        <p style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)' }}>Bay Area Muslim community events</p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* Newsletter strip */}
        <NewsletterStrip />

        {/* Filter row 1 — Type */}
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

        {/* Filter row 2 — Audience */}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 8, paddingBottom: 2, scrollbarWidth: 'none' }}>
          {AUDIENCE_FILTERS.map(f => (
            <button key={f} onClick={() => setAudienceFilter(f)} style={{
              padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: audienceFilter === f ? '#9b87c4' : 'white',
              color: audienceFilter === f ? 'white' : 'rgba(26,42,58,0.6)',
              border: '1px solid rgba(0,0,0,0.1)',
            }}>{f}</button>
          ))}
        </div>

        {/* Filter row 3 — Mosque */}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 16, paddingBottom: 2, scrollbarWidth: 'none' }}>
          {MOSQUE_FILTERS.map(f => (
            <button key={f} onClick={() => setMosqueFilter(f)} style={{
              padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: mosqueFilter === f ? '#e8a040' : 'white',
              color: mosqueFilter === f ? 'white' : 'rgba(26,42,58,0.6)',
              border: '1px solid rgba(0,0,0,0.1)',
            }}>{f}</button>
          ))}
        </div>

        {/* Grouped event feed */}
        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(26,42,58,0.4)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
            <div>No events match your filters</div>
          </div>
        ) : groups.map(group => (
          <div key={group.label}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(26,42,58,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{group.label}</div>
            {group.events.map(e => (
              <EventCard key={e.id} event={e} onTap={() => navigate(`/events/${e.slug}`)} />
            ))}
          </div>
        ))}

      </div>
      <BottomNav />
    </div>
  )
}
