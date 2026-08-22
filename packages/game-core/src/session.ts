import type { SessionEvent } from "./events.ts";

export type SessionStatus = "created" | "active" | "paused" | "finished" | "abandoned";
export type StationStatus = "hidden" | "revealed" | "arrived" | "completed";

export interface StationState {
  status: StationStatus;
  hintsRevealed: number;
  /** Incorrect submissions so far. */
  wrongAttempts: number;
  /** Points earned, once completed. */
  points: number | null;
  answerRevealed: boolean;
}

export interface SessionState {
  status: SessionStatus;
  trackId: string;
  trackVersion: number;
  language: string;
  teamName: string;
  /** Index of the leg in play; equals the number of legs once the last one is completed. */
  legIndex: number;
  /** False between legs, while the party travels. */
  legStarted: boolean;
  stations: Record<string, StationState>;
  score: number;
  /** Active play time accumulated up to the last pause, leg end, or finish. */
  playTimeMs: number;
  /** Monotonic time when the current active stretch began; null while paused or not active. */
  activeSince: number | null;
  leaderboardOptIn: boolean;
  lastSeq: number;
  finished: { score: number; playTimeMs: number } | null;
}

export const INITIAL_STATE: SessionState = {
  status: "created",
  trackId: "",
  trackVersion: 0,
  language: "",
  teamName: "",
  legIndex: 0,
  legStarted: false,
  stations: {},
  score: 0,
  playTimeMs: 0,
  activeSince: null,
  leaderboardOptIn: false,
  lastSeq: 0,
  finished: null,
};

const NEW_STATION: StationState = {
  status: "hidden",
  hintsRevealed: 0,
  wrongAttempts: 0,
  points: null,
  answerRevealed: false,
};

export function stationState(state: SessionState, stationId: string): StationState {
  return state.stations[stationId] ?? NEW_STATION;
}

/** Play time as of a monotonic instant, including the active stretch in progress. */
export function playTimeAt(state: SessionState, mono: number): number {
  return (
    state.playTimeMs + (state.activeSince === null ? 0 : Math.max(0, mono - state.activeSince))
  );
}

function settle(state: SessionState, mono: number): SessionState {
  return { ...state, playTimeMs: playTimeAt(state, mono), activeSince: null };
}

function withStation(
  state: SessionState,
  stationId: string,
  update: (current: StationState) => StationState,
): SessionState {
  return {
    ...state,
    stations: { ...state.stations, [stationId]: update(stationState(state, stationId)) },
  };
}

/** Pure fold of one event into state. Needs no content: events carry every id they refer to. */
export function applyEvent(state: SessionState, event: SessionEvent): SessionState {
  const next = applyBody(state, event);
  return { ...next, lastSeq: event.seq };
}

function applyBody(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "session_started":
      return {
        ...INITIAL_STATE,
        status: "active",
        trackId: event.trackId,
        trackVersion: event.trackVersion,
        language: event.language,
        teamName: event.teamName,
        activeSince: event.mono,
      };
    case "leg_started":
      return {
        ...state,
        status: "active",
        legStarted: true,
        activeSince: state.activeSince ?? event.mono,
      };
    case "station_revealed":
      return withStation(state, event.stationId, (s) =>
        s.status === "hidden" ? { ...s, status: "revealed" } : s,
      );
    case "station_arrived":
      return withStation(state, event.stationId, (s) =>
        s.status === "completed" ? s : { ...s, status: "arrived" },
      );
    case "hint_revealed":
      return withStation(state, event.stationId, (s) => ({
        ...s,
        hintsRevealed: Math.max(s.hintsRevealed, event.index + 1),
      }));
    case "answer_submitted":
      return event.correct
        ? state
        : withStation(state, event.stationId, (s) => ({
            ...s,
            wrongAttempts: s.wrongAttempts + 1,
          }));
    case "station_completed":
      return {
        ...withStation(state, event.stationId, (s) => ({
          ...s,
          status: "completed",
          points: event.points,
          answerRevealed: event.answerRevealed,
        })),
        score: state.score + event.points,
      };
    case "leg_completed":
      return {
        ...settle(state, event.mono),
        status: "paused",
        legStarted: false,
        legIndex: state.legIndex + 1,
      };
    case "session_paused":
      return { ...settle(state, event.mono), status: "paused" };
    case "session_resumed":
      return { ...state, status: "active", activeSince: event.mono };
    case "session_finished":
      return {
        ...settle(state, event.mono),
        status: "finished",
        finished: { score: event.score, playTimeMs: event.playTimeMs },
      };
    case "session_abandoned":
      return { ...settle(state, event.mono), status: "abandoned" };
    case "leaderboard_opt_in":
      return { ...state, leaderboardOptIn: event.optIn };
  }
}

export function deriveState(events: readonly SessionEvent[]): SessionState {
  return events.reduce(applyEvent, INITIAL_STATE);
}
