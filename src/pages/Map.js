import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY

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

function formatTimes(mosque) {
  const times = mosque.jummah_times || {}
  const season = isSummer() ? 's' : 'w'
  const lines = []
  for (let i = 1; i <= 3; i++) {
    const j = times[`${season}${i}j`]
    const iq = times[`${season}${i}iq`]
    if (j) lines.push(`${['1st','2nd','3rd'][i-1]}: ${j}${iq ? ` / Iqama ${iq}` : ''}`)
  }
  return lines.length > 0 ? lines.join('<br>') : 'Check website for times'
}

export default function Map() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [mosques, setMosques] = useState([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)

  // Load mosques from DB
  useEffect(() => {
    async function load() {
      const { data: catData } = await supabase
        .from('categories').select('id').eq('slug', 'mosques').single()
      if (catData) {
        const { data } = await supabase
          .from('content')
          .select('id, name, jummah_times, location_area, display_lat, display_lng, website, phone')
          .eq('category_id', catData.id)
          .eq('status', 'published')
          .not('display_lat', 'is', null)
        setMosques(data || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  // Load Google Maps script
  useEffect(() => {
    if (window.google && window.google.maps) {
      setMapReady(true)
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`
    script.async = true
    script.defer = true
    script.onload = () => setMapReady(true)
    document.head.appendChild(script)
  }, [])

  // Init map once both ready
  useEffect(() => {
    if (!mapReady || !mosques.length || !mapRef.current) return
    if (mapInstanceRef.current) return

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 37.6, lng: -122.0 },
      zoom: 10,
      gestureHandling: 'greedy', // one finger scroll
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControlOptions: {
        position: window.google.maps.ControlPosition.RIGHT_CENTER,
      },
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    })

    mapInstanceRef.current = map
    const infoWindow = new window.google.maps.InfoWindow()

    mosques.forEach(mosque => {
      if (!mosque.display_lat || !mosque.display_lng) return

      const marker = new window.google.maps.Marker({
        position: { lat: mosque.display_lat, lng: mosque.display_lng },
        map,
        title: mosque.name,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
              <path d="M18 0C10.8 0 5 5.8 5 13c0 10 13 31 13 31s13-21 13-31C31 5.8 25.2 0 18 0z" fill="#f4a261"/>
              <circle cx="18" cy="13" r="7" fill="white"/>
              <text x="18" y="17" font-size="9" text-anchor="middle" fill="#c4744a">🕌</text>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(32, 40),
          anchor: new window.google.maps.Point(16, 40),
        },
      })

      marker.addListener('click', () => {
        const times = formatTimes(mosque)
        const season = isSummer() ? '☀️ Summer' : '❄️ Winter'
        const content = `
          <div style="font-family: -apple-system, sans-serif; max-width: 220px; padding: 4px;">
            <div style="font-size: 14px; font-weight: 700; color: #1a2a3a; margin-bottom: 6px; line-height: 1.3;">${mosque.name}</div>
            <div style="font-size: 11px; color: #888; margin-bottom: 6px;">${season} Jummah Times</div>
            <div style="font-size: 12px; color: #1a2a3a; line-height: 1.8; margin-bottom: 10px;">${times}</div>
            <div style="display: flex; gap: 6px;">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${mosque.display_lat},${mosque.display_lng}" target="_blank"
                style="flex: 1; background: #e8a040; color: white; text-align: center; padding: 7px 0; border-radius: 8px; font-size: 12px; font-weight: 700; text-decoration: none;">
                Directions
              </a>
              ${mosque.website ? `<a href="${mosque.website}" target="_blank"
                style="flex: 1; background: #f0f0f0; color: #1a2a3a; text-align: center; padding: 7px 0; border-radius: 8px; font-size: 12px; font-weight: 600; text-decoration: none;">
                Website
              </a>` : ''}
            </div>
          </div>
        `
        infoWindow.setContent(content)
        infoWindow.open(map, marker)
      })
    })

    // Try to center on user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        map.setZoom(11)
        new window.google.maps.Marker({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          map,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="8" fill="#4a90d9" opacity="0.3"/>
                <circle cx="8" cy="8" r="5" fill="#4a90d9"/>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(16, 16),
            anchor: new window.google.maps.Point(8, 8),
          },
          zIndex: 1000,
        })
      })
    }
  }, [mapReady, mosques])

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '52px 20px 20px' }}>
        <button onClick={() => navigate('/')} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 10, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1a2a3a', marginBottom: 2 }}>🗺️ Mosque Map</h1>
        <p style={{ fontSize: 14, color: 'rgba(26,42,58,0.6)' }}>
          {mosques.length} mosques · Tap a pin for Jummah times
        </p>
      </div>

      <div style={{ padding: '12px 16px 0', background: '#f5f5f5' }}>
        <div style={{ display: 'flex', background: 'white', borderRadius: 12, padding: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
          <button onClick={() => navigate('/jummah')} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: 'transparent', color: 'rgba(26,42,58,0.5)',
          }}>☰ List View</button>
          <button style={{
            flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
            fontSize: 12, fontWeight: 600,
            background: '#1a2a3a', color: 'white',
          }}>🗺️ Map View</button>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {(loading || !mapReady) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', zIndex: 10 }}>
            <div style={{ textAlign: 'center', color: 'rgba(26,42,58,0.4)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🕌</div>
              <div style={{ fontSize: 15 }}>Loading map...</div>
            </div>
          </div>
        )}
        <div ref={mapRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      </div>

      <BottomNav />
    </div>
  )
}
