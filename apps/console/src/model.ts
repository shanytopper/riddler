import type { Challenge, Station, TrackContent } from "@riddles/bundle-schema";

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
export interface EditStation {
  id: string;
  title: Loc;
  intro?: Array<{ type: string; text?: Loc; caption?: Loc; mediaId?: string }>;
  challenge: EditChallenge | null;
  hints: EditHint[];
  points: number;
  reveal: EditReveal;
  location?: { lat: number; lng: number };
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
