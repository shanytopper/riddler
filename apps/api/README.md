# @riddles/api

The delivery and ingestion API: it serves venues, tracks, and bundles to the app, and ingests session event batches idempotently, deriving leaderboard entries with the same rules the app plays by. Design: [docs/design.md](../../docs/design.md) §8 (offline and sync), §11.1–11.3 (stack, services, data model). Hosting: decision D27 in [docs/decision-log.md](../../docs/decision-log.md).

## Run locally

```bash
npm run seed -w @riddles/api      # publish Ein Dror from content/ into the local database
npm run start -w @riddles/api     # listen on :4000 (PORT)
npm test -w @riddles/api          # integration tests over an in-memory Postgres
npm run typecheck -w @riddles/api
```

Node 24 runs the TypeScript directly. With no `DATABASE_URL`, the API uses **PGlite** — an embedded Postgres that needs no server — persisted under `apps/api/.data/` (gitignored); tests use an in-memory PGlite. The seed needs the go-pmtiles CLI for the map extract (like `npm run bundle`) unless the extract is already in `.cache/map-assets`; it takes tiles from the Protomaps daily build of _yesterday_ (today's may not be published yet) — set `PROTOMAPS_BUILD=YYYYMMDD` to pin one.

The emulator reaches a locally-running API at `http://10.0.2.2:4000`; set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to switch the app from the fixture client to the HTTP one.

## Endpoints

| Method | Path                                                        | Purpose                                                                                                  |
| ------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                                                   | Liveness                                                                                                 |
| GET    | `/venues`                                                   | Nearby venues (every tenant, for the prototype)                                                          |
| GET    | `/v/:slug`                                                  | A venue (tenant) by slug                                                                                 |
| GET    | `/tenants/:tenantId/tracks`                                 | Published track summaries                                                                                |
| GET    | `/tracks/:trackId`                                          | `{ tenant, track }` for the track screen                                                                 |
| GET    | `/tracks/:trackId/bundle`                                   | `{ manifest, zipUrl }` — the published bundle release                                                    |
| GET    | `/storage/:key`                                             | The bundle archive                                                                                       |
| POST   | `/sessions/:sessionId/events`                               | Ingest an event batch (idempotent by event id)                                                           |
| GET    | `/tracks/:trackId/leaderboard?window=all` or `window=today` | Server-ranked entries; "today" is the venue's local day (`LEADERBOARD_TIMEZONE`, default Asia/Jerusalem) |
| GET    | `/sessions/:sessionId/result`                               | The server-computed session result                                                                       |

## How ingestion works

The app uploads its event log in batches. `ingest.ts` shape-checks every event, stores each once (replaying a batch changes nothing; a sequence number that already holds a _different_ event is refused with 409), then re-derives the session with **`@riddles/game-core` — the same reducer the app runs** — and recomputes the authoritative score **from the track's content**: each station counts once, only if it exists, for what its points, hint costs, and wrong-choice penalty allow given the hints and wrong answers in the log — the points the client wrote into its events are ignored. A mismatch with the client's report is flagged; the server's value is what reaches the leaderboard. When the session is finished and opted in, an entry is published (opting out withdraws it); a team name that fails the shared filter is stored hidden. The acknowledgement is the contiguous prefix of stored events, so the app never marks a gap as synced.

Guards for a public endpoint without accounts (prototype): a session stays bound to the device that opened it (another device gets 403), batches are capped at 500 events and sessions at 5000, malformed input is a 400, and play time is stored as whole milliseconds (the device's monotonic clock reports fractions). Real authentication and rate limiting are v1 work.

## Storage

Bundle archives live in Postgres (`bundle_objects`, bytea) behind the `Storage` interface in `storage.ts`. That keeps the prototype to one free database and lets the API run on a host with no persistent disk; v1 moves archives to S3-compatible storage behind a CDN by implementing the same interface.

## The hosted environment (D27: Render, free tiers)

- **Database:** a free Render Postgres in Frankfurt (1 GB; **expires 30 days after creation**, 14-day grace, one per workspace, no backups). Its external connection string is kept in the gitignored `apps/api/.env` as `DATABASE_URL`; external connections use TLS and the API verifies the certificate, while Render's internal (dotless) hostname is reached over the private network without TLS (`db/client.ts`).
- **Service:** a free Render web service (sleeps after 15 minutes idle, ~1 minute to wake — warm it before a demo or a field test). [`render.yaml`](../../render.yaml) at the repository root describes it: Node 24, `npm ci && npm run build`, `node apps/api/src/main.ts`, health check on `/health`, `DATABASE_URL` from the database. `scripts/render-deploy.mjs` creates the same service through Render's API from a pushed repository and waits for the deploy: `node --env-file=apps/api/.env apps/api/scripts/render-deploy.mjs --repo https://github.com/<owner>/<repo>` (needs `RENDER_API_KEY` or the `Render_Key` variable). Behind Render's proxy the service trusts `X-Forwarded-Proto`, and `RENDER_EXTERNAL_URL` is used for bundle download URLs.
- **Publishing content:** run the seed from a dev machine against the hosted database — `node --env-file=apps/api/.env apps/api/src/seed.ts`. The archive bytes go into Postgres too, so the service needs nothing on disk. Re-run to republish; when the free database expires, create a new one, update `.env`, and re-seed.
- **The app:** set `EXPO_PUBLIC_API_URL=https://<service>.onrender.com` in `apps/mobile/.env` and build a release APK; the app reads venues, tracks, and bundles from it and syncs its event log to it.

No domain during the prototype (D31 deferred): the `*.onrender.com` subdomain has TLS, and the app's links use the `riddles://` scheme.

## Layout

```
src/
  db/schema.ts     Drizzle tables (D26); schema.sql is the matching DDL, applied at startup
  db/client.ts     open PGlite (local/tests) or node-postgres (DATABASE_URL, TLS verified); apply the schema
  storage.ts       Storage interface + PostgresStorage (bundle archives as bytea)
  summary.ts       TrackContent → the app's TrackSummary shape
  ingest.ts        validation, idempotent ingestion, content-based score recomputation, leaderboard derivation
  server.ts        the Fastify routes
  publish.ts       build a bundle and upsert the tenant/track/version/bundle rows
  seed.ts          publish Ein Dror from content/ (local or hosted, per DATABASE_URL)
  main.ts          the entrypoint
scripts/
  render-deploy.mjs  create the Render web service from a pushed repository and wait for the deploy
```

## Not yet

Content-authoring endpoints and the background bundle-build job arrive with the console (M2). Accounts, authentication, and rate limiting are later. Production migrations use drizzle-kit; the prototype applies `schema.sql` idempotently.
