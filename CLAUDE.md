# Nasiha — Project Context for Claude

## The Vision

**Nasiha is the operating system for Muslim life.** A single place a Muslim in any metropolitan area can go to find out what's happening, who to call, where to eat, where to pray, who to hire — without joining a dozen WhatsApp groups, scrolling Facebook groups, or asking around. A community hub and knowledge graph that brings together the disparate signals already in the community and surfaces them in one trusted place.

**Two layers, both essential:**
1. **Browse layer** — structured listings (restaurants, mosques, home cooks, lawyers, caterers, schools, childcare, events, future: marketplace, housing, jobs)
2. **Chat layer** — AI that knows everything in the knowledge graph and answers naturally. "Best biryani in Fremont for 6?" "Friday prayer near SFO at 1pm?" "Who can do a dessert table AND decor for a wedding?" "Any matrimonial events this weekend?"

Browse without chat = Yelp. Chat without browse = ChatGPT. Together = the differentiated product only Nasiha can build.

**The data flywheel (this is the strategy, not a side project):**
- Users submit listings (community marketplace)
- AI scraping fills the rest — WhatsApp, Instagram, Facebook groups, mosque calendars, restaurant openings, event posts
- More data → smarter chat → more users → more submissions → more data

The platform should not depend on users submitting. The goal is **automation via AI scraping**, which still needs to be built (see Vault). Users CAN submit, but the data must keep flowing whether they do or not.

## Stack
- React (`npm start` → localhost:3000) at `~/Desktop/mynasiha`
- Supabase: project `puymhxfhoqryxnjubryw` (West US), anon key in `.env`
- GitHub: `mynasiha4u-stack/Nasiha` (main branch)
- Hostinger DNS for `mynasiha.com`
- Vercel: deployment pending
- Google Maps API key: `REACT_APP_GOOGLE_MAPS_API_KEY` in `.env`
- Resend for transactional email (verified domain, sends from `notifications@mynasiha.com`)
- Beehiiv for newsletter (publication `pub_f4c7ee60-5c82-46a7-ab97-11f6ee53947c`)

## Marketplace Architecture (CRITICAL)

Nasiha is a **community marketplace, not a curated directory.** Anyone signs up and submits in any category. Every submission emails Nas with approve/reject. Nas is superuser. Existing seeded listings owned by Nas.

- Auth: Supabase email/password (Google OAuth skipped for now)
- Submissions: status `pending` → admin reviews → `published` or `rejected`
- Admin email: `mynasiha4u@gmail.com`, user_id `27c3e4a0-bf91-4071-af28-e4ac39ca7e25`
- Future architecture (designed but not built): featured placements, paid promos, reviews (community + MyNasiha curated picks), payments, housing & jobs categories

## Pages Built
- `/` — Home (category tiles, upcoming events carousel)
- `/auth` — Two-step sign in / sign up flow (email-first, adapts based on existing user state)
- `/account` — Hub: My Listings + Admin Review (admins only) + Email Prefs + Profile
- `/account/profile`, `/account/email` — Settings
- `/admin/review` — Admin queue: approve/reject submissions, fires Resend email
- `/submit` — Submit a listing (category-aware, supports `?cat=X`, `?edit=ID`, `?duplicate=ID`)
- `/my-listings` — User's submissions: edit / pause / duplicate / share / delete
- `/restaurants` + `/restaurants/:slug` + `/restaurants/map`
- `/jummah` + `/jummah/:slug` + `/jummah/map`
- `/events` + `/events/:slug` + `/events/map`
- `/childcare` + `/childcare/:slug` + `/childcare/map`
- `/lawyers` + `/lawyers/:slug`
- `/full-time-islamic-schools` + `/full-time-islamic-schools/:slug`
- `/desserts-catering-event-planning` + `/:slug` — Combined catering + desserts via tags column
- `/home-cooked-food-catering` + `/:slug` — Home cooks (needs feature-parity rebuild — see Active Work)
- `/map` — Main map with category filters

## Current DB Counts (approximate)
- **Restaurants: ~24 imported + 6,916 in KML pending import = ~7,000 target**
- Home cooks: 85 (65 published, 20 draft)
- Mosques: 70 | Childcare: 40 | Islamic schools: 40 | Lawyers: 19
- Desserts/catering + event services: 102 (merged via tags after Migration 5)
- Events: live from iCal feeds, refreshed daily
- Total content rows: 7,527+

## Shared Components — REUSE, DO NOT REINVENT
- `src/components/ListingDetail.js` — standard detail page for ALL categories
- `src/components/BottomNav.js` — Home / Map / Submit / Account
- `src/components/TopBar.js` — logo + avatar menu
- `src/components/FilterDropdown.js` — multi-select dropdown (Restaurants, EventPlanning, HomeCooks)
- `src/components/AddListingButton.js` — "+ Add a [type]" pill on every category page header
- `src/components/ImageUpload.js` — Supabase storage upload, 5MB max
- `src/lib/imageUrl.js` — shared `isValidImageUrl()` (Home + Events both use it)
- `src/lib/AuthContext.js` — auth state and helpers
- `src/theme.js` — ALL colors, gradients, spacing. **Never hardcode colors.**

## Design System
- `colors.brand` = `#C2410C` — buttons, active states, CTAs
- `colors.deep` = `#1C2B3A` — dark surfaces, primary text, logo color
- `colors.surface` = `#F7F3EE` — page background (some pages use `#FAF7F2`)
- `headerGradient` — warm Asr sky, on EVERY page header
- Dark text on light header backgrounds. White cards on warm surface background.
- Tag chips: `#E0F7F5` background, `#0F766E` text, 10-11px font, weight 700, radius 999px
- Button labels: "Log in" / "Sign up" (never "Sign in")
- Logo: 32px, weight 900, navy `#1C2B3A`, letter-spacing -1
- Headers should be navigation-only (TopBar + back button + AddListingButton)
- Avoid cream-on-cream blending
- No duplicate info between card sections

## Consistency Rules (DO NOT VIOLATE)
**Before building any new UI element, check if it already exists.** Inconsistency is the #1 user complaint.
- Filter dropdowns → `FilterDropdown` component (white pill → brand-orange when active, multi-select with checkboxes)
- Search bars → white pill with 12px radius border, 🔍 icon, "Search [thing]..." placeholder
- Headers → `padding: '48px 20px 22px'`, `headerGradient` background, h1 `fontSize: 24, fontWeight: 800`
- Back button → rounded white pill, `← Back` or `← [PreviousPage]`
- Add listing → `AddListingButton` component, in the row next to ← Back
- Tag chips on cards → teal style above
- Instagram icon → gradient IG pill (not generic 📷 emoji)
- **When in doubt: copy Restaurants pattern**

## Database (Supabase `content` table)
All listings share one `content` table with `category_id`. Key columns:
- `name, description, address, display_lat, display_lng, image_url, url_slug`
- `phone, email, website, instagram, facebook, whatsapp`
- `category_id, status` (`draft` | `pending` | `published` | `rejected`)
- `owner_id` (auth.users), `submitted_by`, `submitted_at`, `reviewed_at`, `review_notes`
- `tags TEXT[]` (Migration 5) — multi-category labels (e.g. ['desserts', 'event-services'])
- `featured BOOLEAN` — drives "MyNasiha Pick" surface (planned)
- `location_area` — Peninsula / East Bay / South Bay / Fremont / etc.
- `service_area` — TBD, planned for home cooks (text describing cities they serve)

Related tables:
- `categories` — slug, name
- `attributes` — content_id, attribute_name, attribute_value (key/value tags: cuisine, event_type, etc.)
- `user_profiles` — display_name, is_admin, notify_on_review, newsletter_subscribed, beehiiv_subscriber_id, has_password
- `auth.users` — managed by Supabase Auth
- (Future) `chat_conversations`, `chat_messages`, `reviews`

## Mosque Jummah Times — Specific Rules
- **Official mosque websites only** as source. Never Yelp, Facebook, or third-party aggregators.
- DST auto-flip handled in code, no user toggle. Times are NOT labeled "winter/summer" to users.
- A per-mosque winter/summer Jummah and Iqama CSV exists for verification.
- Correction guideline (not absolute): pre-1 PM times shift +1hr in summer; at/after 1 PM often stay the same. Each mosque verified individually.

## iCal Event Feeds (sync via `node sync-events.js`, daily 6 AM Pacific via GitHub Actions)
MCC East Bay, ICF Fremont, SRVIC San Ramon, WVMA Los Gatos (iCal); MCA Santa Clara, Lamorinda (Google Cal)

## Edge Functions (deployed via Supabase dashboard "Via editor")
- `subscribe-newsletter` — creates Supabase user (no password) + Beehiiv subscribe with `reactivate_existing: true`, `send_welcome_email: true`
- `check-email` — two-step auth (returns `not_found` / `subscriber_no_password` / `full_user`)
- `send-notification-email` — fires on admin approve/reject, Resend templates respect `notify_on_review` preference

## Supabase Secrets Set
- `RESEND_API_KEY` — Resend, domain verified for `mynasiha.com`
- `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)
- **NOT yet set:** `ANTHROPIC_API_KEY` (needed for chat — create at console.anthropic.com → API Keys)

## Storage
- Bucket `listing-images` — 5MB max per upload, public SELECT, authenticated INSERT/DELETE namespaced to `user.id`

## Pending SQL Migrations (not yet run by Nas)
- `migration_5_tags_and_merge.sql` — adds `tags TEXT[]` column, backfills from category slugs, merges 66Strawberries + Ladle n Wok duplicates with combined detailed descriptions tagged `['desserts', 'event-services']`
- `migration_6_homecook_attributes.sql` — backfills 123 cuisine/service tags for 83 home cooks from CSV `filters` column
- `migration_step2_drop_old_columns.sql` — drops legacy `location_address` / `location_area` columns. **Deferred — do not run until verified safe.**

## Working Preferences (CRITICAL)
- **One step at a time.** No multi-step sequences. Each instruction is one literal action.
- **No browser control** (Nas doesn't use it)
- **Yes/no or click-this style** when guiding through UIs
- **Show files / SQL before running** — never auto-execute destructive operations
- **Show git diffs or summarize file changes** before pushing big rewrites
- **Audit data BEFORE building.** If building a category page, first check what columns are actually filled in. Don't build features the data can't support.
- **Iterative** — Nas works hands-on in the codebase, `git pull` between sessions
- **When stuck on a design choice**, propose 2-3 options with a recommendation, let Nas pick
- **Match existing patterns. Don't reinvent components.** Inconsistency is the #1 complaint.
- Default to simpler solutions when given a choice
- Nas pushes back hard on overengineering — listen

## What's Pending Right Now (Active Work)

### Home Cooks page — half built, needs feature-parity rebuild
- Add `service_area` column to content, backfill existing 83 from `location_area`
- Featured / MyNasiha Pick section at top using `featured` boolean
- All contact info on cards (phone/email/website/IG/FB/WhatsApp — graceful degradation)
- A-Z sort + Featured sort (**no map / distance** — home cooks don't have addresses by design for privacy)
- Submit form: Google Places picker for service area on new submissions
- Strip "Delivery Offered: No. On Site Prep: No." trailing text from description preview on cards (info already in tag pills)

### Chat — the headline feature (next major build)
- pgvector extension on Supabase + embeddings for all ~7,500 listings
- Hybrid retrieval: keyword (Postgres full-text) + vector (semantic)
- Start with **Haiku 4.5** (~$0.002/turn, cheapest current-gen), easy swap to Sonnet/Opus if needed
- Edge Function `chat-completion`: search Supabase → build context → call Anthropic API → stream response
- UI: floating chat button on every page + dedicated `/chat` route + Event Planning page primer ("Tell me about your event and I'll help")
- Conversation history saved for logged-in users (new `chat_conversations` + `chat_messages` tables)
- System prompt: Nasiha persona, restrict to listings in knowledge graph, warm helpful tone, never invent details

## Vault (Future Builds, in rough priority order)

### AFTER chat — biggest feature, NOT YET BUILT
**Scraping pipeline / data automation.** This is the missing strategic piece. Without it, Nasiha depends on user submissions which is fragile. With it, the knowledge graph grows on its own. **Nas has NOT built this yet — needs to be built.**

To build:
- **WhatsApp scraping** — community group messages → new events, recommendations, openings
- **Instagram scraping** — vendor posts, food pics → home cooks, new restaurants, event flyers
- **Facebook group scraping** — Bay Area Muslim groups, classifieds, event invites
- **Restaurant freshness pipeline** — track new openings, closures, hours changes (the continuous-update problem)
- **Review aggregation** — Yelp/Google reviews → imported reviews (low weight in chat)
- **AI normalization** — Claude classifies, dedupes, geocodes scraped content before it hits the knowledge graph

Architecture options being considered:
- (A) Collaborate with friend Imran ("Halal Maniacs" pipeline: Firecrawl + Apify + Google Maps Scraper + Python)
- (B) Build own pipeline ($50-200/mo infra)
- (C) Contractor
- (D) User submissions + "Report incorrect info" (short-term only)

Plan: D + A short-term, B/C medium-term. Pick up post soft-launch.

### Reviews system
- Three review types: `community` (regular users), `mynasiha_pick` (curated by Nas + trusted friend, weighted heavily in chat), `imported` (Yelp/Google scraped, low weight)
- Pinned reviews on detail pages, "MyNasiha Pick" badges
- Feeds chat context — system prompt weights `mynasiha_pick` reviews strongly
- Schema: `reviews (id, content_id, author_id, review_type, rating, title, body, is_featured, created_at)`

### Screenshot-to-event AI tool — `/admin/events`
MVP for seeding event data without scraping infrastructure. Paste Instagram/Facebook flyer image → Claude extracts date/time/venue/host/description → preview → approve & save.

### Registration link detection
Auto-detect Google Forms, Eventbrite, Luma URLs in iCal event descriptions → render as "Register" button on event detail.

### Categories yet to build
- **Marketplace** — community-listed goods, services (separate from event vendors)
- **Housing** — apartments, rooms, Muslim-friendly landlords
- **Jobs** — Muslim-friendly employers, community job posts

### KML import — 6,916 halal restaurants
Source: `/mnt/user-data/uploads/Halal_Map.kml`. Big import job, needs dedup against existing 24 restaurants, geocode validation, attribute extraction.

### Vercel deployment + `mynasiha.com` public launch
- DNS records ready in Hostinger
- Soft launch to trusted friends first

### Metro / URL refactor (deferred until 2nd metro of data exists)
- Refactor all category URLs to `/{metro}/{category}` pattern
- Metro picker in top-left of home (where weather pill currently is)
- ~2-3 hours of work when ready
- Most categories lack a `metro` field yet (only restaurants have one)

### Other parked items
- **Beehiiv welcome email broken** — subscribe flow works, double-opt-in works, but welcome email not arriving even with toggle ON. Debug post-launch.
- **Edit listing tag editing UI** — SubmitListing `?edit=ID` works but doesn't save the `tags` array yet
- **Mosque "system users"** — each mosque gets a fake user account so iCal events have proper ownership; future, mosques can claim their accounts
- **PostHog analytics** — free tier 1M events/mo, session recordings + heatmaps + funnels. Build AFTER chat.
- **"Sign up to contact" gating** — apply to lawyers, catering, home cooks (skip restaurants, events, jummah, schools)
- **GCP/Google Maps caching** — prior billing incident from unoptimized geocoding (no caching, no domain restriction). Permanent fix: cache geocoding in DB + restrict API key to nasiha domain.
- **Individual SEO URLs** for every listing (e.g., `nasiha.com/jummah/mcc-east-bay`) matching prior WordPress structure
- **"New & Notable"** section for recently opened restaurants
- **Old GitHub PAT cleanup** — token `ghp_AsAU...` was compromised, should be deleted from GitHub Settings
- **Restaurants offering catering** — Nas's view: all restaurants will say yes to a catering order. No need to tag individual restaurants. Chat layer handles "who can cater food" by querying everything.

## Notes on the Catering/Event Planning Merge
The `desserts-catering-event-planning` page queries BOTH `dessert-catering` and `event-services` categories combined. Two vendors had duplicates (one row in each category): **66Strawberries** and **Ladle n Wok** — these were merged in Migration 5 into single rows under `event-services` with combined detailed descriptions, tagged `['desserts', 'event-services']`. All other vendors keep their original single category but get a tag matching their category slug — so the knowledge graph still knows which vendors are primarily desserts vs event services.

## Recent Commits (top of main, newest first)
- `c271ca1` — Home Cooks page + Migration 6 to backfill cuisine/service tags
- `68b157d` — Add search bar to Events page (was the only one missing)
- `0c9b0b4` — EventPlanning: shorter filter labels (Type/Service/Delivery)
- `80ecda5` — EventPlanning uses FilterDropdown for consistency with Restaurants
- `f6c8e05` — Home event cards use same image logic as Events page (shared isValidImageUrl)
- `da19ebb` — Account hub + email preferences + approval/rejection emails
- `f91c78e` — Admin review dashboard at /admin/review
- `4b38931` — Newsletter integration + two-step auth flow
