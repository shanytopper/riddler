/* Generated from schemas/content.schema.json by scripts/generate-types.ts. Do not edit. */

export type Uuid = string;
/**
 * BCP 47 language, optionally with a region: he, en, en-GB.
 */
export type LanguageCode = string;
export type ContentBlock =
  | {
      type: "paragraph";
      text: LocalizedString4;
    }
  | {
      type: "image";
      mediaId: Uuid;
      caption?: LocalizedString;
    };
export type Challenge = ChallengeText | ChallengeNumber | ChallengeChoice | ChallengeMultiChoice;

/**
 * The content.json of a track bundle: one published track version, every language included. Authored files use the same shape; the bundle builder validates them, fills QR tokens, strips authoringNotes, and packages media and maps.
 */
export interface TrackContent {
  schemaVersion: 1;
  trackId: Uuid;
  /**
   * Stable, URL-safe identifier used in deep links. Unique within the tenant.
   */
  slug: string;
  name: LocalizedString;
  description: LocalizedString;
  /**
   * A media id from `media`, or null for no cover.
   */
  coverMediaId?: Uuid | null;
  /**
   * Languages the track is published in. Every localized string in this file must contain each of them.
   *
   * @minItems 1
   */
  languages: [LanguageCode, ...LanguageCode[]];
  defaultLanguage: LanguageCode;
  difficulty: "easy" | "medium" | "hard";
  minAge?: number;
  estimate: {
    durationMinutes: number;
    distanceMeters: number;
  };
  safetyNotes: LocalizedString1;
  rules: Rules;
  /**
   * Every media asset referenced anywhere in the track.
   */
  media: Media[];
  /**
   * Ordered. Single-venue tracks have exactly one leg and the app never shows the word.
   *
   * @minItems 1
   */
  legs: [Leg, ...Leg[]];
  /**
   * Free text for the people editing the source file. Stripped by the bundle builder; never shown to visitors.
   */
  authoringNotes?: string;
}
/**
 * Map from language code to text. Must contain every language in `languages` (builder invariant).
 */
export interface LocalizedString {
  [k: string]: string | undefined;
}
/**
 * Map from language code to text. Must contain every language in `languages` (builder invariant).
 */
export interface LocalizedString1 {
  [k: string]: string | undefined;
}
export interface Rules {
  /**
   * linear: stations in sequence. free: any order; the leg completes when every station is completed.
   */
  order: "linear" | "free";
  /**
   * all: every station shown from the start. progressive: a station appears only after the previous one is completed. Progressive requires linear order.
   */
  visibility: "all" | "progressive";
  /**
   * When the 'reveal answer and continue' option (0 points) becomes available.
   */
  revealAndContinue: "afterFirstHint" | "immediately";
  /**
   * Deducted from the challenge's points for each wrong answer on choice and multi_choice challenges. Text and number challenges are never penalized per attempt.
   */
  wrongChoicePenaltyPercent: number;
  timeBonus: null | {
    points: number;
    parSeconds: number;
    cutoffSeconds: number;
  };
  leaderboard: boolean;
}
export interface Media {
  id: Uuid;
  kind: "image";
  /**
   * In an authored file: relative to the track folder. In a bundle: relative to the bundle root, rewritten by the builder to media/<id>.<ext>.
   */
  path: string;
  alt?: LocalizedString2;
}
/**
 * Map from language code to text. Must contain every language in `languages` (builder invariant).
 */
export interface LocalizedString2 {
  [k: string]: string | undefined;
}
export interface Leg {
  id: Uuid;
  name?: LocalizedString3;
  /**
   * Shown when the leg starts; on multi-leg tracks this is where transport and opening hours go.
   */
  intro?: ContentBlock[];
  /**
   * Shown when the leg's last station is completed.
   */
  outro?: ContentBlock[];
  map: MapTiles | MapImage;
  /**
   * @minItems 1
   */
  stations: [Station, ...Station[]];
}
/**
 * Map from language code to text. Must contain every language in `languages` (builder invariant).
 */
export interface LocalizedString3 {
  [k: string]: string | undefined;
}
/**
 * Map from language code to text. Must contain every language in `languages` (builder invariant).
 */
export interface LocalizedString4 {
  [k: string]: string | undefined;
}
export interface MapTiles {
  kind: "tiles";
  /**
   * [west, south, east, north] in WGS 84 degrees. The offline region extracted into the bundle. Every station of the leg must lie inside it.
   *
   * @minItems 4
   * @maxItems 4
   */
  bounds: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
}
/**
 * An operator-uploaded map image (floor plan, illustrated map). Not georeferenced: no visitor position is drawn on it.
 */
export interface MapImage {
  kind: "image";
  mediaId: Uuid;
  widthPx: number;
  heightPx: number;
}
export interface Station {
  /**
   * Minted once and kept across versions: printed QR codes and analytics depend on it.
   */
  id: string;
  title: LocalizedString;
  /**
   * Shown after arrival, before the challenge.
   */
  intro?: ContentBlock[];
  location?: Location;
  imagePosition?: ImagePosition;
  arrival: Arrival;
  /**
   * Null makes this an info station: arriving completes it and it carries no points.
   */
  challenge: Challenge | null;
  /**
   * Revealed in order. Total cost should not exceed `points` (builder warns).
   *
   * @maxItems 3
   */
  hints: [] | [Hint] | [Hint, Hint] | [Hint, Hint, Hint];
  points: number;
  reveal: Reveal;
}
/**
 * Required on a tiles map, for gps arrival, and for distance feedback. Optional on an image map.
 */
export interface Location {
  lat: number;
  lng: number;
}
/**
 * Required when the leg's map is an image.
 */
export interface ImagePosition {
  x: number;
  y: number;
}
export interface Arrival {
  /**
   * Automatic verification methods offered in addition to manual check-in, which is always available. Empty means manual only.
   */
  methods: ("gps" | "qr")[];
  /**
   * True: the station opens as soon as it becomes current, with no arrival step at all.
   */
  automatic: boolean;
  /**
   * Used by gps arrival. Large values are legitimate for area-scale stations on multi-region tracks.
   */
  radiusMeters?: number;
  /**
   * Secret printed into the station's QR code and validated on the device against this value. Generated by the builder when absent.
   */
  qrToken?: string;
}
export interface ChallengeText {
  type: "text";
  prompt: LocalizedString;
  accepted: LocalizedStringList;
  /**
   * Accept small typos: edit distance 1 for normalized answers of 5–9 characters, 2 for 10 or more.
   */
  closeMatch?: boolean;
  placeholder?: LocalizedString;
}
/**
 * Accepted answers per language. Compared after normalization (design.md §4.4).
 */
export interface LocalizedStringList {
  /**
   * @minItems 1
   */
  [k: string]: [string, ...string[]] | undefined;
}
export interface ChallengeNumber {
  type: "number";
  prompt: LocalizedString;
  answer: number;
  tolerance: {
    kind: "absolute" | "percent";
    value: number;
  };
  unit?: LocalizedString5;
}
/**
 * Map from language code to text. Must contain every language in `languages` (builder invariant).
 */
export interface LocalizedString5 {
  [k: string]: string | undefined;
}
export interface ChallengeChoice {
  type: "choice";
  prompt: LocalizedString;
  /**
   * @minItems 2
   * @maxItems 6
   */
  options:
    | [ChoiceOption, ChoiceOption]
    | [ChoiceOption, ChoiceOption, ChoiceOption]
    | [ChoiceOption, ChoiceOption, ChoiceOption, ChoiceOption]
    | [ChoiceOption, ChoiceOption, ChoiceOption, ChoiceOption, ChoiceOption]
    | [ChoiceOption, ChoiceOption, ChoiceOption, ChoiceOption, ChoiceOption, ChoiceOption];
  correctOptionId: string;
  shuffle?: boolean;
}
export interface ChoiceOption {
  /**
   * Stable within the challenge; used in analytics.
   */
  id: string;
  text: LocalizedString;
}
export interface ChallengeMultiChoice {
  type: "multi_choice";
  prompt: LocalizedString;
  /**
   * @minItems 2
   * @maxItems 8
   */
  options:
    | [ChoiceOption, ChoiceOption]
    | [ChoiceOption, ChoiceOption, ChoiceOption]
    | [ChoiceOption, ChoiceOption, ChoiceOption, ChoiceOption]
    | [ChoiceOption, ChoiceOption, ChoiceOption, ChoiceOption, ChoiceOption]
    | [ChoiceOption, ChoiceOption, ChoiceOption, ChoiceOption, ChoiceOption, ChoiceOption]
    | [
        ChoiceOption,
        ChoiceOption,
        ChoiceOption,
        ChoiceOption,
        ChoiceOption,
        ChoiceOption,
        ChoiceOption,
      ]
    | [
        ChoiceOption,
        ChoiceOption,
        ChoiceOption,
        ChoiceOption,
        ChoiceOption,
        ChoiceOption,
        ChoiceOption,
        ChoiceOption,
      ];
  /**
   * All-or-nothing in v1.
   *
   * @minItems 1
   */
  correctOptionIds: [string, ...string[]];
  shuffle?: boolean;
}
export interface Hint {
  text: LocalizedString;
  mediaId?: Uuid;
  cost: number;
}
export interface Reveal {
  /**
   * How this station is presented when it becomes current in a progressive track. The first station of a leg is always presented as a pin regardless of this value. Ignored when visibility is `all`.
   */
  as: "pin" | "clue" | "both";
  clue?: {
    text: LocalizedString;
    mediaId?: Uuid;
  };
  /**
   * Show the straight-line distance to this station without direction while it is current. Requires `location`.
   */
  distanceFeedback?: boolean;
}
