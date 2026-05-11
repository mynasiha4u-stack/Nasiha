/**
 * Saved places storage.
 *
 * Each saved place: { id, label, name, lat, lng }
 *   - id: stable string ('home', or a random id for others)
 *   - label: user-given name shown on chip ("Home", "Work", "Mosque")
 *   - name: full place name from autocomplete ("123 Main St, Fremont CA")
 *   - lat, lng: coords
 *
 * 'home' is a reserved id with special UX (defaults to first chip, etc).
 */

const KEY = 'nasiha_places_v1'
const LEGACY_HOME_KEY = 'nasiha_home_v1'

function readAll() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      // Migrate from old single-Home key if present
      const legacy = localStorage.getItem(LEGACY_HOME_KEY)
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy)
          if (parsed?.lat && parsed?.lng && parsed?.name) {
            const migrated = [{ id: 'home', label: 'Home', name: parsed.name, lat: parsed.lat, lng: parsed.lng }]
            localStorage.setItem(KEY, JSON.stringify(migrated))
            return migrated
          }
        } catch {}
      }
      return []
    }
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

export function getPlaces() {
  return readAll()
}

export function getHome() {
  return readAll().find(p => p.id === 'home') || null
}

export function getPlace(id) {
  return readAll().find(p => p.id === id) || null
}

/**
 * Add or update a place. If id is omitted, generates a random id.
 * If label is "Home" or id is "home", forces id='home' (only one Home allowed).
 */
export function savePlace({ id, label, name, lat, lng }) {
  if (!label || !name || lat == null || lng == null) return null
  const places = readAll()
  let finalId = id
  if (label.toLowerCase() === 'home' || id === 'home') {
    finalId = 'home'
  }
  if (!finalId) {
    finalId = 'p_' + Math.random().toString(36).slice(2, 10)
  }
  const idx = places.findIndex(p => p.id === finalId)
  const next = { id: finalId, label: label.trim(), name, lat, lng }
  if (idx >= 0) places[idx] = next
  else places.push(next)
  writeAll(places)
  return next
}

export function deletePlace(id) {
  const places = readAll().filter(p => p.id !== id)
  return writeAll(places)
}
