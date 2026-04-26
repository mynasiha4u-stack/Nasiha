import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default function EventsMap() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [filter, setFilter] = useState('all') // all, weekend, week

  useEffect(() => {
    const today = new Date().toISOString().substring(0, 10)
    supabase.from('content')
      .select('id, name, event_date, event_time, event_host, location_address, display_lat, display_lng, url_slug, event_type, image_url')
      .eq('category_id', 'd916a550-c316-40a9-9582-35836417b6cb')
      .eq('status', 'published')
      .gte('event_date', today)
      .not('display_lat', 'is', null)
      .order('event_date')
      .then(({ data }) => {
        const filtered = (data || []).filter(e => !/jumu.{0,3}ah|jummah|jumu|friday prayer/i.test(e.name))
        setEvents(filtered)
      })
  }, [])

  // Filter events based on time filter
  const getFilteredEvents = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 0
    const satDate = new Date(today); satDate.setDate(today.getDate() + daysUntilSat)
    const sunDate = new Date(satDate); sunDate.setDate(satDate.getDate() + 1)
    const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + 7)

    return events.filter(e => {
      if (filter === 'weekend') {
        const sat = satDate.toISOString().substring(0, 10)
        const sun = sunDate.toISOString().substring(0, 10)
        return e.event_date === sat || e.event_date === sun
      }
      if (filter === 'week') return new Date(e.event_date) <= endOfWeek
      return true
    })
  }

  useEffect(() => {
    if (!mapRef.current || !window.google) return
    if (mapInstanceRef.current) return

    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 37.5630, lng: -121.9760 },
      zoom: 10,
      gestureHandling: 'greedy',
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
      ]
    })
  }, [events])

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return

    // Clear existing markers
    if (mapInstanceRef.current._markers) {
      mapInstanceRef.current._markers.forEach(m => m.setMap(null))
    }
    mapInstanceRef.current._markers = []

    const filtered = getFilteredEvents()

    filtered.forEach(event => {
      if (!event.display_lat || !event.display_lng) return

      const marker = new window.google.maps.Marker({
        position: { lat: event.display_lat, lng: event.display_lng },
        map: mapInstanceRef.current,
        icon: {
          path: 'M12 0C7.6 0 4 3.6 4 8c0 6.4 8 16 8 16s8-9.6 8-16C20 3.6 16.4 0 12 0z',
          fillColor: '#e8943a',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 1.5,
          scale: 1.4,
          anchor: new window.google.maps.Point(12, 24),
        }
      })

      marker.addListener('click', () => setSelectedEvent(event))
      mapInstanceRef.current._markers.push(marker)
    })
  }, [events, filter])

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg, #1A2F5C 0%, #5C2D7A 40%, #8B1A4A 70%, #C4500A 100%)', padding: '48px 16px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button onClick={() => navigate('/events')} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', background: 'none', border: 'none', cursor: 'pointer' }}>← Events</button>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a2a3a' }}>Events Map</div>
        </div>

        {/* Time filter */}
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.7)', borderRadius: 20, padding: 3 }}>
          {[['all', 'All'], ['weekend', 'This Weekend'], ['week', 'This Week']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} style={{
              padding: '5px 12px', borderRadius: 18, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: filter === val ? '#1a2a3a' : 'transparent',
              color: filter === val ? 'white' : 'rgba(26,42,58,0.6)',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* Event count */}
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'white', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#1a2a3a', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          {getFilteredEvents().length} events
        </div>

        {/* Selected event popup */}
        {selectedEvent && (
          <div style={{
            position: 'absolute', bottom: 16, left: 16, right: 16,
            background: 'white', borderRadius: 16, padding: 14,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                {selectedEvent.event_host && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#e8943a', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{selectedEvent.event_host}</div>
                )}
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2a3a', lineHeight: 1.3, marginBottom: 4 }}>{selectedEvent.name}</div>
                <div style={{ fontSize: 12, color: '#3A4A5A' }}>
                  {formatDate(selectedEvent.event_date)}{selectedEvent.event_time ? ` · ${formatTime(selectedEvent.event_time)}` : ''}
                </div>
                {selectedEvent.location_address && (
                  <div style={{ fontSize: 11, color: '#6A7A8A', marginTop: 2 }}>{selectedEvent.location_address}</div>
                )}
              </div>
              <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'rgba(26,42,58,0.3)', cursor: 'pointer', padding: '0 0 0 8px' }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => navigate(`/events/${selectedEvent.url_slug}`)} style={{
                flex: 1, background: '#1a2a3a', color: 'white', border: 'none',
                borderRadius: 10, padding: '9px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>View Event</button>
              {selectedEvent.location_address && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedEvent.display_lat},${selectedEvent.display_lng}`}
                  target="_blank" rel="noreferrer" style={{
                    flex: 1, background: '#E8860A', color: 'white', border: 'none',
                    borderRadius: 10, padding: '9px 0', fontSize: 13, fontWeight: 700,
                    textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>🗺️ Directions</a>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
