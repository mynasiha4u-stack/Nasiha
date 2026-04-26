import { colors, headerGradient, card, radius } from '../theme'
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const AREAS = ['All', 'East Bay', 'South Bay', 'Peninsula', 'San Francisco', 'North Bay']

const POPULARITY_ORDER = [
  "MCA - Muslim Community Association (Santa Clara)",
  "MCC - Muslim Community Center East Bay (Pleasanton)",
  "ISEB (Lowry Masjid) - Islamic Society of East Bay (Fremont)",
  "SRVIC - San Ramon Valley Islamic Center",
  "ICF (Irvington) - Islamic Center of Fremont",
  "ICF - Masjid Zakariya (Fremont)",
  "Yaseen Fundation Belmont Masjid (YBM)",
  "SBIA (South Bay Islamic Association)",
  "ICL (Islamic Center of Livermore)",
  "MCC Offsite Jummah - Rosewood Conference Center Building 5 (Pleasanton)",
  "ICCNC - Islamic Cultural Center of Northern California (Oakland)",
  "Masjid Muhajireen (Hayward)",
  "MHMA - Mountain House Unity Center Jummah",
  "ICA - Quba Masjid (Alameda)",
  "ICCC - Islamic Center of Contra Costa (Concord)",
  "Gading Jame Masjid (Hayward)",
  "MEC - Al-Medina Education Center (Newark)",
  "IKIC - Ibrahim Khalilullah Islamic Center (Fremont)",
  "IECRC - Islamic Educational & Cultural Research Center (Newark)",
  "Masjid Al-Huda (Union City)",
  "EIC Masjid - Evergreen Islamic Center",
  "BVMCC - Blossom Valley Muslim Community Center",
  "Masjid Al-Noor (Santa Clara)",
  "TIC (Taha Islamic Center)",
  "SCMCC - Silver Creek Musalla (San Jose)",
  "Masjid Darussalaam - Al Hilaal (Milpitas)",
  "Yaseen Foundation - Belmont Sports Complex (BSC)",
  "Yaseen Foundation - Burlingame Center (YBC)",
  "FJIA - Fiji Jamaat ul Islam - Masjid ul Jame",
  "Stanford Campus Jummah (Old Union Building)",
  "MVPA Musalla - Mountain View-Palo Alto Mosque",
  "Masjid Ul Haqq - Masonic Lodge Jummah (San Mateo)",
  "Alif Jummah - Fort Mason (San Francisco)",
  "ICSF - Crescent Street Masjid (San Francisco)",
  "Masjid Darussalam (Islamic Society San Francisco)",
  "AlSabeel Masjid Noor Al-Islam (San Francisco)",
  "Masjid al-Tawheed (San Francisco)",
  "Lighthouse Mosque",
  "As-Salam Mosque (Oakland)",
  "ICO - Islamic Center of Oakland",
  "MasjId Al Iman (Oakland) - Naqshbandi Sufi Center",
  "Masjid Al Noor (Richmond)",
  "Masjid Abu Bakr Al-Siddiq (Hayward)",
  "Masjid Al-Farooq (San Leandro Islamic Center)",
  "NICCC - Masjid Noor Islamic and Cultural Community Center (Concord)",
  "Berkeley Masjid",
  "BMCC - Brentwood Muslim Community Center",
  "Tracy Islamic Center (TIC)",
  "Walnut Creek Islamic Center (WCIC)",
  "MCC Offsite Jummah - Rosewood Conference Center Building 5 (Pleasanton)",
  "SVIC (South Valley Islamic Community)",
  "WVMA - Prospect Center Jummah",
  "WVMA - Los Gatos Islamic Center (LGIC)",
  "ICNM (Masjid Aisha) - Islamic Center North Marin",
  "MV Masjid - Islamic Center of Mill Valley",
  "ICP - Islamic Center of Petaluma",
  "Islamic Center of Vallejo",
  "Islamic Community of Bay Area Bosnians",
  "Richmond - Masjid Al Rahman",
  "Lamorinda Muslim Community Center (LMCC)",
  "Fairfield Masjid",
  "Vacaville Masjid",
  "Napa Valley Islamic Center (NVIC)",
  "Antioch - Masjid Abubakr Al Siddiq",
  "ICEB Antioch - Islamic Center of East Bay",
  "Pittsburgh Islamic Center",
  "Oakland - Masjid As Salaam",
  "Oakland - Masjid Waritheen",
  "SBAICC - South Bay Afghan Islamic Center",
  "Mountain House Musalla",
]

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

function MosqueIcon() {
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 12, background: '#f0f0f0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 26, flexShrink: 0,
    }}>🕌</div>
  )
}

function MosqueCard({ mosque, season, userLocation }) {
  const navigate = useNavigate()
  const times = mosque.jummah_times || {}
  const isFriday = new Date().getDay() === 5
  const entries = []
  for (let i = 1; i <= 3; i++) {
    const j = season === 'winter' ? times[`w${i}j`] : times[`s${i}j`]
    const iq = season === 'winter' ? times[`w${i}iq`] : times[`s${i}iq`]
    if (j) entries.push({ label: `${['1st','2nd','3rd'][i-1]} Jummah`, j, iq })
  }

  const dist = userLocation && mosque.display_lat && mosque.display_lng
    ? distanceMiles(userLocation.lat, userLocation.lng, mosque.display_lat, mosque.display_lng)
    : null

  return (
    <div onClick={() => mosque.url_slug && navigate(`/jummah/${mosque.url_slug}`)} style={{
      background: 'white', borderRadius: 16,
      border: '1px solid rgba(0,0,0,0.08)',
      padding: '16px', marginBottom: 12,
      cursor: mosque.url_slug ? 'pointer' : 'default',
    }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: entries.length ? 12 : 0 }}>
        <MosqueIcon />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, lineHeight: 1.3, flex: 1, paddingRight: 8 }}>
              {mosque.name}
            </div>
            {isFriday && (
              <span style={{ background: '#c8f0dc', color: '#0a5c2a', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>Today</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center' }}>
            {mosque.location_area && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>📍 {mosque.location_area}</div>
            )}
            {dist !== null && (
              <div style={{ fontSize: 12, color: '#e8a040', fontWeight: 600 }}>{dist.toFixed(1)} mi</div>
            )}
          </div>
        </div>
      </div>

      {entries.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          {entries.map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', marginBottom: 6,
              background: '#FFF0E8', borderRadius: 10,
              borderLeft: '3px solid #C4500A',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 70 }}>{e.label}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>
                {e.j}{e.iq ? <span style={{ color: '#555', fontWeight: 500 }}> / Iqama {e.iq}</span> : ''}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: '#6A7A8A', marginBottom: 12 }}>Check website for times</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {mosque.display_lat && mosque.display_lng && (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${mosque.display_lat},${mosque.display_lng}`}
            style={{ flex: 1, background: '#E8860A', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, color: 'white', textAlign: 'center', textDecoration: 'none' }}>
            Get Directions
          </a>
        )}
        {mosque.website && (
          <a href={mosque.website} target="_blank" rel="noreferrer"
            style={{ flex: 1, background: '#f0f0f0', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 600, color: colors.textPrimary, textAlign: 'center', textDecoration: 'none' }}>
            Website
          </a>
        )}
        {mosque.phone && (
          <a href={`tel:${mosque.phone}`}
            style={{ background: '#f0f0f0', borderRadius: 10, padding: '10px 14px', fontSize: 16, textDecoration: 'none' }}>
            📞
          </a>
        )}
      </div>
    </div>
  )
}

export default function Jummah() {
  const navigate = useNavigate()
  const [mosques, setMosques] = useState([])
  const [loading, setLoading] = useState(true)
  const [area, setArea] = useState('All')
  const [search, setSearch] = useState('')
  const [season, setSeason] = useState(isSummer() ? 'summer' : 'winter')
  const [sortBy, setSortBy] = useState('nearest')
  const [userLocation, setUserLocation] = useState(null)
  const [locationDenied, setLocationDenied] = useState(false)

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setLocationDenied(true); setSortBy('popular') }
    )
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: catData } = await supabase.from('categories').select('id').eq('slug', 'mosques').single()
      if (catData) {
        let q = supabase
          .from('content')
          .select('id, name, jummah_times, location_area, display_lat, display_lng, website, phone, url_slug')
          .eq('category_id', catData.id)
          .eq('status', 'published')
        if (area !== 'All') q = q.eq('location_area', area)
        if (search) q = q.or(`name.ilike.%${search}%,location_address.ilike.%${search}%,location_area.ilike.%${search}%`)
        const { data } = await q
        setMosques(data || [])
      }
      setLoading(false)
    }
    load()
  }, [area, search])

  const sorted = [...mosques].sort((a, b) => {
    if (sortBy === 'az') return a.name.localeCompare(b.name)

    if (sortBy === 'nearest' && userLocation) {
      const aHas = a.display_lat && a.display_lng
      const bHas = b.display_lat && b.display_lng
      if (!aHas && !bHas) return a.name.localeCompare(b.name)
      if (!aHas) return 1
      if (!bHas) return -1
      return distanceMiles(userLocation.lat, userLocation.lng, a.display_lat, a.display_lng)
           - distanceMiles(userLocation.lat, userLocation.lng, b.display_lat, b.display_lng)
    }

    // popular or nearest while waiting for location
    const ai = POPULARITY_ORDER.indexOf(a.name)
    const bi = POPULARITY_ORDER.indexOf(b.name)
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(180deg, #1A2F5C 0%, #5C2D7A 40%, #8B1A4A 70%, #C4500A 100%)', padding: '52px 20px 24px' }}>
        <button onClick={() => navigate('/')} style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: colors.textPrimary, marginBottom: 4 }}>🕌 Jummah Timings</h1>
        <p style={{ fontSize: 14, color: '#3A4A5A', marginBottom: 4 }}>
          {new Date().getDay() === 5 ? '🟢 Today is Friday · ' : ''}{mosques.length} mosques in the Bay Area
        </p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F7F3EE', paddingBottom: 12 }}>

          {/* Search bar with season toggle embedded on the right */}
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', marginBottom: 10 }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search mosques..."
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15 }} />
            <div style={{ display: 'inline-flex', background: '#f0f0f0', borderRadius: 20, padding: 2, flexShrink: 0 }}>
              {['summer', 'winter'].map(s => (
                <button key={s} onClick={() => setSeason(s)} style={{
                  padding: '4px 8px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 14,
                  background: season === s ? '#1a2a3a' : 'transparent',
                }}>{s === 'summer' ? '☀️' : '❄️'}</button>
              ))}
            </div>
          </div>

          {/* Area filter pills */}
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 10, paddingBottom: 2, scrollbarWidth: 'none' }}>
            {AREAS.map(a => (
              <button key={a} onClick={() => { setArea(a); if (a !== 'All') setSortBy('popular') }} style={{
                padding: '7px 15px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: area === a ? '#1a2a3a' : 'white', color: area === a ? 'white' : 'rgba(26,42,58,0.6)', border: '1px solid rgba(0,0,0,0.1)',
              }}>{a}</button>
            ))}
          </div>

          {/* Sort + List/Map in one row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, display: 'flex', background: 'white', borderRadius: 12, padding: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
              {[
                { key: 'nearest', label: '📍 Nearest' },
                { key: 'popular', label: '⭐ Popular' },
                { key: 'az', label: 'A–Z' },
              ].map(s => (
                <button key={s.key} onClick={() => setSortBy(s.key)} disabled={s.key === 'nearest' && locationDenied} style={{
                  flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: s.key === 'nearest' && locationDenied ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: sortBy === s.key ? '#1A2F5C' : 'transparent',
                  color: sortBy === s.key ? 'white' : s.key === 'nearest' && locationDenied ? 'rgba(26,42,58,0.25)' : 'rgba(26,42,58,0.5)',
                }}>{s.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', background: 'white', borderRadius: 12, padding: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
              <button onClick={() => {}} style={{ padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: colors.deep, color: 'white', whiteSpace: 'nowrap' }}>☰ List</button>
              <button onClick={() => navigate('/map')} style={{ padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'transparent', color: '#3A4A5A', whiteSpace: 'nowrap' }}>🗺️ Map</button>
            </div>
          </div>

        </div>

        {locationDenied && (
          <div style={{
            background: '#fff8f0', border: '1px solid #e8a040',
            borderRadius: 12, padding: '12px 14px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>📍</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>Enable location for better results</div>
              <div style={{ fontSize: 12, color: '#3A4A5A', marginTop: 2 }}>Nasiha works best when it can sort mosques by closest to you</div>
            </div>
          </div>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#6A7A8A', fontSize: 15 }}>Loading mosques...</div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#6A7A8A', fontSize: 15 }}>No mosques found</div>
        ) : (
          sorted.map(m => <MosqueCard key={m.id} mosque={m} season={season} userLocation={userLocation} />)
        )}
      </div>
      <BottomNav />
    </div>
  )
}
