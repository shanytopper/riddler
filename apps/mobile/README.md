# @riddles/mobile

The player app: React Native with Expo (SDK 57) and expo-router. Design: [docs/design.md](../../docs/design.md) §5 (visitor experience), §9 (branding and distribution), §11 (stack).

## Run

```bash
npm run web -w @riddles/mobile        # in a browser, the quickest way to see screens
npm run start -w @riddles/mobile      # Metro; press a / i for a simulator, or scan with a dev build
npm run typecheck -w @riddles/mobile  # needs @riddles/bundle-schema built once: npm run build
npm test -w @riddles/mobile           # pure modules under Node's test runner
```

The prototype targets Android only (decision D33): since step 4 the app has native modules, so it runs as a local development build — `npm run android -w @riddles/mobile` — not in Expo Go. iOS is brought up at the start of v1. The web target stays the quickest way to look at screens.

The Android toolchain (SDK command-line tools, JDK 17) lives under the user profile and is found by `scripts/android-env.mjs` without persistent environment variables; `npm run adb -- <args>` and `npm run device -- <command>` (emulator create/start, `wait-boot`, `screenshot`, `geo`, `airplane`, `open`, `logcat`) go through it. Setup details: [docs/spike-offline-map.md](../../docs/spike-offline-map.md).

`plugins/withShortNativeBuildDir.js` is a local Expo config plugin that moves the Android CMake build tree to the repository root (`.cxx/`); without it the release build exceeds Windows' 260-character path limit. Local plugins live in `plugins/` and are listed in `app.config.ts`; they are re-applied by `npx expo prebuild`.

Before reading or writing Expo code, see `AGENTS.md`: the template pins the SDK 57 docs, and several things differ from older SDKs (no `@react-navigation/*` imports — use `expo-router`; splash is configured by its plugin; `newArchEnabled` no longer exists).

## Layout

```
app/                     expo-router routes — the URL paths from design.md §9.2
  index.tsx              umbrella home: scan, enter a code, near you, recent  (/)
  scan.tsx               QR scanner for venue, track, and station codes     (/scan)
  settings.tsx           app language                                       (/settings)
  v/[slug].tsx           venue home, in the operator's theme                (/v/<slug>)
  t/[trackId]/index.tsx  track details                                      (/t/<trackId>)
  t/[trackId]/start.tsx  language → team name → safety → download           (/t/<trackId>/start)
  t/[trackId]/play.tsx   the map and the station in play                    (/t/<trackId>/play)
  t/[trackId]/finish.tsx result card, leaderboard opt-in, share             (/t/<trackId>/finish)
  downloads.tsx          storage screen: list and delete downloaded bundles (/downloads)
  dev/map.tsx            step-4 map spike screen                            (/dev/map)
  dev/pins.tsx           pin capture: take GPS fixes at each station        (/dev/pins)
  +not-found.tsx
src/
  theme/                 buildTheme(tenant.theme) → tokens; ThemeProvider; the neutral umbrella theme
  i18n/                  UI strings (he, en), language detection (persisted), localized() for content text
  delivery/              DeliveryClient interface; FixtureDeliveryClient over content/ (until step 7); link parsing
  bundles/               download a bundle, verify every file against the manifest, unpack, load, delete
  db/                    SQLite (expo-sqlite): sessions + append-only events, bundles, recent venues, settings
  play/                  PlayProvider (game-core commands + persisted event log), StationPanel, ChallengeInput, team names
  map/                   TrackMap (native + web), style assembly, map sources, geo helpers
  location/              usePosition
  components/            Screen, ThemedText, Button, Card, Chip, Header, VenueHeader, TrackCard, LinkRow
  state/                 recent venues (backed by the db)
  util/                  emergency numbers by country
```

Imports use explicit `.ts`/`.tsx` extensions so the pure modules run under Node's test runner — with one exception: **platform-split modules** (`TrackMap.tsx` + `TrackMap.web.tsx`) must be imported _without_ an extension, because Metro only applies its `.web.tsx`-first resolution to extensionless imports.

Every color and typeface on a venue or track screen comes from the tenant's theme through `ThemeProvider`; the root mounts a neutral theme and venue routes mount the tenant's. Text goes through `ThemedText`, which applies the theme font and the UI language's writing direction.

## Dedicated builds

Set these at build time to produce an operator's own app (design.md §9.3); the umbrella app leaves them unset:

| Variable                                           | Effect                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `RIDDLES_TENANT_SLUG`                              | Pins the tenant; the app opens on `/v/<slug>` and never shows the umbrella home |
| `RIDDLES_APP_NAME`                                 | Display name                                                                    |
| `RIDDLES_SCHEME`                                   | Custom URL scheme                                                               |
| `RIDDLES_IOS_BUNDLE_ID`, `RIDDLES_ANDROID_PACKAGE` | Store identity                                                                  |

Icon, splash, and store assets are still the template placeholders; per-tenant assets are part of the dedicated-build work.

## Right-to-left

Native layout mirroring follows the device language through React Native's `I18nManager`; `expo-localization` is configured with `supportedLocales` `en` and `he` so iOS honors Hebrew. The in-app language setting changes strings immediately; layout direction changes after a restart. On web the provider sets `dir` and `lang` on the document. Both platforms must be checked on real devices — it is one of the prototype's listed verification items (design.md §11.4).

## Map (step 4 spike)

`src/map/` renders a track's leg with MapLibre: `TrackMap.tsx` (MapLibre Native, reads a PMTiles extract offline as `pmtiles://file://…`) and `TrackMap.web.tsx` (MapLibre GL JS with the `pmtiles` protocol). The style is assembled on the device from `@protomaps/basemaps` (`style.ts`); `sources.ts` decides between the local bundle layout, the configured assets host (`EXPO_PUBLIC_MAP_ASSETS_URL`), and the public Protomaps build. `/dev/map` is the spike screen. Offline assets come from `npm run extract-map` at the repository root, which needs the go-pmtiles CLI. Full notes and the device checklist: [docs/spike-offline-map.md](../../docs/spike-offline-map.md).

On web, MapLibre's worker must be served as a static file: `scripts/sync-web-assets.mjs` copies it into `public/vendor/maplibre/` and runs automatically before `npm start` / `npm run web`.

## Play (step 5)

`Start` on the track screen opens the start flow: language, team name (with suggestions and a light filter), the safety notes, then the bundle download. The fixture delivery client fetches `<trackId>-v1.manifest.json` and the zip from `EXPO_PUBLIC_BUNDLES_URL` (`.env`; `http://10.0.2.2:8081/bundles` is Metro's `public/bundles` as seen from the emulator) — run `npm run bundle` at the repository root first. `src/bundles/bundleStore.ts` downloads the archive, checks every file's SHA-256 against the manifest, unpacks into `<documents>/bundles/<trackId>/v<n>/`, and only then writes the `.installed` marker. From there the map, content, fonts, and sprites all come from that directory.

`src/play/PlayProvider.tsx` holds the session in play: the bundle, the event log, and the state folded from it with `@riddles/game-core`. Screens call commands (`arrive`, `revealHint`, `submitAnswer`, `revealAndContinue`, `leave`); the provider appends the events they produce. The play screen shows the map above and the station below — the clue with distance and "We're here", then the intro, the challenge, the hints with their costs, and reveal-and-continue when the rules allow it. Finishing opens the result card.

## Local state (step 6)

`src/db/` is the on-device database (`expo-sqlite`, native only; on web the handle is null and every repo is a no-op so screens still render). Tables: `sessions`, an append-only `events` log, `bundles`, `recent_venues`, `settings`; migrations are gated on `PRAGMA user_version`. The rule is **append-then-apply** — `PlayProvider` writes each command's events to the log (a synchronous transaction) _before_ the in-memory state updates, so a crash never loses progress and an airplane-mode playthrough leaves a complete, ordered log.

On launch `PlayProvider` restores the most recent unfinished session: it re-reads the event log, re-derives state with the reducer, and reloads the bundle from disk, so killing the app mid-challenge (hints open, score counted) relaunches into the exact same screen. Play time uses the monotonic clock; the provider pauses on backgrounding and resumes on foreground (and on opening the play screen), and a session left "active" by a hard crash is paused on restore so the dead process's stretch is dropped rather than miscounted. Starting a finished track again creates a new session row and keeps the old one.

Settings → **Manage downloads** (`/downloads`) lists installed bundles with their size and version and deletes them (files and record); it warns when a game on that track is still in progress. The UI language override and recent venues now live in the database. Bundles are refused at the start flow if their `manifest.schemaVersion` is newer than the app understands (`schemaSupport` in `bundleStore.ts`).

Unpacking uses fflate on the JS thread, which is fine at the prototype's bundle sizes; a native unzip is part of the v1 storage work.

## Delivery and sync (step 7)

When `EXPO_PUBLIC_API_URL` is set (`.env`; `http://10.0.2.2:4000` is a locally-running [`@riddles/api`](../api/README.md) as seen from the emulator), `src/delivery/client.ts` uses the HTTP delivery client instead of the fixture — same `DeliveryClient` interface, so venue, track, and bundle screens are unchanged; the bundle downloads from the API. Unset, it falls back to the repository fixtures.

`src/sync/syncManager.ts` uploads the event log to the ingestion API. It keeps a per-session high-water mark (`synced_seq`): `syncNow()` walks sessions with events the server hasn't acknowledged, POSTs the new ones, and advances the mark on success. It's safe to call anytime — idempotent on the server, and an offline failure just leaves the mark for the next attempt. Triggers: after each event batch (debounced), on returning to the foreground, and on launch. So a party can play a whole track with no signal, and the moment the app is back online its events upload and the result appears on the leaderboard.

The leaderboard screen (`/t/[trackId]/leaderboard`, linked from the result card) shows the server-ranked entries with an all-time / today toggle and an offline state; opting in happens on the result card. The server recomputes the score from the events, so the leaderboard shows the server's value, not the phone's.

Not yet: accounts and saved history; the hosted deployment (owner decisions D27 hosting, D31 domain) — the client is provider-agnostic and points wherever `EXPO_PUBLIC_API_URL` says.
