import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'

const EVENTS = [
  {
    id: 1,
    title: 'Sisters Healing Circle',
    mosque: 'MCC East Bay',
    area: 'East Bay',
    date: 'Sun Apr 7',
    time: '11:00 AM',
    tag: 'Community',
    tagBg: '#c8f0dc', tagColor: '#0a5c2a',
    bg: '#c8f0dc', free: true,
  },
  {
    id: 2,
    title: "Brothers Halaqa Night",
    mosque: 'ICF Fremont',
    area: 'East Bay',
    date: 'Fri Apr 12',
    time: '8:00 PM',
    tag: 'Youth',
    tagBg: '#b8d8f8', tagColor: '#0a3a6a',
    bg: '#b8d8f8', free: true,
  },
  {
    id: 3,
    title: 'Monthly Mawlid',
    mosque: 'MCC East Bay',
    area: 'East Bay',
    date: 'Sat Apr 13',
    time: '6:30 PM',
    tag: 'Lecture',
    tagBg: '#fde8c0', tagColor: '#7a4a00',
    bg: '#fde8c0', free: true,
  },
  {
    id: 4,
    title: 'Islamic Parenting Workshop',
    mosque: 'ISEB Fremont',
    area: 'East Bay',
    date: 'Sat Apr 20',
    time: '2:00 PM',
    tag: 'Family',
    tagBg: '#dddaf8', tagColor: '#3c2a8a',
    bg: '#dddaf8', free: true,
  },
]

const FILTERS = ['All', 'This week', 'Free', 'Community', 'Youth', 'Lecture', 'Family']

function MosqueInitial({ name, bg }) {
  const initials = name.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join('')
  return (
    <div style={{
      width: '100%', height: 110,
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 36, fontWeight: 700, color: 'rgba(26,42,58,0.25)',
      letterSpacing: 2,
    }}>{initials}</div>
  )
}

function EventCard({ event, onTap }) {
  return (
    <div
      onClick={() => onTap(event)}
      style={{
        background: 'white', borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.08)',
        overflow: 'hidden', marginBottom: 12, cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative' }}>
        <MosqueInitial name={event.mosque} bg={event.bg} />
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(0,0,0,0.3)', borderRadius: 7,
          padding: '4px 9px', fontSize: 12, color: 'white', fontWeight: 600,
        }}>{event.date}</div>
        {event.free && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: '#e8a040', borderRadius: 7,
            padding: '4px 9px', fontSize: 11, color: 'white', fontWeight: 700,
          }}>Free</div>
        )}
      </div>

      <div style={{ padding: '14px 16px' }}>
        <div style={{
          display: 'inline-block',
          background: event.tagBg, color: event.tagColor,
          fontSize: 11, fontWeight: 700, padding: '3px 9px',
          borderRadius: 6, marginBottom: 8,
        }}>{event.tag}</div>

        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2a3a', marginBottom: 5 }}>
          {event.title}
        </div>

        <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.55)', marginBottom: 14 }}>
          {event.mosque} · {event.time} · {event.area}
        </div>

        <button style={{
          width: '100%', background: '#1a2a3a',
          color: 'white', borderRadius: 10,
          padding: '11px 0', fontSize: 14, fontWeight: 700,
          border: 'none',
        }}>
          View details →
        </button>
      </div>
    </div>
  )
}

function EventDetail({ event, onBack }) {
  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: 'white', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          height: 200, background: event.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 56, fontWeight: 700, color: 'rgba(26,42,58,0.2)', letterSpacing: 4,
        }}>
          {event.mosque.split(' ').filter(w => w.length > 2).slice(0,2).map(w => w[0]).join('')}
        </div>
        <button onClick={onBack} style={{
          position: 'absolute', top: 52, left: 16,
          background: 'rgba(255,255,255,0.8)', border: 'none',
          borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600,
        }}>← Back</button>
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        <div style={{
          display: 'inline-block',
          background: event.tagBg, color: event.tagColor,
          fontSize: 12, fontWeight: 700, padding: '4px 10px',
          borderRadius: 6, marginBottom: 10,
        }}>{event.tag}</div>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a2a3a', marginBottom: 6, lineHeight: 1.2 }}>
          {event.title}
        </h1>

        <div style={{ fontSize: 15, color: '#e8a040', fontWeight: 600, marginBottom: 20 }}>
          {event.mosque}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {[
            { icon: '📅', label: 'Date', value: event.date },
            { icon: '🕐', label: 'Time', value: event.time },
            { icon: '📍', label: 'Area', value: event.area },
            { icon: '💰', label: 'Cost', value: event.free ? 'Free' : 'Paid' },
          ].map(row => (
            <div key={row.label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#f7f7f7', borderRadius: 12, padding: '12px 14px',
            }}>
              <span style={{ fontSize: 18 }}>{row.icon}</span>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.45)', fontWeight: 600 }}>{row.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2a3a' }}>{row.value}</div>
              </div>
            </div>
          ))}
        </div>

        <button style={{
          width: '100%', background: '#e8a040',
          color: 'white', borderRadius: 12,
          padding: '14px 0', fontSize: 16, fontWeight: 700,
          border: 'none', marginBottom: 10,
        }}>
          Get Directions
        </button>
        <button style={{
          width: '100%', background: '#f0f0f0',
          color: '#1a2a3a', borderRadius: 12,
          padding: '14px 0', fontSize: 16, fontWeight: 600,
          border: 'none',
        }}>
          Share event
        </button>
      </div>
    </div>
  )
}

export default function Events() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(null)

  if (selected) {
    return <EventDetail event={selected} onBack={() => setSelected(null)} />
  }

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
          📅 Events
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(26,42,58,0.6)' }}>
          Bay Area Muslim community events
        </p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 16, paddingBottom: 4, scrollbarWidth: 'none' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '7px 15px', borderRadius: 20, whiteSpace: 'nowrap',
              fontSize: 13, fontWeight: 600,
              background: filter === f ? '#1a2a3a' : 'white',
              color: filter === f ? 'white' : 'rgba(26,42,58,0.6)',
              border: '1px solid rgba(0,0,0,0.1)',
            }}>{f}</button>
          ))}
        </div>

        {EVENTS.map(e => <EventCard key={e.id} event={e} onTap={setSelected} />)}
      </div>

      <BottomNav />
    </div>
  )
}
