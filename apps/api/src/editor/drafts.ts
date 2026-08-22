import type { Issue, TrackContent } from "@riddles/bundle-schema";
import { hasErrors, validateDocument } from "@riddles/bundle-schema";
import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { tenants, trackDrafts, trackVersions, tracks } from "../db/schema.ts";
import { badRequest, notFound } from "../errors.ts";
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
  const content = await getDraft(db, trackId);
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

  const content = await getDraft(db, trackId);
  const report = validateDocument("content", content);
  if (hasErrors(report))
    throw badRequest(
      `cannot publish: ${[...report.schema, ...report.errors][0]?.message ?? "content has errors"}`,
    );

  const version = (await maxVersion(db, trackId)) + 1;
  const built = await builder({ tenant, content, version });
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
