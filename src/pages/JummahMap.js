import { colors, headerGradient } from '../theme'
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

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

function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Build the InfoWindow HTML — native Google Maps bubble with a tail
// Styled to match Jummah card: warm orange time blocks, clickable name, distance, directions
function buildInfoHtml(mosque, season, userLocation) {
  const times = mosque.jummah_times || {}
  const entries = []
  for (let i = 1; i <= 3; i++) {
    const j = season === 'winter' ? times[`w${i}j`] : times[`s${i}j`]
    const iq = season === 'winter' ? times[`w${i}iq`] : times[`s${i}iq`]
    if (j) entries.push({ label: ['1st Jummah', '2nd Jummah', '3rd Jummah'][i-1], j, iq })
  }

  const dist = userLocation && mosque.display_lat && mosque.display_lng
    ? distanceMiles(userLocation.lat, userLocation.lng, mosque.display_lat, mosque.display_lng)
    : null

  const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${mosque.display_lat},${mosque.display_lng}`
  const detailUrl = mosque.url_slug ? `/jummah/${mosque.url_slug}` : null

  const safeName = (mosque.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  let timesHtml = ''
  if (entries.length > 0) {
    timesHtml = entries.map((e, i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;margin-bottom:4px;background:#FFF0E8;border-radius:8px;border-left:3px solid #C4500A;">
        <span style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.05em;min-width:62px;${i === 0 ? '' : ''}">${e.label}</span>
        <span style="font-size:13px;font-weight:${i === 0 ? '800' : '700'};color:#1C2B3A;">
          ${e.j}${e.iq ? ` <span style="color:#666;font-weight:500;">/ Iqama ${e.iq}</span>` : ''}
        </span>
      </div>
    `).join('')
  } else {
    timesHtml = '<div style="font-size:12px;color:#6A7A8A;padding:6px 0;">No times listed</div>'
  }

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:240px;max-width:280px;padding:4px 2px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">
        ${detailUrl
          ? `<a href="${detailUrl}" data-jummah-detail="${detailUrl}" style="font-size:14px;font-weight:800;color:#1C2B3A;line-height:1.3;text-decoration:none;flex:1;">${safeName}</a>`
          : `<span style="font-size:14px;font-weight:800;color:#1C2B3A;line-height:1.3;flex:1;">${safeName}</span>`
        }
        ${dist !== null ? `<span style="font-size:11px;color:#C4500A;font-weight:700;white-space:nowrap;flex-shrink:0;">${dist.toFixed(1)} mi</span>` : ''}
      </div>
      ${timesHtml}
      <a href="${dirUrl}" target="_blank" rel="noreferrer" style="display:block;margin-top:8px;background:#C2410C;border-radius:8px;padding:9px 0;font-size:12px;font-weight:700;color:white;text-align:center;text-decoration:none;">Directions</a>
    </div>
  `
}

export default function JummahMap() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const infoWindowRef = useRef(null)
  const [mosques, setMosques] = useState([])
  const [mapReady, setMapReady] = useState(false)
  const [season] = useState(isSummer() ? 'summer' : 'winter')
  const [userLocation, setUserLocation] = useState(null)

  // Get user location for distance
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    )
  }, [])

  // Load mosques + Google Maps script
  useEffect(() => {
    async function load() {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'mosques').single()
      if (!cat) return
      const { data } = await supabase.from('content')
        .select('id, name, jummah_times, location_area, display_lat, display_lng, url_slug')
        .eq('category_id', cat.id)
        .eq('status', 'published')
        .not('display_lat', 'is', null)
      setMosques(data || [])
    }
    load()

    if (!window.google) {
      const existing = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existing) {
        existing.addEventListener('load', () => setMapReady(true))
      } else {
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
        script.async = true
        script.onload = () => setMapReady(true)
        document.head.appendChild(script)
      }
    } else {
      setMapReady(true)
    }
  }, [])

  // Init map + single shared InfoWindow
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return
    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 37.6, lng: -121.95 },
      zoom: 10,
      gestureHandling: 'greedy',
      disableDefaultUI: true,
      zoomControl: true,
    })
    infoWindowRef.current = new window.google.maps.InfoWindow({
      pixelOffset: new window.google.maps.Size(0, -8),
    })
    // Close any open InfoWindow when user taps the map background
    mapInstanceRef.current.addListener('click', () => {
      if (infoWindowRef.current) infoWindowRef.current.close()
    })
  }, [mapReady])

  // User location blue dot
  const userMarkerRef = useRef(null)
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !userLocation) return
    if (userMarkerRef.current) userMarkerRef.current.setMap(null)
    userMarkerRef.current = new window.google.maps.Marker({
      position: { lat: userLocation.lat, lng: userLocation.lng },
      map: mapInstanceRef.current,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#1E88E5',
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 3,
        scale: 9,
      },
      zIndex: 9999,
      title: 'Your location',
    })
  }, [userLocation, mapReady])

  const recenterToUser = () => {
    if (!mapInstanceRef.current || !userLocation) return
    mapInstanceRef.current.panTo({ lat: userLocation.lat, lng: userLocation.lng })
    mapInstanceRef.current.setZoom(13)
  }

  // Drop markers + bind InfoWindow handlers
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !mosques.length) return
    if (mapInstanceRef.current._markers) {
      mapInstanceRef.current._markers.forEach(m => m.setMap(null))
    }
    mapInstanceRef.current._markers = []

    mosques.forEach(mosque => {
      if (!mosque.display_lat || !mosque.display_lng) return
      const marker = new window.google.maps.Marker({
        position: { lat: mosque.display_lat, lng: mosque.display_lng },
        map: mapInstanceRef.current,
        title: mosque.name,
        icon: {
          // Smaller, simple teardrop pin in brand orange
          path: 'M12 0C7.6 0 4 3.6 4 8c0 6.4 8 16 8 16s8-9.6 8-16C20 3.6 16.4 0 12 0z',
          fillColor: colors.brand,
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 1.5,
          scale: 1.1,
          anchor: new window.google.maps.Point(12, 24),
        },
      })
      marker.addListener('click', () => {
        if (!infoWindowRef.current) return
        infoWindowRef.current.setContent(buildInfoHtml(mosque, season, userLocation))
        infoWindowRef.current.open({
          anchor: marker,
          map: mapInstanceRef.current,
        })
        // Wire up the in-bubble detail link to use react-router (no full reload)
        setTimeout(() => {
          const detailLinks = document.querySelectorAll('[data-jummah-detail]')
          detailLinks.forEach(link => {
            link.onclick = (e) => {
              e.preventDefault()
              const path = link.getAttribute('data-jummah-detail')
              if (path) navigate(path)
            }
          })
        }, 0)
      })
      mapInstanceRef.current._markers.push(marker)
    })
  }, [mosques, mapReady, season, userLocation, navigate])

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: headerGradient, padding: '48px 16px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button onClick={() => navigate('/jummah')} style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>🕌 Jummah</h1>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#3A4A5A', fontWeight: 600 }}>{mosques.length} mosques</div>
        </div>
        {/* Small pill toggle, matches Jummah list page */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ display: 'inline-flex', background: 'white', borderRadius: 12, padding: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
            <button onClick={() => navigate('/jummah')} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'transparent', color: '#3A4A5A', whiteSpace: 'nowrap' }}>☰ List</button>
            <button style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#1C2B3A', color: 'white', whiteSpace: 'nowrap' }}>🗺️ Map</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        {userLocation && (
          <button onClick={recenterToUser} style={{
            position: 'absolute', bottom: 20, right: 16, zIndex: 5,
            background: 'white', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 999,
            padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#1C2B3A',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>Recenter</button>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
