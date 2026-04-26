import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY

const CATEGORIES = [
  { id: 'mosques',     label: '🕌 Masjids',       slug: 'mosques',          color: '#e8943a' },
  { id: 'childcare',   label: '👶 Childcare',     slug: 'childcare',        color: '#9b87c4' },
  { id: 'restaurants', label: '🍽️ Restaurants',   slug: 'restaurants',      color: '#2a8a4a' },
  { id: 'homecooks',   label: '👨‍🍳 Home Cooks',    slug: 'home-cooked-food', color: '#c87c0a' },
  { id: 'schools',     label: '🏫 Schools',        slug: 'islamic-schools',  color: '#1a5a9a' },
  { id: 'events',      label: '📅 Events',         slug: 'events',           color: '#c43a6a' },
]

const CAT_COLOR = Object.fromEntries(CATEGORIES.map(c => [c.slug, c.color]))

function isSummer() {
  const now = new Date()
  const year = now.getFullYear()
  const march = new Date(year, 2, 1)
  const marchDay = march.getDay()
  const firstSunMarch = marchDay === 0 ? 1 : 8 - marchDay
  const springForward = new Date(year, 2, firstSunMarch + 7)
  const nov = new Date(year, 10, 1)
  const novDay = nov.getDay()
  const firstSunNov = novDay === 0 ? 1 : 8 - novDay
  const fallBack = new Date(year, 10, firstSunNov)
  return now >= springForward && now < fallBack
}

export default function Map() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [pins, setPins] = useState([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [category, setCategory] = useState(null) // null = all
  const [selected, setSelected] = useState(null)

  // Load data when category changes
  useEffect(() => {
    async function load() {
      setLoading(true)
      setSelected(null)
      const cat = CATEGORIES.find(c => c.id === category)

      if (!category) {
        // Load from all categories that have coordinates
        const { data: cats } = await supabase.from('categories').select('id, slug, name')
        if (!cats) { setLoading(false); return }

        let allPins = []
        for (const c of cats) {
          const { data } = await supabase.from('content')
            .select('id, name, location_area, display_lat, display_lng, url_slug, category_id, phone, website, email, instagram, facebook, whatsapp, description')
            .eq('category_id', c.id)
            .eq('status', 'published')
            .not('display_lat', 'is', null)
            .limit(100)
          if (data) allPins = [...allPins, ...data.map(d => ({ ...d, _catSlug: c.slug }))]
        }
        setPins(allPins)
      } else {
        const { data: catData } = await supabase.from('categories').select('id').eq('slug', cat.slug).single()
        if (!catData) { setLoading(false); return }

        let query = supabase.from('content')
          .select('id, name, location_area, display_lat, display_lng, url_slug, phone, website, email, instagram, facebook, whatsapp, description, jummah_times, event_date, event_time, event_host')
          .eq('category_id', catData.id)
          .eq('status', 'published')
          .not('display_lat', 'is', null)

        // For events, only show upcoming
        if (category === 'events') {
          const today = new Date().toISOString().substring(0, 10)
          query = query.gte('event_date', today)
        }

        const { data } = await query.limit(200)
        setPins((data || []).map(d => ({ ...d, _catSlug: cat.slug })))
      }
      setLoading(false)
    }
    load()
  }, [category])

  // Init map
  useEffect(() => {
    if (!window.google) {
      const existing = document.querySelector('script[src*="maps.googleapis.com"]')
      if (!existing) {
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`
        script.async = true
        script.onload = () => setMapReady(true)
        document.head.appendChild(script)
      } else {
        existing.addEventListener('load', () => setMapReady(true))
      }
    } else {
      setMapReady(true)
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return
    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 37.5630, lng: -121.9760 },
      zoom: 10,
      gestureHandling: 'greedy',
      disableDefaultUI: true,
      zoomControl: true,
      styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
    })
  }, [mapReady])

  // Update pins when data or category changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return
    if (mapInstanceRef.current._markers) {
      mapInstanceRef.current._markers.forEach(m => m.setMap(null))
    }
    mapInstanceRef.current._markers = []

    pins.forEach(pin => {
      if (!pin.display_lat || !pin.display_lng) return
      if (pin._catSlug === 'events' && /jumu.{0,3}ah|jummah/i.test(pin.name)) return

      const pinColor = CAT_COLOR[pin._catSlug] || '#1a2a3a'

      const marker = new window.google.maps.Marker({
        position: { lat: pin.display_lat, lng: pin.display_lng },
        map: mapInstanceRef.current,
        icon: {
          path: 'M12 0C7.6 0 4 3.6 4 8c0 6.4 8 16 8 16s8-9.6 8-16C20 3.6 16.4 0 12 0z',
          fillColor: pinColor,
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 1.5,
          scale: 1.4,
          anchor: new window.google.maps.Point(12, 24),
        }
      })
      marker.addListener('click', () => setSelected(pin))
      mapInstanceRef.current._markers.push(marker)
    })
  }, [pins, mapReady, category])

  const getDetailPath = (pin) => {
    const slug = pin._catSlug || ''
    if (slug === 'mosques') return `/jummah/${pin.url_slug}`
    if (slug === 'childcare') return `/childcare/${pin.url_slug}`
    if (slug === 'events') return `/events/${pin.url_slug}`
    return null
  }

  const season = isSummer() ? 's' : 'w'

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '48px 16px 14px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a2a3a', marginBottom: 12 }}>🗺️ Map</h1>
        {/* Category filter */}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          <button onClick={() => setCategory(null)} style={{
            padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            background: category === null ? '#1a2a3a' : 'rgba(255,255,255,0.7)',
            color: category === null ? 'white' : 'rgba(26,42,58,0.7)',
            border: 'none',
          }}>All</button>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCategory(c.id)} style={{
              padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              background: category === c.id ? c.color : 'rgba(255,255,255,0.7)',
              color: category === c.id ? 'white' : 'rgba(26,42,58,0.7)',
              border: 'none',
            }}>{c.label}</button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        {(loading || !mapReady) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', zIndex: 10 }}>
            <div style={{ textAlign: 'center', color: 'rgba(26,42,58,0.4)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗺️</div>
              <div>Loading map...</div>
            </div>
          </div>
        )}
        <div ref={mapRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

        {/* Pin count */}
        {!loading && (
          <div style={{ position: 'absolute', top: 10, right: 10, background: 'white', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#1a2a3a', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            {pins.length} {category ? CATEGORIES.find(c => c.id === category)?.label.split(' ').slice(1).join(' ') : 'places'}
          </div>
        )}

        {/* Selected popup */}
        {selected && (
          <>
            <div onClick={() => setSelected(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'white', borderRadius: '20px 20px 0 0', padding: '0 0 90px', boxShadow: '0 -4px 30px rgba(0,0,0,0.2)', maxHeight: '65vh', overflowY: 'auto' }}>
              <div style={{ width: 36, height: 4, background: 'rgba(0,0,0,0.12)', borderRadius: 2, margin: '14px auto 18px' }} />
              <div style={{ padding: '0 18px' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1, paddingRight: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1a2a3a', marginBottom: 4, lineHeight: 1.3 }}>{selected.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.5)' }}>📍 {selected.location_area}</div>
                    {selected.event_date && <div style={{ fontSize: 12, color: '#e8943a', fontWeight: 600, marginTop: 3 }}>📅 {new Date(selected.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>}
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: '#f0f0f0', border: 'none', borderRadius: 20, width: 30, height: 30, fontSize: 15, color: 'rgba(26,42,58,0.4)', cursor: 'pointer', flexShrink: 0 }}>×</button>
                </div>

                {/* Description */}
                {selected.description && (
                  <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.7)', lineHeight: 1.7, marginBottom: 14, background: '#f8f8f8', borderRadius: 12, padding: '12px 14px', whiteSpace: 'pre-wrap' }}>
                    {selected.description.replace(/&nbsp;/g, ' ').replace(/Age Group:/g, '\nAge Group:').replace(/Services:/g, '\nServices:').replace(/Location:/g, '\nLocation:').substring(0, 300)}{selected.description.length > 300 ? '...' : ''}
                  </div>
                )}

                {/* Primary actions */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {getDetailPath(selected) && (
                    <button onClick={() => navigate(getDetailPath(selected))} style={{ flex: 1, background: '#1a2a3a', color: 'white', border: 'none', borderRadius: 12, padding: '12px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>View Details</button>
                  )}
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.display_lat},${selected.display_lng}`} target="_blank" rel="noreferrer"
                    style={{ flex: 1, background: '#e8943a', color: 'white', borderRadius: 12, padding: '12px 0', fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    🗺️ Directions
                  </a>
                </div>

                {/* All contact methods */}
                {(selected.phone || selected.email || selected.website || selected.instagram || selected.facebook || selected.whatsapp) && (
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {selected.phone && <a href={`tel:${selected.phone}`} style={{ flex: 1, minWidth: 70, background: '#f5f5f5', borderRadius: 10, padding: '9px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textDecoration: 'none', textAlign: 'center' }}>📞 Call</a>}
                    {selected.email && <a href={`mailto:${selected.email}`} style={{ flex: 1, minWidth: 70, background: '#f5f5f5', borderRadius: 10, padding: '9px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textDecoration: 'none', textAlign: 'center' }}>✉️ Email</a>}
                    {selected.website && <a href={selected.website.startsWith('http') ? selected.website : 'https://' + selected.website} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 70, background: '#f5f5f5', borderRadius: 10, padding: '9px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textDecoration: 'none', textAlign: 'center' }}>🌐 Website</a>}
                    {selected.instagram && <a href={selected.instagram} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 70, background: '#f5f5f5', borderRadius: 10, padding: '9px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textDecoration: 'none', textAlign: 'center' }}>📸 IG</a>}
                    {selected.facebook && <a href={selected.facebook} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 70, background: '#f5f5f5', borderRadius: 10, padding: '9px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textDecoration: 'none', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ background: '#1877F2', color: 'white', borderRadius: 3, padding: '0 3px', fontSize: 10, fontWeight: 900 }}>f</span> FB</span>
                    </a>}
                    {selected.whatsapp && <a href={`https://wa.me/${selected.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 70, background: '#f5f5f5', borderRadius: 10, padding: '9px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textDecoration: 'none', textAlign: 'center' }}>💬 WA</a>}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
