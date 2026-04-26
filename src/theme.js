/**
 * Nasiha Golden Hour Design System
 * Inspired by Asr/Maghrib — the most beautiful hour
 */

export const COLORS = {
  // Core palette
  burntSienna:  '#C4500A',  // Deep sunset orange — primary action
  maghribRose:  '#8B1A4A',  // Deep rose/magenta — secondary
  deepIndigo:   '#1A2F5C',  // Night sky — dark backgrounds, text
  goldenAmber:  '#E8860A',  // Last light — highlights, CTAs
  duskPurple:   '#5C2D7A',  // Dusk purple — accents
  deepTeal:     '#0A4A5C',  // Deep teal — cool accent

  // Backgrounds
  warmWhite:    '#F7F3EE',  // Warm off-white — page background
  cardWhite:    '#FFFFFF',  // Pure white — cards

  // Text
  textDark:     '#0F1F2E',  // Near black — primary text
  textMid:      '#3A4A5A',  // Dark gray — secondary text
  textLight:    '#6A7A8A',  // Medium gray — tertiary text (use sparingly)

  // Header gradient — night sky bleeding into sunset
  headerGradient: 'linear-gradient(180deg, #1A2F5C 0%, #5C2D7A 40%, #8B1A4A 70%, #C4500A 100%)',

  // Category tile colors — rich and saturated
  tiles: {
    homeCooks:   { bg: '#8B1A4A', text: '#FFFFFF' },  // Maghrib rose
    jummah:      { bg: '#1A2F5C', text: '#FFFFFF' },  // Deep indigo
    desserts:    { bg: '#C4500A', text: '#FFFFFF' },  // Burnt sienna
    childcare:   { bg: '#5C2D7A', text: '#FFFFFF' },  // Dusk purple
    events:      { bg: '#0A4A5C', text: '#FFFFFF' },  // Deep teal
    schools:     { bg: '#1A2F5C', text: '#FFFFFF' },  // Deep indigo
    lawyers:     { bg: '#3A4A5A', text: '#FFFFFF' },  // Dark slate
    cafes:       { bg: '#8B1A4A', text: '#FFFFFF' },  // Maghrib rose
    restaurants: { bg: '#C4500A', text: '#FFFFFF' },  // Burnt sienna
    eventSvc:    { bg: '#5C2D7A', text: '#FFFFFF' },  // Dusk purple
  },

  // Event type badge colors
  eventTypes: {
    'Halaqa':          { bg: '#5C2D7A', color: '#FFFFFF' },
    'Islamic Learning':{ bg: '#1A2F5C', color: '#FFFFFF' },
    'Wellness':        { bg: '#0A4A5C', color: '#FFFFFF' },
    'Family & Kids':   { bg: '#8B1A4A', color: '#FFFFFF' },
    'Community':       { bg: '#1A2F5C', color: '#FFFFFF' },
    'Fundraiser':      { bg: '#C4500A', color: '#FFFFFF' },
    'Matrimonial':     { bg: '#5C2D7A', color: '#FFFFFF' },
    'Civic':           { bg: '#0A4A5C', color: '#FFFFFF' },
    'Arts & Culture':  { bg: '#3A4A5A', color: '#FFFFFF' },
    'Food & Drink':    { bg: '#8B1A4A', color: '#FFFFFF' },
    'Default':         { bg: '#3A4A5A', color: '#FFFFFF' },
  },

  // Filter pill active states
  filterActive:   { bg: '#1A2F5C', text: '#FFFFFF' },
  filterInactive: { bg: '#FFFFFF',  text: '#3A4A5A', border: '1px solid rgba(0,0,0,0.12)' },

  // Jummah time tiles
  jummahTile:  { bg: '#FFF0E8', border: '#C4500A', text: '#0F1F2E' },

  // Map pins
  mapPins: {
    mosques:     '#E8860A',
    childcare:   '#5C2D7A',
    restaurants: '#C4500A',
    homecooks:   '#8B1A4A',
    schools:     '#1A2F5C',
    events:      '#0A4A5C',
    default:     '#1A2F5C',
  },
}

export const HEADER_STYLE = {
  background: COLORS.headerGradient,
  padding: '52px 20px 20px',
}

export const CARD_STYLE = {
  background: COLORS.cardWhite,
  borderRadius: 16,
  border: '1px solid rgba(0,0,0,0.08)',
  padding: 16,
  marginBottom: 12,
}

export const PAGE_BG = COLORS.warmWhite
