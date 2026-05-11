/**
 * Home address storage — saves user's "Home" location to localStorage.
 * Eventually this should be per-user when auth is in place.
 */

const HOME_KEY = 'nasiha_home_v1'

export function getHome() {
  try {
    const raw = localStorage.getItem(HOME_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.lat || !parsed?.lng || !parsed?.name) return null
    return parsed
  } catch {
    return null
  }
}

export function setHome({ lat, lng, name }) {
  if (!lat || !lng || !name) return false
  try {
    localStorage.setItem(HOME_KEY, JSON.stringify({ lat, lng, name }))
    return true
  } catch {
    return false
  }
}

export function clearHome() {
  try {
    localStorage.removeItem(HOME_KEY)
    return true
  } catch {
    return false
  }
}
