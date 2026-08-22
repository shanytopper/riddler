# Riddles

White-label, offline-first location-based riddle tracks for venue operators — zoos, museums, parks, tourism offices. An operator authors stations and challenges, visitors play them in a native app that works without connectivity after one download. Working name; see [docs/design.md](docs/design.md) for the product and technical design and [docs/decision-log.md](docs/decision-log.md) for how every decision was made.

## Layout

```
packages/
  bundle-schema/      JSON Schemas for the track bundle, generated TS types, and the validator
  game-core/          the rules of play: answer matching, scoring, the session event log and reducer
  bundle-builder/     authored track → validated, hashed, zipped bundle (media, tiles, fonts, sprites)
apps/
  mobile/             the player app (Expo / React Native)
  api/                delivery + ingestion API (Fastify + Drizzle over Postgres); console (Next.js) comes in M2
content/
  ein-dror/           the mock operator for the prototype: tenant.json and tracks/*/content.json
docs/                 design, roadmap, decision log, the original spec and its review
```

## Requirements

Node 24 or newer (TypeScript files run directly, no build step for tooling). npm workspaces.

```bash
npm install
```

## Commands

```bash
npm run validate      # validate everything under content/ against the schemas and the builder invariants
npm run bundle        # build the Spring Trail bundle into apps/mobile/public/bundles (needs go-pmtiles)
npm run extract-map   # only the offline map data, in bundle layout, into apps/mobile/public/maps
npm test              # unit tests in every workspace
npm run typecheck
npm run generate      # regenerate TypeScript types from the JSON Schemas
npm run format
```

## Status

Prototype, steps 1–7 of the order of work in [docs/design.md §12.1](docs/design.md) are done and verified on the emulator: the bundle format and validator, the app shell, the offline-map spike, the station flow (game-core + bundle builder + the play screens), crash-safe local state (`expo-sqlite`), and the delivery + ingestion API with sync and the leaderboard (`apps/api`, see its README). An offline playthrough syncs on reconnect and appears on the leaderboard with the server-computed score. The API is hosted on Render free tiers (D27, no domain until the go/no-go) at `https://riddles-api-vv2y.onrender.com`, built from this repository (`render.yaml`, `apps/api/scripts/render-deploy.mjs`); the hosted Postgres is seeded with Ein Dror. Next: the field test (step 8).

```bash
npm run web -w @riddles/mobile     # the app in a browser
```
