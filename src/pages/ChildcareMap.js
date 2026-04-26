import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

export default function ChildcareMap() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'childcare').single()
      if (!cat) return
      const { data } = await supabase.from('content').select('id,name,phone,website,email,whatsapp,instagram,facebook,location_address,location_area,display_lat,display_lng,url_slug,description')
        .eq('category_id', cat.id)
        .eq('status', 'published')
        .not('display_lat', 'is', null)
      setItems(data || [])
    }
    load()

    if (!window.google) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
      script.async = true
      script.onload = () => setMapReady(true)
      document.head.appendChild(script)
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
    })
  }, [mapReady])

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !items.length) return
    if (mapInstanceRef.current._markers) mapInstanceRef.current._markers.forEach(m => m.setMap(null))
    mapInstanceRef.current._markers = []

    items.forEach(item => {
      if (!item.display_lat || !item.display_lng) return
      const marker = new window.google.maps.Marker({
        position: { lat: item.display_lat, lng: item.display_lng },
        map: mapInstanceRef.current,
        icon: {
          path: 'M12 0C7.6 0 4 3.6 4 8c0 6.4 8 16 8 16s8-9.6 8-16C20 3.6 16.4 0 12 0z',
          fillColor: '#9b87c4',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 1.5,
          scale: 1.4,
          anchor: new window.google.maps.Point(12, 24),
        }
      })
      marker.addListener('click', () => setSelected(item))
      mapInstanceRef.current._markers.push(marker)
    })
  }, [items, mapReady])

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '48px 16px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a2a3a', margin: 0 }}>👶 Childcare</h1>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(26,42,58,0.5)', fontWeight: 600 }}>{items.length} providers</div>
        </div>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.7)', borderRadius: 12, padding: 3 }}>
          <button onClick={() => navigate('/childcare')} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'transparent', color: 'rgba(26,42,58,0.5)' }}>☰ List View</button>
          <button style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#1a2a3a', color: 'white' }}>🗺️ Map View</button>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {selected && (
          <>
            {/* Backdrop */}
            <div onClick={() => setSelected(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
            {/* Bottom sheet card */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'white', borderRadius: '20px 20px 0 0',
              padding: '0 0 32px',
              boxShadow: '0 -4px 30px rgba(0,0,0,0.15)',
              minHeight: '50vh', maxHeight: '75vh', overflowY: 'auto', paddingBottom: 80,
            }}>
              {/* Drag handle */}
              <div style={{ width: 36, height: 4, background: 'rgba(0,0,0,0.12)', borderRadius: 2, margin: '12px auto 16px' }} />

              <div style={{ padding: '0 16px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1, paddingRight: 8 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#1a2a3a', marginBottom: 3, lineHeight: 1.3 }}>{selected.name}</div>
                    {selected.location_address && <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.5)' }}>📍 {selected.location_address}</div>}
                    {!selected.location_address && selected.location_area && <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.5)' }}>📍 {selected.location_area}</div>}
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: '#f5f5f5', border: 'none', borderRadius: 20, width: 28, height: 28, fontSize: 14, color: 'rgba(26,42,58,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                </div>

                {/* Description */}
                {selected.description && (
                  <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.65)', lineHeight: 1.6, marginBottom: 14, background: '#f8f8f8', borderRadius: 10, padding: '10px 12px' }}>
                    {selected.description.replace(/&nbsp;/g, ' ').substring(0, 200)}{selected.description.length > 200 ? '...' : ''}
                  </div>
                )}

                {/* Contact buttons */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button onClick={() => navigate(`/childcare/${selected.url_slug}`)} style={{ flex: 1, background: '#1a2a3a', color: 'white', border: 'none', borderRadius: 12, padding: '12px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>View Full Details</button>
                  {selected.phone && (
                    <a href={`tel:${selected.phone}`} style={{ flex: 1, background: '#9b87c4', color: 'white', borderRadius: 12, padding: '12px 0', fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>📞 Call</a>
                  )}
                </div>

                {/* Extra contact row */}
                {(selected.website || selected.email || selected.whatsapp) && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {selected.website && (
                      <a href={selected.website} target="_blank" rel="noreferrer" style={{ flex: 1, background: '#f5f5f5', borderRadius: 12, padding: '10px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textDecoration: 'none', textAlign: 'center' }}>🌐 Website</a>
                    )}
                    {selected.email && (
                      <a href={`mailto:${selected.email}`} style={{ flex: 1, background: '#f5f5f5', borderRadius: 12, padding: '10px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textDecoration: 'none', textAlign: 'center' }}>✉️ Email</a>
                    )}
                    {selected.whatsapp && (
                      <a href={`https://wa.me/${selected.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ flex: 1, background: '#f5f5f5', borderRadius: 12, padding: '10px 0', fontSize: 12, fontWeight: 600, color: '#1a2a3a', textDecoration: 'none', textAlign: 'center' }}>💬 WhatsApp</a>
                    )}
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
