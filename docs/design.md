# Product Design Document — Location-Based Riddle Tracks for Venue Operators

**Status:** Draft 2 · 2026-08-21
**Working name:** Riddles (placeholder)
**Decisions:** referenced as D-numbers from [decision-log.md](decision-log.md). All decisions through D24 are made. D14 (scoring) and D18 (console scope) are accepted provisionally and will be revisited once the prototype has been played.

---

## 1. Overview

A white-label platform on which an operator of a tourist attraction — a zoo, a museum, a nature park, a city or national tourism office — authors location-based riddle tracks and publishes them to visitors, who play them in a native mobile app that works without connectivity. A track is a sequence of stations at physical places; arriving at a station unlocks a challenge about that place, and solving it reveals the next station. The operator writes the content, plans the route, and brands the experience; the platform supplies the authoring console, the player app, the offline delivery, and the analytics. (D1, D3, D4, D6)

### 1.1 Goals for v1

1. An operator's non-technical staff can author, translate, preview, and publish a track without our involvement, in an afternoon.
2. A visitor party can complete a track with no connectivity after the initial download, and nothing they did is lost.
3. The visitor experience carries the operator's brand. The operator can choose between presence inside our umbrella app and a dedicated store app built from the same codebase. (D9)
4. The operator can tell whether their content works: completion rate, where visitors stall, which questions are broken. (D18)
5. A single track can span anything from a museum floor to a multi-day, multi-region itinerary. (D10)

### 1.2 Non-goals for v1

Photo or video tasks and recaps; audio content; AI-assisted authoring; payment or billing; operator self-signup; push notifications; a live map of active sessions for operators; a synchronized event mode (lobby, common start, organizer present); branching or "detour" paths; turn-by-turn navigation; real-time interaction between parties; UI or content languages beyond Hebrew and English; a marketplace of ready-made tracks; Bluetooth beacons; cross-device resume of a session in progress. (D7, D15, D16, D18, D21, D23)

### 1.3 Success metrics (proposed — owner to set targets)

| Stage | Metric | Proposed target |
|---|---|---|
| Prototype | Operators who agree to pilot after a demo | 2 of the first 5 shown |
| Prototype | Visitor parties finishing a test track | ≥ 70 % of parties that start |
| v1 | A track authored end-to-end by operator staff with no support ticket | First 3 operators |
| v1 | Sessions lost or corrupted due to connectivity | 0 |
| v1 | Completion rate per published track | ≥ 60 % median across operators |
| v1 | Operator-reported "broken question" found via analytics before a visitor complains | Tracked, no target |

---

## 2. Users

### 2.1 The operator (customer)

An organization running a venue or a destination. The people who touch the product:

- **Visitor-experience or marketing manager** — owns the decision, the brand, and the content. Not technical. Authors and publishes tracks in the console. Reads analytics.
- **Content editor / guide / educator** — writes stations and challenges, often in two languages. May be a seasonal employee.
- **IT or brand contact** — supplies logos, colors, legal URLs, and (for a dedicated app) developer accounts. Appears once.

Jobs to be done: give visitors a reason to explore the whole venue and stay longer; offer a differentiated, branded activity for families and school groups without staffing it; know whether it is being used and where it breaks.

### 2.2 The visitor party (player)

A family, a couple, a group of friends, a school group, a pair of tourists. They play as one **party** on **one shared phone** (D10). They are anonymous by default (D17). They did not install anything in advance, may have poor or no connectivity inside the venue, and have children pulling at them. They will abandon at the first dead end.

### 2.3 Platform admin (us)

Creates tenants, invites the first operator admin, configures dedicated app builds, and monitors platform health. Does not author content and is not present at venues (D2).

---

## 3. Landscape and positioning

The category exists. Products an operator will have heard of or will compare us to:

| Product | What it is | Overlap |
|---|---|---|
| Actionbound | Self-service builder for location-based "bounds"; strong in museums and education (DACH) | Authoring model, offline play |
| Locatify | Museum guides and treasure hunts with white-label apps | White-label, indoor |
| Loquiz | Outdoor game builder, corporate and tourism | Authoring, offline |
| Geocaching Adventure Lab | Location-based multi-stage caches inside the Geocaching app | Umbrella-app model |
| Questo, Secret City Trails | Consumer city quests with pre-written content | Visitor experience, not operator tooling |
| Goosechase, Scavify, Eventzee | Event scavenger hunts with an organizer present | Event mode, not always-on venue tracks |
| Smartify | Museum audio guides | Indoor, white-label |

Claims about competitors above should be verified against their current offerings before they are used externally.

Where this product is different, and what v1 must therefore actually deliver:

1. **Offline as the default, not a mode.** The track is downloaded whole; every part of play works with the radio off; results sync later. (D6)
2. **Place-gated by design.** Arrival at the place is what unlocks the challenge, and the authoring model pushes operators toward challenges about the place. (D4)
3. **Hebrew and RTL as first-class**, in both the player app and the console. No product in the table treats this as primary. (D8)
4. **White-label with two depths**: branded presence inside the umbrella app, or a dedicated store app from the same codebase. (D9)
5. **Content-quality analytics**: per-station funnel and the most common wrong answers, so operators fix bad questions without visitor complaints. (D18)

---

## 4. Core game concept

### 4.1 The loop

1. The party enters the venue in the app (QR at the entrance, a venue code, or "near you"), picks a track, picks a language, names their team, and downloads the track bundle while they still have connectivity.
2. The app shows where to go: a pin on the map, a clue, or both, depending on the track's mode (§4.2).
3. The party arrives. Arrival is verified by one of the station's allowed methods (§4.3).
4. The station's intro content is shown, then its challenge (§4.4).
5. The party answers. A correct answer scores points; hints cost points; "reveal and continue" always exists (§4.5).
6. The next station is revealed. Repeat until the track's completion condition is met.
7. The party sees a result card. When online, their result is posted and the leaderboard is shown (§4.6).

### 4.2 Ordering and visibility modes (D13)

Two track-level settings and one station-level setting express every mode the product supports:

| Setting | Values | Level |
|---|---|---|
| Order | `linear` — fixed sequence · `free` — any order | Track |
| Visibility | `all` — every station shown from the start · `progressive` — a station appears only after the previous one is completed | Track (only `linear` may be `progressive`) |
| Reveal | `pin` — marker on the map · `clue` — text and optional image · `both` | Station — how this station is presented when it becomes current (only when `progressive`) |

The three mechanics from the original discussion map onto these: **Model A** (treasure hunt) = `linear` + `progressive` + `clue`; **Model B** (station walk) = `all`, with `linear` or `free` order; **Model C** (the default) = `linear` + `progressive` + `pin`.

The first station of every leg is always shown as a pin, together with the leg's intro, whatever the reveal setting — a party must always know where to begin.

When a station is revealed as a `clue`, the operator may additionally enable **distance-only feedback**: the app shows "120 m away" without direction, updated as the party moves. This is the hot-and-cold mechanic of an escape room and costs nothing to implement since both coordinates are known.

Completion condition: `linear` — the last station is completed; `free` — all stations are completed. "Complete when N of M are done" is a later option.

Prototype: Model A only. v1: all modes.

### 4.3 Arrival verification (D11)

Each station lists the methods that mark the party as arrived. Manual check-in is always available as a backup (D6) and is never removed by configuration.

| Method | How it works | Typical use |
|---|---|---|
| `gps` | The device is within the station's radius (default 30 m; 10–500 m). The app prompts "You've reached *Station name* — start?" rather than opening the station unasked, so walking past a station in a `free` track is an offer, not an interruption. | Outdoor venues, city areas |
| `qr` | The party scans the station's printed QR code. The code is validated against the bundle, so scanning works offline. | Indoor venues, deterring play from home |
| `manual` | "We are here." Always shown; shown prominently when GPS accuracy is poor or the station has no `gps`. Recorded as `manual` in the session events. | Backup; venues without GPS; the prototype |
| `none` | The station opens as soon as it is current. | Model B tracks that are really quizzes on a walk |

GPS details that decide whether this feels reliable: the app treats a fix as usable only when its reported horizontal accuracy is at most max(radius, 50 m); if no usable fix arrives within 30 s of the party tapping the station, the manual button is surfaced with an explanation. Station radii on multi-region tracks may be large (a town square is a station). Indoor GPS is assumed absent; operators are told so in the station editor when they pick `gps` without `qr` for an indoor-looking track (custom-image map in use).

A session in which the party used `manual` at a station that offered `gps` or `qr` is flagged in analytics. It is not penalized and not marked publicly in v1.

Prototype: `manual` only. v1: all four.

### 4.4 Challenges and answers (D5)

A station has optional intro content (rich text and images) and at most one challenge. A station with no challenge is an **info station**: arriving completes it, and it carries no points. Challenge types in v1:

| Type | Operator provides | Visitor does | Correctness |
|---|---|---|---|
| `text` | One or more accepted answers per language; optional "accept close matches" | Types an answer | Normalized match against any accepted answer (below) |
| `number` | Correct value; tolerance (absolute or percent) | Types a number | Within tolerance |
| `choice` | 2–6 options, one correct; optional shuffle | Taps one | Exact |
| `multi_choice` | 2–8 options, several correct | Taps several | All-or-nothing in v1 |

Text normalization, applied to both the accepted answers and the visitor's input before comparison: trim; Unicode NFKC; case-fold; collapse internal whitespace; strip punctuation, quotation marks, and the Hebrew geresh/gershayim (׳ ״); strip Hebrew cantillation and vowel points (U+0591–U+05C7); map Hebrew final letters to their non-final forms; map Arabic-Indic digits to ASCII digits. With "accept close matches" on (the default), a Damerau–Levenshtein distance of 1 is accepted for normalized answers of 5–9 characters and 2 for 10 or more. Operators see a live "would be accepted / rejected" tester in the editor when they type sample inputs.

Accepted answers are per language: the Hebrew and English answer sets for the same challenge are independent.

Prototype: `text`, `number`, `choice`. v1: all four.

### 4.5 Hints and the stuck path (D14 — provisional, marked for revisit)

There is no organizer to call (D3), so the app must never leave a party stuck.

- A challenge has 0–3 hints, revealed in order. Each hint has a point cost set by the operator. The cost is shown before the hint is revealed ("Reveal hint 1 — costs 20 points").
- `text` and `number`: unlimited attempts, no penalty per attempt. Penalizing typos is the classic failure in this category.
- `choice` and `multi_choice`: a wrong answer costs a fixed penalty (default 25 % of the challenge's points) and the party may try again.
- **Reveal and continue** shows the answer, awards 0 points for the challenge, and moves on. It is available after at least one hint has been used; the operator can make it available immediately for a given track. A challenge that has no hints makes it available immediately regardless, so a party is never without a way forward.
- Points for a challenge never go below zero.

### 4.6 Scoring, time, ties, leaderboard (D14 — provisional, marked for revisit)

- Each challenge has a point value set by the operator; default 100. Default hint costs are 20, 30, and 50, so using all three hints is worth the same as revealing.
- Track score = sum of challenge scores. There is no time component by default. The operator may enable a **time bonus** for a competitive track: a per-track bonus that decays linearly from full to zero between a "par" play time and a "cutoff" play time.
- **Play time** is the time the session was active: from start to finish, minus explicit pauses and minus gaps between legs (§4.7). It is measured on the device with a monotonic clock, so a wrong device clock does not corrupt it.
- Ties on score are broken by lower play time.
- The **leaderboard** is per track (not per version), with "today" and "all time" views. It shows team names and scores only. Posting to it is opt-in per session, on the result card. The operator can disable it per track. Every party sees a result card regardless of the leaderboard.
- Because results arrive whenever devices come online, a party may see their rank change later. The result card says so.

### 4.7 Legs and multi-day tracks (D10)

A track has one or more **legs**. A leg is a sequence of stations with its own map region. Single-venue tracks have one leg and the word never appears in the visitor's UI. Multi-leg tracks ("Day 1 — Old City", "Day 2 — Galilee") show "Leg 2 of 3" and the leg's own map.

- Legs are always in fixed order; order and visibility settings (§4.2) apply within a leg.
- Between legs the session is paused. Transport, lodging, and opening hours are outside the product; the operator writes them into the leg's intro.
- A session can be resumed on the same device at any later time (D10).
- Map data is downloaded per leg: the current leg's region at track start, the next leg's region opportunistically whenever the device is online (§8).

### 4.8 Session lifecycle

`created` (team named, bundle downloaded) → `active` → `paused` (explicit, or between legs, or app backgrounded for long) → `active` … → `finished` (completion condition met) or `abandoned` (the party chose "Leave track", or no activity for 30 days). A party may start a fresh session on a track they finished or abandoned. One active session per track per device; several tracks may have sessions on one device.

Sessions are pinned to the **track version** whose bundle they downloaded. Publishing a new version never changes a session in progress (§6.4).

A synchronized event mode — many parties starting together, with a lobby, a common start, and an organizer present — is not part of v1 (D21). The data model leaves room for it as an `event` that groups sessions; the lobby, the start gate, and the organizer's live view are later work.

---

## 5. Visitor experience (native app)

### 5.1 Entering a venue

**Umbrella app** (D9): the home screen offers "Scan venue code" (camera), "Enter code" (short slug), "Near you" (venues with tracks within a few kilometers; location permission is requested on first use, with the reason stated), and "Recent". Entering a venue switches the whole app into the operator's theme: name, logo, colors, typography, cover image (§9). Leaving the venue returns to the neutral home.

**Dedicated build** (D9): the app opens directly into the operator's venue home. There is no venue switching.

**Venue home**: cover, name, short about text, the list of published tracks (name, cover, estimated duration and distance, difficulty, age suggestion, languages), "Continue" for any session in progress, and links to support and legal pages.

### 5.2 Starting a track

Track details → language choice (Hebrew or English; defaults to the device language) → team name (suggestions offered; a light profanity filter applies because names may appear on the leaderboard) → bundle download, with size shown before starting ("42 MB — Wi-Fi recommended") and a progress bar → safety notes written by the operator, acknowledged with one tap → location permission requested here if not already granted, with the reason stated → start.

If the download fails or the device is offline, the screen says so plainly and offers retry; nothing else is available until the bundle is complete. This is the one moment the product needs connectivity, and the venue-entry QR poster tells visitors to start the track at the entrance.

### 5.3 Playing

**Map screen** — the base map (standard tiles or the operator's custom image, §5.8) with the party's position (standard maps only), the current station highlighted, completed stations checked, upcoming stations shown or hidden per visibility, and locked stations greyed in Model B. A bar shows progress ("3 / 8"), the score, and distance and bearing to the current station when the station is shown as a pin. Buttons: "We are here", "Scan station code" (when any station in the track uses `qr`), and a menu (pause or leave track, language, help, emergency, about).

**Clue screen** (Model A) — the clue text and image for the next station, the optional distance-only feedback, and the same "We are here" and scan buttons.

**Station screen** — title; intro content; the challenge with its type-specific input; submit. Correct: a brief celebration, points earned, "Next". Wrong: a gentle message and the input stays focused. A hints drawer shows each hint's cost before revealing. "Reveal answer and continue" appears per §4.5. After the station, the reveal of the next station plays (pin drops on the map or the clue appears).

**Finish** — the result card: team name, track, score, play time, date, operator branding; "Post to leaderboard" (opt-in); "Share result" (OS share sheet, an image of the card). The leaderboard view loads when online and says "Your result will be posted when you're back online" otherwise.

### 5.4 Between legs

The leg's closing text, then the next leg's intro with its map region's download state ("Day 2 map: ready" or "will download when online"). "Resume later" returns to the venue home.

### 5.5 Accounts and history (D17)

Anonymous play is the default and complete. A visitor may create an account to keep a history of played tracks and results across reinstalls; leaderboard entries posted while signed in are linked to the account. Sign-in methods (D23): Sign in with Apple, Google, and email magic link — Apple requires Sign in with Apple whenever a third-party login is offered. Minimum age 16. Accounts are platform-level — the same account works across venues and inside dedicated apps, and the privacy notice says so. Cross-device resume of an in-progress session is not in v1.

### 5.6 Settings, privacy, safety, support

UI language (follows device by default), text size (follows system), manage downloaded tracks (size, delete), account (if any), privacy notice, terms, the operator's support contact, and an **emergency** entry that shows the operator's emergency contact and dials the local emergency number for the track's country.

### 5.7 States the app must handle well

| Situation | Behavior |
|---|---|
| No GPS fix or poor accuracy | Map still works; position hidden; manual check-in surfaced with explanation |
| Offline for the whole session | Everything works; result card local; events queued; leaderboard deferred |
| App killed or phone restarted | Session restored exactly, including the open challenge |
| Low battery | No background location; location is read only while the map or clue screen is open |
| Bundle schema newer than the app | App prompts to update before downloading; sessions on older bundles keep working |
| Track unpublished mid-session | Session continues (bundle is local); leaderboard posting still accepted |
| Station QR for a station not in this version | "This code belongs to a different version of the track" and manual check-in offered |
| Device language not supported | English |

### 5.8 Maps (D12)

Two base-map kinds, chosen per leg by the operator:

- **Standard map** — vector tiles styled neutrally so the operator's theme colors carry the UI. The leg's region is included in the bundle for offline use. The party's position is shown.
- **Custom image map** — an operator-uploaded image (illustrated zoo map, museum floor plan) on which stations are placed in image coordinates. No GPS position is shown on it in v1 (images are not georeferenced), so `gps` arrival is still possible if the station also has coordinates, but the dot is not drawn. Pinch-zoom and pan; stations drawn as the same markers.

Prototype: standard map only (D20).

---

## 6. Operator experience (web console)

The console is a website in Hebrew and English with full RTL support (D8). It is used on a desktop browser; the phone-frame preview is part of it.

### 6.1 Tenant setup and branding (D9)

Set by an admin: display name, venue slug (the code visitors can type), logo (light and dark backgrounds), primary and accent colors with an automatic contrast check against the text colors the app will use (minimum 4.5:1), a typography pairing chosen from a small set that covers Hebrew and Latin well (Heebo, Assistant, Rubik, or system), cover image, about text, support contact, emergency contact, website, privacy policy and terms URLs. Every change is previewed live in the phone frame.

### 6.2 Users and roles (D18)

Two roles in v1: **admin** (everything, including branding, users, publishing, and dedicated-app settings) and **editor** (create and edit tracks, translate, preview; cannot publish or change branding). Invitations by email. A user belongs to one tenant; platform admins belong to all, and every platform-admin action inside a tenant is audit-logged.

### 6.3 Track editor

A track page with tabs: **Details**, **Legs & stations**, **Map**, **Translations**, **Rules**, **Preview**, **Publish**.

- **Details** — name, description, cover image, difficulty, age suggestion, estimated duration and distance (computed from the route and adjustable), languages enabled, safety notes.
- **Legs & stations** — a reorderable list; single-leg tracks show only stations. Each station opens an editor: title, intro content (rich text with images), arrival methods and radius, the challenge (type picker, then type-specific fields, the accepted-answer tester for `text`), 0–3 hints with costs, points, and the reveal setting — how this station is presented when it becomes current (`pin`, `clue` with text and image, `both`, distance-only feedback).
- **Map** — for each leg: choose the base map (standard, or upload an image); place and drag stations; draw the station radius; see the total path length; the standard map shows an estimate of the offline region's download size as the region changes.
- **Translations** — every player-facing text field of the track, side by side per language, with completeness per language. A language with gaps cannot be published.
- **Rules** — order and visibility, leaderboard on/off, reveal-and-continue availability, time bonus (par and cutoff), wrong-answer penalty for choice types.
- **Preview** — the station flow in a phone frame, switchable between languages and between light/dark, with arrival simulated by a button. It does not simulate location.
- **Publish** — validation report (every station located, every language complete, every challenge has an answer, every `qr` station has a printed code), then publish. Also: unpublish, and the version history.

### 6.4 Publishing and versions

A track has one **draft** and zero or one **published version**. Publishing freezes the draft into an immutable version, builds its bundle asynchronously, and makes it the version new sessions receive. Editing a published track edits the draft; nothing changes for visitors until the next publish. Sessions stay on the version they downloaded. Station identifiers are stable across versions, so station QR codes remain valid unless the station is deleted, and analytics can be compared across versions. Unpublishing stops new sessions; sessions in progress are unaffected.

### 6.5 QR codes and print materials

Two printable PDFs, generated from the console in the tenant's branding: a **venue entry poster** (the venue QR, the typed code, a three-step "install, scan, start at the entrance" instruction, in both languages) and a **station sheet** with one QR per station, labeled with the station's title and internal number, for operators using `qr` arrival.

### 6.6 Analytics (D18 — provisional, marked for revisit)

Per track, filterable by version, language, and date range:

- Sessions started, finished, abandoned; completion rate; sessions per day.
- Per-station funnel: reached, completed, skipped (reveal-and-continue), median time on station, hint usage by hint, arrival method mix including `manual` flags.
- Per-challenge: the most common wrong answers (normalized text, capped at 100 characters) — the fastest way to find a mis-keyed answer or an ambiguous question.
- Device platform split.

No live map of active sessions in v1 (D18).

### 6.7 Dedicated app builds (D9)

For operators who want their own store listing. The build is the same app with a pinned tenant, its own bundle identifier, icon, splash, and store listing. Because of store policies (§9.3), the app is published **from the operator's own Apple and Google developer accounts**; the operator grants our build account the necessary roles. The console has a **Dedicated app** page where the admin uploads icon and store assets and sees the status of each release. The release process is ours to run; the operator reviews the store listing.

---

## 7. Content model

Localized text is stored as a map from language code to string (`{"he": "...", "en": "..."}`) on every player-facing field. Media are referenced by asset id.

| Entity | Key fields |
|---|---|
| **Tenant** | id, slug, display name, theme (§9.1), contacts, legal URLs, status |
| **TenantUser** | tenant, email, role (`admin` / `editor`) |
| **Track** | tenant, draft content, published version pointer, status, leaderboard on/off, created/updated |
| **TrackVersion** | track, version number, immutable content snapshot (the same JSON that ships in the bundle), bundle reference, published at |
| **Leg** (in content) | id, name*, intro*, outro*, map kind (`tiles` / `image`), region or image asset, stations in order |
| **Station** (in content) | id (stable across versions), title*, intro content*, coordinates (optional when image map), image position (optional), arrival methods, radius, challenge, hints, points, reveal — how this station is presented when it becomes current (`pin` / `clue` / `both`), clue text* and image, distance feedback on/off, QR token |
| **Challenge** (in station) | type (`text` / `number` / `choice` / `multi_choice`), type-specific fields; for `text`: accepted answers per language, close-match flag; for `number`: value and tolerance; for choice types: options* and correct set, shuffle flag |
| **Hint** (in station) | text*, image (optional), cost |
| **Track rules** (in content) | order, visibility, reveal-and-continue availability, wrong-answer penalty, time bonus (par, cutoff), safety notes* |
| **Asset** | tenant, kind (image), original and resized renditions, size |
| **Bundle** | track version, URL, size, checksum, schema version, per-leg map artifacts |
| **Device** | anonymous id, platform, app version |
| **Account** (optional) | id, sign-in identities, created |
| **Session** | id (client-generated), device, account (optional), track version, language, team name, state, score, play time, started/finished; derived from events on the server |
| **SessionEvent** | id (client-generated UUID), session, sequence number, device time, type, payload |
| **LeaderboardEntry** | track, session, team name, score, play time, posted at; derived |

\* localized.

Event types: `session_started`, `leg_started`, `station_arrived {station, method}`, `hint_revealed {station, index}`, `answer_submitted {station, correct, normalized_text?}`, `station_completed {station, points}`, `station_revealed {station}`, `leg_completed`, `session_paused`, `session_resumed`, `session_finished {score, play_time}`, `session_abandoned`, `leaderboard_opt_in`.

---

## 8. Offline model (D6)

**Bundle.** One archive per track version: `manifest.json` (schema version, track version, sizes, checksums), `content.json` (all enabled languages), `media/` (images resized server-side to at most 1600 px on the long edge), and per-leg map artifacts — either a vector-tile extract of the leg's region for the zoom levels the venue scale needs, or the custom map image. Vector-tile legs also need the map's fonts and sprites offline: the bundle carries `fonts/<stack>/<range>.pbf` for the glyph ranges of the track's languages (Latin and punctuation always; the Hebrew block for `he`) and `sprites/` for the light and dark flavors, and the app assembles the map style on the device from them, so a bundle never carries a style file that could drift from the app's map version. The bundle is immutable and cached by version; visitors can delete it from settings.

**Size budget.** Single-venue tracks target ≤ 50 MB. The console shows the estimated bundle size while the operator works, and warns above 100 MB. Multi-leg tracks ship `content.json` and all media up front, and map artifacts per leg: the first leg's with the bundle, later legs' prefetched whenever the device is online, with the state shown between legs (§5.4).

**Local state.** Session state and the event log live in an on-device database. Every state change appends an event first and then updates the state, so a crash never loses progress.

**Sync.** A background worker uploads event batches whenever the device is online: events carry client-generated UUIDs and sequence numbers; the server stores them idempotently and acknowledges; acknowledged events are pruned locally. The server derives session state, analytics, and leaderboard entries from events, and sanity-checks the client-reported score and play time against its own recomputation; a mismatch is flagged, and the server's value wins.

**Leaderboard and clocks.** Durations are measured with the device's monotonic clock. "Today" buckets use the server's receipt time. Late-arriving results may change ranks after the fact; the UI says so.

**Station QR offline.** Each station's QR encodes a URL containing the station id and a short per-station token that is also in the bundle; the app validates the scan locally. Scanned with the phone's camera outside the app, the same URL opens the app at the track via a universal link, or the store if the app is missing.

---

## 9. Branding and distribution (D9)

### 9.1 Theme

A tenant theme is runtime configuration: display name, logo variants, primary and accent colors, derived text colors with contrast enforced, typography pairing, cover image, and result-card layout. The app is built theme-neutral; every color and typeface in the visitor UI comes from the theme. The standard map style is neutral grey so the theme colors carry.

### 9.2 Umbrella app

One store listing under our brand. The venue's theme applies from the moment a venue is entered. Deep links: `https://<domain>/v/<venue-slug>` opens the venue, `/t/<track-id>` opens a track, `/s/<track-id>/<station-id>?k=<token>` is the station QR. Universal links on iOS and App Links on Android; when the app is not installed, a web page shows the store link and the typed venue code, because deferred deep linking is not attempted in v1.

### 9.3 Dedicated builds

The same codebase with a build-time configuration: pinned tenant, bundle identifier, icon, splash, display name, and store listing. Apple's App Store Review Guideline 4.2.6 rejects apps created from a template or app-generation service unless they are submitted by the content's owner, and Google Play's spam policy contains an equivalent rule; dedicated builds are therefore always submitted through the operator's own developer accounts. Requirements the operator must meet: an Apple Developer Program organization membership (D-U-N-S number), a Google Play Console account, and granting our build account the roles needed to upload and submit. The operator is the publisher of record; we build, upload, and coordinate review.

---

## 10. Privacy, safety, and legal

**Data minimization by design (D17).** Anonymous play collects: an anonymous device id, the team name, the session's events (station-level: arrived, hint, answer correctness and — for wrong answers — normalized answer text, completed, finished), platform, app version, language. It does not collect: location traces (location is used on the device only), photos (none in v1), names, contacts, or any identifier of a person. Accounts add a sign-in identity and link sessions to it. Operators see aggregates and per-session event data without device ids.

**Children.** The product is not directed at children; it collects nothing from a child that it does not collect from anyone else, and that set contains no personal data. Accounts require the user to be at least 16. School groups play as a party on a teacher's or a student's phone exactly as families do.

**Roles.** For visitor data we are the data controller of the platform and the operator is a recipient of aggregated and pseudonymous analytics; the operator is the controller of the content and of any contact data they collect elsewhere. Applicable law for the first market is the Israeli Privacy Protection Law as amended; EU visitors bring the GDPR. The privacy notice is short, true, and shown in the app and at the store listing.

**Retention.** Raw session events: 13 months. Aggregates: indefinite. Anonymous sessions: no self-service deletion is possible beyond uninstalling; accounts can delete themselves with their history.

**Team names.** Filtered against a profanity list in Hebrew and English; operators can hide a leaderboard entry.

**Safety.** The operator writes safety notes per track, acknowledged at start. The emergency entry is one tap from the menu. The app never routes on roads and never asks for background location. For multi-day tracks the app states that transport and lodging are not part of the product.

---

## 11. Technical design

The owner had no standing preference (D19); the stack was chosen (D24) to follow from the decisions: a native app that is offline-first with offline maps and custom map images (D6, D12), theming as runtime configuration with per-tenant build variants (D9), localized content in two languages (D16), multi-leg tracks (D10), optional accounts (D17), and one developer building with AI assistance (D2).

### 11.1 Stack

| Layer | Choice | Why this and not the obvious alternative |
|---|---|---|
| Mobile app | **React Native with Expo** (TypeScript), EAS Build for per-tenant build variants | One language across app, console, and backend matters for a solo developer. Expo's build service makes dedicated builds a configuration (`app.config.ts` per tenant) rather than a project fork. Flutter would serve equally well technically; the choice is ecosystem uniformity. RTL needs a restart to switch at runtime — acceptable, language is chosen per session content-wise and UI language follows the device. |
| Maps | **MapLibre** (native SDK via the React Native binding; GL JS in the console) with **Protomaps PMTiles** as the tile format | Open source, no per-MAU pricing or terms limiting offline caching. A leg's region is cut from a planet PMTiles file with the `pmtiles extract` tool at bundle-build time and shipped inside the bundle. *Verified in documentation (spike-offline-map.md):* the binding (v11, New Architecture only) bundles MapLibre Native 13.x, which reads local archives as `pmtiles://file://<absolute path>`; `asset://` is not supported on Android, so extracts live in the files directory. The public builds stop at zoom 15 and the map overzooms beyond it. Device confirmation is the step 4 exit criterion; the fallback remains MapLibre offline packs. |
| Local storage | SQLite (expo-sqlite) for session state and the event queue; file system for bundles | Append-only event log, crash-safe |
| Console | **Next.js** (React, TypeScript), MapLibre GL JS map editor, CSS logical properties for RTL | Same language; RTL is a first-class concern |
| Backend | **TypeScript API service** (Fastify or NestJS) on **PostgreSQL**, S3-compatible object storage behind a CDN for bundles and media, background jobs for bundle builds, image resizing, PDF generation, and analytics rollups | The non-trivial work (bundle building, tile extraction, event ingestion, analytics) is server code regardless, so a backend-as-a-service saves less than it appears to. Supabase (Postgres + Auth + Storage + RLS) was considered and not chosen (D24). |
| Auth | Console: email magic link + passkeys. App accounts: Sign in with Apple, Google, email link | Minimal; Apple's rule on Sign in with Apple |
| Tenancy | `tenant_id` on every tenant-owned row; enforced in the data-access layer; Postgres row-level security as a second line | Ordinary SaaS multi-tenancy (D3); no hierarchy (D7) |

### 11.2 Services and flows

- **Content API** (console): CRUD on tracks' drafts, assets, translations; publish → enqueue bundle build.
- **Bundle builder** (job): snapshot draft → `TrackVersion`; resize media; extract map regions; write archive; checksum; upload; mark published.
- **Delivery API** (app): venue lookup by slug/code/proximity; track list; bundle manifest and download URLs (CDN).
- **Ingestion API** (app): batched events, idempotent by event id; derives sessions; posts leaderboard entries on `session_finished` + `leaderboard_opt_in`.
- **Analytics** (job): nightly and on-demand rollups per track version and station.
- **Print** (job): QR PDFs.
- **Platform admin** (console area): tenants, users, build configurations, audit log.

### 11.3 Data model notes

Drafts are normalized enough to edit comfortably (tracks, legs, stations as rows with JSONB for challenge configuration and localized strings); a published version is an immutable JSON snapshot, which is also the `content.json` in the bundle, so the app and the console never disagree about what a version contains. Station ids are UUIDs minted once and preserved across versions. Sessions and events are the system of record for everything analytic; leaderboard entries and session summaries are derived and rebuildable.

### 11.4 Things to prove in the prototype

PMTiles in the React Native MapLibre binding; offline region sizes for a venue at zoom 14–18; RTL layout in React Native on Android (iOS at the start of v1, D33); QR scanning speed in poor light; GPS arrival behavior in a dense venue; bundle download time on venue Wi-Fi.

---

## 12. Phasing

### 12.1 Prototype — to show to the first operators (D20)

Purpose: demonstrate the visitor experience in a real, small venue under a fictional operator's brand, and prove the offline and map decisions.

| Area | Prototype scope |
|---|---|
| Operator | One fictional operator, **Ein Dror Nature Park**, mock-branded; theme applied inside the umbrella app; no dedicated build |
| Platform | Android only (D33). iOS is brought up at the start of v1, before any v1 feature |
| Track | One track, one leg, 6–8 stations, Hebrew and English |
| Mode | Model A: `linear`, `progressive`, `clue` (D13); distance-only feedback on |
| Arrival | `manual` only (D11). GPS is still read for the party's position on the map and for distance-only feedback; it is not used to verify arrival |
| Challenges | `text`, `number`, `choice`; hints; reveal-and-continue; scoring per §4.6 |
| Map | Standard tiles, offline region in the bundle; no custom image map |
| Offline | Full bundle download; crash-safe local state; event sync; result card; leaderboard when online |
| Players | Anonymous only; no accounts |
| Console | **Not built.** Content is authored as JSON and published with a script |
| Analytics | Events stored; no dashboard |

Backend pieces the prototype needs from §11.2: the bundle builder (run as a command-line tool over the JSON content), the delivery API, and the ingestion API including leaderboard derivation. Not built for the prototype: the content API, analytics rollups, print jobs, platform admin.

Suggested order of work, each step ending in something that runs:

1. The bundle format and the mock track's JSON. *Done: `packages/bundle-schema/schemas`, `content/ein-dror`.*
2. The repository scaffold and the validator — schema validation plus the builder invariants — so every later step runs against content that is known to be valid. *Done: `packages/bundle-schema`.*
3. The app shell with the theme applied and the venue home. *Done: `apps/mobile` — Expo SDK 57 with expo-router routes matching the deep-link paths, tenant theme from the tenant document, Hebrew and English UI with RTL, umbrella home, venue home, track details, QR scanner, settings; a fixture delivery client over `content/` until step 7. Verified on the web target.*
4. The offline-map spike: PMTiles in the React Native MapLibre binding, with a region extract for the test venue. This is the step most likely to change the stack, so it comes before anything depends on the map. *Done on an Android emulator: a release build cold-started in airplane mode renders the map from a local PMTiles extract with Hebrew and English labels, live position, and distance feedback, at about 4 MB of map assets; see spike-offline-map.md. Physical-phone confirmation happens in step 8.*
5. The station flow: clue, manual arrival, the three challenge types, hints, reveal-and-continue, scoring. *Done and verified on the emulator (Spring Trail played end to end, all seven stations, result card at 700 points): `packages/game-core` (normalization, matching, scoring, the event log and reducer, commands — 25 tests, including a no-dead-end walk of the Spring Trail); `packages/bundle-builder` (validate → snapshot → media → tiles and basemap assets → hashed manifest → zip); and the app side — the start flow (`/t/[trackId]/start`: language, team name, safety, verified download and unpack), the play screen (`/play`: map, clue, arrival, the three challenge inputs, hints, reveal-and-continue, per-station feedback), the result card (`/finish`), and a dev pin-capture screen (`/dev/pins`).*
6. Crash-safe local state and the event log. *Done and verified on the emulator: SQLite through `expo-sqlite` (`src/db/`) with append-then-apply persistence, restore-on-launch, pause/resume on the monotonic clock, a downloads screen that lists and deletes bundles, and schema-version gating.*
7. The delivery and ingestion APIs, sync, the result card, the leaderboard. *Code done and verified locally: `apps/api` (Fastify + Drizzle over Postgres; every endpoint; idempotent event ingestion that recomputes the score with game-core and derives leaderboard entries) with a seed for Ein Dror; the app's HTTP delivery client, event-log sync worker, and leaderboard screen. An offline playthrough on the emulator synced on reconnect and appeared on the leaderboard with the server-computed score. The hosted deployment awaits D27 (hosting) and D31 (domain); the code is provider-agnostic.*
8. Editor v0 (D34): the operator edits the track and publishes a new version from a small web console served by the API, with the map for pins, the validation report, and leaderboard moderation. *Done and verified end to end on the hosted service 2026-08-22: `apps/api/src/editor` (password + signed cookie, drafts in `track_drafts`, publish as version N+1 building the bundle on the server from the cached map artifacts) and `apps/console` (a React + Vite SPA served under `/console`). Signed in, edited a question and a hint, dragged a pin, validated, published — the app then downloaded the new version and its content carried the edits — and hid and unhid a leaderboard entry.*
9. A field test at the venue with people who have not seen the app.

### 12.2 v1 — the product

Everything in sections 4–11 not marked as a non-goal, on iOS and Android (D33): all modes, all four arrival methods, both map kinds, multi-leg tracks, both challenge families, the full console with translations, publishing and versions, QR print materials, analytics, optional accounts with history, umbrella app and dedicated builds, Hebrew and English throughout.

### 12.3 Later

Photo tasks and a shareable recap (D15); audio content; AI-assisted authoring (D5); additional languages, each treated as a product change with UI verification, not a string drop (D16); branching paths and "complete N of M"; a live view of active sessions; push notifications; cross-device session resume; synchronized event mode (D21); payments and operator self-signup; a marketplace of tracks.

---

## 13. Risks and open questions

| Risk | Mitigation |
|---|---|
| Bundle size for country-scale legs (map extracts) | Per-leg download, zoom caps by leg extent, size shown to the operator while editing |
| GPS unreliable in dense or indoor venues | `qr` and `manual`; accuracy-aware prompting; operators warned in the editor |
| RTL and Hebrew typography in React Native | Prove on Android in the prototype; iOS is the first work package of v1 |
| Store review of dedicated builds (guideline 4.2.6) | Always published from the operator's accounts with distinct branding and content |
| One developer across three surfaces | Shared TypeScript; the prototype deliberately omits the console; versioned bundle schema so app and backend can move independently |
| Content quality depends on operators | Answer tester in the editor, validation before publish, wrong-answer analytics |
| Leaderboard abuse | Opt-in, name filter, operator hide |
| Solo device per party: phone dies, party splits | Stated trade-off; cross-device resume is a later feature |

No decisions are open. D14 (scoring) and D18 (console scope) are provisional and will be revisited after the prototype has been played; the verification items in §11.4 are the prototype's technical exit criteria.

---

## Appendix A. Glossary

- **Operator** — the customer organization (tenant).
- **Venue** — the operator's public presence in the app: name, brand, list of tracks.
- **Track** — a published, versioned piece of content: legs, stations, rules.
- **Leg** — an ordered group of stations with its own map region; single-venue tracks have one.
- **Station** — a place with intro content and at most one challenge.
- **Challenge** — the question at a station; typed.
- **Party / team** — the group of visitors playing on one phone.
- **Session** — one party playing one track version on one device.
- **Bundle** — the downloadable archive for a track version.
- **Umbrella app** — our store app hosting every venue; **dedicated build** — an operator's own store app from the same code.
- **Model A / B / C** — treasure hunt / station walk / place-gated progressive; see §4.2.
