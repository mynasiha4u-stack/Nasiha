import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import ImageUpload from '../components/ImageUpload'
import { colors, headerGradient } from '../theme'

// Map slug → friendly label, emoji, and which fields to show
const CATEGORIES = [
  { slug: 'restaurants',       label: 'Restaurant',                 icon: '🍽️', fields: ['address','phone','website','instagram','description','image_url','hours'] },
  { slug: 'events',            label: 'Event',                      icon: '📅', fields: ['event_date','event_time','event_end_time','address','website','image_url','description'] },
  { slug: 'home-cooked-food',  label: 'Home Cook',                  icon: '👨‍🍳', fields: ['phone','email','instagram','website','description','image_url','delivery'] },
  { slug: 'mosques',           label: 'Mosque',                     icon: '🕌', fields: ['address','phone','website','email','instagram','facebook','description'] },
  { slug: 'dessert-catering',  label: 'Desserts & Drinks Vendor',   icon: '🍰', fields: ['phone','email','instagram','website','description','image_url','delivery'] },
  { slug: 'childcare',         label: 'Childcare',                  icon: '👶', fields: ['address','phone','email','website','description','image_url','hours'] },
  { slug: 'event-services',    label: 'Event Services & Decor',     icon: '💐', fields: ['phone','email','instagram','website','description','image_url'] },
  { slug: 'islamic-schools',   label: 'Islamic School',             icon: '🏫', fields: ['address','phone','email','website','description','image_url','grades'] },
  { slug: 'lawyers',           label: 'Lawyer',                     icon: '⚖️', fields: ['phone','email','website','description','specialty'] },
]

// Slugify event name for url_slug
function makeSlug(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 80)
    + '-' + Date.now().toString(36).slice(-4)
}

export default function SubmitListing() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  const editId = params.get('edit')  // if present, we're editing not creating
  const duplicateId = params.get('duplicate')  // if present, prefill from existing listing (creates new)

  // Pre-select category from URL param if present (e.g. /submit?cat=lawyers)
  const initialCat = CATEGORIES.find(c => c.slug === params.get('cat'))?.slug || ''

  const [categorySlug, setCategorySlug] = useState(initialCat)
  const [form, setForm] = useState({
    name: '', description: '', address: '', metro: 'Bay Area',
    phone: '', email: '', website: '', instagram: '', facebook: '',
    image_url: '', hours: '', delivery: '', specialty: '', grades: '',
    event_date: '', event_time: '', event_end_time: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(!!editId || !!duplicateId)

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=${encodeURIComponent('/submit')}`)
    }
  }, [authLoading, user, navigate])

  // Load existing listing if editing or duplicating
  useEffect(() => {
    if (!user) return
    const idToLoad = editId || duplicateId
    if (!idToLoad) return

    async function load() {
      const { data, error } = await supabase
        .from('content')
        .select('*, categories(slug)')
        .eq('id', idToLoad)
        .single()

      if (error || !data) {
        setError('Could not load that listing.')
        setLoadingExisting(false)
        return
      }
      // Set category from the joined slug
      if (data.categories?.slug) setCategorySlug(data.categories.slug)
      // Fill form fields from existing data
      setForm({
        name: duplicateId ? `${data.name || ''} (copy)` : (data.name || ''),
        description: data.description || '',
        address: data.address || '',
        metro: data.metro || 'Bay Area',
        phone: data.phone || '',
        email: data.email || '',
        website: data.website || '',
        instagram: data.instagram || '',
        facebook: data.facebook || '',
        image_url: data.image_url || '',
        hours: data.hours || '',
        delivery: data.delivery || '',
        specialty: data.specialty || '',
        grades: data.grades || '',
        event_date: data.event_date || '',
        event_time: data.event_time || '',
        event_end_time: data.event_end_time || '',
      })
      setLoadingExisting(false)
    }
    load()
  }, [user, editId, duplicateId])

  const cat = CATEGORIES.find(c => c.slug === categorySlug)
  const set = (key) => (e) => {
    const val = typeof e === 'string' ? e : e.target.value
    setForm(f => ({ ...f, [key]: val }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!categorySlug) { setError('Please pick a category.'); return }
    if (!form.name.trim()) { setError('Name is required.'); return }

    setSubmitting(true)
    try {
      // Look up category id
      const { data: catRow } = await supabase.from('categories').select('id').eq('slug', categorySlug).single()
      if (!catRow) { setError('Category not found.'); setSubmitting(false); return }

      // Build the insert/update payload — only include fields the category cares about
      const payload = {
        name: form.name,
        description: form.description || null,
      }
      // Include fields based on category schema
      const fieldMap = {
        address: form.address, phone: form.phone, email: form.email,
        website: form.website, instagram: form.instagram, facebook: form.facebook,
        image_url: form.image_url, metro: form.metro,
        event_date: form.event_date || null,
        event_time: form.event_time || null,
        event_end_time: form.event_end_time || null,
      }
      cat.fields.forEach(f => {
        if (fieldMap.hasOwnProperty(f) && fieldMap[f] !== '') {
          payload[f] = fieldMap[f]
        }
      })
      payload.metro = form.metro

      if (editId) {
        // EDIT: update the existing row, keep its status as-is (admin can re-review if they want)
        const { error: updateError } = await supabase
          .from('content').update(payload).eq('id', editId)
        if (updateError) {
          setError(`Couldn't update: ${updateError.message}`)
          setSubmitting(false)
          return
        }
      } else {
        // CREATE (or DUPLICATE): full insert with pending status + owner
        const createPayload = {
          ...payload,
          content_type: 'listing',
          category_id: catRow.id,
          status: 'pending',
          owner_id: user.id,
          submitted_by: user.email,
          submitted_at: new Date().toISOString(),
          url_slug: makeSlug(form.name),
        }
        const { error: insertError } = await supabase.from('content').insert(createPayload)
        if (insertError) {
          setError(`Couldn't submit: ${insertError.message}`)
          setSubmitting(false)
          return
        }
      }

      setSuccess(true)
    } catch (e) {
      setError(`Unexpected error: ${e.message}`)
      setSubmitting(false)
    }
  }

  if (authLoading || loadingExisting) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6A7A8A' }}>Loading…</div>
  }
  if (!user) return null // redirect in progress

  const pageMode = editId ? 'edit' : duplicateId ? 'duplicate' : 'create'
  const pageTitle = { edit: 'Edit listing', duplicate: 'Duplicate listing', create: 'Submit a listing' }[pageMode]
  const pageSubhead = {
    edit: 'Update your listing details. Changes save immediately.',
    duplicate: 'Make a copy of this listing with the details prefilled.',
    create: 'Add your business, event, or service to Nasiha. We review every submission before it goes live.',
  }[pageMode]

  if (success) {
    return (
      <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 80 }}>
        <div style={{ background: headerGradient, padding: '48px 20px 22px' }}>
          <div style={{ marginBottom: 10 }}><TopBar /></div>
        </div>
        <div style={{ padding: '60px 30px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1C2B3A', marginBottom: 8 }}>
            {pageMode === 'edit' ? 'Listing updated' : 'Submitted for review'}
          </h1>
          <p style={{ fontSize: 14, color: '#3A4A5A', lineHeight: 1.5, marginBottom: 24 }}>
            {pageMode === 'edit'
              ? 'Your changes are saved.'
              : `Thanks! Your ${cat.label.toLowerCase()} listing will appear once it's reviewed (usually within 24 hours). You can track its status in My Listings.`}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => navigate('/my-listings')} style={primaryBtn}>View My Listings</button>
            {pageMode !== 'edit' && (
              <button onClick={() => { setSuccess(false); setForm({ name: '', description: '', address: '', metro: 'Bay Area', phone: '', email: '', website: '', instagram: '', facebook: '', image_url: '', hours: '', delivery: '', specialty: '', grades: '', event_date: '', event_time: '', event_end_time: '' }); setCategorySlug('') }} style={secondaryBtn}>Submit another</button>
            )}
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: headerGradient, padding: '48px 20px 22px' }}>
        <div style={{ marginBottom: 10 }}><TopBar /></div>
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => navigate(-1)} style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A', display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', marginBottom: 4 }}>{pageTitle}</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.7)' }}>
          {pageSubhead}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '20px 16px' }}>
        {/* Category picker */}
        <Field label="What are you adding?">
          {!categorySlug ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {CATEGORIES.map(c => (
                <button key={c.slug} type="button" onClick={() => setCategorySlug(c.slug)} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 10px', background: 'white',
                  border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 12,
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1C2B3A',
                  textAlign: 'left',
                }}>
                  <span style={{ fontSize: 20 }}>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'white', border: `2px solid ${colors.brand}`, borderRadius: 12 }}>
              <span style={{ fontSize: 22 }}>{cat.icon}</span>
              <span style={{ flex: 1, fontWeight: 700, color: '#1C2B3A' }}>{cat.label}</span>
              <button type="button" onClick={() => setCategorySlug('')} style={{
                background: 'none', border: '1px solid rgba(194,65,12,0.3)',
                color: colors.brand, fontSize: 11, fontWeight: 700,
                padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
              }}>Change</button>
            </div>
          )}
        </Field>

        {categorySlug && (
          <>
            <Field label="Name *">
              <input required value={form.name} onChange={set('name')} placeholder="What's it called?" style={inputStyle} />
            </Field>

            {cat.fields.includes('event_date') && (
              <Field label="Date *">
                <input type="date" required value={form.event_date} onChange={set('event_date')} style={inputStyle} />
              </Field>
            )}

            {cat.fields.includes('event_time') && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Start time">
                    <input type="time" value={form.event_time} onChange={set('event_time')} style={inputStyle} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="End time">
                    <input type="time" value={form.event_end_time} onChange={set('event_end_time')} style={inputStyle} />
                  </Field>
                </div>
              </div>
            )}

            {cat.fields.includes('address') && (
              <Field label="Address">
                <input value={form.address} onChange={set('address')} placeholder="Street address, city" style={inputStyle} />
              </Field>
            )}

            {cat.fields.includes('phone') && (
              <Field label="Phone">
                <input type="tel" value={form.phone} onChange={set('phone')} placeholder="(555) 123-4567" style={inputStyle} />
              </Field>
            )}

            {cat.fields.includes('email') && (
              <Field label="Email">
                <input type="email" value={form.email} onChange={set('email')} placeholder="contact@example.com" style={inputStyle} />
              </Field>
            )}

            {cat.fields.includes('website') && (
              <Field label="Website">
                <input value={form.website} onChange={set('website')} placeholder="https://..." style={inputStyle} />
              </Field>
            )}

            {cat.fields.includes('instagram') && (
              <Field label="Instagram">
                <input value={form.instagram} onChange={set('instagram')} placeholder="@handle or full URL" style={inputStyle} />
              </Field>
            )}

            {cat.fields.includes('facebook') && (
              <Field label="Facebook">
                <input value={form.facebook} onChange={set('facebook')} placeholder="Facebook page URL" style={inputStyle} />
              </Field>
            )}

            {cat.fields.includes('hours') && (
              <Field label="Hours">
                <input value={form.hours} onChange={set('hours')} placeholder="e.g. Mon-Fri 9am-5pm" style={inputStyle} />
              </Field>
            )}

            {cat.fields.includes('delivery') && (
              <Field label="Delivery / pickup notes">
                <input value={form.delivery} onChange={set('delivery')} placeholder="e.g. Delivery within 10 miles" style={inputStyle} />
              </Field>
            )}

            {cat.fields.includes('specialty') && (
              <Field label="Specialty / practice area">
                <input value={form.specialty} onChange={set('specialty')} placeholder="e.g. Family Law, Immigration" style={inputStyle} />
              </Field>
            )}

            {cat.fields.includes('grades') && (
              <Field label="Grades offered">
                <input value={form.grades} onChange={set('grades')} placeholder="e.g. K-8, Pre-K to 12" style={inputStyle} />
              </Field>
            )}

            {cat.fields.includes('image_url') && (
              <Field label="Photo (optional)">
                <ImageUpload value={form.image_url} onChange={(url) => setForm(f => ({ ...f, image_url: url }))} />
              </Field>
            )}

            <Field label="Description">
              <textarea value={form.description} onChange={set('description')}
                placeholder="Tell people about it..." rows={4}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} />
            </Field>

            {error && <div style={{ color: '#9A3A3A', fontSize: 12, marginBottom: 12, fontWeight: 600 }}>{error}</div>}

            <button type="submit" disabled={submitting} style={{ ...primaryBtn, width: '100%', marginTop: 8 }}>
              {submitting ? 'Saving...' : pageMode === 'edit' ? 'Save changes' : 'Submit for review'}
            </button>
          </>
        )}
      </form>

      <BottomNav />
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#3A4A5A', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '11px 13px',
  border: '1.5px solid rgba(0,0,0,0.1)',
  borderRadius: 10,
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: 'white',
}

const primaryBtn = {
  background: colors.brand, color: 'white', border: 'none',
  borderRadius: 12, padding: '13px 22px',
  fontSize: 14, fontWeight: 800, cursor: 'pointer',
}

const secondaryBtn = {
  background: 'white', color: '#1C2B3A',
  border: '1.5px solid rgba(0,0,0,0.12)',
  borderRadius: 12, padding: '13px 22px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer',
}
