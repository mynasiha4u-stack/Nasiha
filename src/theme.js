/**
 * NASIHA DESIGN SYSTEM
 * Maghrib/Asr sunset palette — 4 colors + neutrals only
 * 
 * RULES:
 * - Dark surface → white text
 * - Light surface → deep text
 * - Brand gradient on every page header
 * - Cards are always white
 * - Tiles are all the same — icon does the work, not the color
 */

export const colors = {
  // Core 4
  brand:   '#C2410C',  // Burnt orange — primary CTA, active states
  deep:    '#1C2B3A',  // Deep navy — nav, dark text, dark surfaces
  warm:    '#EA580C',  // Warm orange — accent, highlights
  surface: '#FAF7F2',  // Creamy warm off-white — page background

  // Neutrals
  card:    '#FFFFFF',
  border:  'rgba(0,0,0,0.07)',
  textPrimary:   '#1C2B3A',
  textSecondary: '#64748B',
  textMuted:     '#94A3B8',

  // Semantic (used sparingly for map pins and type badges only)
  pinMosque:      '#C2410C',
  pinChildcare:   '#7C3AED',
  pinRestaurant:  '#059669',
  pinHomecook:    '#D97706',
  pinSchool:      '#2563EB',
  pinEvent:       '#DB2777',
}

// The one gradient — used on every page header
// Late Asr sky: soft warm blue at top, gentle peach at bottom — calm and airy
export const headerGradient = 'linear-gradient(180deg, #4a7fa5 0%, #7fb3cc 30%, #f4c18a 75%, #f0a96e 100%)'

// Same for inner pages
export const subheaderGradient = 'linear-gradient(180deg, #4a7fa5 0%, #7fb3cc 30%, #f4c18a 75%, #f0a96e 100%)'

// Compressed warm gradient — for short map-page headers
// Skips the blue portion so the header feels harmonious with the warmer bottom of list-page headers
export const mapHeaderGradient = 'linear-gradient(180deg, #f7d4a8 0%, #f4c18a 50%, #f0a96e 100%)'

// Typography scale
export const text = {
  xs:   { fontSize: 11, lineHeight: 1.4 },
  sm:   { fontSize: 13, lineHeight: 1.5 },
  base: { fontSize: 15, lineHeight: 1.6 },
  lg:   { fontSize: 17, lineHeight: 1.4 },
  xl:   { fontSize: 20, lineHeight: 1.3 },
  xxl:  { fontSize: 26, lineHeight: 1.2 },
}

// Spacing
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
}

// Card style — used for all cards everywhere
export const card = {
  background: colors.card,
  borderRadius: radius.lg,
  border: `1px solid ${colors.border}`,
  marginBottom: 12,
}

// Standard page header style
export const pageHeader = (extraPadding = 0) => ({
  background: headerGradient,
  padding: `${52 + extraPadding}px 20px 20px`,
})

export default { colors, headerGradient, subheaderGradient, text, radius, card, pageHeader }
