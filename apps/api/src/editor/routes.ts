import { existsSync } from "node:fs";
import { join } from "node:path";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { and, asc, desc, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db/client.ts";
import { leaderboardEntries } from "../db/schema.ts";
import { ApiError, badRequest, forbidden, notFound } from "../errors.ts";
import type { BundleBuilderFn } from "../publish.ts";
import type { Storage } from "../storage.ts";
import { CONSOLE_COOKIE, checkPassword, issueToken, verifyToken } from "./auth.ts";
import { getDraft, listEditorTracks, publishDraft, saveDraft, validateDraft } from "./drafts.ts";

export interface ConsoleDeps {
  db: Db;
  storage: Storage;
  password: string;
  cookieSecret: string;
  /** Whether the session cookie should be marked Secure (true behind Render's HTTPS). */
  secureCookie: boolean;
  /** Directory of the built console SPA; when present it is served under /console. */
  consoleDir?: string;
  /** Passed to the bundle builder on publish. */
  build?: string;
  pmtilesBin?: string;
  /** Overrides the bundle builder (tests inject a fake so publishing needs no go-pmtiles). */
  builder?: BundleBuilderFn;
}

/**
 * The operator console (Editor v0, D34): a password-gated JSON API under /console-api, and the built
 * single-page app under /console. Kept apart from the public delivery/ingestion routes so the app's
 * endpoints stay open while everything here needs the session cookie.
 */
export async function registerConsole(app: FastifyInstance, deps: ConsoleDeps): Promise<void> {
  await app.register(fastifyCookie, { secret: deps.cookieSecret });

  const requireAuth = (request: FastifyRequest): void => {
    if (!verifyToken(deps.cookieSecret, request.cookies[CONSOLE_COOKIE]))
      throw new ApiError(401, "sign in to the console");
  };

  app.post("/console-api/login", async (request, reply) => {
    const body = (request.body ?? {}) as { password?: unknown };
    if (!checkPassword(body.password, deps.password)) throw forbidden("wrong password");
    setSession(reply, deps);
    return { ok: true };
  });

  app.post("/console-api/logout", async (_request, reply) => {
    reply.clearCookie(CONSOLE_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/console-api/session", async (request) => ({
    authed: verifyToken(deps.cookieSecret, request.cookies[CONSOLE_COOKIE]),
  }));

  app.get("/console-api/tracks", async (request) => {
    requireAuth(request);
    return { tracks: await listEditorTracks(deps.db) };
  });

  app.get("/console-api/tracks/:trackId", async (request) => {
    requireAuth(request);
    const { trackId } = request.params as { trackId: string };
    return { content: await getDraft(deps.db, trackId) };
  });

  app.put("/console-api/tracks/:trackId", async (request) => {
    requireAuth(request);
    const { trackId } = request.params as { trackId: string };
    const body = (request.body ?? {}) as { content?: unknown };
    if (body.content === undefined) throw badRequest("body.content is required");
    await saveDraft(deps.db, trackId, body.content);
    return { ok: true };
  });

  app.post("/console-api/tracks/:trackId/validate", async (request) => {
    requireAuth(request);
    const { trackId } = request.params as { trackId: string };
    return validateDraft(deps.db, trackId);
  });

  app.post("/console-api/tracks/:trackId/publish", async (request) => {
    requireAuth(request);
    const { trackId } = request.params as { trackId: string };
    return publishDraft(
      deps.db,
      deps.storage,
      trackId,
      { storage: deps.storage, build: deps.build, pmtilesBin: deps.pmtilesBin },
      deps.builder,
    );
  });

  app.get("/console-api/tracks/:trackId/leaderboard", async (request) => {
    requireAuth(request);
    const { trackId } = request.params as { trackId: string };
    const rows = await deps.db
      .select()
      .from(leaderboardEntries)
      .where(eq(leaderboardEntries.trackId, trackId))
      .orderBy(desc(leaderboardEntries.score), asc(leaderboardEntries.playTimeMs))
      .limit(200);
    return {
      entries: rows.map((row) => ({
        sessionId: row.sessionId,
        teamName: row.teamName,
        score: row.score,
        playTimeMs: row.playTimeMs,
        hidden: row.hidden,
        finishedAt: row.finishedAt,
      })),
    };
  });

  app.post("/console-api/leaderboard/:sessionId/hide", async (request) => {
    requireAuth(request);
    const { sessionId } = request.params as { sessionId: string };
    const body = (request.body ?? {}) as { hidden?: unknown };
    const hidden = body.hidden !== false;
    const updated = await deps.db
      .update(leaderboardEntries)
      .set({ hidden })
      .where(eq(leaderboardEntries.sessionId, sessionId))
      .returning({ sessionId: leaderboardEntries.sessionId });
    if (updated.length === 0) throw notFound(`no leaderboard entry for ${sessionId}`);
    return { ok: true, hidden };
  });

  // Serve the built SPA under /console (skipped in dev, where Vite serves it).
  if (deps.consoleDir && existsSync(deps.consoleDir)) {
    await app.register(fastifyStatic, {
      root: deps.consoleDir,
      prefix: "/console/",
      wildcard: false,
    });
    const sendIndex = (_request: FastifyRequest, reply: FastifyReply) =>
      reply.sendFile("index.html", deps.consoleDir);
    app.get("/console", sendIndex);
    app.get("/console/*", sendIndex);
  }
}

/** The join helper, exported so tests can point at a fixture SPA directory. */
export const consoleIndex = (dir: string): string => join(dir, "index.html");

function setSession(reply: FastifyReply, deps: ConsoleDeps): void {
  reply.setCookie(CONSOLE_COOKIE, issueToken(deps.cookieSecret), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: deps.secureCookie,
    maxAge: 7 * 24 * 60 * 60,
  });
}
