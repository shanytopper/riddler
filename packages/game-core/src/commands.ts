import type { Leg, Station, TrackContent } from "@riddles/bundle-schema";
import type { ArrivalMethod, EventBody, EventContext, SessionEvent } from "./events.ts";
import { checkAnswer, type AnswerInput, type AnswerResult } from "./match.ts";
import { challengeScore } from "./scoring.ts";
import {
  INITIAL_STATE,
  applyEvent,
  playTimeAt,
  stationState,
  type SessionState,
} from "./session.ts";

/**
 * Commands turn what the party does into events, after checking the rules of the track. Each returns
 * the events to append; callers persist them and fold them with applyEvent. Rule violations throw a
 * GameRuleError with a stable code the UI can map to a message.
 */

export type GameRuleCode =
  | "not_active"
  | "not_paused"
  | "unknown_station"
  | "station_hidden"
  | "not_arrived"
  | "already_completed"
  | "out_of_order"
  | "method_not_offered"
  | "no_more_hints"
  | "reveal_not_allowed"
  | "no_next_leg";

export class GameRuleError extends Error {
  readonly code: GameRuleCode;
  constructor(code: GameRuleCode, message: string) {
    super(message);
    this.name = "GameRuleError";
    this.code = code;
  }
}

export interface StartOptions {
  trackVersion: number;
  language: string;
  teamName: string;
}

interface Emission {
  events: SessionEvent[];
  state: SessionState;
}

function emit(state: SessionState, ctx: EventContext, bodies: readonly EventBody[]): Emission {
  const events: SessionEvent[] = [];
  let current = state;
  for (const body of bodies) {
    const event: SessionEvent = {
      ...body,
      id: ctx.id(),
      seq: current.lastSeq + 1,
      at: ctx.now(),
      mono: ctx.mono(),
    };
    events.push(event);
    current = applyEvent(current, event);
  }
  return { events, state: current };
}

function concat(first: Emission, next: (state: SessionState) => Emission): Emission {
  const more = next(first.state);
  return { events: [...first.events, ...more.events], state: more.state };
}

export function currentLeg(content: TrackContent, state: SessionState): Leg | null {
  return content.legs[state.legIndex] ?? null;
}

export function findStation(
  content: TrackContent,
  stationId: string,
): { leg: Leg; station: Station; index: number } | null {
  for (const leg of content.legs) {
    const index = leg.stations.findIndex((station) => station.id === stationId);
    const station = leg.stations[index];
    if (station) return { leg, station, index };
  }
  return null;
}

/** In linear order, the station the party must do next; in free order, null (any revealed station). */
export function nextStation(content: TrackContent, state: SessionState): Station | null {
  const leg = currentLeg(content, state);
  if (!leg || content.rules.order !== "linear") return null;
  return (
    leg.stations.find((station) => stationState(state, station.id).status !== "completed") ?? null
  );
}

export function canRevealAndContinue(
  content: TrackContent,
  state: SessionState,
  stationId: string,
): boolean {
  const found = findStation(content, stationId);
  if (!found || found.station.challenge === null) return false;
  const s = stationState(state, stationId);
  if (s.status !== "arrived") return false;
  if (content.rules.revealAndContinue === "immediately") return true;
  // A challenge with no hints would otherwise have no way forward (design.md §4.5).
  return found.station.hints.length === 0 || s.hintsRevealed >= 1;
}

export function startSession(
  content: TrackContent,
  options: StartOptions,
  ctx: EventContext,
): SessionEvent[] {
  const started = emit(INITIAL_STATE, ctx, [
    { type: "session_started", trackId: content.trackId, ...options },
  ]);
  return concat(started, (state) => startLegEmission(content, state, ctx)).events;
}

/** Begins the next leg after the party has travelled (the first leg is started by startSession). */
export function startNextLeg(
  content: TrackContent,
  state: SessionState,
  ctx: EventContext,
): SessionEvent[] {
  if (state.status !== "paused" || state.legStarted)
    throw new GameRuleError("not_paused", "no leg is waiting to start");
  if (!currentLeg(content, state)) throw new GameRuleError("no_next_leg", "every leg is complete");
  return startLegEmission(content, state, ctx).events;
}

function startLegEmission(content: TrackContent, state: SessionState, ctx: EventContext): Emission {
  const leg = currentLeg(content, state);
  if (!leg) throw new GameRuleError("no_next_leg", "every leg is complete");
  const started = emit(state, ctx, [{ type: "leg_started", legId: leg.id }]);
  const initial: readonly Station[] =
    content.rules.visibility === "all" ? leg.stations : [leg.stations[0]];
  return initial.reduce(
    (emission, station) =>
      concat(emission, (current) => revealEmission(content, current, station, ctx)),
    started,
  );
}

/** Reveals a station, then handles automatic arrival and info stations, which may cascade. */
function revealEmission(
  content: TrackContent,
  state: SessionState,
  station: Station,
  ctx: EventContext,
): Emission {
  let emission = emit(state, ctx, [{ type: "station_revealed", stationId: station.id }]);
  if (station.arrival.automatic) {
    emission = concat(emission, (current) =>
      arriveEmission(content, current, station, "automatic", ctx),
    );
  }
  return emission;
}

function arriveEmission(
  content: TrackContent,
  state: SessionState,
  station: Station,
  method: ArrivalMethod,
  ctx: EventContext,
): Emission {
  let emission = emit(state, ctx, [{ type: "station_arrived", stationId: station.id, method }]);
  if (station.challenge === null) {
    emission = concat(emission, (current) =>
      completeEmission(content, current, station, 0, false, ctx),
    );
  }
  return emission;
}

function completeEmission(
  content: TrackContent,
  state: SessionState,
  station: Station,
  points: number,
  answerRevealed: boolean,
  ctx: EventContext,
): Emission {
  const completed = emit(state, ctx, [
    { type: "station_completed", stationId: station.id, points, answerRevealed },
  ]);
  return concat(completed, (current) => advanceEmission(content, current, ctx));
}

/** After a completion: reveal the next station, or close the leg and maybe the session. */
function advanceEmission(content: TrackContent, state: SessionState, ctx: EventContext): Emission {
  const leg = currentLeg(content, state);
  if (!leg) return { events: [], state };
  const remaining = leg.stations.filter(
    (station) => stationState(state, station.id).status !== "completed",
  );
  if (remaining.length === 0) {
    const closed = emit(state, ctx, [{ type: "leg_completed", legId: leg.id }]);
    const isLast = state.legIndex + 1 >= content.legs.length;
    if (!isLast) return closed;
    return concat(closed, (current) =>
      emit(current, ctx, [
        {
          type: "session_finished",
          score: current.score,
          playTimeMs: playTimeAt(current, ctx.mono()),
        },
      ]),
    );
  }
  if (content.rules.order === "linear" && content.rules.visibility === "progressive") {
    const next = remaining[0]!;
    if (stationState(state, next.id).status === "hidden")
      return revealEmission(content, state, next, ctx);
  }
  return { events: [], state };
}

function requireActive(state: SessionState): void {
  if (state.status !== "active" || !state.legStarted)
    throw new GameRuleError("not_active", "the session is not in play");
}

function requireStation(content: TrackContent, state: SessionState, stationId: string): Station {
  const found = findStation(content, stationId);
  if (!found) throw new GameRuleError("unknown_station", `no station ${stationId}`);
  const leg = currentLeg(content, state);
  if (!leg || found.leg.id !== leg.id)
    throw new GameRuleError("out_of_order", "that station is not in the current leg");
  return found.station;
}

export function arrive(
  content: TrackContent,
  state: SessionState,
  stationId: string,
  method: Exclude<ArrivalMethod, "automatic">,
  ctx: EventContext,
): SessionEvent[] {
  requireActive(state);
  const station = requireStation(content, state, stationId);
  const s = stationState(state, stationId);
  if (s.status === "hidden")
    throw new GameRuleError("station_hidden", "that station has not been revealed yet");
  if (s.status === "completed")
    throw new GameRuleError("already_completed", "that station is already done");
  if (s.status === "arrived") return [];
  const expected = nextStation(content, state);
  if (expected && expected.id !== stationId)
    throw new GameRuleError("out_of_order", "stations are visited in order");
  // Manual check-in is always available (design.md §4.3, D6); the others only where the station lists them.
  if (method !== "manual" && !station.arrival.methods.includes(method))
    throw new GameRuleError("method_not_offered", `this station does not offer ${method} arrival`);
  return arriveEmission(content, state, station, method, ctx).events;
}

export function revealHint(
  content: TrackContent,
  state: SessionState,
  stationId: string,
  ctx: EventContext,
): SessionEvent[] {
  requireActive(state);
  const station = requireStation(content, state, stationId);
  const s = stationState(state, stationId);
  if (s.status === "completed")
    throw new GameRuleError("already_completed", "that station is already done");
  if (s.status !== "arrived") throw new GameRuleError("not_arrived", "arrive at the station first");
  const hint = station.hints[s.hintsRevealed];
  if (!hint) throw new GameRuleError("no_more_hints", "every hint has been revealed");
  return emit(state, ctx, [
    { type: "hint_revealed", stationId, index: s.hintsRevealed, cost: hint.cost },
  ]).events;
}

export interface SubmitResult {
  events: SessionEvent[];
  result: AnswerResult;
}

export function submitAnswer(
  content: TrackContent,
  state: SessionState,
  stationId: string,
  input: AnswerInput,
  ctx: EventContext,
): SubmitResult {
  requireActive(state);
  const station = requireStation(content, state, stationId);
  const s = stationState(state, stationId);
  if (s.status === "completed")
    throw new GameRuleError("already_completed", "that station is already done");
  if (s.status !== "arrived") throw new GameRuleError("not_arrived", "arrive at the station first");
  if (station.challenge === null)
    throw new GameRuleError("already_completed", "an info station has no challenge");

  const result = checkAnswer(station.challenge, input);
  let emission = emit(state, ctx, [
    {
      type: "answer_submitted",
      stationId,
      correct: result.correct,
      normalizedText: result.correct ? null : result.normalizedText,
    },
  ]);
  if (result.correct) {
    const isChoice =
      station.challenge.type === "choice" || station.challenge.type === "multi_choice";
    const points = challengeScore({
      points: station.points,
      hintCosts: station.hints.map((hint) => hint.cost),
      hintsRevealed: s.hintsRevealed,
      wrongChoiceAttempts: isChoice ? s.wrongAttempts : 0,
      wrongChoicePenaltyPercent: content.rules.wrongChoicePenaltyPercent,
      answerRevealed: false,
    });
    emission = concat(emission, (current) =>
      completeEmission(content, current, station, points, false, ctx),
    );
  }
  return { events: emission.events, result };
}

export function revealAndContinue(
  content: TrackContent,
  state: SessionState,
  stationId: string,
  ctx: EventContext,
): SessionEvent[] {
  requireActive(state);
  const station = requireStation(content, state, stationId);
  if (!canRevealAndContinue(content, state, stationId)) {
    throw new GameRuleError(
      "reveal_not_allowed",
      "reveal the first hint before giving up on this one",
    );
  }
  return completeEmission(content, state, station, 0, true, ctx).events;
}

export function pause(state: SessionState, ctx: EventContext): SessionEvent[] {
  if (state.status !== "active")
    throw new GameRuleError("not_active", "only an active session can pause");
  return emit(state, ctx, [{ type: "session_paused" }]).events;
}

export function resume(state: SessionState, ctx: EventContext): SessionEvent[] {
  if (state.status !== "paused" || !state.legStarted)
    throw new GameRuleError("not_paused", "nothing to resume");
  return emit(state, ctx, [{ type: "session_resumed" }]).events;
}

export function leave(state: SessionState, ctx: EventContext): SessionEvent[] {
  if (state.status === "finished" || state.status === "abandoned") return [];
  return emit(state, ctx, [{ type: "session_abandoned" }]).events;
}

export function setLeaderboardOptIn(
  state: SessionState,
  optIn: boolean,
  ctx: EventContext,
): SessionEvent[] {
  return emit(state, ctx, [{ type: "leaderboard_opt_in", optIn }]).events;
}
