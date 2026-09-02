import type {
  ChoiceOption,
  ContentBlock,
  Hint,
  Station,
  TrackContent,
  Waypoint,
} from "./generated/content.ts";
import type { Tenant } from "./generated/tenant.ts";
import { MIN_TEXT_CONTRAST, contrastRatio } from "./contrast.ts";
import type { Issue } from "./schema.ts";

export interface InvariantReport {
  errors: Issue[];
  warnings: Issue[];
}

export interface ContentContext {
  /** Size in bytes of the media file at `path` (as written in `media[].path`), or undefined if it does not exist. */
  mediaBytes?: (path: string) => number | undefined;
}

const MB = 1024 * 1024;
/** Above this the builder warns; the design targets ≤ 50 MB for a single-venue track. */
export const BUNDLE_WARN_BYTES = 50 * MB;
/** Above this the builder refuses to publish. */
export const BUNDLE_MAX_BYTES = 100 * MB;

type Localized = Record<string, string | readonly string[] | undefined>;
type LocalizedVisitor = (path: string, value: Localized) => void;
/** Anything placed on a leg's map: a station, or the leg's start/end waypoint. */
type Placed = Pick<Waypoint, "location" | "imagePosition">;

const hintsOf = (station: Station): readonly Hint[] => station.hints;
const optionsOf = (challenge: { options: readonly ChoiceOption[] }): readonly ChoiceOption[] =>
  challenge.options;

function visitBlocks(
  blocks: ContentBlock[] | undefined,
  base: string,
  visit: LocalizedVisitor,
): void {
  blocks?.forEach((block, i) => {
    if (block.type === "paragraph") visit(`${base}/${i}/text`, block.text);
    else if (block.caption) visit(`${base}/${i}/caption`, block.caption);
  });
}

/** Calls `visit` for every localized string or answer list in the track, with its JSON Pointer. */
export function visitLocalized(content: TrackContent, visit: LocalizedVisitor): void {
  visit("/name", content.name);
  visit("/description", content.description);
  visit("/safetyNotes", content.safetyNotes);
  content.media.forEach((m, i) => {
    if (m.alt) visit(`/media/${i}/alt`, m.alt);
  });
  content.legs.forEach((leg, li) => {
    const lp = `/legs/${li}`;
    if (leg.name) visit(`${lp}/name`, leg.name);
    visitBlocks(leg.intro, `${lp}/intro`, visit);
    visitBlocks(leg.outro, `${lp}/outro`, visit);
    if (leg.start?.note) visit(`${lp}/start/note`, leg.start.note);
    leg.stations.forEach((station, si) => {
      const sp = `${lp}/stations/${si}`;
      visit(`${sp}/title`, station.title);
      visitBlocks(station.intro, `${sp}/intro`, visit);
      if (station.reveal.clue) visit(`${sp}/reveal/clue/text`, station.reveal.clue.text);
      hintsOf(station).forEach((hint, hi) => visit(`${sp}/hints/${hi}/text`, hint.text));
      const challenge = station.challenge;
      if (!challenge) return;
      visit(`${sp}/challenge/prompt`, challenge.prompt);
      switch (challenge.type) {
        case "text":
          visit(`${sp}/challenge/accepted`, challenge.accepted);
          if (challenge.placeholder) visit(`${sp}/challenge/placeholder`, challenge.placeholder);
          break;
        case "number":
          if (challenge.unit) visit(`${sp}/challenge/unit`, challenge.unit);
          break;
        case "choice":
        case "multi_choice":
          optionsOf(challenge).forEach((option, oi) =>
            visit(`${sp}/challenge/options/${oi}/text`, option.text),
          );
          break;
      }
    });
    if (leg.end?.note) visit(`${lp}/end/note`, leg.end.note);
  });
}

/**
 * The rules from packages/bundle-schema/README.md "Invariants the builder enforces" that JSON Schema
 * cannot express. Numbering in the messages' comments follows the README.
 */
export function contentInvariants(
  content: TrackContent,
  ctx: ContentContext = {},
): InvariantReport {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const error = (path: string, message: string): void => {
    errors.push({ path, message });
  };
  const warn = (path: string, message: string): void => {
    warnings.push({ path, message });
  };
  const mediaBytes = ctx.mediaBytes;

  // 1. Languages
  if (!content.languages.includes(content.defaultLanguage)) {
    error("/defaultLanguage", `"${content.defaultLanguage}" is not one of languages`);
  }
  visitLocalized(content, (path, value) => {
    const missing = content.languages.filter((language) => value[language] === undefined);
    if (missing.length)
      error(path, `missing language${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
  });

  // 3. Media registry
  const mediaById = new Map<string, { path: string; hasAlt: boolean; index: number }>();
  content.media.forEach((m, i) => {
    if (mediaById.has(m.id)) error(`/media/${i}/id`, `duplicate media id ${m.id}`);
    else mediaById.set(m.id, { path: m.path, hasAlt: m.alt !== undefined, index: i });
    if (mediaBytes && mediaBytes(m.path) === undefined)
      error(`/media/${i}/path`, `file not found: ${m.path}`);
  });
  const requireMedia = (path: string, id: string, shownToVisitors: boolean): void => {
    const m = mediaById.get(id);
    if (!m) {
      error(path, `unknown media id ${id}`);
      return;
    }
    if (shownToVisitors && !m.hasAlt) {
      error(`/media/${m.index}`, `${m.path} is shown to visitors and needs alt text`);
    }
  };
  const checkBlocks = (blocks: ContentBlock[] | undefined, base: string): void => {
    blocks?.forEach((block, i) => {
      if (block.type === "image") requireMedia(`${base}/${i}/mediaId`, block.mediaId, true);
    });
  };
  if (content.coverMediaId) requireMedia("/coverMediaId", content.coverMediaId, true);

  // 2, 4, 5, 6, 8, 9, 10, 12 — per leg and station
  const stationPaths = new Map<string, string>();
  const progressive = content.rules.visibility === "progressive";
  content.legs.forEach((leg, li) => {
    const lp = `/legs/${li}`;
    checkBlocks(leg.intro, `${lp}/intro`);
    checkBlocks(leg.outro, `${lp}/outro`);

    const map = leg.map;
    if (map.kind === "tiles") {
      const [west, south, east, north] = map.bounds;
      if (!(west < east)) error(`${lp}/map/bounds`, "west must be less than east");
      if (!(south < north)) error(`${lp}/map/bounds`, "south must be less than north");
      if (map.minZoom > map.maxZoom) error(`${lp}/map`, "minZoom must not exceed maxZoom");
    } else {
      requireMedia(`${lp}/map/mediaId`, map.mediaId, false);
    }

    if (progressive && leg.stations[0].reveal.as !== "pin") {
      warn(
        `${lp}/stations/0/reveal/as`,
        "the first station of a leg is always shown as a pin; this value is ignored",
      );
    }

    // 4. Placement on the leg's map — the same rule for a station and for the start/end waypoints.
    const checkPlacement = (base: string, point: Placed): void => {
      if (map.kind === "tiles") {
        if (!point.location) {
          error(`${base}/location`, "required on a tiles map");
        } else {
          const [west, south, east, north] = map.bounds;
          const { lat, lng } = point.location;
          if (lng < west || lng > east || lat < south || lat > north) {
            error(`${base}/location`, `outside the leg's map bounds [${map.bounds.join(", ")}]`);
          }
        }
      } else if (!point.imagePosition) {
        error(`${base}/imagePosition`, "required on an image map");
      }
    };
    if (leg.start) checkPlacement(`${lp}/start`, leg.start);

    leg.stations.forEach((station, si) => {
      const sp = `${lp}/stations/${si}`;

      const seenAt = stationPaths.get(station.id);
      if (seenAt) error(`${sp}/id`, `duplicate station id, also used at ${seenAt}`);
      else stationPaths.set(station.id, sp);

      checkBlocks(station.intro, `${sp}/intro`);
      if (station.reveal.clue?.mediaId) {
        requireMedia(`${sp}/reveal/clue/mediaId`, station.reveal.clue.mediaId, true);
      }
      hintsOf(station).forEach((hint, hi) => {
        if (hint.mediaId) requireMedia(`${sp}/hints/${hi}/mediaId`, hint.mediaId, true);
      });

      checkPlacement(sp, station);

      const needsLocation = station.arrival.methods.includes("gps")
        ? "gps arrival"
        : station.reveal.distanceFeedback
          ? "distance feedback"
          : undefined;
      if (needsLocation && !station.location)
        error(`${sp}/location`, `required for ${needsLocation}`);

      if (station.arrival.methods.includes("qr") && !station.arrival.qrToken) {
        warn(`${sp}/arrival/qrToken`, "absent; the builder will generate one");
      }

      const challenge = station.challenge;
      if (challenge === null) {
        if (station.points !== 0)
          error(`${sp}/points`, "an info station (no challenge) carries no points");
        if (station.hints.length > 0)
          error(`${sp}/hints`, "an info station (no challenge) has no hints");
        return;
      }
      if (challenge.type === "choice" || challenge.type === "multi_choice") {
        const ids = optionsOf(challenge).map((option) => option.id);
        const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
        if (duplicate) error(`${sp}/challenge/options`, `duplicate option id "${duplicate}"`);
        const correct =
          challenge.type === "choice" ? [challenge.correctOptionId] : challenge.correctOptionIds;
        for (const id of correct) {
          if (!ids.includes(id))
            error(`${sp}/challenge`, `correct option "${id}" is not one of the options`);
        }
      }
      const hintCost = hintsOf(station).reduce((sum, hint) => sum + hint.cost, 0);
      if (hintCost > station.points) {
        warn(
          `${sp}/hints`,
          `hint costs total ${hintCost}, more than the station's ${station.points} points`,
        );
      }
    });
    if (leg.end) checkPlacement(`${lp}/end`, leg.end);
  });

  // 7. Time bonus
  const timeBonus = content.rules.timeBonus;
  if (timeBonus && timeBonus.cutoffSeconds <= timeBonus.parSeconds) {
    error("/rules/timeBonus", "cutoffSeconds must exceed parSeconds");
  }

  // 11. Size — media only; map extracts are added by the builder
  if (mediaBytes) {
    const bytes = content.media.reduce((sum, m) => sum + (mediaBytes(m.path) ?? 0), 0);
    if (bytes > BUNDLE_MAX_BYTES) {
      error(
        "/media",
        `media total ${megabytes(bytes)} MB exceeds the ${megabytes(BUNDLE_MAX_BYTES)} MB bundle limit, before map data`,
      );
    } else if (bytes > BUNDLE_WARN_BYTES) {
      warn(
        "/media",
        `media total ${megabytes(bytes)} MB is above the ${megabytes(BUNDLE_WARN_BYTES)} MB target, before map data`,
      );
    }
  }

  return { errors, warnings };
}

const megabytes = (bytes: number): string => (bytes / MB).toFixed(1);

export function tenantInvariants(tenant: Tenant): InvariantReport {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  if (!tenant.languages.includes(tenant.defaultLanguage)) {
    errors.push({
      path: "/defaultLanguage",
      message: `"${tenant.defaultLanguage}" is not one of languages`,
    });
  }

  const localized: Array<[string, Localized | undefined]> = [
    ["/displayName", tenant.displayName],
    ["/about", tenant.about],
    ["/contacts/emergency/note", tenant.contacts.emergency.note],
  ];
  for (const [path, value] of localized) {
    if (!value) continue;
    const missing = tenant.languages.filter((language) => value[language] === undefined);
    if (missing.length)
      errors.push({
        path,
        message: `missing language${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
      });
  }

  const pairs: Array<[string, string, string]> = [
    ["/theme/onPrimary", tenant.theme.onPrimary, tenant.theme.primary],
    ["/theme/onAccent", tenant.theme.onAccent, tenant.theme.accent],
  ];
  for (const [path, foreground, background] of pairs) {
    const ratio = contrastRatio(foreground, background);
    if (ratio < MIN_TEXT_CONTRAST) {
      errors.push({
        path,
        message: `contrast ${ratio.toFixed(2)}:1 against ${background} is below ${MIN_TEXT_CONTRAST}:1`,
      });
    }
  }

  return { errors, warnings };
}
