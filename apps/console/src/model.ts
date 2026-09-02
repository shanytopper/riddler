import type { Challenge, Station, TrackContent, Waypoint } from "@riddles/bundle-schema";

/** A localized string as the editor treats it — every language optional while editing. */
export type Loc = Record<string, string | undefined>;

export type ChallengeType = "text" | "number" | "choice" | "multi_choice";

/**
 * The editor's permissive view of the content it mutates. The API round-trips the strict
 * `TrackContent`; here we edit the same objects through looser shapes so a keystroke handler stays
 * readable. Only the fields the editor touches are named.
 */
export interface EditOption {
  id: string;
  text: Loc;
}
export type EditChallenge =
  | {
      type: "number";
      prompt: Loc;
      answer: number;
      tolerance?: { kind: string; value: number };
      unit?: Loc;
    }
  | {
      type: "text";
      prompt: Loc;
      accepted: Record<string, string[]>;
      closeMatch?: boolean;
      placeholder?: Loc;
    }
  | {
      type: "choice";
      prompt: Loc;
      options: EditOption[];
      correctOptionId: string;
      shuffle?: boolean;
    }
  | {
      type: "multi_choice";
      prompt: Loc;
      options: EditOption[];
      correctOptionIds: string[];
      shuffle?: boolean;
    };
export interface EditHint {
  text: Loc;
  cost: number;
}
export interface EditReveal {
  as: "pin" | "clue" | "both";
  clue?: { text: Loc };
  distanceFeedback?: boolean;
}
export type EditArrivalMethod = "gps" | "qr";
export interface EditArrival {
  methods: EditArrivalMethod[];
  automatic: boolean;
  radiusMeters?: number;
  qrToken?: string;
}
export interface EditStation {
  id: string;
  title: Loc;
  intro?: Array<{ type: string; text?: Loc; caption?: Loc; mediaId?: string }>;
  arrival: EditArrival;
  challenge: EditChallenge | null;
  hints: EditHint[];
  points: number;
  reveal: EditReveal;
  location?: { lat: number; lng: number };
}
/** A leg's start or finish point: a pin with an optional one-line note, no arrival step. */
export interface EditWaypoint {
  location?: { lat: number; lng: number };
  note?: Loc;
}

/** The schema's bounds for `arrival.radiusMeters` (an integer number of metres). */
export const RADIUS_MIN = 10;
export const RADIUS_MAX = 500;
export const RADIUS_DEFAULT = 30;

/** Round and clamp a radius into the schema's range, so a typed value can never fail the save. */
export const clampRadius = (n: number): number =>
  Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(n)));

export const hasGps = (station: EditStation): boolean => station.arrival.methods.includes("gps");

/**
 * Turn gps arrival on or off. On means the party verifies its arrival, so it clears `automatic`
 * (the schema forbids both) and gives the radius its default if it was never set. The manual
 * check-in is always available either way (D6/D11), so off simply drops the method.
 */
export function setGps(station: EditStation, on: boolean): void {
  const { arrival } = station;
  if (on) {
    if (!arrival.methods.includes("gps")) arrival.methods.push("gps");
    arrival.automatic = false;
    arrival.radiusMeters ??= RADIUS_DEFAULT;
  } else {
    arrival.methods = arrival.methods.filter((m) => m !== "gps");
  }
}

export const languageName = (code: string): string =>
  code === "he" ? "עברית" : code === "en" ? "English" : code;

export const isRtl = (code: string): boolean => code === "he" || code === "ar";

/** True if every language has a non-empty value — mirrors the "complete localized string" invariant. */
export const isComplete = (value: Loc | undefined, languages: readonly string[]): boolean =>
  value !== undefined && languages.every((l) => (value[l] ?? "").trim().length > 0);

/** The stations of the (single, in v0) leg. */
export const stationsOf = (content: TrackContent) => content.legs[0]?.stations ?? [];

/**
 * A fresh info station (no challenge, no points, shown as a pin) at a point inside the leg's map.
 * The operator renames it and adds a challenge; its id is minted once and kept across versions.
 * Assumes a tiles map (it sets `location`, not `imagePosition`) — the only map kind the prototype
 * console produces; an image-map leg would need `imagePosition` instead.
 */
export function blankStation(location: { lat: number; lng: number }): Station {
  return {
    id: crypto.randomUUID(),
    title: { he: "תחנה חדשה", en: "New station" },
    arrival: { methods: [], automatic: false },
    challenge: null,
    hints: [],
    points: 0,
    reveal: { as: "pin" },
    location,
  } satisfies Station;
}

/**
 * A fresh start or finish point at `location`. It has no note: the note is optional, so an operator
 * who wants none has nothing to fill in. Same tiles-map assumption as `blankStation`.
 */
export function blankWaypoint(location: { lat: number; lng: number }): Waypoint {
  return { location } satisfies Waypoint;
}

/** A fresh, valid-shape challenge of the given type, for switching a station's challenge kind. */
export function blankChallenge(type: ChallengeType): Challenge {
  const prompt = { he: "", en: "" };
  const options = [
    { id: "a", text: { he: "", en: "" } },
    { id: "b", text: { he: "", en: "" } },
  ];
  const byType: Record<ChallengeType, unknown> = {
    number: { type, prompt, answer: 0, tolerance: { kind: "absolute", value: 0 } },
    text: { type, prompt, accepted: { he: [], en: [] }, closeMatch: true },
    choice: { type, prompt, options, correctOptionId: "a", shuffle: true },
    multi_choice: { type, prompt, options, correctOptionIds: ["a"], shuffle: true },
  };
  return byType[type] as Challenge;
}
