# Nasiha — Project Context for Claude

## What is this?
Bay Area Muslim community directory app. "The guide for Muslim life."

## Stack
- React (localhost:3000 dev) at ~/Desktop/mynasiha
- Supabase: project `puymhxfhoqryxnjubryw` (West US), anon key in `.env`
- GitHub: `mynasiha4u-stack/Nasiha` (main branch)
- Vercel: deployment pending (next major milestone)
- Google Maps API key: `REACT_APP_GOOGLE_MAPS_API_KEY` in `.env`

## Pages Built
- `/` — Home (category tiles, events, mosques)
- `/jummah` — 70 mosques, Jummah/Iqama times, list + map
- `/jummah/:slug` — Mosque detail
- `/events` — Events (6 mosque iCal feeds)
- `/events/:slug` — Event detail
- `/events/map` — Events map
- `/childcare` — 40 listings, search, area filter, list + map
- `/childcare/:slug` — Childcare detail
- `/childcare/map` — Childcare map
- `/map` — Main map with category filters
- `/admin` — Add events and mosques

## Shared Components
- `src/components/ListingDetail.js` — standard detail page for ALL categories
- `src/components/BottomNav.js` — Home + Map only
- `src/theme.js` — ALL colors, gradients, spacing. Never hardcode colors.

## Design System (src/theme.js)
- `colors.brand` = `#C2410C` — buttons, active states, CTAs
- `colors.deep` = `#1C2B3A` — dark surfaces
- `colors.surface` = `#FAF7F2` — page background
- `headerGradient` — warm Asr sky, used on EVERY page header
- Dark text on light header backgrounds
- White cards on warm surface background

## Database (Supabase `content` table)
All listings share one `content` table with `category_id`.
Key category IDs:
- Mosques: `b7c8a7cb-082f-46e6-95c2-8cfaddbdc50c`
- Events: `d916a550-c316-40a9-9582-35836417b6cb`
- Childcare: look up via `SELECT id FROM categories WHERE slug = 'childcare'`
- Restaurants: look up via `SELECT id FROM categories WHERE slug = 'restaurants'`

## iCal Event Feeds (sync via `node sync-events.js`)
- MCC East Bay, ICF Fremont, SRVIC San Ramon, WVMA Los Gatos
- MCA Santa Clara (Google Cal), Lamorinda (Google Cal)

## DB Counts
- Mosques: 70 | Home cooks: 85 | Desserts/catering: 61
- Childcare: 40 | Event services: 41 | Islamic schools: 40
- Restaurants: 24 (need more — KML import pending)
- Lawyers: 19

## Nas's Preferences (IMPORTANT)
- One instruction at a time
- No browser control unless absolutely necessary
- Never wipe data without explicit confirmation
- Never run SQL without showing the file first
- Show git diffs before pushing when making big changes

## Pending / Vault
- KML import: 2000+ halal restaurants from community Google Map
- Vercel deployment + automatic iCal cron job
- Nearest to me sorting on Childcare and Restaurants
- Directions button on all listing pages
- Home cooks page, Schools page, Lawyers page
- Event pictures backfill (MCC uses JS rendering)
- AI event classification (Claude Haiku, ~$0.0002/event)
- Screenshot-to-event tool at /admin/events
