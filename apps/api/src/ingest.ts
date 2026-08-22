import type { Station, TrackContent } from "@riddles/bundle-schema";
import type { EventType, SessionEvent } from "@riddles/game-core";
import {
  EVENT_TYPES,
  challengeScore,
  deriveState,
  timeBonus,
  validateTeamName,
} from "@riddles/game-core";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import { leaderboardEntries, sessionEvents, sessions, trackVersions, tracks } from "./db/schema.ts";
import { badRequest, conflict, forbidden, notFound, tooLarge } from "./errors.ts";

/**
 * Ingests a batch of session events (design.md §8, §11.2). Idempotent by client-generated event id,
 * so replaying a batch changes nothing. After storing, the server re-derives the session from the
 * whole log with the shared reducer and recomputes the authoritative score **from the track's
 * content** — station values, hint costs, wrong-choice penalties — never from the points the client
 * wrote into its events. A mismatch with the client's report is flagged and the server's value wins.
 * Once the session is finished and opted in, a leaderboard entry is published; a team name that fails
 * the shared filter is stored hidden.
 *
 * Guards for a public endpoint with no accounts (prototype): every event is shape-checked, batches
 * and logs are capped, a session stays bound to the device that opened it, and a sequence number
 * that already holds a different event is refused rather than silently dropped.
 */

export const MAX_BATCH_EVENTS = 500;
export const MAX_SESSION_EVENTS = 5000;

export interface IngestInput {
  sessionId: string;
  deviceId?: string | null;
  events: unknown;
}

export interface IngestResult {
  /** Events 1..n are all durably stored; the client may treat everything through n as synced. */
  acknowledgedThroughSeq: number;
  status: string;
  serverScore: number;
  mismatch: boolean;
}

type Field = [name: string, kind: "string" | "number" | "integer" | "boolean"];
const REQUIRED: Record<EventType, Field[]> = {
  session_started: [
    ["trackId", "string"],
    ["trackVersion", "integer"],
    ["language", "string"],
    ["teamName", "string"],
  ],
  leg_started: [["legId", "string"]],
  station_revealed: [["stationId", "string"]],
  station_arrived: [
    ["stationId", "string"],
    ["method", "string"],
  ],
  hint_revealed: [
    ["stationId", "string"],
    ["index", "integer"],
    ["cost", "number"],
  ],
  answer_submitted: [
    ["stationId", "string"],
    ["correct", "boolean"],
  ],
  station_completed: [
    ["stationId", "string"],
    ["points", "number"],
    ["answerRevealed", "boolean"],
  ],
  leg_completed: [["legId", "string"]],
  session_paused: [],
  session_resumed: [],
  session_finished: [
    ["score", "number"],
    ["playTimeMs", "number"],
  ],
  session_abandoned: [],
  leaderboard_opt_in: [["optIn", "boolean"]],
};

const KNOWN_TYPES = new Set<string>(EVENT_TYPES);

function hasKind(value: unknown, kind: Field[1]): boolean {
  switch (kind) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
  }
}

/** Rejects anything that isn't a well-formed event log fragment, before it touches the database. */
export function validateBatch(input: unknown): SessionEvent[] {
  if (!Array.isArray(input)) throw badRequest("events must be an array");
  if (input.length > MAX_BATCH_EVENTS)
    throw tooLarge(`at most ${MAX_BATCH_EVENTS} events per batch`);
  const seen = new Map<number, string>();
  return input.map((raw, i) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw badRequest(`events[${i}] is not an object`);
    const e = raw as Record<string, unknown>;
    if (typeof e.id !== "string" || e.id.length === 0 || e.id.length > 128)
      throw badRequest(`events[${i}].id must be a short string`);
    if (!Number.isInteger(e.seq) || (e.seq as number) < 1)
      throw badRequest(`events[${i}].seq must be a positive integer`);
    if (typeof e.type !== "string" || !KNOWN_TYPES.has(e.type))
      throw badRequest(`events[${i}].type is not a known event type`);
    if (typeof e.at !== "string" || typeof e.mono !== "number" || !Number.isFinite(e.mono))
      throw badRequest(`events[${i}] is missing its clock fields`);
    for (const [name, kind] of REQUIRED[e.type as EventType]) {
      if (!hasKind(e[name], kind)) throw badRequest(`events[${i}].${name} must be a ${kind}`);
    }
    const seq = e.seq as number;
    const previous = seen.get(seq);
    if (previous !== undefined && previous !== e.id)
      throw badRequest(`events[${i}] repeats sequence ${seq} with a different id`);
    seen.set(seq, e.id);
    return e as unknown as SessionEvent;
  });
}

export async function ingestEvents(db: Db, input: IngestInput): Promise<IngestResult> {
  const { sessionId } = input;
  if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > 128)
    throw badRequest("invalid session id");
  const batch = validateBatch(input.events);

  const existing = (await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1))[0];
  // A session belongs to the device that opened it; another device may not append to it.
  if (existing?.deviceId && input.deviceId && existing.deviceId !== input.deviceId)
    throw forbidden("this session belongs to another device");

  const startedEvent = batch.find((event) => event.type === "session_started");
  const trackId = existing?.trackId ?? startedEvent?.trackId;
  const trackVersion = existing?.trackVersion ?? startedEvent?.trackVersion;
  if (!trackId || trackVersion === undefined)
    throw badRequest("no known session and no session_started in the batch");

  const track = (await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1))[0];
  if (!track) throw notFound(`unknown track ${trackId}`);
  const version = (
    await db
      .select({ content: trackVersions.content })
      .from(trackVersions)
      .where(and(eq(trackVersions.trackId, trackId), eq(trackVersions.version, trackVersion)))
      .limit(1)
  )[0];
  if (!version) throw notFound(`unknown version ${trackVersion} of track ${trackId}`);

  // Caps, so one anonymous caller can't fill the free database through a single session.
  const stored = (
    await db
      .select({ n: sql<number>`count(*)` })
      .from(sessionEvents)
      .where(eq(sessionEvents.sessionId, sessionId))
  )[0];
  if (Number(stored?.n ?? 0) + batch.length > MAX_SESSION_EVENTS)
    throw tooLarge(`a session may hold at most ${MAX_SESSION_EVENTS} events`);

  // A sequence number that already holds a *different* event is a real conflict, not a replay.
  if (batch.length > 0) {
    const held = await db
      .select({ seq: sessionEvents.seq, eventId: sessionEvents.eventId })
      .from(sessionEvents)
      .where(
        and(
          eq(sessionEvents.sessionId, sessionId),
          inArray(
            sessionEvents.seq,
            batch.map((event) => event.seq),
          ),
        ),
      );
    const byStoredSeq = new Map(held.map((row) => [row.seq, row.eventId]));
    for (const event of batch) {
      const storedId = byStoredSeq.get(event.seq);
      if (storedId !== undefined && storedId !== event.id)
        throw conflict(`sequence ${event.seq} already holds a different event`);
    }
    await db
      .insert(sessionEvents)
      .values(
        batch.map((event) => ({
          sessionId,
          seq: event.seq,
          eventId: event.id,
          type: event.type,
          data: event,
        })),
      )
      .onConflictDoNothing();
  }

  // Re-derive from the full stored log with the same reducer the app uses.
  const rows = await db
    .select({ data: sessionEvents.data })
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId))
    .orderBy(asc(sessionEvents.seq));
  const log = rows.map((row) => row.data);
  if (log.length === 0) throw badRequest("no events for this session");
  const state = deriveState(log);

  // The device's monotonic clock yields fractional milliseconds; play time is stored as whole ms.
  const serverPlayTimeMs = Math.round(state.playTimeMs);
  const serverScore = recomputeScore(version.content, log, serverPlayTimeMs);
  const finished = log.find((event) => event.type === "session_finished");
  const startedAt = timeOf(log, "session_started");
  const finishedAt = timeOf(log, "session_finished");
  // The client's own report, for the sanity check (design.md §8).
  const clientScore = finished?.type === "session_finished" ? finished.score : state.score;
  const clientPlayTimeMs =
    finished?.type === "session_finished" ? Math.round(finished.playTimeMs) : serverPlayTimeMs;
  const mismatch =
    clientScore !== serverScore || Math.abs(clientPlayTimeMs - serverPlayTimeMs) > 1000;
  const nameOk = validateTeamName(state.teamName) === "ok";

  await db
    .insert(sessions)
    .values({
      id: sessionId,
      tenantId: track.tenantId,
      trackId,
      trackVersion: state.trackVersion,
      teamName: state.teamName,
      language: state.language,
      status: state.status,
      score: clientScore,
      playTimeMs: clientPlayTimeMs,
      serverScore,
      serverPlayTimeMs,
      mismatch,
      leaderboardOptIn: state.leaderboardOptIn,
      deviceId: input.deviceId ?? null,
      startedAt: startedAt ?? new Date(),
      finishedAt: finishedAt ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: sessions.id,
      set: {
        status: state.status,
        score: clientScore,
        playTimeMs: clientPlayTimeMs,
        serverScore,
        serverPlayTimeMs,
        mismatch,
        leaderboardOptIn: state.leaderboardOptIn,
        // Bind the session to the first device that identifies itself.
        deviceId: existing?.deviceId ?? input.deviceId ?? null,
        finishedAt: finishedAt ?? null,
        updatedAt: new Date(),
      },
    });

  // Publish (or refresh) the leaderboard entry once the game is finished and opted in.
  if (state.status === "finished" && state.leaderboardOptIn) {
    await db
      .insert(leaderboardEntries)
      .values({
        id: sessionId,
        tenantId: track.tenantId,
        trackId,
        trackVersion: state.trackVersion,
        sessionId,
        teamName: state.teamName,
        score: serverScore,
        playTimeMs: serverPlayTimeMs,
        hidden: !nameOk,
        finishedAt: finishedAt ?? new Date(),
      })
      .onConflictDoUpdate({
        target: leaderboardEntries.sessionId,
        set: {
          teamName: state.teamName,
          score: serverScore,
          playTimeMs: serverPlayTimeMs,
          hidden: !nameOk,
        },
      });
  } else if (!state.leaderboardOptIn) {
    // Opting back out withdraws a previously posted entry.
    await db.delete(leaderboardEntries).where(eq(leaderboardEntries.sessionId, sessionId));
  }

  return {
    acknowledgedThroughSeq: contiguousThrough(log),
    status: state.status,
    serverScore,
    mismatch,
  };
}

/**
 * The score the track's content allows for this log: each station counts once, only if it exists,
 * and only for what its configuration grants after the hints the log shows were revealed and the
 * wrong choices it shows were made. Client-written points are ignored entirely.
 */
export function recomputeScore(
  content: TrackContent,
  log: readonly SessionEvent[],
  playTimeMs: number,
): number {
  const stations = new Map<string, Station>();
  for (const leg of content.legs)
    for (const station of leg.stations) stations.set(station.id, station);
  const progress = new Map<string, { hints: number; wrong: number; done: boolean }>();
  const of = (id: string) => {
    let entry = progress.get(id);
    if (!entry) {
      entry = { hints: 0, wrong: 0, done: false };
      progress.set(id, entry);
    }
    return entry;
  };
  let total = 0;
  for (const event of log) {
    switch (event.type) {
      case "hint_revealed":
        of(event.stationId).hints = Math.max(of(event.stationId).hints, event.index + 1);
        break;
      case "answer_submitted":
        if (!event.correct) of(event.stationId).wrong += 1;
        break;
      case "station_completed": {
        const station = stations.get(event.stationId);
        const entry = of(event.stationId);
        if (!station || entry.done) break;
        entry.done = true;
        if (!station.challenge) break;
        const isChoice =
          station.challenge.type === "choice" || station.challenge.type === "multi_choice";
        total += challengeScore({
          points: station.points,
          hintCosts: station.hints.map((hint) => hint.cost),
          hintsRevealed: Math.min(entry.hints, station.hints.length),
          wrongChoiceAttempts: isChoice ? entry.wrong : 0,
          wrongChoicePenaltyPercent: content.rules.wrongChoicePenaltyPercent,
          answerRevealed: event.answerRevealed,
        });
        break;
      }
      default:
        break;
    }
  }
  const finished = log.some((event) => event.type === "session_finished");
  return (
    total +
    (finished ? timeBonus(content.rules.timeBonus ?? null, Math.round(playTimeMs / 1000)) : 0)
  );
}

/** The largest n such that events 1..n are all present. */
function contiguousThrough(log: readonly SessionEvent[]): number {
  let n = 0;
  for (const event of log) {
    if (event.seq === n + 1) n = event.seq;
    else if (event.seq > n + 1) break;
  }
  return n;
}

function timeOf(log: readonly SessionEvent[], type: SessionEvent["type"]): Date | null {
  const event = log.find((candidate) => candidate.type === type);
  return event ? new Date(event.at) : null;
}
