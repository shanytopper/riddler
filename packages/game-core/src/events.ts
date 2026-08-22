/**
 * The session event log (design.md §7, §8). Events are facts about what happened on the device; the
 * reducer in session.ts folds them into state, the commands in commands.ts decide which to emit.
 * Every event carries a client-generated id and a per-session sequence number, so the server can
 * store them idempotently, plus wall-clock time for records and a monotonic clock for durations.
 */

export type ArrivalMethod = "gps" | "qr" | "manual" | "automatic";

export interface EventMeta {
  id: string;
  seq: number;
  /** Wall-clock time on the device, ISO 8601. Not trusted for durations. */
  at: string;
  /** Milliseconds from a monotonic clock; only differences are meaningful. */
  mono: number;
}

export type EventBody =
  | {
      type: "session_started";
      trackId: string;
      trackVersion: number;
      language: string;
      teamName: string;
    }
  | { type: "leg_started"; legId: string }
  | { type: "station_revealed"; stationId: string }
  | { type: "station_arrived"; stationId: string; method: ArrivalMethod }
  | { type: "hint_revealed"; stationId: string; index: number; cost: number }
  | { type: "answer_submitted"; stationId: string; correct: boolean; normalizedText: string | null }
  | { type: "station_completed"; stationId: string; points: number; answerRevealed: boolean }
  | { type: "leg_completed"; legId: string }
  | { type: "session_paused" }
  | { type: "session_resumed" }
  | { type: "session_finished"; score: number; playTimeMs: number }
  | { type: "session_abandoned" }
  | { type: "leaderboard_opt_in"; optIn: boolean };

export type SessionEvent = EventMeta & EventBody;
export type EventType = EventBody["type"];

/** Every event type, for validating a log that arrives over the network. */
export const EVENT_TYPES: readonly EventType[] = [
  "session_started",
  "leg_started",
  "station_revealed",
  "station_arrived",
  "hint_revealed",
  "answer_submitted",
  "station_completed",
  "leg_completed",
  "session_paused",
  "session_resumed",
  "session_finished",
  "session_abandoned",
  "leaderboard_opt_in",
];

/** Supplied by the host: ids, wall-clock time, and a monotonic clock. Tests pass deterministic ones. */
export interface EventContext {
  id(): string;
  now(): string;
  mono(): number;
}
