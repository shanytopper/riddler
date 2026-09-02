import { randomUUID } from "node:crypto";
import type { Issue, Station, TrackContent } from "@riddles/bundle-schema";
import { hasErrors, validateDocument } from "@riddles/bundle-schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { tenants, trackDrafts, trackVersions, tracks } from "../db/schema.ts";
import { ApiError, badRequest, notFound, serviceUnavailable } from "../errors.ts";
import {
  buildFromContent,
  storePublished,
  type BuildOptions,
  type BundleBuilderFn,
} from "../publish.ts";
import type { Storage } from "../storage.ts";

/**
 * The editor's model of a track (Editor v0, D34): one editable draft plus its published version. The
 * draft is seeded from the published version on first read; Publish freezes it into version N+1.
 */

export interface EditorTrack {
  trackId: string;
  slug: string;
  publishedVersion: number | null;
  hasDraft: boolean;
  name: TrackContent["name"];
}

export interface ValidationReport {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
}

/** The grid (~1 km) the map region snaps to, so a small pin move rarely re-cuts the tile extract. */
const BOUNDS_GRID = 0.01;
/** The minimum margin (~500 m) around the stations, so the map shows their surroundings. */
const BOUNDS_MARGIN = 0.005;
const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;

/**
 * Sizes each tiles leg's map region to its stations: their bounding box, padded, snapped outward to a
 * coarse grid. Bounds are derived from where the stations are, never hand-set, so a track can be
 * anywhere in the world and always passes the "station inside the map" rule; snapping keeps the
 * region — and so the cached tile extract — stable across small pin adjustments.
 */
export function fitLegBoundsToStations(content: TrackContent): TrackContent {
  for (const leg of content.legs) {
    if (leg.map.kind !== "tiles") continue;
    const points = leg.stations.flatMap((s) => (s.location ? [s.location] : []));
    if (points.length === 0) continue;
    const down = (v: number) => Math.floor((v - BOUNDS_MARGIN) / BOUNDS_GRID) * BOUNDS_GRID;
    const up = (v: number) => Math.ceil((v + BOUNDS_MARGIN) / BOUNDS_GRID) * BOUNDS_GRID;
    leg.map.bounds = [
      round5(down(Math.min(...points.map((p) => p.lng)))),
      round5(down(Math.min(...points.map((p) => p.lat)))),
      round5(up(Math.max(...points.map((p) => p.lng)))),
      round5(up(Math.max(...points.map((p) => p.lat)))),
    ];
  }
  return content;
}

/** Every track the console can edit, newest published first. */
export async function listEditorTracks(db: Db): Promise<EditorTrack[]> {
  const rows = await db.select().from(tracks);
  const out: EditorTrack[] = [];
  for (const track of rows) {
    const content = await currentContent(db, track.id);
    if (!content) continue;
    const draft = await draftRow(db, track.id);
    out.push({
      trackId: track.id,
      slug: track.slug,
      publishedVersion: track.publishedVersion ?? null,
      hasDraft: draft !== null,
      name: content.name,
    });
  }
  return out;
}

/** The draft content for a track — the saved draft, or a fresh copy of the published version. */
export async function getDraft(db: Db, trackId: string): Promise<TrackContent> {
  const draft = await draftRow(db, trackId);
  if (draft) return draft.content;
  const published = await publishedContent(db, trackId);
  if (!published) throw notFound(`no track ${trackId}`);
  return published;
}

/** Saves the draft after a schema check (invariant errors are allowed until publish). */
export async function saveDraft(db: Db, trackId: string, content: unknown): Promise<void> {
  const track = (await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1))[0];
  if (!track) throw notFound(`no track ${trackId}`);
  const report = validateDocument("content", content);
  if (report.schema.length > 0)
    throw badRequest(`draft does not match the schema: ${report.schema[0]?.message ?? "invalid"}`);
  const doc = content as TrackContent;
  if (doc.trackId !== trackId) throw badRequest("draft trackId does not match the track");
  fitLegBoundsToStations(doc);
  await db
    .insert(trackDrafts)
    .values({ trackId, content: doc, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: trackDrafts.trackId,
      set: { content: doc, updatedAt: new Date() },
    });
}

/** Runs the full validator (schema + authoring invariants) over the current draft. */
export async function validateDraft(db: Db, trackId: string): Promise<ValidationReport> {
  const content = fitLegBoundsToStations(await getDraft(db, trackId));
  const report = validateDocument("content", content);
  return {
    ok: !hasErrors(report),
    errors: [...report.schema, ...report.errors],
    warnings: report.warnings,
  };
}

/**
 * Publishes the draft as the next version: validates, builds the bundle on the server (reusing
 * cached map artifacts), stores it, and points the track at the new version. Refuses on any error.
 */
export async function publishDraft(
  db: Db,
  storage: Storage,
  trackId: string,
  options: BuildOptions,
  builder: BundleBuilderFn = (input) => buildFromContent(input, options),
): Promise<{ version: number; warnings: Issue[] }> {
  const track = (await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1))[0];
  if (!track) throw notFound(`no track ${trackId}`);
  const tenant = (
    await db
      .select({ data: tenants.data })
      .from(tenants)
      .where(eq(tenants.id, track.tenantId))
      .limit(1)
  )[0]?.data;
  if (!tenant) throw notFound(`no venue for track ${trackId}`);

  const content = fitLegBoundsToStations(await getDraft(db, trackId));
  const report = validateDocument("content", content);
  if (hasErrors(report))
    throw badRequest(
      `cannot publish: ${[...report.schema, ...report.errors][0]?.message ?? "content has errors"}`,
    );

  const version = (await maxVersion(db, trackId)) + 1;
  let built;
  try {
    built = await builder({ tenant, content, version });
  } catch (error) {
    if (error instanceof ApiError) throw error; // e.g. an unsupported-media badRequest
    // Building the bundle can fail on a transient tile-service issue; surface a clear, retryable
    // message instead of a generic 500.
    console.error("[publish] bundle build failed:", error);
    throw serviceUnavailable(
      "Could not build the map for this version — the map tile service may be busy. Please try again in a moment.",
    );
  }
  await storePublished(db, storage, tenant, built, version);
  return { version, warnings: built.warnings };
}

async function draftRow(db: Db, trackId: string) {
  return (
    (await db.select().from(trackDrafts).where(eq(trackDrafts.trackId, trackId)).limit(1))[0] ??
    null
  );
}

/** The published version's content, if the track has one. */
async function publishedContent(db: Db, trackId: string): Promise<TrackContent | null> {
  const track = (await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1))[0];
  if (!track?.publishedVersion) return null;
  const version = (
    await db
      .select({ content: trackVersions.content })
      .from(trackVersions)
      .where(eq(trackVersions.trackId, trackId))
      .orderBy(desc(trackVersions.version))
      .limit(1)
  )[0];
  return version?.content ?? null;
}

/** The draft if present, else the published content — for showing the track's name in a list. */
async function currentContent(db: Db, trackId: string): Promise<TrackContent | null> {
  const draft = await draftRow(db, trackId);
  return draft?.content ?? (await publishedContent(db, trackId));
}

async function maxVersion(db: Db, trackId: string): Promise<number> {
  const row = (
    await db
      .select({ max: sql<number>`coalesce(max(${trackVersions.version}), 0)` })
      .from(trackVersions)
      .where(eq(trackVersions.trackId, trackId))
  )[0];
  return Number(row?.max ?? 0);
}

// --- Creating a new track (D35 follow-up) ---------------------------------------------------------
// The prototype console serves a single operator, so a new track is created under the one tenant and
// seeded with a minimal but valid skeleton the operator then fills in.

/** A default map region near the pilot venue, used when the tenant has no track to copy bounds from. */
const DEFAULT_MAP = {
  kind: "tiles" as const,
  bounds: [34.8, 32.09, 34.82, 32.11] as [number, number, number, number],
  minZoom: 13,
  maxZoom: 18,
};

/** The single operator tenant (the prototype has exactly one); the oldest if several ever exist. */
export async function operatorTenantId(db: Db): Promise<string> {
  const row = (
    await db.select({ id: tenants.id }).from(tenants).orderBy(asc(tenants.createdAt)).limit(1)
  )[0];
  if (!row) throw notFound("no venue is configured");
  return row.id;
}

/** The map (bounds + zoom) for a new track: reuse a track of the same tenant so it sits at the same venue. */
async function defaultLegMap(db: Db, tenantId: string): Promise<typeof DEFAULT_MAP> {
  const row = (
    await db
      .select({ content: trackVersions.content })
      .from(trackVersions)
      .innerJoin(tracks, eq(trackVersions.trackId, tracks.id))
      .where(eq(tracks.tenantId, tenantId))
      .orderBy(desc(trackVersions.publishedAt))
      .limit(1)
  )[0];
  const map = row?.content.legs[0]?.map;
  if (map && map.kind === "tiles") {
    return {
      kind: "tiles",
      bounds: [...map.bounds] as [number, number, number, number],
      minZoom: map.minZoom,
      maxZoom: map.maxZoom,
    };
  }
  return { ...DEFAULT_MAP, bounds: [...DEFAULT_MAP.bounds] as [number, number, number, number] };
}

function slugify(name: string): string {
  // Trim the trailing hyphen AFTER slicing — otherwise the length cap can reintroduce one and the
  // slug fails the schema pattern ^[a-z0-9]+(-[a-z0-9]+)*$.
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return base || "track";
}

async function uniqueSlug(db: Db, tenantId: string, base: string): Promise<string> {
  const taken = new Set(
    (await db.select({ slug: tracks.slug }).from(tracks).where(eq(tracks.tenantId, tenantId))).map(
      (row) => row.slug,
    ),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

/** One info station at a point (a valid seed: no challenge, no points, shown as a pin). */
function seedStation(location: { lat: number; lng: number }): Station {
  return {
    id: randomUUID(),
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
 * Creates a new, unpublished track for the tenant with a minimal editable skeleton — a valid
 * one-leg, one-station document the operator then builds out and publishes. Fails if the skeleton
 * does not match the schema (a bug, not operator input).
 */
export async function createTrack(
  db: Db,
  tenantId: string,
  name: string,
): Promise<{ trackId: string; slug: string }> {
  const trackId = randomUUID();
  const trimmed = name.trim();
  const displayName = trimmed || "New track";
  let slug = await uniqueSlug(db, tenantId, slugify(trimmed));
  const map = await defaultLegMap(db, tenantId);
  const center = {
    lat: (map.bounds[1] + map.bounds[3]) / 2,
    lng: (map.bounds[0] + map.bounds[2]) / 2,
  };
  const content: TrackContent = {
    schemaVersion: 1,
    trackId,
    slug,
    name: { he: displayName, en: displayName },
    description: { he: "תיאור המסלול", en: "Track description" },
    languages: ["he", "en"],
    defaultLanguage: "he",
    difficulty: "easy",
    estimate: { durationMinutes: 60, distanceMeters: 1000 },
    safetyNotes: { he: "הנחיות בטיחות", en: "Safety notes" },
    rules: {
      order: "linear",
      visibility: "progressive",
      revealAndContinue: "afterFirstHint",
      wrongChoicePenaltyPercent: 25,
      timeBonus: null,
      leaderboard: true,
    },
    media: [],
    legs: [{ id: randomUUID(), map, stations: [seedStation(center)] }],
  };
  fitLegBoundsToStations(content);

  const report = validateDocument("content", content);
  if (report.schema.length > 0)
    throw new Error(
      `new-track skeleton failed the schema: ${report.schema[0]?.message ?? "invalid"}`,
    );

  // uniqueSlug is best-effort; the unique index on (tenant_id, slug) is the real guard. On the rare
  // race where two creates pick the same slug, fall back to a globally unique suffix rather than 500.
  try {
    await db.insert(tracks).values({ id: trackId, tenantId, slug, publishedVersion: null });
  } catch {
    slug = `${slug}-${randomUUID().slice(0, 8)}`.slice(0, 64);
    content.slug = slug;
    await db.insert(tracks).values({ id: trackId, tenantId, slug, publishedVersion: null });
  }
  await db.insert(trackDrafts).values({ trackId, content, updatedAt: new Date() });
  return { trackId, slug };
}
