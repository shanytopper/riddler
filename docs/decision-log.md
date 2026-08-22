# Decision Log

Living record of the design decisions for the rework. Claude raises questions and recommendations; the product owner decides. Each entry records the question, the options considered, the recommendation, and the decision once made. Decisions are numbered and never deleted; a reversed decision gets a new entry that references the old one. Entries marked **REVISIT** are accepted provisionally and will be re-opened once the prototype exists.

The design itself lives in [design.md](design.md).

**Open decisions:** D25, D26, D28, D30, D32, raised by [roadmap.md](roadmap.md) and listed in its decision calendar with the step that needs each; D31 is deferred to the go/no-go. D34 (an operator editor in the prototype) is decided. D35 (prototype front door: Hebrew default + a track picker instead of location codes) is decided. D27 (hosting), D29 (build method), and D33 (platform scope) are decided. **Provisional (REVISIT after the prototype is played):** D14, D18.

---

## Round 1 — foundations

### D1. Purpose of the document — DECIDED 2026-08-21
**Decision:** A build specification that the product is implemented from. Business context is one short section; costs, franchising, and revenue projections are out.

### D2. Owner's role and starting point — DECIDED 2026-08-21
**Decision:** The owner is a co-founder and developer. They will not run events and will not author content outside the prototyping phase. Nothing else exists (no prototype, code, designs, or customer conversations) unless stated otherwise.
**Consequences:** The product must be fully self-service for the customer. The document can assume a technical reader.

### D3. Primary customer for v1 — DECIDED 2026-08-21
**Decision:** Paying customers are operators of large-scale tourist activities: zoos, museums, a country's tourism office (an "Amazing Race"-style experience for tourists), and the like. Families and tourists are the users (players), not the customers. The product is white-label: the operator authors their own questions and plans their own tracks. The prototype is mock-branded as a fictional operator.
**Consequences:**
- The unit of content is a **track** that an operator publishes once and visitors play on demand — not a one-off event with a lobby and a synchronized start. The original's join-code → lobby → "organizer starts" flow and live control room are no longer the center of the product (D21 keeps an event mode out of v1).
- Each customer is a **tenant** with its own branding, users, tracks, and analytics. Ordinary SaaS multi-tenancy is in scope from the start; the franchise *hierarchy* stays out. A platform-admin role (us) onboards tenants.
- Players are anonymous visitors; the stuck path must be fully self-service.
- Museums are indoor: GPS cannot be the only arrival method.
- Education and corporate use re-enter through operators, not as separate segments.
- Operators are onboarded manually; no self-signup in v1.

### D4. Core mechanic — DECIDED 2026-08-21
**Decision:** Model C is the main model: arriving at a station unlocks a challenge about the place; solving it reveals the next station. Models A and B must also be supportable. Expressed as configuration in D13.

### D5. How operators author content — DECIDED 2026-08-21
**Decision:** A structured challenge editor with typed challenges. AI-assisted authoring may become a later tool; not the core product. Starter templates are at most a convenience.

### D6. Platform and connectivity — DECIDED 2026-08-21
**Decision:** Offline is a must: the full dataset is downloaded at track start; "we are here" is the backup for no GPS; leaderboard and results sync when possible. Player = native app; management console = website.

### D7. Scope cuts — DECIDED 2026-08-21
**Decision:** Native apps and offline maps stay. Removed: the four-tier hierarchy and franchise model. Deferred past v1: summary video, push notifications, curated site repository, marketplace, subscriptions.

### D8. Market, language, money — DECIDED 2026-08-21
**Decision:** Israel first. Hebrew and English UI (RTL required). No payment integration.

---

## Round 2 — the core, given D3

### D9. App distribution and white-label depth — DECIDED 2026-08-21
**Decision:** Option 3 — umbrella app by default, with the venue's branding applied inside it; dedicated per-operator store builds from the same codebase as a premium tier, published through the operator's own developer accounts (App Store guideline 4.2.6 and the Google Play equivalent). Branding is runtime tenant configuration; a dedicated build is that configuration pinned at build time plus store assets.

### D10. Scale and session model — DECIDED 2026-08-21
**Decision:** The prototype targets a small venue. v1 includes all scopes: from a museum floor to multi-day, multi-region itineraries. One party on one shared device; sessions resumable on the same device without time limit.
**Consequences:** Tracks are made of **legs** (ordered groups of stations, each with its own map region; single-venue tracks have one); per-leg map downloads; pauses between legs; larger station radii for area-scale stations. Synchronized events are excluded by D21.

### D11. Arrival verification — DECIDED 2026-08-21
**Decision:** Depends on the track; all four methods (`gps`, `qr`, `manual`, `none`) in v1, configured per station. Manual check-in is always available as the backup. Prototype: `manual` only.

### D12. Maps — DECIDED 2026-08-21
**Decision:** Both standard map tiles (offline region in the bundle) and operator-uploaded custom map images (floor plans, illustrated maps) in v1. Custom images are not georeferenced in v1.

### D13. Ordering and visibility — DECIDED 2026-08-21
**Decision:** The unified configuration — order `linear`/`free`; visibility `all`/`progressive`; per-station reveal-of-next `pin`/`clue`/`both` — ships in v1 and covers Models A, B, C. The first station of each leg is always shown as a pin. Prototype: Model A only (`linear`, `progressive`, `clue`).

### D14. Scoring, hints, stuck path — DECIDED 2026-08-21 · **REVISIT**
**Decision:** Accepted as proposed for now: operator-set points (default 100); up to three priced hints (defaults 20/30/50); unlimited free attempts for text and number; fixed penalty with retry for choice types (default 25 %); reveal-and-continue for 0 points after at least one hint (operator can allow immediately); no time scoring by default, optional time bonus; ties on play time; per-track opt-in leaderboard (today / all-time), team names only, operator can disable. To be revisited after the prototype is played.

### D15. Photos and station media — DECIDED 2026-08-21
**Decision:** No photo tasks and no photo recap in v1 (reading confirmed by D22). Station media in v1 is rich text and operator-authored images; audio and video later.

### D16. Multi-language content — DECIDED 2026-08-21
**Decision:** Agreed in principle; but a language is more than translated strings — it can require UI changes. v1 therefore supports exactly Hebrew and English for both UI and content. The content model is built for N languages; enabling a new one is a product change that includes UI verification.

### D17. Player identity and privacy — DECIDED 2026-08-21
**Decision:** Anonymity by default. Optional accounts for features such as saved history (details in D23). No location traces uploaded; station-level events only.

### D18. Operator console scope — DECIDED 2026-08-21 · **REVISIT**
**Decision:** Agreed as proposed: branding, two roles (admin, editor), full track editor with map, stations, challenges, hints, translations, validation, phone-frame preview; publish with versioning (sessions pinned to a version); printable QR posters and station sheets; analytics (funnel per station, hint/skip usage, common wrong answers, completion, median time). Out: live session map, self-signup, billing, AI authoring, audio, multi-venue hierarchies. To be revisited after the prototype.

### D19. Technical preferences — DECIDED 2026-08-21
**Decision:** No strong preference. Claude proposed the stack; decided in D24.

---

## Round 3 — prototype scope and technical design

### D20. Prototype scope — DECIDED 2026-08-21
**Decision:** As proposed:
- One fictional operator, **Ein Dror Nature Park**, mock-branded, inside the umbrella app; no dedicated build.
- One track, one leg, 6–8 stations, in Hebrew and English.
- Model A (`linear`, `progressive`, `clue`) with distance-only feedback on.
- Arrival: `manual` only. GPS is read for position and distance feedback, not for arrival.
- Challenge types: `text`, `number`, `choice`; hints; reveal-and-continue; scoring per D14.
- Map: standard tiles with an offline region; no custom image map.
- Offline: full bundle download, crash-safe local state, event sync, local result card, leaderboard when online.
- Anonymous players only.
- Console not built; track content authored as JSON and published by a script. Backend for the prototype: bundle builder (CLI), delivery API, ingestion API with leaderboard derivation.
- Events stored; no analytics dashboard.

### D21. Synchronized event mode — DECIDED 2026-08-21
**Decision:** Not in v1. An `event` entity grouping sessions is reserved for later; the lobby, start gate, and organizer live view are later work.

### D22. Reading of D15 — DECIDED 2026-08-21
**Decision:** Confirmed: no photo tasks and no photo recap at all in v1; operator-authored station images remain.

### D23. Accounts — DECIDED 2026-08-21
**Decision:** Sign in with Apple, Google, and email magic link (Apple requires Sign in with Apple when any third-party login is offered). Minimum age 16. v1 account features: history of played tracks with results; leaderboard entries linked to the account. Not in v1: cross-device resume of a session in progress. Accounts are platform-level and work across venues and inside dedicated apps.

### D24. Technical stack — DECIDED 2026-08-21
**Decision:** As proposed (design.md §11): React Native with Expo (TypeScript) and EAS Build for per-tenant variants; MapLibre with Protomaps PMTiles region extracts for offline maps — PMTiles support in the React Native MapLibre binding is verified first in the prototype, with MapLibre offline packs or bundled MBTiles as the fallback; SQLite on device; Next.js console with MapLibre GL JS; TypeScript API (Fastify or NestJS) on PostgreSQL with S3-compatible storage behind a CDN and background jobs; tenancy by `tenant_id` enforced in the data layer with Postgres RLS as a second line. Flutter and Supabase were considered and not chosen.

---

## Round 4 — prototype completion and v1 (open)

Raised by [roadmap.md](roadmap.md); each entry names the step that needs it.

### D25. Map stack confirmation — needed after step 4
**Question:** Does PMTiles + MapLibre work offline through the React Native binding on device, at an acceptable extract size?
**Options:** confirm; MapLibre offline packs from a self-hosted tile server; raster MBTiles; Mapbox.
**Recommendation:** Decide from the spike's measurements, in that order of preference.
**Evidence (2026-08-21):** on an API 36 emulator (host GPU), the app renders the Spring Trail from a local PMTiles extract with Latin and Hebrew labels from local `file://` fonts, markers, live position and distance, and keeps rendering with airplane mode on; the whole offline map is about 4 MB. Details, screenshots, and the fixes made along the way in [spike-offline-map.md](spike-offline-map.md). A release APK cold-started with airplane mode on renders the map fully. Outstanding only: a physical phone, in step 8.
**Recommendation:** Confirm PMTiles + MapLibre (the decided stack); no fallback is needed.
**Decision:** _pending_

### D26. Database tooling — needed before step 7
**Options:** Drizzle ORM with drizzle-kit migrations; Prisma; hand-written SQL with a migration runner.
**Recommendation:** Drizzle — SQL-shaped, light, shares TypeScript types with the API, and keeps RLS policies expressible.
**Status (2026-08-22):** step 7 was built on Drizzle as recommended (`apps/api/src/db/schema.ts`; the prototype applies `schema.sql` idempotently at startup, drizzle-kit migrations come with the console). Switching now would mean rewriting the data layer.
**Decision:** _pending formal confirmation_

### D27. Hosting for the prototype — DECIDED 2026-08-22
**Options:** a small PaaS (Fly.io, Railway) with managed Postgres (Neon) and object storage (Cloudflare R2); a single VPS; a hyperscaler; free tiers only.
**Decision:** Render, on free tiers, for the prototype: a free web service for the API and Render's free Postgres, both in Frankfurt; bundle archives are stored in Postgres (`bundle_objects`) so no object-storage account is needed and the service needs no disk. The owner's reasoning: no spend before the go/no-go.
**Consequences:** the API sleeps after 15 minutes idle and takes about a minute to wake (warm it before a demo or a field test); the free Postgres expires 30 days after creation with a 14-day grace period, one per workspace, no backups — re-creating and re-seeding takes minutes (`npm run seed -w @riddles/api` against the new `DATABASE_URL`); the service is reached at Render's `*.onrender.com` subdomain — `https://riddles-api-vv2y.onrender.com`, built from `github.com/shanytopper/riddler` (see D31). A paid Render Postgres, or Neon, removes the expiry when the project continues.

### D28. Field-test venue and testers — needed before step 8
**Question:** Which real venue replaces the placeholder coordinates, and who plays?
**Recommendation:** A park the owner can reach repeatedly; three to five parties including a family with children, one Hebrew-first and one English-first.
**Decision:** _pending_

### D29. Build method — DECIDED 2026-08-21
**Options:** local Android development builds (Android Studio on Windows); EAS cloud builds.
**Decision:** Local Android development builds for the prototype; EAS from M2, when iOS and repeatable release builds arrive.

### D30. Developer accounts — needed before M2
**Recommendation:** Apple Developer Program a few weeks before M2's iOS bring-up (organization enrollment takes days); Google Play Console before Play internal testing in M2. Prototype APKs are sideloaded, so neither is needed before then.
**Decision:** _pending_

### D31. Product domain — DEFERRED 2026-08-22 to the go/no-go
**Question:** Deep links, the API, and store listings need a domain; the working name "Riddles" is a placeholder.
**Recommendation (revised):** No domain during the prototype. The API lives on Render's `*.onrender.com` subdomain with TLS; the app keeps the `riddles://` custom scheme for links and QR codes; verified App Links / universal links and store listings are v1 work anyway. Buy the domain once the product name is settled and the go decision is made.
**Decision:** Deferred to the go/no-go (owner, 2026-08-22).

### D32. Console preview approach — needed before M2 work package D
**Options:** an HTML preview that mirrors the app's station screens; rendering the real React Native components through react-native-web from a shared UI package.
**Recommendation:** HTML preview in v1; the shared-components route is a stretch goal once the station screens are stable.
**Decision:** _pending_

### D34. An operator editor in the prototype — DECIDED 2026-08-22
**Owner (2026-08-22):** "the prototype is not complete without an editor to the server side." This revises D20, which had the prototype authored as JSON and published by a script, with the console deferred to M2.
**What it pulls forward:** a subset of M2 work packages A–E (console foundation, track editor, map editor, validation, publishing pipeline) — enough for an operator to change the Spring Trail and publish it without touching JSON, for the go/no-go demo.
**Open sub-decisions (owner):** (a) scope of the first editor; (b) access control for a prototype editor on the public internet; (c) stack and hosting — a React SPA served by the existing API service, or Next.js as its own service per D24; (d) whether media uploads are in scope.
**Decision (owner, 2026-08-22, all four recommendations confirmed):**
- **Scope — "Editor v0":** track details and rules; a reorderable station list with a per-station editor (title, intro paragraphs, the three challenge types, hints with costs, points, reveal and clue), Hebrew and English side by side with per-language completeness; a map to drag station pins; the validation report; Publish, which creates version N+1 and builds the bundle on the server; leaderboard moderation (hide an entry). Deferred to M2: image uploads, the translation tab, the phone-frame preview (D32), branding and users, version-history UI, a Hebrew console UI.
- **Access:** one operator password in an environment variable with a session cookie; accounts and email links stay in M2 (WP-A).
- **Stack and hosting:** a React + TypeScript single-page app (Vite) in `apps/console`, built during the API's deploy and served by the same Render service under `/console`. This amends D24: the console does not need server rendering, so it is not Next.js; revisit at M2 only if a need appears.
- **Publishing on the free tier:** the bundle is built on the server; tiles, fonts, and sprites from the previous publish are cached in Postgres and reused, and a tile re-extract runs only when the bounds change (go-pmtiles is fetched during the Render build). Media uploads stay deferred, which keeps the build within the free instance.
**Consequences:** the roadmap gains a step 8 (Editor v0) before the field test, now step 9; M2 work packages A–E shrink to what v0 leaves out.

### D35. Prototype front door: Hebrew default + track picker — DECIDED 2026-08-22
**Owner (2026-08-22), after a first test of the hosted prototype:** two prototype-only changes — (1) the app should start in Hebrew, not English; (2) replace the location-code entry (QR scan and typed venue code) with a simple selection out of the tracks that exist on the server.
**Decision & rationale (both prototype-only; revert for v1):**
- **Default language = Hebrew.** The pilot venue is in Israel and the testers are Hebrew-speaking, so the first launch defaults to Hebrew regardless of the device language; a user's saved choice in Settings still wins. For v1, restore device-language selection (design §11: the app follows the device, then the user's choice).
- **Front door = a list of the server's tracks.** With one venue, one track, and no printed QR posters yet, a code/QR front door adds friction for testers. The umbrella home now lists the tracks published on the server and the player taps one; it no longer scans or asks for a venue code. For v1, restore the full §5.1 front door (venue-code entry, QR scan, and the nearby/recent venue lists).
**Implementation:** `apps/mobile/src/i18n/LanguageProvider.tsx` (`PROTOTYPE_DEFAULT_LANGUAGE = "he"`, saved override still wins); `apps/mobile/app/index.tsx` rewritten to render `delivery.listAllTracks()` as `TrackCard`s routing to the existing `/t/{trackId}`; the delivery client gains `listAllTracks()` (fixture flattens the bundled content, HTTP composes `/venues` + `/tenants/:id/tracks`). Verified on web with the fixture client (home renders in Hebrew and lists the Spring Trail; tapping it opens the track) and against the hosted API's listing endpoints. The QR scan route (`app/scan.tsx`) stays for deep links but is unlinked from the home.
**Consequences:** app-only change; the API and console are untouched. A new release APK is needed for it to reach a device.

### D33. Platform scope — DECIDED 2026-08-21
**Decision:** The prototype is built and tested on Android only. v1 ships on all major mobile platforms, i.e. iOS and Android.
**Consequences:** No Apple account, EAS, or iOS device work before v1; step 4 uses local Android development builds; the step 8 device matrix is Android-only; M2 opens with an iOS bring-up work package (first EAS iOS build; MapLibre + PMTiles, RTL, fonts, camera, and location verified on an iPhone; TestFlight) before any v1 feature is added. Design §11.4's RTL check covers Android in the prototype and iOS at the start of v1.
