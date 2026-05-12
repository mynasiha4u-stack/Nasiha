/**
 * Route corridor utilities.
 *
 * Given a Google Directions result (a polyline of {lat, lng} points along the route),
 * determine which restaurants are "on the way" — within a corridor of N miles around
 * the route.
 */

// Haversine distance in miles
function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3959 // earth radius in miles
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Distance from a single point to the nearest point on the route polyline.
 * Cheap approximation: just measures distance to every polyline point and returns min.
 * Good enough since polylines have many densely-sampled points.
 */
export function pointToRouteMiles(lat, lng, routePath) {
  if (!routePath || routePath.length === 0) return Infinity
  let min = Infinity
  for (let i = 0; i < routePath.length; i++) {
    const p = routePath[i]
    const d = distanceMiles(lat, lng, p.lat, p.lng)
    if (d < min) min = d
  }
  return min
}

/**
 * Filter restaurants to those within `radiusMiles` of the route.
 * Returns the filtered restaurants annotated with `detour_miles`.
 */
export function filterRestaurantsAlongRoute(restaurants, routePath, radiusMiles = 2) {
  if (!routePath || routePath.length === 0) return []
  return restaurants
    .map(r => {
      if (!r.display_lat || !r.display_lng) return null
      const d = pointToRouteMiles(r.display_lat, r.display_lng, routePath)
      if (d > radiusMiles) return null
      return { ...r, detour_miles: d }
    })
    .filter(Boolean)
    .sort((a, b) => a.detour_miles - b.detour_miles)
}

/**
 * Get driving route(s) from Google Directions API.
 * Returns an array of routes: [{ path, duration_min, distance_mi, summary }, ...]
 * (Up to 3 alternatives when alternatives:true.)
 *
 * Returns null on failure, or single-route array if alternatives not requested.
 */
export function getRoute(origin, destination, { alternatives = true } = {}) {
  return new Promise((resolve) => {
    if (!window.google?.maps?.DirectionsService) {
      console.warn('[getRoute] DirectionsService not loaded')
      return resolve(null)
    }
    const service = new window.google.maps.DirectionsService()
    service.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: 'DRIVING',
        provideRouteAlternatives: alternatives,
      },
      (result, status) => {
        if (status !== 'OK' || !result.routes?.length) {
          console.warn('[getRoute] failed:', status)
          return resolve(null)
        }
        const routes = result.routes.map((route, i) => {
          const leg = route.legs?.[0]
          const path = (route.overview_path || []).map(p => ({ lat: p.lat(), lng: p.lng() }))
          return {
            id: i,
            path,
            duration_min: leg ? Math.round(leg.duration.value / 60) : null,
            distance_mi: leg ? leg.distance.value / 1609.34 : null,
            // 'summary' is something like "I-280 N" or "El Camino Real"
            summary: route.summary || `Route ${i + 1}`,
          }
        })
        resolve(routes)
      }
    )
  })
}

/**
 * Get total route duration when adding a stop at `waypoint`.
 * Returns total duration in minutes (origin → waypoint → destination), or null on failure.
 */
export function getRouteWithWaypoint(origin, destination, waypoint) {
  return new Promise((resolve) => {
    if (!window.google?.maps?.DirectionsService) return resolve(null)
    const service = new window.google.maps.DirectionsService()
    service.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        waypoints: [{ location: { lat: waypoint.lat, lng: waypoint.lng }, stopover: true }],
        travelMode: 'DRIVING',
      },
      (result, status) => {
        if (status !== 'OK' || !result.routes?.length) {
          console.warn('[getRouteWithWaypoint] failed:', status)
          return resolve(null)
        }
        // Sum all legs (there will be 2: origin→waypoint, waypoint→destination)
        const totalSec = (result.routes[0].legs || []).reduce((s, leg) => s + leg.duration.value, 0)
        resolve({ total_min: Math.round(totalSec / 60) })
      }
    )
  })
}
