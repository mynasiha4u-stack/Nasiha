import { colors, headerGradient } from '../theme'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import RecommendationStrip from '../components/RecommendationStrip'
import FilterDropdown from '../components/FilterDropdown'
import LocationSearch from '../components/LocationSearch'
import RoutePlannerPanel from '../components/RoutePlannerPanel'
import { getRoute, getRouteWithWaypoint, filterRestaurantsAlongRoute } from '../utils/route'

function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

const HALAL_TIERS = [
  { key: 'all', label: 'All' },
  { key: 'hfsaa_zabihah', label: 'HFSAA Zabihah' },
  { key: 'fully_halal', label: 'Fully Halal' },
  { key: 'partially_halal', label: 'Partially' },
]

const TYPES = [
  { key: 'all', label: 'All' },
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'cafe', label: 'Cafe' },
  { key: 'grocery', label: 'Grocery & Meat' },
  { key: 'dessert', label: 'Dessert' },
]

function tierBadge(t) {
  if (t === 'hfsaa_zabihah') return { bg: '#E3F2FD', color: '#0288D1', label: 'HFSAA Zabihah' }
  if (t === 'fully_halal') return { bg: '#E8F5E9', color: '#2E7D32', label: 'Fully Halal' }
  if (t === 'partially_halal') return { bg: '#FFF8E1', color: '#9A6D00', label: 'Partially Halal' }
  return null
}

function buildInfoHtml(r, userLocation, detourMiles, detourMinutes) {
  const dist = userLocation && r.display_lat && r.display_lng
    ? distanceMiles(userLocation.lat, userLocation.lng, r.display_lat, r.display_lng)
    : null
  const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.display_lat},${r.display_lng}`
  const detailUrl = r.url_slug ? `/restaurants/${r.url_slug}` : null
  const safeName = (r.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const tier = tierBadge(r.halal_tier)

  const chips = []
  if (tier) chips.push(`<span style="background:${tier.bg};color:${tier.color};font-size:10px;font-weight:700;padding:3px 7px;border-radius:5px;">${tier.label}</span>`)
  if (r.cuisine_clean) chips.push(`<span style="background:#F7F3EE;color:#3A4A5A;font-size:10px;font-weight:600;padding:3px 7px;border-radius:5px;">${r.cuisine_clean}</span>`)
  ;(r.types || []).filter(t => t !== 'restaurant').forEach(t => {
    const label = t === 'grocery' ? 'Grocery & Meat' : t.charAt(0).toUpperCase() + t.slice(1)
    chips.push(`<span style="background:#FFF0E8;color:#C2410C;font-size:10px;font-weight:700;padding:3px 7px;border-radius:5px;">${label}</span>`)
  })
  const chipsHtml = chips.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">${chips.join('')}</div>` : ''

  // Detour chip — shown in route mode. Distance shows immediately; time shows after API returns.
  let detourHtml = ''
  if (typeof detourMiles === 'number') {
    let label = `🚗 ${detourMiles.toFixed(1)} mi off route`
    if (typeof detourMinutes === 'number') {
      const sign = detourMinutes > 0 ? '+' : ''
      label += ` · ${sign}${Math.round(detourMinutes)} min`
    } else {
      label += ' · calculating time…'
    }
    detourHtml = `<div style="display:inline-flex;align-items:center;gap:4px;background:#E6FAF7;color:#0F766E;font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;margin-bottom:8px;">${label}</div>`
  }

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
      ${detourHtml}
      <a href="${dirUrl}" target="_blank" rel="noreferrer" style="display:block;background:#C2410C;border-radius:8px;padding:8px 0;font-size:12px;font-weight:700;color:white;text-align:center;text-decoration:none;">Directions</a>
    </div>
  `
}

export default function RestaurantsMap() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const infoWindowRef = useRef(null)
  const userMarkerRef = useRef(null)
  const nearbyMarkerRef = useRef(null)
  // Polyline refs for route display (shadow + main)
  const routePolylineRef = useRef(null)
  const routeShadowRef = useRef(null)
  const [items, setItems] = useState([])
  const [mapReady, setMapReady] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  // Currently-highlighted restaurant from the recommendation strip (changes pin color)
  const [activeRecId, setActiveRecId] = useState(null)
  // "Search nearby" location — if set, map centers there
  const [nearbyLocation, setNearbyLocation] = useState(null)
  // "On the way home" mode — when active, fetch route and filter restaurants to corridor
  const [routeMode, setRouteMode] = useState(false)
  const [routeData, setRouteData] = useState(null)  // { path, duration_min, distance_mi }
  const [routeLoading, setRouteLoading] = useState(false)
  const [routePanelOpen, setRoutePanelOpen] = useState(false)
  // How far off-route to include restaurants (miles)
  const [corridorMiles, setCorridorMiles] = useState(2)
  // Origin + destination kept around so we can compute detour time per pin click
  const [routeOrigin, setRouteOrigin] = useState(null)
  const [routeDestination, setRouteDestination] = useState(null)

  // Mirror route state into a ref so click handlers (captured at marker creation time) see latest values
  const routeStateRef = useRef({ active: false, origin: null, destination: null, baseTime: null })
  useEffect(() => {
    routeStateRef.current = {
      active: routeMode,
      origin: routeOrigin,
      destination: routeDestination,
      baseTime: routeData?.duration_min || null,
    }
  }, [routeMode, routeOrigin, routeDestination, routeData])

  const parseSet = (key) => {
    const v = searchParams.get(key)
    return new Set(v ? v.split(',') : [])
  }
  const [tierFilter, setTierFilter] = useState(parseSet('tier'))
  const [typeFilter, setTypeFilter] = useState(parseSet('type'))
  const [cuisineFilter, setCuisineFilter] = useState(parseSet('cuisine'))

  useEffect(() => {
    const params = {}
    if (tierFilter.size > 0) params.tier = [...tierFilter].join(',')
    if (typeFilter.size > 0) params.type = [...typeFilter].join(',')
    if (cuisineFilter.size > 0) params.cuisine = [...cuisineFilter].join(',')
    setSearchParams(params, { replace: true })
  }, [tierFilter, typeFilter, cuisineFilter, setSearchParams])

  // Cache: which content IDs we've already loaded so bounds-driven fetches don't duplicate
  const loadedIdsRef = useRef(new Set())

  // Loader for restaurants within a bounding box. Used for initial load and on every map pan/zoom.
  // Declared early so the route-mode effect below can reference it.
  const loadRestaurantsInBounds = useCallback(async (bounds) => {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'restaurants').single()
    if (!cat) return

    const { data: contentRows } = await supabase.from('content')
      .select('id, name, url_slug, address, metro, display_lat, display_lng')
      .eq('category_id', cat.id)
      .eq('status', 'published')
      .gte('display_lat', bounds.south)
      .lte('display_lat', bounds.north)
      .gte('display_lng', bounds.west)
      .lte('display_lng', bounds.east)
      .limit(2000)
    if (!contentRows || contentRows.length === 0) return

    const newRows = contentRows.filter(r => !loadedIdsRef.current.has(r.id))
    if (newRows.length === 0) return
    newRows.forEach(r => loadedIdsRef.current.add(r.id))

    const newIds = newRows.map(r => r.id)
    const CHUNK = 200
    let allAttrs = []
    for (let i = 0; i < newIds.length; i += CHUNK) {
      const slice = newIds.slice(i, i + CHUNK)
      const { data: page } = await supabase.from('attributes')
        .select('content_id, attribute_name, attribute_value')
        .in('content_id', slice)
        .in('attribute_name', ['halal_tier', 'cuisine_clean', 'type'])
      if (page) allAttrs = allAttrs.concat(page)
    }

    const byId = new Map()
    allAttrs.forEach(a => {
      if (!byId.has(a.content_id)) byId.set(a.content_id, { types: [] })
      const b = byId.get(a.content_id)
      if (a.attribute_name === 'type') b.types.push(a.attribute_value)
      else b[a.attribute_name] = a.attribute_value
    })

    const enriched = newRows.map(r => {
      const a = byId.get(r.id) || { types: [] }
      return { ...r, halal_tier: a.halal_tier || 'unknown', cuisine_clean: a.cuisine_clean || null, types: a.types || [] }
    })

    setItems(prev => prev.concat(enriched))
  }, [])

  // When user picks a location from search, pan + zoom map to it (~3 mi radius)
  const handleNearbySelect = useCallback(({ lat, lng, name }) => {
    setNearbyLocation({ lat, lng, name })
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat, lng })
      mapInstanceRef.current.setZoom(13)
    }
  }, [])
  const handleNearbyClear = useCallback(() => {
    setNearbyLocation(null)
  }, [])

  // "On the way" button: if route is active, clear it. Otherwise open the planner panel.
  const handleRouteButton = useCallback(() => {
    if (routeMode) {
      setRouteMode(false)
      setRouteData(null)
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null)
        routePolylineRef.current = null
      }
      if (routeShadowRef.current) {
        routeShadowRef.current.setMap(null)
        routeShadowRef.current = null
      }
      return
    }
    setRoutePanelOpen(true)
  }, [routeMode])

  // Called by RoutePlannerPanel when user picks origin + destination + clicks Find
  const handleRoutePlan = useCallback(async ({ origin, destination }) => {
    setRoutePanelOpen(false)
    setRouteLoading(true)
    const route = await getRoute(
      { lat: origin.lat, lng: origin.lng },
      { lat: destination.lat, lng: destination.lng }
    )
    setRouteLoading(false)
    if (!route) {
      alert('Could not load route. Please try again.')
      return
    }
    setRouteData(route)
    setRouteOrigin(origin)
    setRouteDestination(destination)
    setRouteMode(true)
  }, [])

  // When routeData becomes available, draw the polyline on the map AND load restaurants along the route
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return
    // Remove old polyline
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null)
      routePolylineRef.current = null
    }
    if (routeShadowRef.current) {
      routeShadowRef.current.setMap(null)
      routeShadowRef.current = null
    }
    if (!routeData?.path) return

    // Shadow layer (slightly thicker, dark, semi-transparent) — gives the route depth
    routeShadowRef.current = new window.google.maps.Polyline({
      path: routeData.path,
      strokeColor: '#0F2C2A',
      strokeOpacity: 0.4,
      strokeWeight: 8,
      map: mapInstanceRef.current,
    })
    // Main teal line on top — slightly thinner, fully opaque, rounded caps
    routePolylineRef.current = new window.google.maps.Polyline({
      path: routeData.path,
      strokeColor: '#14B8A6',
      strokeOpacity: 1,
      strokeWeight: 5,
      map: mapInstanceRef.current,
    })

    // Fit the map to the route bounds
    const bounds = new window.google.maps.LatLngBounds()
    routeData.path.forEach(p => bounds.extend(p))
    mapInstanceRef.current.fitBounds(bounds, { top: 200, right: 40, bottom: 200, left: 40 })

    // Load restaurants along the entire route bounding box (+ 0.05° padding for the corridor edge)
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    loadRestaurantsInBounds({
      south: sw.lat() - 0.05,
      north: ne.lat() + 0.05,
      west: sw.lng() - 0.05,
      east: ne.lng() + 0.05,
    })
  }, [routeData, loadRestaurantsInBounds])

  const toggleSetFilter = (setter, currentSet, key) => {
    if (key === 'all') { setter(new Set()); return }
    const next = new Set(currentSet)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setter(next)
  }

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    )
  }, [])

  useEffect(() => {
    // Initial load: just Bay Area bounding box
    loadRestaurantsInBounds({
      south: 37.2, north: 38.0,
      west: -122.6, east: -121.6,
    })

    if (!window.google) {
      const existing = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existing) existing.addEventListener('load', () => setMapReady(true))
      else {
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=marker,places&v=weekly`
        script.async = true
        script.onload = () => setMapReady(true)
        document.head.appendChild(script)
      }
    } else {
      setMapReady(true)
    }
  }, [loadRestaurantsInBounds])

  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return
    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 37.6, lng: -121.95 },
      zoom: 10,
      gestureHandling: 'greedy',
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: {
        // RIGHT_CENTER avoids overlap with header (top) and recommendation strip (bottom).
        position: window.google.maps.ControlPosition.RIGHT_CENTER,
      },
      // mapId is required for AdvancedMarkerElement. 'DEMO_MAP_ID' uses Google's default style.
      mapId: 'DEMO_MAP_ID',
    })
    infoWindowRef.current = new window.google.maps.InfoWindow({
      pixelOffset: new window.google.maps.Size(0, -8),
    })
    mapInstanceRef.current.addListener('click', () => {
      if (infoWindowRef.current) infoWindowRef.current.close()
    })

    // Viewport-based loading: whenever the user finishes panning/zooming,
    // fetch any restaurants in the new visible area we haven't already loaded.
    // Debounce by 400ms so we don't fire mid-pan.
    let debounceTimer = null
    mapInstanceRef.current.addListener('idle', () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        const b = mapInstanceRef.current.getBounds()
        if (!b) return
        const ne = b.getNorthEast()
        const sw = b.getSouthWest()
        loadRestaurantsInBounds({
          south: sw.lat(),
          west: sw.lng(),
          north: ne.lat(),
          east: ne.lng(),
        })
      }, 400)
    })
  }, [mapReady, loadRestaurantsInBounds])

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !userLocation) return
    if (userMarkerRef.current) userMarkerRef.current.map = null

    const dot = document.createElement('div')
    dot.style.cssText = `
      width: 18px; height: 18px; border-radius: 50%;
      background: #1E88E5;
      border: 3px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    `
    userMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
      position: { lat: userLocation.lat, lng: userLocation.lng },
      map: mapInstanceRef.current,
      content: dot,
      zIndex: 9999,
      title: 'Your location',
    })
  }, [userLocation, mapReady])

  // Nearby search pin — distinct teal pulsing marker so user sees WHERE they searched
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return

    // Inject pulse keyframe once
    if (!document.getElementById('nasiha-pulse-style')) {
      const style = document.createElement('style')
      style.id = 'nasiha-pulse-style'
      style.textContent = `
        @keyframes nasiha-pulse {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `
      document.head.appendChild(style)
    }

    // Remove old pin if it exists
    if (nearbyMarkerRef.current) {
      nearbyMarkerRef.current.map = null
      nearbyMarkerRef.current = null
    }
    if (!nearbyLocation) return

    // Build wrapper with pulse halo + solid center — sized large for visibility
    const wrap = document.createElement('div')
    wrap.style.cssText = 'position: relative; width: 48px; height: 48px; pointer-events: none;'
    wrap.innerHTML = `
      <div style="
        position: absolute; inset: 0; border-radius: 50%;
        background: rgba(20, 184, 166, 0.4);
        animation: nasiha-pulse 1.6s ease-out infinite;
      "></div>
      <div style="
        position: absolute; top: 12px; left: 12px; width: 24px; height: 24px; border-radius: 50%;
        background: #14b8a6; border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      "></div>
    `

    nearbyMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
      position: { lat: nearbyLocation.lat, lng: nearbyLocation.lng },
      map: mapInstanceRef.current,
      content: wrap,
      zIndex: 9998,
      title: nearbyLocation.name || 'Searched location',
    })
  }, [nearbyLocation, mapReady])

  const cuisines = ['all', ...new Set(items.map(i => i.cuisine_clean).filter(Boolean))].sort((a, b) => {
    if (a === 'all') return -1
    if (b === 'all') return 1
    return a.localeCompare(b)
  })

  const filtered = useMemo(() => {
    // Apply chip filters first
    let base = items.filter(item => {
      if (tierFilter.size > 0 && !tierFilter.has(item.halal_tier)) return false
      if (typeFilter.size > 0 && !(item.types || []).some(t => typeFilter.has(t))) return false
      if (cuisineFilter.size > 0 && !cuisineFilter.has(item.cuisine_clean)) return false
      return true
    })
    // Then narrow by route corridor if in "on the way" mode
    if (routeMode && routeData?.path) {
      base = filterRestaurantsAlongRoute(base, routeData.path, corridorMiles)
    }
    return base
  }, [items, tierFilter, typeFilter, cuisineFilter, routeMode, routeData, corridorMiles])

  // Diff-based marker rendering: only create new markers, only remove markers no longer needed.
  // Crucial for performance — destroying + recreating hundreds of markers on every pan is what was causing the jank.
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return

    // Initialize the marker store on first run
    if (!mapInstanceRef.current._markersById) {
      mapInstanceRef.current._markersById = new Map()
    }
    const store = mapInstanceRef.current._markersById

    // Build a set of IDs that should be visible now
    const wantedIds = new Set()
    filtered.forEach(r => {
      if (r.display_lat && r.display_lng) wantedIds.add(r.id)
    })

    // 1. Remove markers no longer in the filtered set
    for (const [id, entry] of store) {
      if (!wantedIds.has(id)) {
        entry.marker.map = null
        store.delete(id)
      }
    }

    // 2. Add markers for new IDs only; update item ref for existing ones (so detour_miles refreshes on route toggle)
    filtered.forEach(r => {
      if (!r.display_lat || !r.display_lng) return
      if (store.has(r.id)) {
        // Refresh stored item so click handler shows current detour data
        store.get(r.id).item = r
        return
      }

      // Build pin as a styled div. AdvancedMarker renders HTML elements (fast) vs SVG paths (slow).
      const pin = document.createElement('div')
      pin.style.cssText = `
        width: 14px; height: 14px; border-radius: 50% 50% 50% 0;
        background: ${colors.brand};
        border: 1.5px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        transform: rotate(-45deg);
        cursor: pointer;
      `

      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        position: { lat: r.display_lat, lng: r.display_lng },
        map: mapInstanceRef.current,
        title: r.name,
        content: pin,
        zIndex: 1,
      })
      marker.addListener('click', () => {
        if (!infoWindowRef.current) return
        // Read current item from store so it reflects latest detour_miles
        const current = store.get(r.id)?.item || r
        const initialHtml = buildInfoHtml(current, userLocation, current.detour_miles, null /* loading time */)
        infoWindowRef.current.setContent(initialHtml)
        infoWindowRef.current.open({ anchor: marker, map: mapInstanceRef.current })
        setTimeout(() => {
          document.querySelectorAll('[data-rest-detail]').forEach(link => {
            link.onclick = (e) => {
              e.preventDefault()
              navigate(link.getAttribute('data-rest-detail'))
            }
          })
        }, 0)

        // In route mode: fetch precise detour time via Directions API with waypoint.
        // Read state from a ref so we get the LATEST values (closures capture stale state).
        const rs = routeStateRef.current
        if (rs.active && rs.origin && rs.destination && rs.baseTime) {
          getRouteWithWaypoint(rs.origin, rs.destination, { lat: current.display_lat, lng: current.display_lng })
            .then(res => {
              if (!res?.total_min) return
              const detourMin = res.total_min - rs.baseTime
              const updated = buildInfoHtml(current, userLocation, current.detour_miles, detourMin)
              infoWindowRef.current.setContent(updated)
              setTimeout(() => {
                document.querySelectorAll('[data-rest-detail]').forEach(link => {
                  link.onclick = (e) => {
                    e.preventDefault()
                    navigate(link.getAttribute('data-rest-detail'))
                  }
                })
              }, 0)
            })
            .catch(err => console.error('[detour] error:', err))
        }
      })
      store.set(r.id, { marker, item: r, pin })
    })
  }, [filtered, mapReady, userLocation, navigate])

  // Active recommendation highlight — only mutates the affected pin elements directly (no marker recreation)
  const prevActiveIdRef = useRef(null)
  useEffect(() => {
    if (!mapInstanceRef.current?._markersById) return
    const store = mapInstanceRef.current._markersById

    // In route mode, don't highlight the active rec pin in blue — keep all pins uniform orange.
    // Also reset any previously-highlighted pin back to default.
    if (routeMode) {
      if (prevActiveIdRef.current) {
        const prev = store.get(prevActiveIdRef.current)
        if (prev?.pin) {
          prev.pin.style.background = colors.brand
          prev.pin.style.width = '14px'
          prev.pin.style.height = '14px'
          prev.pin.style.borderWidth = '1.5px'
          prev.marker.zIndex = 1
        }
      }
      prevActiveIdRef.current = null
      return
    }

    // Restore the previous active pin to default style
    if (prevActiveIdRef.current && prevActiveIdRef.current !== activeRecId) {
      const prev = store.get(prevActiveIdRef.current)
      if (prev?.pin) {
        prev.pin.style.background = colors.brand
        prev.pin.style.width = '14px'
        prev.pin.style.height = '14px'
        prev.pin.style.borderWidth = '1.5px'
        prev.marker.zIndex = 1
      }
    }

    // Highlight the new active pin
    if (activeRecId) {
      const curr = store.get(activeRecId)
      if (curr?.pin) {
        curr.pin.style.background = '#0288D1'
        curr.pin.style.width = '20px'
        curr.pin.style.height = '20px'
        curr.pin.style.borderWidth = '2.5px'
        curr.marker.zIndex = 9000
      }
    }
    prevActiveIdRef.current = activeRecId
  }, [activeRecId, routeMode])

  // When the active recommendation changes, pan the map to it
  useEffect(() => {
    if (!mapInstanceRef.current || !activeRecId) return
    const entry = mapInstanceRef.current._markersById?.get(activeRecId)
    if (entry?.item?.display_lat && entry?.item?.display_lng) {
      mapInstanceRef.current.panTo({ lat: entry.item.display_lat, lng: entry.item.display_lng })
    }
  }, [activeRecId])

  // Stable callback for the strip's onActiveChange — prevents re-render loops
  const handleActiveRec = useCallback((r) => {
    setActiveRecId(r?.id || null)
  }, [])

  const recenterToUser = () => {
    if (!mapInstanceRef.current || !userLocation) return
    mapInstanceRef.current.panTo({ lat: userLocation.lat, lng: userLocation.lng })
    mapInstanceRef.current.setZoom(13)
  }

  const goBackToList = () => {
    const qs = searchParams.toString()
    navigate(qs ? `/restaurants?${qs}` : '/restaurants')
  }

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Map fills full background */}
      <div ref={mapRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Header — sunset gradient, translucent (85%), rounded lip */}
      <div style={{
        position: 'relative', zIndex: 4,
        background: headerGradient,
        opacity: 0.85,
        padding: '48px 16px 18px',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <button onClick={goBackToList} style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A', background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1C2B3A', margin: 0 }}>🍽️ Restaurants</h1>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#3A4A5A', fontWeight: 600 }}>{filtered.length} of {items.length}</div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <FilterDropdown
            label="Halal Type"
            options={HALAL_TIERS.filter(t => t.key !== 'all')}
            selected={tierFilter}
            onChange={setTierFilter}
            accentColor={colors.brand}
          />
          <FilterDropdown
            label="Category"
            options={TYPES.filter(t => t.key !== 'all')}
            selected={typeFilter}
            onChange={setTypeFilter}
            accentColor={colors.deep}
          />
          <FilterDropdown
            label="Cuisine"
            options={cuisines.filter(c => c !== 'all').map(c => ({ key: c, label: c }))}
            selected={cuisineFilter}
            onChange={setCuisineFilter}
            accentColor="#1C2B3A"
          />
        </div>

        <div style={{ marginBottom: 8 }}>
          <LocationSearch
            variant="map"
            placeholder="Search nearby address, city, place..."
            currentLabel={nearbyLocation?.name}
            onSelect={handleNearbySelect}
            onClear={handleNearbyClear}
          />
        </div>

        {/* "On the way" toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleRouteButton}
            disabled={routeLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: routeMode ? '#0EA5A0' : 'white',
              color: routeMode ? 'white' : '#1C2B3A',
              border: routeMode ? 'none' : '1px solid rgba(0,0,0,0.12)',
              borderRadius: 999, padding: '7px 12px',
              fontSize: 12, fontWeight: 700,
              cursor: routeLoading ? 'wait' : 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              whiteSpace: 'nowrap',
              opacity: routeLoading ? 0.7 : 1,
            }}
          >
            🚗 {routeLoading ? 'Loading…' : routeMode ? `On the way (${routeData?.duration_min || '?'} min)` : 'On the way'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ display: 'inline-flex', background: 'white', borderRadius: 12, padding: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
            <button onClick={goBackToList} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'transparent', color: '#3A4A5A', whiteSpace: 'nowrap' }}>☰ List</button>
            <button style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#1C2B3A', color: 'white', whiteSpace: 'nowrap' }}>🗺️ Map</button>
          </div>
        </div>
      </div>

      {/* Route planner panel — overlay below the header when open */}
      {routePanelOpen && (
        <div style={{
          position: 'absolute', top: 200, left: 16, right: 16, zIndex: 10,
          maxWidth: 400, margin: '0 auto',
        }}>
          <RoutePlannerPanel
            userLocation={userLocation}
            initialOrigin={nearbyLocation ? { ...nearbyLocation, kind: 'search' } : null}
            corridorMiles={corridorMiles}
            onCorridorChange={setCorridorMiles}
            onPlan={handleRoutePlan}
            onClose={() => setRoutePanelOpen(false)}
          />
        </div>
      )}

      {/* Recenter button — bottom-left, above bottom nav */}
      {userLocation && (
        <button onClick={recenterToUser} style={{
          position: 'absolute', bottom: 180, left: 16, zIndex: 5,
          background: 'white', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 999,
          padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#1C2B3A',
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>Recenter</button>
      )}

      {/* Recommendation strip — overlay at bottom, above bottom nav.
          Wrapper is pointer-events:none so it doesn't block map drag; child re-enables. */}
      <div style={{ position: 'absolute', bottom: 80, left: 0, right: 0, zIndex: 5, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>
          <RecommendationStrip
            items={filtered}
            userLocation={nearbyLocation || userLocation}
            onCardTap={(r) => r.url_slug && navigate(`/restaurants/${r.url_slug}`)}
            onActiveChange={handleActiveRec}
            variant="map"
          />
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
