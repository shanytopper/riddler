import type { Station, TrackContent } from "@riddles/bundle-schema";
import type { EventContext } from "./events.ts";

export const L = (he: string, en: string): { he: string; en: string } => ({ he, en });

/** Deterministic ids and clocks; `advance` moves the monotonic clock by the given milliseconds. */
export function testContext(): EventContext & { advance: (ms: number) => void } {
  let counter = 0;
  let mono = 1_000;
  return {
    id: () => `evt-${++counter}`,
    now: () => new Date(1_700_000_000_000 + mono).toISOString(),
    mono: () => mono,
    advance: (ms) => {
      mono += ms;
    },
  };
}

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
    hints: [
      { text: L("א", "a"), cost: 20 },
      { text: L("ב", "b"), cost: 30 },
    ],
    points: 100,
    reveal: { as: "clue", clue: { text: L("רמז", "Clue") }, distanceFeedback: true },
    ...overrides,
  };
}

export const S1 = "0a1b2c3d-4e5f-4061-8a9b-0c1d2e3f4a5b";
export const S2 = "1b2c3d4e-5f60-4172-9bac-1d2e3f4a5b6c";
export const S3 = "2c3d4e5f-6071-4283-abcd-2e3f4a5b6c7d";

/** Three stations: a text riddle, a multiple choice, and an info station. Model A by default. */
export function smallTrack(overrides: Partial<TrackContent["rules"]> = {}): TrackContent {
  return {
    schemaVersion: 1,
    trackId: "3f9a2b1c-8d7e-4f60-a1b2-c3d4e5f60718",
    slug: "small",
    name: L("קטן", "Small"),
    description: L("תיאור", "Description"),
    coverMediaId: null,
    languages: ["he", "en"],
    defaultLanguage: "he",
    difficulty: "easy",
    estimate: { durationMinutes: 20, distanceMeters: 300 },
    safetyNotes: L("זהירות", "Take care"),
    rules: {
      order: "linear",
      visibility: "progressive",
      revealAndContinue: "afterFirstHint",
      wrongChoicePenaltyPercent: 25,
      timeBonus: null,
      leaderboard: true,
      ...overrides,
    },
    media: [],
    legs: [
      {
        id: "9b8c7d6e-5f40-4a31-b2c3-d4e5f6071829",
        map: { kind: "tiles", bounds: [34.8, 32.09, 34.82, 32.11], minZoom: 13, maxZoom: 18 },
        stations: [
          station({ id: S1, reveal: { as: "pin", distanceFeedback: false } }),
          station({
            id: S2,
            challenge: {
              type: "choice",
              prompt: L("?", "?"),
              options: [
                { id: "a", text: L("א", "A") },
                { id: "b", text: L("ב", "B") },
                { id: "c", text: L("ג", "C") },
              ],
              correctOptionId: "b",
              shuffle: true,
            },
          }),
          station({ id: S3, challenge: null, hints: [], points: 0 }),
        ],
      },
    ],
  };
}
