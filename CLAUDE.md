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
- `/admin/curate` — **Nasiha editorial cockpit** (Phase 4). Admin-only. Side-by-side Claude AI enrichment vs editable Nasiha fields (nasiha_pro_tip, nasiha_must_order, nasiha_tagline_override, nasiha_tag_overrides). Has search + "Needs Review" queue sorted by Google review count DESC.
- `/chat` — **Full-page chat** (Phase 2). Floating ✨ launcher button on every page also opens a drawer with the same component. Conversation history persisted for auth users.
- `/submit` — Submit a listing (category-aware, supports `?cat=X`, `?edit=ID`, `?duplicate=ID`)
- `/my-listings` — User's submissions: edit / pause / duplicate / share / delete
- `/restaurants` + `/restaurants/:slug` + `/restaurants/map` — list cards now show street address + photos[0] lead image; detail page renders enrichment (Pro Tip box, must_order chips, vibe, signature, occasion tags); map popup includes thumbnail; halal badges intentionally NOT rendered publicly.
- `/jummah` + `/jummah/:slug` + `/jummah/map`
- `/events` + `/events/:slug` + `/events/map`
- `/childcare` + `/childcare/:slug` + `/childcare/map`
- `/lawyers` + `/lawyers/:slug`
- `/full-time-islamic-schools` + `/full-time-islamic-schools/:slug`
- `/desserts-catering-event-planning` + `/:slug` — Combined catering + desserts via tags column
- `/home-cooked-food-catering` + `/:slug` — Home cooks (Near Me + A-Z sort, ✨ MyNasiha Picks band, city-level only, no map)
- `/map` — Main map with category filters

## Current DB Counts (as of 2026-05-23)
- **Restaurants: 6,934 published total** (KML import was global — only ~390 are Bay Area; rest are Toronto, Texas, etc.)
- **Bay Area restaurants: 390** — of these, **287 enriched** (74% — Phase 4 Slice 1 + sweep); 9 sweep-failure rows in cleanup; remaining backlog ~94 not yet enriched
- **Individual review signals**: 1,465 (Google reviews stored in `signals` table)
- **Photos uploaded to Supabase Storage**: ~861 (3 per enriched restaurant)
- Home cooks: 85 (65 published, 20 draft)
- Mosques: 70 | Childcare: 40 | Islamic schools: 40 | Lawyers: 19
- Desserts/catering + event services: 102 (merged via tags after Migration 5)
- Events: live from iCal feeds, refreshed daily
- Embedded rows (`content_embeddings`): ~7,400 (everything published, re-embedded nightly via cron when source_hash changes)
- After dedup (Migration 5 + dedup-listings.js run): ~7,400 content rows total

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

**Core fields**
- `name, description, address, display_lat, display_lng, image_url, url_slug`
- `phone, email, website, instagram, facebook, whatsapp`
- `category_id, status` (`draft` | `pending` | `published` | `rejected` | `archived`)
- `owner_id` (auth.users), `submitted_by`, `submitted_at`, `reviewed_at`, `review_notes`
- `tags TEXT[]` (Migration 5) — multi-category labels
- `featured BOOLEAN` — drives "MyNasiha Pick" surface
- `location_area` — Peninsula / East Bay / South Bay / Fremont / etc.
- `service_area` — for home cooks, city only, privacy by design (Migrations 7/8/8b)
- `metro` — 'Bay Area' is the primary one
- `internal_notes` — admin notes; archive script appends archival reason here
- `jummah_times JSONB` — mosques' winter/summer time slots (s1j, s1iq, w1j, w1iq, ...)

**Phase 4 enrichment fields** (Migrations 13–16):
- `google_place_id TEXT UNIQUE` — Google Places canonical id (partial unique index where not null)
- `google_rating NUMERIC`, `google_review_count INT` — pulled at enrichment time
- `photos TEXT[]` — array of Supabase Storage URLs (up to 3 per enriched listing), pulled from Google Places Photo
- `ai_enriched_summary JSONB` — Claude-distilled review insights. Shape:
  `{ known_for_dishes: [], signature_strength, vibe, praise_themes: [], complaint_themes: [], halal_notes, occasion_tags: [], minor_tags: [], good_for_summary, based_on, confidence }`
  - `occasion_tags` drawn from fixed 13-vocab (date_night, family_with_kids, big_groups, outdoor_seating, late_night, quick_lunch, business_meeting, prayer_facilities, takeout_friendly, large_catering_orders, vegetarian_friendly, solo_friendly, cheap_eats)
- `ai_enriched_at TIMESTAMPTZ` — when distillation last ran (cron skips if source_hash unchanged)
- `halal_verification TEXT` (Migration 14) — admin-only field, NOT publicly displayed. Values: `'certified' | 'owner_confirmed' | 'sign_in_restaurant' | 'community_vouched' | 'implied' | 'unverified' | null`. Nasiha is not a halal certification body; this is internal only.

**Editorial layer fields** (Migrations 15–16) — Nasiha's own voice, admin-editable via `/admin/curate`:
- `nasiha_pro_tip TEXT` — insider tip (1–3 sentences), displayed as "💡 Nasiha Pro Tip" callout on listing
- `nasiha_must_order TEXT[]` — authoritative dish picks, displayed FIRST in "What it's known for" before Claude's known_for_dishes
- `nasiha_tagline_override TEXT` — replaces AI good_for_summary on public display when set
- `nasiha_reviewer TEXT` — internal-only contributor name (never displayed publicly)
- `nasiha_tag_overrides JSONB` — `{ force_add: [], force_remove: [] }` for correcting Claude's occasion_tags

Related tables:
- `categories` — slug, name
- `attributes` — content_id, attribute_name, attribute_value (key/value tags: cuisine, event_type, halal_tier, etc.)
- `user_profiles` — display_name, is_admin, notify_on_review, newsletter_subscribed, beehiiv_subscriber_id, has_password
- `auth.users` — managed by Supabase Auth
- `content_embeddings` (Migration 9) — `content_id, embedding VECTOR(1536), model, source_hash, embedded_at`. HNSW index on cosine ops. Re-embedded nightly when source_hash changes.
- `chat_conversations` + `chat_messages` (Migration 9) — chat history for logged-in users. RLS-gated.
- `signals` (Migration 13) — per-source individual signals (Google reviews now, Yelp/IG/WhatsApp later). UNIQUE(source, source_id). 1,465 rows currently.
- `nasiha_signature_dishes` (Migration 15) — table for future "Top Dishes in the Bay" editorial. Schema ready, public page not built yet.

Postgres functions:
- `match_content(query_embedding, query_text, match_count, category_filter, near_lat, near_lng, radius_miles)` — hybrid retrieval (vector + FTS via RRF), distance-aware. Latest version is Migration 12 (radius-first candidate selection + distance-primary sort when geo present, fixed Pakwan-missing bug).
- `get_occasion_tag_counts()` (Migration 16) — returns frequency of each occasion_tag across published rows. Used by render layer to cap visible tags at top 3-4 by rarity (more distinctive = surface first).

## Mosque Jummah Times — Specific Rules
- **Official mosque websites only** as source. Never Yelp, Facebook, or third-party aggregators.
- DST auto-flip handled in code, no user toggle. Times are NOT labeled "winter/summer" to users.
- A per-mosque winter/summer Jummah and Iqama CSV exists for verification.
- Correction guideline (not absolute): pre-1 PM times shift +1hr in summer; at/after 1 PM often stay the same. Each mosque verified individually.

## iCal Event Feeds (sync via `node sync-events.js`, daily 6 AM Pacific via GitHub Actions)
MCC East Bay, ICF Fremont, SRVIC San Ramon, WVMA Los Gatos (iCal); MCA Santa Clara, Lamorinda (Google Cal)

## Edge Functions
Deployed via Supabase dashboard's Code tab OR (preferred since the inline editor breaks on this project) via Supabase CLI: `supabase functions deploy <name>`.

- `subscribe-newsletter` — creates Supabase user (no password) + Beehiiv subscribe with `reactivate_existing: true`, `send_welcome_email: true`
- `check-email` — two-step auth (returns `not_found` / `subscriber_no_password` / `full_user`)
- `send-notification-email` — fires on admin approve/reject, Resend templates respect `notify_on_review` preference
- **`chat-completion`** (Phase 1+) — the main chat backend. Embeds user message via OpenAI → runs `match_content` RPC → applies tag overrides + editorial fields → streams Anthropic Haiku 4.5 response. Has location-aware retrieval (Google Geocoding for location intent), drive-time proxy (2.5 min/mile), Jummah times injection for mosques, system prompt enforcing "never hallucinate, hedge on halal status."

## Supabase Secrets Set
- `RESEND_API_KEY` — Resend, domain verified for `mynasiha.com`
- `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)
- `ANTHROPIC_API_KEY` — for chat-completion edge function + intent extraction
- `OPENAI_API_KEY` — for query embedding in chat-completion
- `GOOGLE_MAPS_API_KEY` — server-side key restricted to Geocoding + Places APIs. **NOT the same as `REACT_APP_GOOGLE_MAPS_API_KEY`** (which is browser-referrer-restricted). Used by chat geocoding + scripts.

## Storage
- Bucket `listing-images` — 5MB max per upload, public SELECT, authenticated INSERT/DELETE namespaced to `user.id`. Phase 4 enrichment also writes Google Places photos here at path `google/<place_id>/{0,1,2}.jpg`.

## SQL Migrations

**Run / done:**
- `migration_5_tags_and_merge.sql` — `tags TEXT[]` column, backfilled, merged 66Strawberries + Ladle n Wok dups
- `migration_6_homecook_attributes.sql` — 123 cuisine/service tags backfilled for 83 home cooks
- `migration_7` / `migration_8` / `migration_8b` — `service_area` column + backfill for 65 published home cooks (city-level only)
- `migration_9_chat_backend.sql` — **Phase 1.** pgvector extension; `content_embeddings` table with HNSW cosine index; `chat_conversations` + `chat_messages` tables with RLS; `match_content()` Postgres function (hybrid vector + FTS retrieval via Reciprocal Rank Fusion). FTS uses OR-of-tokens (revised from initial AND to fix recall issues).
- `migration_10_geographic_retrieval.sql` — adds `near_lat/near_lng/radius_miles` parameters to `match_content()`; returns `display_lat/display_lng/distance_miles`; soft distance ranking when geo set.
- `migration_11_radius_first_retrieval.sql` — fixed the **Pakwan-missing bug**: when has_radius, pre-filter candidates to within radius BEFORE applying vector/FTS ranking. Otherwise top-50 semantic candidates filtered out geographically-relevant places.
- `migration_12_distance_sort_no_hard_radius.sql` — current production version. has_geo (with or without radius) → distance ASC is primary sort; RRF is tiebreaker. Mimics Restaurants page "Nearest" behavior.
- `migration_13_signals_and_enrichment.sql` — **Phase 4.** `signals` table (generic, multi-source) with UNIQUE(source, source_id); content gains `ai_enriched_summary JSONB, ai_enriched_at, google_place_id (partial UNIQUE), google_rating, google_review_count, photos TEXT[]`.
- `migration_14_halal_verification.sql` — `halal_verification TEXT` column on content (admin-only, never displayed).
- `migration_15_nasiha_editorial.sql` — editorial layer: `nasiha_pro_tip, nasiha_must_order, nasiha_reviewer` columns + `nasiha_signature_dishes` table for future "Top Dishes in the Bay" page.
- `migration_16_tag_overrides_and_curate.sql` — `nasiha_tag_overrides JSONB`, `nasiha_tagline_override TEXT`, `get_occasion_tag_counts()` function (returns tag frequencies for rarity-based display capping).

**Deferred:**
- `migration_step2_drop_old_columns.sql` — drops legacy `location_address` / `location_area` columns. **Do not run until verified safe.**

## Node Scripts (`scripts/*.js`)
All auto-load keys from `.env.scripts.local` at project root via `scripts/_loadenv.js` — no need to type env vars inline. Most have `--dry-run` mode.

- `embed-content.js` — generates/refreshes content_embeddings for every published row. Incremental via SHA-256 source_hash. Runs nightly via GitHub Actions.
- `sweep-enrich.js` — runs `enrich-restaurant.js` over all Bay Area restaurants. Idempotent (skips already-enriched). ~3 min for 363 rows.
- `enrich-restaurant.js` — single-restaurant Phase 4 pipeline: find_place → place_details → upload 3 photos → upsert reviews to signals → Claude distillation → UPDATE content. **Has defensive checks (address-match + place_id uniqueness) to prevent sister-location bugs.**
- `add-places-via-google.js` — for adding new content rows from a list of {name, city} via Google Places lookup. Used for genuine KML gaps. Idempotent.
- `assign-place-id.js` — assigns a specific Google place_id to a row from a Google Maps URL. Used to fix sister-location mistakes. Verifies + auto-enriches.
- `audit-place-id-matches.js` — read-only audit; categorizes every enriched row's place_id as MATCH/MISMATCH/AMBIGUOUS/ERROR by comparing Google's formatted address to stored address.
- `archive-listings.js` — sets status='archived' on hardcoded list of bad rows (permanently closed / phantom / duplicates).
- `fix-shawarmaji-keeper.js` — one-off cleanup script (Shawarmaji Oakland keeper had wrong address).
- `backfill-addresses.js` — reverse-geocoded coords → addresses for all 7,335 rows that lacked an address. Has retry-with-backoff.
- `dedup-listings.js` — finds near-duplicates by name + ~100m coord cluster, merges with description concat. Has --dry-run.
- `show-enrichments.js` — display all enriched listings or `--random N` for city-diverse spot-check sample.
- `test-chat.js` — CLI test of `chat-completion` edge function. Prints retrieval + streamed answer + debug payload.
- `batch-enrich.js` — runs enrich-restaurant on a hardcoded list of content IDs (Slice 1 test set, 29 restaurants).

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

### Phase 4 sweep cleanup — IN PROGRESS, RESUME WHEN READY
After the 363-restaurant Bay Area sweep completed (commit `ffe1ff2`), 9 rows failed in 3 buckets. All cleanup tooling is built. Steps 1-8 queued — see memory file `phase4_cleanup_resume.md`. TL;DR:

1. `assign-place-id.js` for Mirchi Cafe Fremont (URL in memory file)
2. `archive-listings.js --dry-run` → confirm → `archive-listings.js`
3. `fix-shawarmaji-keeper.js --dry-run` → confirm → `fix-shawarmaji-keeper.js`
4. Re-enrich Chaat Cafe + 3 Ike's Sandwiches (transient fetch fails)
5. Final `sweep-enrich.js` to confirm 0 failures
6. `audit-place-id-matches.js` to triage any MISMATCH rows from before defensive checks landed

### Home page — quick fixes (next up, not started)
- **Upcoming events row → horizontal scroll** with a half-card peeking on the right edge, so scrollability is visually obvious
- **Featured section lower on the home page** mixing featured restaurant / home cook / caterer — the page currently feels blank. Depends on listings having `featured = true`, which almost none do yet, so this surface will be empty until Nas flips the flag on a few.

### Home Cooks — submit form `service_area` capture
The only remaining item from the Home Cooks rebuild. New submissions via `/submit?cat=home-cooked-food` don't yet collect `service_area`; add a Google Places city picker so submitter picks a city (city-level only, never street address). All existing cards / sort / Picks / contact buttons already work — see the "Decided — don't re-litigate" note below.

### Chat — see the "Chat & Data Enrichment Roadmap" section below
Phase 1 (retrieval backend) is in progress. Phases 2-5 live in the new roadmap section. Don't pattern-match this to "build a chatbot" — it's a five-phase, multi-quarter plan culminating in a self-maintaining data layer.

## Chat & Data Enrichment Roadmap

The headline strategic bet. Don't treat any phase as the end state — each phase makes the next more valuable. The compounding insight is that **embedded text is the universal substrate**: Phases 3-5 all feed into the same embedded `document` that retrieval uses, so every enrichment becomes immediately searchable.

### Phase 1 — Retrieval backend (current)
- **pgvector** on Supabase + `content_embeddings` table (separate from `content`, see Schema decision B)
- **Hybrid retrieval** via the `match_content()` Postgres function: vector kNN + Postgres FTS, combined with Reciprocal Rank Fusion
- **`chat-completion` Edge Function**: embeds the query (OpenAI `text-embedding-3-small`), runs hybrid retrieval, builds a context block, streams from Anthropic Haiku 4.5
- **Nightly re-embed cron** (GitHub Actions, runs after iCal sync) — incremental via SHA-256 `source_hash` so only new/changed listings get re-embedded. Same automation pattern as `sync-events.js`.
- **`chat_conversations` + `chat_messages` tables** exist but are unused in Phase 1; Phase 2 will start writing to them.

### Phase 1.5 — Editorial content layer
Blog articles / guides get embedded into retrieval alongside listings so the chat can cite editorial perspective ("according to Nasiha's guide to East Bay home cooks…") and not just match raw listings. Articles also double as SEO pages at `/guides/{slug}`.

**Critical distinction — articles come in three flavors and the chat MUST treat them differently:**

| `source_type` | What it is | Citation behavior |
|---|---|---|
| `nasiha` | Written or commissioned by Nasiha | Cited as **"Nasiha's guide says…"** — builds Nasiha's editorial voice and credibility |
| `third_party` | Outside sources (Eater, KQED, established Muslim food blogs, etc.) | Cited as **"According to {source_name}…"** with a link out. **Never blurred with Nasiha's voice.** Borrows credibility without claiming authorship. |
| `community` | User-submitted guides (later) | Lowest trust by default; cited as **"A community contributor wrote…"** |

**Schema (rough):**
```
articles (
  id, title, slug, body_markdown,
  source_type ('nasiha' | 'third_party' | 'community'),
  source_name TEXT,         -- e.g. 'Eater', NULL for nasiha
  source_url TEXT,          -- required for third_party
  author TEXT,
  trust_tier INT,           -- 1 = top editorial, 2 = solid, 3 = community
  related_category_slugs TEXT[],
  related_listing_ids UUID[],
  status, published_at
)
```

**Retrieval changes:**
- Articles get embedded into `content_embeddings` (or a parallel `article_embeddings` table — TBD)
- Hybrid retrieval returns a **mix of listings + articles**, ranked together
- `trust_tier` influences ranking — higher-tier sources surface first when relevant
- System prompt updated to cite article sources correctly and **never present third-party opinion as Nasiha's voice**

**Operational notes:**
- For **third-party content, store a Nasiha-written summary** (not the full original text — copyright + honest attribution). Link out to the original.
- **First pass is curated** — articles added manually by Nas.
- **Auto-discovery of articles** (RSS feeds, sitemap crawling of trusted publications) becomes part of Phase 5's discovery pipeline later.

### Phase 2 — Chat UI
- Floating chat button on every page
- Dedicated `/chat` route
- Conversation history persistence for logged-in users (writes `chat_conversations` + `chat_messages`)
- Event Planning page primer: "Tell me about your event and I'll help"
- Anonymous users: ephemeral session, no history saved

### Phase 3 — Image / menu extraction (vision)
- Vendors upload menu, price-list, or hours images on their listing (Submit form or claim flow)
- Background job sends each image to Claude's vision model with a structured-extraction prompt: dishes, prices, hour ranges, notes
- Extracted text stored on the listing (new column or related `listing_extracted` table)
- **The extracted text becomes part of the embedded document** — chat can now answer "where can I get chicken karahi under $15"
- Re-extract triggered only when an image changes (hash check, same incremental pattern as embeddings)

### Phase 4 — AI enrichment from review aggregation
- For each listing, pull Google reviews + Yelp reviews (and any imported community reviews from the future Reviews system)
- Send to Claude with a tightly-scoped prompt: summarize "what it's known for," signature dishes, vibe, occasion fit, recurring complaints
- Store as structured `ai_enriched_summary` on the listing — also feeds into the embedded document
- **Why this matters strategically**: Google has reviews, Nasiha has *reviews distilled into searchable knowledge*. This is the single biggest differentiator over searching Google for halal food. Without this layer Nasiha is a directory; with it, Nasiha can answer "best biryani for a date night" because it knows *which* biryani spots are date-night-coded based on the body of reviews.
- Re-run nightly only for listings whose review hash changed

### Phase 5 — Continuous discovery pipeline
The piece that makes the data layer self-maintaining. Without it the platform stays dependent on user submissions, which doesn't scale.

**Reference point only** (not collaboration): a separate developer (Imran) has built a working production pipeline called "Halal Maniacs" — an Android app backed by Firecrawl + Apify + the Apify Google Maps Scraper actor + Python orchestration. His system auto-discovers, enriches, and dedupes halal restaurants state-by-state. He is not a collaborator and **Nasiha does not have access to his code or data.** His pipeline is mentioned only as a proof point that the approach works.

**Nasiha will build its own independent equivalent** — a Python pipeline using:
- **Firecrawl** for site crawling (restaurant websites, mosque pages, vendor sites)
- **Apify**, specifically the **Google Maps Scraper actor**, for places data and metadata
- A **dedup + enrichment layer** that normalizes against existing `content` rows, geocodes consistently, and routes new candidates through Phases 3/4 before they're embedded

**Goals (in priority order):**
1. **Continuous freshness** — catch new openings, closings, and hour changes promptly. *This is the deepest concern.* A pipeline that does a one-time data dump and goes silent doesn't solve the actual problem; restaurants open and close all the time and stale data is worse than no data.
2. **Bay Area first**, then state-by-state expansion
3. **Once a new listing enters the system**, Phases 3 and 4 auto-enrich it, then Phase 1's nightly re-embed picks it up — fully self-maintaining

**Cost estimate**: $50–200/mo at scale (Firecrawl + Apify + occasional Claude vision/text calls)

**Could be supplemented (not replaced) by**: a user "Report incorrect info" flow on every listing, surfacing reported drift to admin review.

**The next concrete slice (after Phase 4 enrichment proves out):** a Bay Area discovery sweep using Google Places **Text Search** — `"halal restaurants in {city}"` × ~20 Bay Area cities × 3 pages of 20 results = up to ~1,200 candidate places. Cross-reference each against `content` (by `google_place_id` for the ones we've enriched, by name+coords for the rest). Anything in Google's index that we don't have → propose as a new listing. Cost: ~60 Text Search calls (~$2 list price, $0 under Pro SKU). This is the stepping-stone to the full Firecrawl + Apify pipeline above — same general idea, narrower scope, native to Google. Built on top of the same `add-places-via-google.js` pattern that's already in place for manual additions.

### Phase X — Community Reviews with Moderation Queue
Logged-in Nasiha users (the general public, NOT the Nasiha editorial team) can leave reviews on listings. Reviews enter an admin moderation queue at `status: 'pending'`. Nas or designated moderators approve or reject from `/admin/reviews`. Approved reviews display on the listing in a separate **Community Reviews** section, **clearly distinguished from the Nasiha Pro Tip editorial layer**, AND feed the chat retrieval layer. Each community review is attributed to the user who wrote it ("Reviewed by Sarah K"). Rejected reviews are hidden but retained for record.

**Critical distinction:** community reviews are NOT the Nasiha voice. They're individual community members. The listing page shows them as a separate section, not blended with the Pro Tip (which IS the Nasiha voice).

Schema sketch:
```
community_reviews (
  id UUID PK,
  content_id UUID FK → content.id,
  user_id UUID FK → auth.users.id,
  rating INT,
  review_text TEXT,
  status TEXT CHECK (status IN ('pending','approved','rejected')),
  moderator_notes TEXT,
  created_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ
)
```

### Phase X+1 — Conversational Review Capture
When a chat user expresses intent to visit a restaurant ("I'll check out Bundoo Khan"), the chat sets a soft follow-up flag against that user + that listing. In a future session (days later, configurable cadence), the chat may organically ask "Did you end up trying Bundoo Khan?" If the user shares an impression, the chat asks **"Mind if I share that with the community as a quick review?"** — strictly opt-in.

If yes, the response is captured as a `community_reviews` entry with `status: 'pending'`, attributed to the user, fed into the moderation queue (Phase X).

**Why this is the unlock:** traditional review forms fail because people don't sit down to "write a review" — they naturally *talk about food* after eating. The chat captures the talking. Most thoughtful, useful reviews in the wild are conversational fragments — those are exactly what we want.

Real implementation has subtleties to design when this phase is built:
- **Restaurant disambiguation** — which Pakwan did they mean? Latest in-chat retrieval should bind.
- **Sentiment detection** — distinguish "I went and loved it" from "I tried it, it was meh" so the moderation queue gets useful priors.
- **Opt-in language** — never pushy, always clearly opt-in, single-question.
- **Frequency limits** — don't ask the same user about the same place twice; back off after one decline.
- **False-positive guards** — don't fire on "I'll check Bundoo Khan online" or other non-visit intents.

### Why all five phases together are the moat
- Phase 1+2 alone = ChatGPT with a directory bolted on. Easy to copy.
- Phase 3+4 added = the knowledge graph is *deeper* than any competitor's, because reviews and menus are distilled into searchable structured text.
- Phase 5 added = the knowledge graph stays current automatically.

Each layer compounds because they all flow into the same embedded document.

## Vault (Future Builds, in rough priority order)

### PARKED — Data Pipeline / Discovery
The big strategic gap. The full plan lives in the **Chat & Data Enrichment Roadmap** above (Phase 5 covers the auto-discovery pipeline; review aggregation is Phase 4). This Vault entry catches the *adjacent* community-signal sources that aren't covered by the Google Maps / Firecrawl crawl in Phase 5.

Adjacent signal sources (longer tail, harder to automate, lower priority than Phase 5):
- **WhatsApp scraping** — community group messages → new events, recommendations, openings
- **Instagram scraping** — vendor posts, food pics → home cooks, new restaurants, event flyers
- **Facebook group scraping** — Bay Area Muslim groups, classifieds, event invites
- **AI normalization** — Claude classifies, dedupes, geocodes scraped content before it hits the knowledge graph

Build options for Phase 5 + the adjacent signals above:
- (A) **Nasiha-built Python pipeline** — most control, $50-200/mo infra. Likely path.
- (B) **Contractor-built** — faster, costs ~$5-15k upfront depending on scope.
- (C) **User submissions + "Report incorrect info"** — manual, doesn't scale, but cheap interim.
- (D) **Hybrid** — short-term C while A is being built; long-term A.

Plan: C as interim → A as the real solution. Pick up post soft-launch. **Imran's Halal Maniacs pipeline is a reference point only — not a collaboration path.**

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

### KML import — DONE (became the 6,934 restaurant base layer)
The KML was imported, dedup'd (Migration 5 + `dedup-listings.js` run), reverse-geocoded for addresses (`backfill-addresses.js`, 7,335 rows). Caveat: most of the import was NOT Bay Area (Toronto, Texas, Houston, etc.). Only ~390 are Bay Area. The non-Bay-Area rows exist in the DB but are not currently surfaced anywhere. Could be revisited if Nasiha expands to other metros.

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

## Decided — don't re-litigate

- **Home cooks: city-level location only, never street address.** Privacy by design. `service_area` holds the city (e.g. "Fremont"), and `display_lat/display_lng` are the city centroid, not the cook's actual home. There is no map page for home cooks for the same reason. ~20 home cooks did originally provide full street addresses in their submissions; the plan (not built) is to store those in a private, never-displayed column for more precise distance sorting in chat — but **the user-facing surface stays city-only forever.**

## Recent Commits (top of main, newest first)
- `ffe1ff2` — Phase 4 cleanup: defensive checks (enrich-restaurant) + audit-place-id-matches + assign-place-id + archive-listings + fix-shawarmaji-keeper. Resolves the 9 sweep failures.
- `8f84708` — RecommendationStrip: render photos[0] (with image_url fallback)
- `16a7c1e` — Photos: render across 4 surfaces (list cards, map popup, chat citations, detail gallery) + halal badges stripped from public
- `3ced55c` — show-enrichments: `--random N` mode for city-diverse spot-check sampling
- `0bca9e2` — Phase 4 v3: editorial layer + tag overrides + admin curate (/admin/curate) + ListingDetail rendering of editorial fields + chat-completion applies overrides + tag rarity capping
- `7c0c420` — Phase 4: editorial layer migration (15) + refined occasion_tag defs + sweep-enrich
- `409e1d6` — Phase 4: revised prompt v2 + halal_verification column (Migration 14) + minor_tags
- `0bae5fc` — Phase 4: production-quality distillation prompt (no filler words, evidence threshold, specific beats general, honest about thin data)
- `1590774` — scripts: auto-load keys from `.env.scripts.local` (no more inline env vars)
- `e599f0a` — Phase 4 (Migration 13): enrichment pipeline (Google reviews → Claude distill → ai_enriched_summary)
- `2a65554` — Restaurants: show street address on list cards under restaurant name
- `fdbe48f` + `0bbc88a` — dedup-listings: 54 dup groups merged, 83 rows deleted
- `d851d23` — chat: drop hard radius filter (mimic Restaurants page); stop suggesting Google
- `a2a9d33` — chat-completion: drive-time estimate (~2.5 min/mile, honestly framed)
- `7a5c07c` — match_content (Migration 11): radius-first retrieval (fix Pakwan-missing bug)
- `3cdc2ad` — scripts: reverse-geocoding address backfill (incremental, --dry-run); ended up filling 7,335 of 7,400 addresses
- `8138619` — Chat: location-aware retrieval (Migration 10 — geocode → distance-biased match_content)
- `b088d4c` — **Phase 2 (chat UI): floating launcher + drawer + /chat route + Event Planning primer**
- `1bb26b2` — **Phase 1 (Migration 9): pgvector + content_embeddings + match_content RPC + chat-completion Edge Function + nightly re-embed cron**
- `0868dc0` — Home Cooks rebuild: Near Me/Featured sort, geolocation auto-detect, city dropdown, ✨ Picks band, six contact buttons
- `c271ca1` — Home Cooks page + Migration 6 to backfill cuisine/service tags
- `da19ebb` — Account hub + email preferences + approval/rejection emails
- `f91c78e` — Admin review dashboard at /admin/review
- `4b38931` — Newsletter integration + two-step auth flow
