import type { Station, TrackContent } from "./generated/content.ts";
import type { BundleManifest } from "./generated/manifest.ts";
import type { Tenant } from "./generated/tenant.ts";

export const L = (he: string, en: string): { he: string; en: string } => ({ he, en });

export const TRACK_ID = "3f9a2b1c-8d7e-4f60-a1b2-c3d4e5f60718";
export const LEG_ID = "9b8c7d6e-5f40-4a31-b2c3-d4e5f6071829";
export const STATION_A = "0a1b2c3d-4e5f-4061-8a9b-0c1d2e3f4a5b";
export const STATION_B = "1b2c3d4e-5f60-4172-9bac-1d2e3f4a5b6c";
export const MEDIA_A = "aaaa1111-2222-4333-8444-555566667777";

export function station(overrides: Partial<Station> & Pick<Station, "id">): Station {
  return {
    title: L("תחנה", "Station"),
    intro: [],
    location: { lat: 32.1, lng: 34.81 },
    arrival: { methods: [], automatic: false, radiusMeters: 30 },
    challenge: {
      type: "text",
      prompt: L("?", "?"),
      accepted: { he: ["כן"], en: ["yes"] },
      closeMatch: true,
    },
    hints: [],
    points: 100,
    reveal: { as: "pin", distanceFeedback: false },
    ...overrides,
  };
}

/** A two-station Model A track that satisfies the schema and every invariant. */
export function minimalContent(): TrackContent {
  return {
    schemaVersion: 1,
    trackId: TRACK_ID,
    slug: "test-track",
    name: L("מסלול", "Track"),
    description: L("תיאור", "Description"),
    coverMediaId: null,
    languages: ["he", "en"],
    defaultLanguage: "he",
    difficulty: "easy",
    estimate: { durationMinutes: 30, distanceMeters: 500 },
    safetyNotes: L("זהירות", "Take care"),
    rules: {
      order: "linear",
      visibility: "progressive",
      revealAndContinue: "afterFirstHint",
      wrongChoicePenaltyPercent: 25,
      timeBonus: null,
      leaderboard: true,
    },
    media: [],
    legs: [
      {
        id: LEG_ID,
        map: { kind: "tiles", bounds: [34.8, 32.09, 34.82, 32.11], minZoom: 13, maxZoom: 18 },
        stations: [
          station({ id: STATION_A }),
          station({
            id: STATION_B,
            location: { lat: 32.102, lng: 34.812 },
            reveal: { as: "clue", clue: { text: L("רמז", "Clue") }, distanceFeedback: true },
            challenge: {
              type: "choice",
              prompt: L("?", "?"),
              options: [
                { id: "a", text: L("א", "A") },
                { id: "b", text: L("ב", "B") },
              ],
              correctOptionId: "a",
              shuffle: true,
            },
            hints: [{ text: L("רמז", "Hint"), cost: 20 }],
          }),
        ],
      },
    ],
  };
}

export function minimalTenant(): Tenant {
  return {
    schemaVersion: 1,
    tenantId: "7c1f0d2e-5a3b-4c8d-9e1f-2a3b4c5d6e7f",
    slug: "test-venue",
    displayName: L("אתר", "Venue"),
    about: L("אודות", "About"),
    countryCode: "IL",
    languages: ["he", "en"],
    defaultLanguage: "he",
    theme: {
      primary: "#1F5E3B",
      onPrimary: "#FFFFFF",
      accent: "#E0A526",
      onAccent: "#1A1A1A",
      background: "light",
      typography: "heebo",
      logoUrl: null,
      logoDarkUrl: null,
      coverUrl: null,
    },
    contacts: {
      support: { phone: null, email: null, url: null },
      emergency: { phone: null },
    },
    legal: {
      privacyUrl: "https://example.invalid/privacy",
      termsUrl: "https://example.invalid/terms",
    },
  };
}

const ZERO_SHA = "0".repeat(64);

export function exampleManifest(): BundleManifest {
  return {
    schemaVersion: 1,
    bundleId: "8d2c6b6e-1f7a-4e3b-9c5d-7a1e2f3b4c5d",
    tenantId: "7c1f0d2e-5a3b-4c8d-9e1f-2a3b4c5d6e7f",
    trackId: TRACK_ID,
    trackVersion: 1,
    publishedAt: "2026-09-01T08:00:00Z",
    languages: ["he", "en"],
    files: {
      content: { path: "content.json", bytes: 18234, sha256: ZERO_SHA },
      media: [
        {
          id: MEDIA_A,
          path: `media/${MEDIA_A}.jpg`,
          bytes: 204800,
          sha256: ZERO_SHA,
          mime: "image/jpeg",
          widthPx: 1600,
          heightPx: 1067,
        },
      ],
      maps: [
        {
          legId: LEG_ID,
          kind: "pmtiles",
          delivery: "bundled",
          path: `maps/${LEG_ID}.pmtiles`,
          bytes: 3145728,
          sha256: ZERO_SHA,
          bounds: [34.802, 32.095, 34.818, 32.106],
          minZoom: 13,
          maxZoom: 18,
        },
      ],
    },
    totalBytes: 3368762,
  };
}
