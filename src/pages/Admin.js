import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  { id: 'd916a550-c316-40a9-9582-35836417b6cb', name: 'Events' },
  { id: 'b7c8a7cb-082f-46e6-95c2-8cfaddbdc50c', name: 'Mosques' },
  { id: '73bb4daf-1b52-48ac-a991-027e928477f0', name: 'Restaurants' },
  { id: '3b196241-65fd-43bf-b9e3-62d5234a642b', name: 'Home Cooks' },
  { id: '09c30c29-6c32-4315-bf83-1c96cbc7570f', name: 'Event Services' },
]

const EVENT_TYPES = ['Halaqa', 'Islamic Learning', 'Wellness', 'Family & Kids', 'Community', 'Fundraiser', 'Matrimonial', 'Civic', 'Arts & Culture', 'Food & Drink']
const AUDIENCES = ['General Public', 'Sisters Only', 'Brothers Only', 'Youth', 'Families']
const AREAS = ['East Bay', 'South Bay', 'Peninsula', 'San Francisco', 'North Bay', 'Central Valley']

function Section({ title, children }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid rgba(0,0,0,0.08)' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#3A4A5A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type}
      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
  )
}

function Textarea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
  )
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', fontSize: 14, outline: 'none', background: 'white' }}>
      <option value="">Select...</option>
      {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
    </select>
  )
}

function MultiSelect({ values, onChange, options }) {
  const toggle = (v) => onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v])
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => (
        <button key={o} onClick={() => toggle(o)} style={{
          padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: values.includes(o) ? '#1a2a3a' : '#f5f5f5',
          color: values.includes(o) ? 'white' : 'rgba(26,42,58,0.6)',
          border: 'none',
        }}>{o}</button>
      ))}
    </div>
  )
}

function makeSlug(title, date) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-')
    .substring(0, 45).replace(/-+$/, '')
    + (date ? '-' + date : '')
}

// --- Add Event Form ---
function AddEventForm({ onSuccess }) {
  const [form, setForm] = useState({
    name: '', description: '', location_address: '', location_area: 'East Bay',
    event_date: '', event_time: '', event_end_time: '', website: '', image_url: '',
    event_type: 'Community', event_audience: ['General Public'],
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }))

  const save = async () => {
    if (!form.name || !form.event_date) { setMsg('Name and date are required'); return }
    setSaving(true)
    const slug = makeSlug(form.name, form.event_date)
    const { error } = await supabase.from('content').insert({
      content_type: 'listing',
      category_id: 'd916a550-c316-40a9-9582-35836417b6cb',
      status: 'published',
      submitted_by: 'admin',
      url_slug: slug,
      ...form,
    })
    setSaving(false)
    if (error) { setMsg(`Error: ${error.message}`); return }
    setMsg('✅ Event added!')
    setForm({ name: '', description: '', location_address: '', location_area: 'East Bay', event_date: '', event_time: '', event_end_time: '', website: '', image_url: '', event_type: 'Community', event_audience: ['General Public'] })
    onSuccess()
  }

  return (
    <div>
      <Field label="Event Name *"><Input value={form.name} onChange={set('name')} placeholder="e.g. Sisters Hike at Pleasanton Ridge" /></Field>
      <Field label="Date *"><Input value={form.event_date} onChange={set('event_date')} type="date" /></Field>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Start Time"><Input value={form.event_time} onChange={set('event_time')} type="time" /></Field></div>
        <div style={{ flex: 1 }}><Field label="End Time"><Input value={form.event_end_time} onChange={set('event_end_time')} type="time" /></Field></div>
      </div>
      <Field label="Location / Address"><Input value={form.location_address} onChange={set('location_address')} placeholder="e.g. 5724 W Las Positas Blvd, Pleasanton" /></Field>
      <Field label="Area"><Select value={form.location_area} onChange={set('location_area')} options={AREAS} /></Field>
      <Field label="Event Type"><Select value={form.event_type} onChange={set('event_type')} options={EVENT_TYPES} /></Field>
      <Field label="Audience"><MultiSelect values={form.event_audience} onChange={set('event_audience')} options={AUDIENCES} /></Field>
      <Field label="Website / RSVP Link"><Input value={form.website} onChange={set('website')} placeholder="https://..." /></Field>
      <Field label="Image URL (flyer)"><Input value={form.image_url} onChange={set('image_url')} placeholder="https://..." /></Field>
      <Field label="Description"><Textarea value={form.description} onChange={set('description')} placeholder="What is this event about?" /></Field>
      {msg && <div style={{ fontSize: 13, color: msg.includes('✅') ? '#2a8a4a' : '#c00', marginBottom: 12 }}>{msg}</div>}
      <button onClick={save} disabled={saving} style={{ width: '100%', background: '#1a2a3a', color: 'white', border: 'none', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
        {saving ? 'Saving...' : 'Add Event'}
      </button>
    </div>
  )
}

// --- Add Mosque Form ---
function AddMosqueForm({ onSuccess }) {
  const [form, setForm] = useState({
    name: '', location_address: '', location_area: 'East Bay',
    website: '', phone: '', email: '', instagram: '', facebook: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }))

  const save = async () => {
    if (!form.name) { setMsg('Name is required'); return }
    setSaving(true)
    const slug = makeSlug(form.name, '')
    const { error } = await supabase.from('content').insert({
      content_type: 'listing',
      category_id: 'b7c8a7cb-082f-46e6-95c2-8cfaddbdc50c',
      status: 'published',
      submitted_by: 'admin',
      url_slug: slug,
      ...form,
    })
    setSaving(false)
    if (error) { setMsg(`Error: ${error.message}`); return }
    setMsg('✅ Mosque added! Remember to add Jummah times and coordinates in Supabase.')
    setForm({ name: '', location_address: '', location_area: 'East Bay', website: '', phone: '', email: '', instagram: '', facebook: '', description: '' })
    onSuccess()
  }

  return (
    <div>
      <Field label="Mosque Name *"><Input value={form.name} onChange={set('name')} placeholder="e.g. Masjid Al-Noor (Richmond)" /></Field>
      <Field label="Address"><Input value={form.location_address} onChange={set('location_address')} placeholder="e.g. 1234 Main St, Richmond, CA" /></Field>
      <Field label="Area"><Select value={form.location_area} onChange={set('location_area')} options={AREAS} /></Field>
      <Field label="Website"><Input value={form.website} onChange={set('website')} placeholder="https://..." /></Field>
      <Field label="Phone"><Input value={form.phone} onChange={set('phone')} placeholder="(510) 555-1234" /></Field>
      <Field label="Email"><Input value={form.email} onChange={set('email')} placeholder="info@mosque.org" /></Field>
      <Field label="Instagram"><Input value={form.instagram} onChange={set('instagram')} placeholder="https://instagram.com/..." /></Field>
      <Field label="Facebook"><Input value={form.facebook} onChange={set('facebook')} placeholder="https://facebook.com/..." /></Field>
      <Field label="Description"><Textarea value={form.description} onChange={set('description')} placeholder="About this mosque..." /></Field>
      {msg && <div style={{ fontSize: 13, color: msg.includes('✅') ? '#2a8a4a' : '#c00', marginBottom: 12 }}>{msg}</div>}
      <button onClick={save} disabled={saving} style={{ width: '100%', background: '#1a2a3a', color: 'white', border: 'none', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
        {saving ? 'Saving...' : 'Add Mosque'}
      </button>
    </div>
  )
}

// --- Recent entries list ---
function RecentEntries({ category, refresh }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    supabase.from('content').select('id, name, event_date, created_at, status')
      .eq('category_id', category)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setItems(data || []))
  }, [category, refresh])

  if (items.length === 0) return <div style={{ fontSize: 13, color: '#6A7A8A' }}>No entries yet</div>

  return (
    <div>
      {items.map(item => (
        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2a3a' }}>{item.name}</div>
            {item.event_date && <div style={{ fontSize: 11, color: '#6A7A8A' }}>{item.event_date}</div>}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5, background: item.status === 'published' ? '#c8f0dc' : '#f0f0f0', color: item.status === 'published' ? '#0a5c2a' : '#666' }}>{item.status}</span>
        </div>
      ))}
    </div>
  )
}

// --- Main Admin Page ---
export default function Admin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('events')
  const [refresh, setRefresh] = useState(0)
  const onSuccess = () => setRefresh(r => r + 1)

  const tabs = [
    { id: 'events', label: '📅 Events' },
    { id: 'mosques', label: '🕌 Mosques' },
  ]

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg, #1a2a3a 0%, #2d4a6a 100%)', padding: '52px 20px 20px' }}>
        <button onClick={() => navigate('/')} style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 4 }}>⚙️ Admin</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Add and manage Nasiha content</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '14px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none',
            color: tab === t.id ? '#1a2a3a' : 'rgba(26,42,58,0.4)',
            borderBottom: tab === t.id ? '2px solid #1a2a3a' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {tab === 'events' && (
          <>
            <Section title="Add Event">
              <AddEventForm onSuccess={onSuccess} />
            </Section>
            <Section title="Recent Events">
              <RecentEntries category="d916a550-c316-40a9-9582-35836417b6cb" refresh={refresh} />
            </Section>
          </>
        )}
        {tab === 'mosques' && (
          <>
            <Section title="Add Mosque">
              <AddMosqueForm onSuccess={onSuccess} />
            </Section>
            <Section title="Recent Mosques">
              <RecentEntries category="b7c8a7cb-082f-46e6-95c2-8cfaddbdc50c" refresh={refresh} />
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
