import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_KEY'

function parseJummahTimes(description) {
  if (!description) return []
  const times = []
  const lines = description.split('\n')
  for (const line of lines) {
    const jummahMatch = line.match(/(\d+(?:st|nd|rd|th))\s+Jummah[:\s]+(\d+:\d+\s*(?:AM|PM))/i)
    if (jummahMatch) {
      const iqamaMatch = line.match(/[Ii]qama.*?(\d+:\d+\s*(?:AM|PM))/i)
      times.push({
        label: jummahMatch[1],
        time: jummahMatch[2].trim(),
        iqama: iqamaMatch ? iqamaMatch[1].trim() : null,
      })
    }
  }
  return times
}

export default function MapPage() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const [mosques, setMosques] = useState([])
  const [selected, setSelected] = useState(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapInstance = useRef(null)
  const markers = useRef([])

  useEffect(() => {
    async function loadMosques() {
      const { data: catData } = await supabase
        .from('categories').select('id').eq('slug', 'mosques').single()
      if (catData) {
        const { data } = await supabase
          .from('content')
          .select('id, name, description, location_area, display_lat, display_lng, website, phone')
          .eq('category_id', catData.id)
          .eq('status', 'published')
          .not('display_lat', 'is', null)
        setMosques(data || [])
      }
    }
    loadMosques()
  }, [])

  useEffect(() => {
    if (!mosques.length) return
    if (GOOGLE_MAPS_KEY === 'YOUR_GOOGLE_MAPS_KEY') {
      setMapLoaded(false)
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap`
    script.async = true
    window.initMap = () => {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 37.55, lng: -121.98 },
        zoom: 10,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
        disableDefaultUI: true,
        zoomControl: true,
      })
      mapInstance.current = map

      mosques.forEach(mosque => {
        if (!mosque.display_lat || !mosque.display_lng) return
        const marker = new window.google.maps.Marker({
          position: { lat: mosque.display_lat, lng: mosque.display_lng },
          map,
          title: mosque.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#7db8e8',
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 2,
          },
        })
        marker.addListener('click', () => setSelected(mosque))
        markers.current.push(marker)
      })
      setMapLoaded(true)
    }
    document.head.appendChild(script)
    return () => { delete window.initMap }
  }, [mosques])

  const times = selected ? parseJummahTimes(selected.description) : []

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', height: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: 60 }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(90deg, #7db8e8, #c8e4f8)',
        padding: '52px 20px 16px',
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a2a3a' }}>
          🗺️ Mosques near you
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)', marginTop: 2 }}>
          {mosques.length} mosques in the Bay Area
        </p>
      </div>

      {/* Map or placeholder */}
      <div ref={mapRef} style={{ flex: 1, background: '#e8f0e8', position: 'relative' }}>
        {!mapLoaded && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#e8f4f8', gap: 12,
          }}>
            <div style={{ fontSize: 48 }}>🕌</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2a3a' }}>
              Map coming soon
            </div>
            <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.5)', textAlign: 'center', padding: '0 32px', lineHeight: 1.5 }}>
              Google Maps API key needed to show {mosques.length} mosque pins
            </div>
            <button
              onClick={() => navigate('/jummah')}
              style={{
                background: '#e8a040', color: 'white', border: 'none',
                borderRadius: 12, padding: '12px 24px',
                fontSize: 14, fontWeight: 700, marginTop: 8,
              }}
            >
              View list instead →
            </button>
          </div>
        )}
      </div>

      {/* Selected mosque card - slides up */}
      {selected && (
        <div style={{
          position: 'fixed', bottom: 60, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430,
          background: 'white', borderRadius: '20px 20px 0 0',
          padding: '20px 20px 16px',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          zIndex: 50,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ flex: 1, paddingRight: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1a2a3a', marginBottom: 3 }}>
                {selected.name}
              </div>
              {selected.location_area && (
                <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.5)' }}>
                  📍 {selected.location_area}
                </div>
              )}
            </div>
            <button onClick={() => setSelected(null)} style={{
              background: '#f0f0f0', border: 'none', borderRadius: 20,
              width: 30, height: 30, fontSize: 16, cursor: 'pointer',
            }}>✕</button>
          </div>

          {times.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {times.map((t, i) => (
                <div key={i} style={{
                  background: '#f0f7ff', borderRadius: 10,
                  padding: '8px 14px', flex: 1, minWidth: 90,
                }}>
                  <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.5)', marginBottom: 2 }}>
                    {t.label} Jummah
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2a3a' }}>
                    {t.time}
                  </div>
                  {t.iqama && (
                    <div style={{ fontSize: 12, color: '#c87820', fontWeight: 600 }}>
                      Iqama {t.iqama}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {selected.display_lat && (
              <a
                href={`https://maps.apple.com/?daddr=${selected.display_lat},${selected.display_lng}`}
                style={{
                  flex: 1, background: '#e8a040', borderRadius: 10,
                  padding: '11px 0', fontSize: 14, fontWeight: 700,
                  color: 'white', textAlign: 'center', textDecoration: 'none',
                }}
              >Get Directions</a>
            )}
            {selected.website && (
              <a
                href={selected.website}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1, background: '#f0f0f0', borderRadius: 10,
                  padding: '11px 0', fontSize: 14, fontWeight: 600,
                  color: '#1a2a3a', textAlign: 'center', textDecoration: 'none',
                }}
              >Website</a>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
