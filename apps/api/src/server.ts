import type { Tenant } from "@riddles/bundle-schema";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import Fastify, { type FastifyInstance } from "fastify";
import type { Db } from "./db/client.ts";
import {
  bundles,
  leaderboardEntries,
  sessions,
  tenants,
  trackVersions,
  tracks,
} from "./db/schema.ts";
import { ApiError, notFound } from "./errors.ts";
import { ingestEvents, type IngestInput } from "./ingest.ts";
import type { Storage } from "./storage.ts";
import { summarize } from "./summary.ts";

export interface ServerDeps {
  db: Db;
  storage: Storage;
  /** Overrides the bundle download origin (a CDN in production); defaults to the request's own. */
  bundleBaseUrl?: string;
  /** The venue's timezone for the "today" leaderboard window (one venue in the prototype). */
  leaderboardTimezone?: string;
}

export function buildServer({
  db,
  storage,
  bundleBaseUrl,
  leaderboardTimezone = "Asia/Jerusalem",
}: ServerDeps): FastifyInstance {
  // trustProxy: behind Render's load balancer the request arrives over plain HTTP with
  // X-Forwarded-Proto; without it request.protocol would say "http" and bundle URLs would break.
  const app = Fastify({ logger: false, trustProxy: true });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      void reply.status(error.status).send({ error: error.message });
      return;
    }
    app.log.error(error);
    void reply.status(500).send({ error: "internal error" });
  });

  app.get("/health", async () => ({ ok: true }));

  // Nearby venues — every tenant, for the prototype (proximity ranking is a later feature).
  app.get("/venues", async () => {
    const rows = await db.select({ data: tenants.data }).from(tenants);
    return rows.map((row) => venueSummary(row.data));
  });

  app.get("/v/:slug", async (request) => {
    const { slug } = request.params as { slug: string };
    const tenant = await tenantBySlug(db, slug);
    if (!tenant) throw notFound(`no venue ${slug}`);
    return tenant;
  });

  app.get("/tenants/:tenantId/tracks", async (request) => {
    const { tenantId } = request.params as { tenantId: string };
    const rows = await publishedVersionsForTenant(db, tenantId);
    return rows.map((row) => summarize(row.content));
  });

  app.get("/tracks/:trackId", async (request) => {
    const { trackId } = request.params as { trackId: string };
    const found = await publishedVersion(db, trackId);
    if (!found) throw notFound(`no track ${trackId}`);
    const tenant = await tenantById(db, found.tenantId);
    if (!tenant) throw notFound(`no venue for track ${trackId}`);
    return { tenant, track: summarize(found.content) };
  });

  app.get("/tracks/:trackId/bundle", async (request) => {
    const { trackId } = request.params as { trackId: string };
    const track = (await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1))[0];
    if (!track?.publishedVersion) throw notFound(`no published bundle for ${trackId}`);
    const bundle = (
      await db
        .select()
        .from(bundles)
        .where(and(eq(bundles.trackId, trackId), eq(bundles.version, track.publishedVersion)))
        .limit(1)
    )[0];
    if (!bundle) throw notFound(`no bundle for ${trackId}`);
    const base = bundleBaseUrl ?? `${request.protocol}://${request.host}`;
    return { manifest: bundle.manifest, zipUrl: `${base}/storage/${bundle.objectKey}` };
  });

  app.get("/storage/:key", async (request, reply) => {
    const { key } = request.params as { key: string };
    const bytes = await storage.get(key);
    if (!bytes) throw notFound(`no object ${key}`);
    return reply.type("application/zip").send(Buffer.from(bytes));
  });

  app.post("/sessions/:sessionId/events", async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = (request.body ?? {}) as Partial<IngestInput>;
    return ingestEvents(db, {
      sessionId,
      deviceId: typeof body.deviceId === "string" ? body.deviceId.slice(0, 128) : null,
      events: body.events,
    });
  });

  app.get("/tracks/:trackId/leaderboard", async (request) => {
    const { trackId } = request.params as { trackId: string };
    const { window } = request.query as { window?: string };
    const filters = [eq(leaderboardEntries.trackId, trackId), eq(leaderboardEntries.hidden, false)];
    if (window === "today")
      filters.push(gte(leaderboardEntries.receivedAt, startOfTodayIn(leaderboardTimezone)));
    const rows = await db
      .select()
      .from(leaderboardEntries)
      .where(and(...filters))
      .orderBy(desc(leaderboardEntries.score), asc(leaderboardEntries.playTimeMs))
      .limit(100);
    return {
      entries: rows.map((row, index) => ({
        rank: index + 1,
        teamName: row.teamName,
        score: row.score,
        playTimeMs: row.playTimeMs,
        finishedAt: row.finishedAt,
      })),
    };
  });

  app.get("/sessions/:sessionId/result", async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    const row = (await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1))[0];
    if (!row) throw notFound(`no session ${sessionId}`);
    return {
      teamName: row.teamName,
      status: row.status,
      score: row.serverScore,
      playTimeMs: row.serverPlayTimeMs,
      mismatch: row.mismatch,
      finishedAt: row.finishedAt,
    };
  });

  return app;
}

function venueSummary(tenant: Tenant) {
  return {
    tenantId: tenant.tenantId,
    slug: tenant.slug,
    displayName: tenant.displayName,
    coverUrl: tenant.theme.coverUrl,
  };
}

async function tenantBySlug(db: Db, slug: string): Promise<Tenant | null> {
  const row = (
    await db.select({ data: tenants.data }).from(tenants).where(eq(tenants.slug, slug)).limit(1)
  )[0];
  return row?.data ?? null;
}

async function tenantById(db: Db, id: string): Promise<Tenant | null> {
  const row = (
    await db.select({ data: tenants.data }).from(tenants).where(eq(tenants.id, id)).limit(1)
  )[0];
  return row?.data ?? null;
}

/** The published version's content for a track, plus its tenant. */
async function publishedVersion(db: Db, trackId: string) {
  const track = (await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1))[0];
  if (!track?.publishedVersion) return null;
  const version = (
    await db
      .select()
      .from(trackVersions)
      .where(
        and(eq(trackVersions.trackId, trackId), eq(trackVersions.version, track.publishedVersion)),
      )
      .limit(1)
  )[0];
  return version ? { tenantId: track.tenantId, content: version.content } : null;
}

async function publishedVersionsForTenant(db: Db, tenantId: string) {
  const trackRows = await db.select().from(tracks).where(eq(tracks.tenantId, tenantId));
  const out: { content: (typeof trackVersions.$inferSelect)["content"] }[] = [];
  for (const track of trackRows) {
    if (!track.publishedVersion) continue;
    const version = (
      await db
        .select()
        .from(trackVersions)
        .where(
          and(
            eq(trackVersions.trackId, track.id),
            eq(trackVersions.version, track.publishedVersion),
          ),
        )
        .limit(1)
    )[0];
    if (version) out.push({ content: version.content });
  }
  return out;
}

/** Midnight today in the given IANA timezone, as an instant (the "today" bucket, design.md §8). */
export function startOfTodayIn(timeZone: string, now = new Date()): Date {
  const parts = (date: Date) => {
    const fields = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(date);
    const get = (type: string) => Number(fields.find((part) => part.type === type)?.value ?? 0);
    return {
      y: get("year"),
      m: get("month"),
      d: get("day"),
      h: get("hour"),
      mi: get("minute"),
      s: get("second"),
    };
  };
  const local = parts(now);
  // Start from local midnight read as if it were UTC, then correct by the zone's offset at that instant.
  const guess = Date.UTC(local.y, local.m - 1, local.d);
  const at = parts(new Date(guess));
  const asUtc = Date.UTC(at.y, at.m - 1, at.d, at.h, at.mi, at.s);
  return new Date(guess - (asUtc - guess));
}
