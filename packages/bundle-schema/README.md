# @riddles/bundle-schema

JSON Schemas (draft 2020-12) for the contract between the backend, the bundle builder, and the player app; TypeScript types generated from them; and the validator the builder runs before publishing. Design context: [docs/design.md](../../docs/design.md) §7 (content model) and §8 (offline model).

| Schema                         | Describes                                                   | Written by                                                                  |
| ------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `schemas/content.schema.json`  | `content.json` — one published track version, all languages | Authored (prototype: by hand; v1: by the console), validated by the builder |
| `schemas/manifest.schema.json` | `manifest.json` — what is in the archive, sizes, hashes     | The bundle builder only                                                     |
| `schemas/tenant.schema.json`   | The venue document the app fetches when entering a venue    | The delivery API (prototype: a hand-written file)                           |

## Usage

From the repository root, `npm run validate` checks everything under `content/`. Directly:

```bash
node packages/bundle-schema/src/cli.ts content/ein-dror            # a directory, searched recursively
node packages/bundle-schema/src/cli.ts path/to/content.json        # one file; kind inferred from the name
node packages/bundle-schema/src/cli.ts some.json --kind tenant     # or given explicitly
node packages/bundle-schema/src/cli.ts content --json              # machine-readable
```

Exit code 1 when any file has errors (schema violations or invariant errors), 2 on usage errors. Warnings never fail the run.

As a library (after `npm run build`, or directly from `src/` inside the monorepo):

```ts
import {
  validateFile,
  validateTree,
  validateDocument,
  type TrackContent,
} from "@riddles/bundle-schema";

const report = validateFile("content/ein-dror/tracks/spring-trail/content.json");
report.schema; // schema violations; when non-empty the invariants did not run
report.errors; // invariant errors — the builder refuses to publish
report.warnings; // invariant warnings
```

Types: `TrackContent`, `Leg`, `Station`, `Waypoint`, `Challenge`, `Tenant`, `BundleManifest`, and the rest of `src/generated/`. Regenerate after a schema change with `npm run generate-types`; the generated files are committed.

Tests: `npm test` (Node's built-in runner; TypeScript runs directly on Node 24, no build).

## Bundle layout

```
<trackId>-v<trackVersion>.zip
├── manifest.json
├── content.json
├── media/<mediaId>.<ext>        resized by the builder, ≤ 1600 px on the long edge
└── maps/<legId>.pmtiles         vector-tile extract of the leg's bounds, or
    maps/<legId>.<ext>           the leg's custom map image
```

The manifest is also served on its own so the app can show the size before downloading. Map artifacts for legs after the first may be `deferred`: listed in the manifest, absent from the archive, fetched when the device is next online.

## Authoring

An authored track is a folder with `content.json` and a `media/` directory. The authored file has exactly the shape of the bundle's `content.json`, so nothing is transformed on publish except: media paths are rewritten to `media/<id>.<ext>`, missing `qrToken`s are generated, and `authoringNotes` is removed.

Where settings live, because it is not obvious:

- **`reveal` is on the station being revealed**, not on the one before it. It answers "how does this station appear when it becomes current": as a map pin, as a clue, or both. The first station of a leg is always a pin whatever its `reveal` says. Under `visibility: all` the field is ignored.
- **`arrival.methods` lists automatic methods only** (`gps`, `qr`). Manual check-in is always offered and is not configurable. `arrival.automatic: true` skips arrival entirely (the original design's `none`).
- **A leg's `start` and `end` are waypoints, not stations.** `start` is where the party meets before the first station, `end` where the leg finishes after the last one; when either is absent the first or last station plays the part. They are informational — shown on the map with their optional `note`, no arrival step, no events — and placed like a station: `location` inside the bounds on a tiles map, `imagePosition` on an image map. A circular route gives `end` the same location as `start`.
- **`accepted` answers are per language.** The Hebrew and English answer sets of the same text challenge are independent.
- **A challenge with no hints** makes "reveal and continue" available immediately, whatever `rules.revealAndContinue` says; otherwise a party could be stuck.

## Invariants the builder enforces

JSON Schema cannot express these; `contentInvariants` and `tenantInvariants` in `src/invariants.ts` implement them, and the builder rejects (or warns on) them before publishing.

Errors:

1. Every localized string and answer list contains every language in `languages`; `defaultLanguage` is one of `languages`.
2. Station ids are unique across the track; option ids are unique within a challenge; `correctOptionId` / `correctOptionIds` refer to existing options.
3. Media ids are unique; every referenced media id exists in `media`; every media path exists on disk; every image shown to visitors (cover, content blocks, clue and hint images — not map images) has `alt`.
4. On a `tiles` map every station, and the leg's `start` and `end` when present, has a `location` inside the leg's `bounds`. On an `image` map each has an `imagePosition`.
5. `gps` in `arrival.methods` and `reveal.distanceFeedback: true` both require `location`.
6. A station with `challenge: null` has `points: 0` and no hints.
7. `timeBonus.cutoffSeconds > timeBonus.parSeconds`.
8. `minZoom ≤ maxZoom`; `bounds` is west < east and south < north.
9. Within one tenant, track slugs are unique (checked across files by `validateTree`).

Warnings:

10. The sum of hint costs exceeds the station's points (the extra cost is never applied; points floor at zero).
11. The first station of a leg has `reveal.as` other than `pin` on a progressive track (it is shown as a pin anyway).
12. A `qr` station has no `qrToken` (the builder generates one).
13. A track is published in a language the tenant does not list.
14. Media alone exceed 50 MB; error above 100 MB. Map extracts are added by the builder on top of this.

Tenant documents: `defaultLanguage` is one of `languages`; localized strings are complete; `onPrimary` against `primary` and `onAccent` against `accent` reach a contrast ratio of 4.5:1.

## Versioning

`schemaVersion` is an integer shared by the manifest and content. Adding an optional field does not bump it; removing or renaming a field, changing a type, or changing the meaning of an enum value does. The app supports the current version and the previous one; on a newer bundle it asks the visitor to update before downloading. Sessions already on an older bundle keep working.

## Example manifest

```json
{
  "schemaVersion": 1,
  "bundleId": "8d2c6b6e-1f7a-4e3b-9c5d-7a1e2f3b4c5d",
  "tenantId": "7c1f0d2e-5a3b-4c8d-9e1f-2a3b4c5d6e7f",
  "trackId": "3f9a2b1c-8d7e-4f60-a1b2-c3d4e5f60718",
  "trackVersion": 1,
  "publishedAt": "2026-09-01T08:00:00Z",
  "languages": ["he", "en"],
  "files": {
    "content": {
      "path": "content.json",
      "bytes": 18234,
      "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
    },
    "media": [],
    "maps": [
      {
        "legId": "9b8c7d6e-5f40-4a31-b2c3-d4e5f6071829",
        "kind": "pmtiles",
        "delivery": "bundled",
        "path": "maps/9b8c7d6e-5f40-4a31-b2c3-d4e5f6071829.pmtiles",
        "bytes": 3145728,
        "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "bounds": [34.802, 32.095, 34.818, 32.106],
        "minZoom": 13,
        "maxZoom": 18
      }
    ]
  },
  "totalBytes": 3163962
}
```
