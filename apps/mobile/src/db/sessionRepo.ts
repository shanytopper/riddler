import type { SessionEvent, SessionState } from "@riddles/game-core";
import { db } from "./index.ts";

/** A resumable session on this device: enough to find its bundle and re-derive its state. */
export interface SessionRow {
  id: string;
  trackId: string;
  trackVersion: number;
  tenantSlug: string | null;
  status: string;
}

interface RawSessionRow {
  id: string;
  track_id: string;
  track_version: number;
  tenant_slug: string | null;
  status: string;
}

/** Opens a session row before any event is written, so the log always has a home. */
export function createSessionRow(input: {
  id: string;
  trackId: string;
  trackVersion: number;
  tenantSlug: string | null;
  teamName: string;
  language: string;
  at: string;
}): void {
  db?.runSync(
    `INSERT INTO sessions
       (id, track_id, track_version, tenant_slug, team_name, language, status, score, play_time_ms, started_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', 0, 0, ?, ?)`,
    input.id,
    input.trackId,
    input.trackVersion,
    input.tenantSlug,
    input.teamName,
    input.language,
    input.at,
    input.at,
  );
}

/**
 * Appends events and refreshes the session summary in one transaction. The events are the source of
 * truth; the summary columns are a denormalized cache for listing without replaying every log.
 * Called before the in-memory state updates (append-then-apply).
 */
export function appendEvents(
  sessionId: string,
  events: readonly SessionEvent[],
  after: SessionState,
): void {
  const database = db;
  if (!database || events.length === 0) return;
  database.withTransactionSync(() => {
    for (const event of events) {
      database.runSync(
        "INSERT OR IGNORE INTO events (session_id, seq, type, data) VALUES (?, ?, ?, ?)",
        sessionId,
        event.seq,
        event.type,
        JSON.stringify(event),
      );
    }
    const last = events[events.length - 1]!;
    database.runSync(
      "UPDATE sessions SET status = ?, score = ?, play_time_ms = ?, finished_at = ?, updated_at = ? WHERE id = ?",
      after.status,
      after.score,
      after.finished?.playTimeMs ?? after.playTimeMs,
      after.finished ? last.at : null,
      last.at,
      sessionId,
    );
  });
}

/** The most recently touched session still in play, if any. */
export function latestResumableSession(): SessionRow | null {
  const row = db?.getFirstSync<RawSessionRow>(
    `SELECT id, track_id, track_version, tenant_slug, status
       FROM sessions
      WHERE status IN ('active', 'paused')
      ORDER BY updated_at DESC
      LIMIT 1`,
  );
  return row ? toSessionRow(row) : null;
}

/** The full event log of a session, in order, for re-deriving its state. */
export function loadEvents(sessionId: string): SessionEvent[] {
  const rows =
    db?.getAllSync<{ data: string }>(
      "SELECT data FROM events WHERE session_id = ? ORDER BY seq ASC",
      sessionId,
    ) ?? [];
  return rows.map((row) => JSON.parse(row.data) as SessionEvent);
}

/** Sessions that have events the API has not yet acknowledged (step 7 sync). */
export function sessionsWithUnsyncedEvents(): { id: string; syncedSeq: number }[] {
  return (
    db?.getAllSync<{ id: string; syncedSeq: number }>(
      `SELECT s.id AS id, s.synced_seq AS syncedSeq
         FROM sessions s
        WHERE (SELECT COALESCE(MAX(seq), 0) FROM events WHERE session_id = s.id) > s.synced_seq
        ORDER BY s.updated_at ASC`,
    ) ?? []
  );
}

/** A session's events beyond a sequence number, for uploading only what's new. */
export function eventsAfter(sessionId: string, afterSeq: number): SessionEvent[] {
  const rows =
    db?.getAllSync<{ data: string }>(
      "SELECT data FROM events WHERE session_id = ? AND seq > ? ORDER BY seq ASC",
      sessionId,
      afterSeq,
    ) ?? [];
  return rows.map((row) => JSON.parse(row.data) as SessionEvent);
}

/** Advances the synced high-water mark after the API acknowledges a batch (never moves it back). */
export function markSynced(sessionId: string, throughSeq: number): void {
  db?.runSync(
    "UPDATE sessions SET synced_seq = MAX(synced_seq, ?) WHERE id = ?",
    throughSeq,
    sessionId,
  );
}

/** Sessions still referencing a bundle, so we don't silently strip a game in progress. */
export function resumableSessionsForBundle(trackId: string, version: number): number {
  const row = db?.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sessions
      WHERE track_id = ? AND track_version = ? AND status IN ('active', 'paused')`,
    trackId,
    version,
  );
  return row?.n ?? 0;
}

function toSessionRow(row: RawSessionRow): SessionRow {
  return {
    id: row.id,
    trackId: row.track_id,
    trackVersion: row.track_version,
    tenantSlug: row.tenant_slug,
    status: row.status,
  };
}
