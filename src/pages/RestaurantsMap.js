import { colors, mapHeaderGradient } from '../theme'
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

const TIER_COLORS = {
  hfsaa_zabihah: '#0288D1',
  fully_halal: '#0F9D58',
  partially_halal: '#F4B400',
  unknown: '#9CA3AF',
}

function tierBadge(t) {
  if (t === 'hfsaa_zabihah') return { bg: '#E3F2FD', color: '#0288D1', label: 'HFSAA Zabihah' }
  if (t === 'fully_halal') return { bg: '#E8F5E9', color: '#2E7D32', label: 'Fully Halal' }
  if (t === 'partially_halal') return { bg: '#FFF8E1', color: '#9A6D00', label: 'Partially Halal' }
  return null
}

function buildInfoHtml(r, userLocation) {
  const dist = userLocation && r.display_lat && r.display_lng
    ? distanceMiles(userLocation.lat, userLocation.lng, r.display_lat, r.display_lng)
    : null
  const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.display_lat},${r.display_lng}`
  const detailUrl = r.url_slug ? `/restaurants/${r.url_slug}` : null
  const safeName = (r.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const tier = tierBadge(r.halal_tier)

  let chipsHtml = ''
  const chips = []
  if (tier) chips.push(`<span style="background:${tier.bg};color:${tier.color};font-size:10px;font-weight:700;padding:3px 7px;border-radius:5px;">${tier.label}</span>`)
  if (r.cuisine_clean) chips.push(`<span style="background:#F7F3EE;color:#3A4A5A;font-size:10px;font-weight:600;padding:3px 7px;border-radius:5px;">${r.cuisine_clean}</span>`)
  ;(r.types || []).filter(t => t !== 'restaurant').forEach(t => {
    const label = t === 'grocery' ? 'Grocery & Meat' : t.charAt(0).toUpperCase() + t.slice(1)
    chips.push(`<span style="background:#FFF0E8;color:#C2410C;font-size:10px;font-weight:700;padding:3px 7px;border-radius:5px;">${label}</span>`)
  })
  if (chips.length) chipsHtml = `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">${chips.join('')}</div>`

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:220px;max-width:260px;padding:4px 2px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
        ${detailUrl
          ? `<a href="${detailUrl}" data-rest-detail="${detailUrl}" style="font-size:14px;font-weight:800;color:#1C2B3A;line-height:1.3;text-decoration:none;flex:1;">${safeName}</a>`
          : `<span style="font-size:14px;font-weight:800;color:#1C2B3A;line-height:1.3;flex:1;">${safeName}</span>`
        }
        ${dist !== null ? `<span style="font-size:11px;color:#C4500A;font-weight:700;white-space:nowrap;flex-shrink:0;">${dist.toFixed(1)} mi</span>` : ''}
      </div>
      ${chipsHtml}
      <a href="${dirUrl}" target="_blank" rel="noreferrer" style="display:block;background:#C2410C;border-radius:8px;padding:8px 0;font-size:12px;font-weight:700;color:white;text-align:center;text-decoration:none;">Directions</a>
    </div>
  `
}

export default function RestaurantsMap() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const infoWindowRef = useRef(null)
  const userMarkerRef = useRef(null)
  const [items, setItems] = useState([])
  const [mapReady, setMapReady] = useState(false)
  const [userLocation, setUserLocation] = useState(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    )
  }, [])

  useEffect(() => {
    async function load() {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'restaurants').single()
      if (!cat) return
      const { data: contentRows } = await supabase.from('content')
        .select('id, name, url_slug, location_address, location_area, display_lat, display_lng')
        .eq('category_id', cat.id)
        .eq('status', 'published')
        .eq('location_area', 'Bay Area')
        .not('display_lat', 'is', null)
      if (!contentRows) return

      const ids = contentRows.map(r => r.id)
      const { data: attrs } = await supabase.from('attributes')
        .select('content_id, attribute_name, attribute_value')
        .in('content_id', ids)
      const byId = new Map()
      ;(attrs || []).forEach(a => {
        if (!byId.has(a.content_id)) byId.set(a.content_id, { types: [] })
        const b = byId.get(a.content_id)
        if (a.attribute_name === 'type') b.types.push(a.attribute_value)
        else b[a.attribute_name] = a.attribute_value
      })
      setItems(contentRows.map(r => {
        const a = byId.get(r.id) || { types: [] }
        return { ...r, halal_tier: a.halal_tier || 'unknown', cuisine_clean: a.cuisine_clean || null, types: a.types || [] }
      }))
    }
    load()

    if (!window.google) {
      const existing = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existing) existing.addEventListener('load', () => setMapReady(true))
      else {
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
    mapInstanceRef.current.addListener('click', () => {
      if (infoWindowRef.current) infoWindowRef.current.close()
    })
  }, [mapReady])

  // User location dot
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

  // Drop pins, color-coded by halal tier
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !items.length) return
    if (mapInstanceRef.current._markers) {
      mapInstanceRef.current._markers.forEach(m => m.setMap(null))
    }
    mapInstanceRef.current._markers = []

    items.forEach(r => {
      if (!r.display_lat || !r.display_lng) return
      const fillColor = TIER_COLORS[r.halal_tier] || TIER_COLORS.unknown
      const marker = new window.google.maps.Marker({
        position: { lat: r.display_lat, lng: r.display_lng },
        map: mapInstanceRef.current,
        title: r.name,
        icon: {
          path: 'M12 0C7.6 0 4 3.6 4 8c0 6.4 8 16 8 16s8-9.6 8-16C20 3.6 16.4 0 12 0z',
          fillColor,
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 1.2,
          scale: 1,
          anchor: new window.google.maps.Point(12, 24),
        },
      })
      marker.addListener('click', () => {
        if (!infoWindowRef.current) return
        infoWindowRef.current.setContent(buildInfoHtml(r, userLocation))
        infoWindowRef.current.open({ anchor: marker, map: mapInstanceRef.current })
        setTimeout(() => {
          document.querySelectorAll('[data-rest-detail]').forEach(link => {
            link.onclick = (e) => {
              e.preventDefault()
              navigate(link.getAttribute('data-rest-detail'))
            }
          })
        }, 0)
      })
      mapInstanceRef.current._markers.push(marker)
    })
  }, [items, mapReady, userLocation, navigate])

  const recenterToUser = () => {
    if (!mapInstanceRef.current || !userLocation) return
    mapInstanceRef.current.panTo({ lat: userLocation.lat, lng: userLocation.lng })
    mapInstanceRef.current.setZoom(13)
  }

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: mapHeaderGradient, padding: '48px 16px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button onClick={() => navigate('/restaurants')} style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1C2B3A', margin: 0 }}>🍽️ Restaurants</h1>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#3A4A5A', fontWeight: 600 }}>{items.length} spots</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ display: 'inline-flex', background: 'white', borderRadius: 12, padding: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
            <button onClick={() => navigate('/restaurants')} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'transparent', color: '#3A4A5A', whiteSpace: 'nowrap' }}>☰ List</button>
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
        {/* Tier legend */}
        <div style={{ position: 'absolute', top: 12, left: 12, background: 'white', borderRadius: 10, padding: '8px 10px', fontSize: 11, fontWeight: 600, color: '#1C2B3A', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: TIER_COLORS.hfsaa_zabihah }} />HFSAA Zabihah
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: TIER_COLORS.fully_halal }} />Fully Halal
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: TIER_COLORS.partially_halal }} />Partially Halal
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
