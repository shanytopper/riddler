import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { TrackContent } from "@riddles/bundle-schema";
import {
  GameRuleError,
  arrive,
  canRevealAndContinue,
  leave,
  nextStation,
  pause,
  resume,
  revealAndContinue,
  revealHint,
  startSession,
  submitAnswer,
} from "./commands.ts";
import type { SessionEvent } from "./events.ts";
import { applyEvent, deriveState, playTimeAt, stationState, type SessionState } from "./session.ts";
import { S1, S2, S3, smallTrack, testContext } from "./test-fixtures.ts";

const START = { trackVersion: 1, language: "he", teamName: "הנמרים" };

/** Applies events to state and returns both, the way a host would. */
function run(state: SessionState, events: SessionEvent[]): SessionState {
  return events.reduce(applyEvent, state);
}

test("starting a progressive track reveals only the first station", () => {
  const content = smallTrack();
  const ctx = testContext();
  const events = startSession(content, START, ctx);
  assert.deepEqual(
    events.map((e) => e.type),
    ["session_started", "leg_started", "station_revealed"],
  );
  assert.deepEqual(
    events.map((e) => e.seq),
    [1, 2, 3],
  );
  const state = deriveState(events);
  assert.equal(state.status, "active");
  assert.equal(state.teamName, "הנמרים");
  assert.equal(stationState(state, S1).status, "revealed");
  assert.equal(stationState(state, S2).status, "hidden");
  assert.equal(nextStation(content, state)?.id, S1);
});

test("visibility 'all' reveals every station up front; in free order there is no 'next' station", () => {
  const content = smallTrack({ order: "free", visibility: "all" });
  const ctx = testContext();
  const state = deriveState(startSession(content, START, ctx));
  for (const id of [S1, S2, S3]) assert.equal(stationState(state, id).status, "revealed");
  assert.equal(nextStation(content, state), null);
});

test("a full play-through: wrong answer, hint, right answer, penalty, info station, finish", () => {
  const content = smallTrack();
  content.legs[0].stations[1]!.arrival.methods = ["gps"];
  const ctx = testContext();
  let state = deriveState(startSession(content, START, ctx));

  // Station 1: arrive, miss, take a hint, answer within the typo allowance? "כן" is too short — exact.
  state = run(state, arrive(content, state, S1, "manual", ctx));
  assert.equal(stationState(state, S1).status, "arrived");
  const miss = submitAnswer(content, state, S1, { kind: "text", text: "לא" }, ctx);
  assert.equal(miss.result.correct, false);
  state = run(state, miss.events);
  assert.equal(stationState(state, S1).wrongAttempts, 1);
  state = run(state, revealHint(content, state, S1, ctx));
  const hit = submitAnswer(content, state, S1, { kind: "text", text: " YES " }, ctx);
  assert.equal(hit.result.correct, true);
  assert.deepEqual(
    hit.events.map((e) => e.type),
    ["answer_submitted", "station_completed", "station_revealed"],
  );
  state = run(state, hit.events);
  assert.equal(stationState(state, S1).points, 80); // 100 − hint 20; text answers carry no wrong-attempt penalty
  assert.equal(stationState(state, S2).status, "revealed");
  assert.equal(state.score, 80);

  // Station 2: choice — a wrong pick costs 25 %, then the right one.
  assert.throws(
    () => arrive(content, state, S3, "manual", ctx),
    (e: unknown) => e instanceof GameRuleError && e.code === "station_hidden",
  );
  state = run(state, arrive(content, state, S2, "gps", ctx));
  state = run(
    state,
    submitAnswer(content, state, S2, { kind: "choice", optionId: "a" }, ctx).events,
  );
  const right = submitAnswer(content, state, S2, { kind: "choice", optionId: "b" }, ctx);
  state = run(state, right.events);
  assert.equal(stationState(state, S2).points, 75);

  // Station 3 is an info station: arriving completes it, which ends the leg and the session.
  assert.equal(stationState(state, S3).status, "revealed");
  const last = arrive(content, state, S3, "manual", ctx);
  assert.deepEqual(
    last.map((e) => e.type),
    ["station_arrived", "station_completed", "leg_completed", "session_finished"],
  );
  state = run(state, last);
  assert.equal(state.status, "finished");
  assert.equal(state.score, 155);
  assert.equal(state.finished?.score, 155);
  assert.equal(state.legIndex, 1);
});

test("reveal-and-continue needs a hint first, unless the challenge has none or the track allows it", () => {
  const content = smallTrack();
  const ctx = testContext();
  let state = deriveState(startSession(content, START, ctx));
  state = run(state, arrive(content, state, S1, "manual", ctx));
  assert.equal(canRevealAndContinue(content, state, S1), false);
  assert.throws(() => revealAndContinue(content, state, S1, ctx), /first hint/);
  state = run(state, revealHint(content, state, S1, ctx));
  assert.equal(canRevealAndContinue(content, state, S1), true);
  state = run(state, revealAndContinue(content, state, S1, ctx));
  assert.equal(stationState(state, S1).points, 0);
  assert.equal(stationState(state, S1).answerRevealed, true);
  assert.equal(stationState(state, S2).status, "revealed");

  const lenient = smallTrack({ revealAndContinue: "immediately" });
  const ctx2 = testContext();
  let s2 = deriveState(startSession(lenient, START, ctx2));
  s2 = run(s2, arrive(lenient, s2, S1, "manual", ctx2));
  assert.equal(canRevealAndContinue(lenient, s2, S1), true);

  const noHints = smallTrack();
  noHints.legs[0].stations[0].hints = [];
  const ctx3 = testContext();
  let s3 = deriveState(startSession(noHints, START, ctx3));
  s3 = run(s3, arrive(noHints, s3, S1, "manual", ctx3));
  assert.equal(canRevealAndContinue(noHints, s3, S1), true);
});

test("hints run out, answers need arrival, and order is enforced in linear tracks", () => {
  const content = smallTrack();
  const ctx = testContext();
  let state = deriveState(startSession(content, START, ctx));
  assert.throws(
    () => submitAnswer(content, state, S1, { kind: "text", text: "yes" }, ctx),
    (e: unknown) => e instanceof GameRuleError && e.code === "not_arrived",
  );
  state = run(state, arrive(content, state, S1, "manual", ctx));
  state = run(state, revealHint(content, state, S1, ctx));
  state = run(state, revealHint(content, state, S1, ctx));
  assert.throws(
    () => revealHint(content, state, S1, ctx),
    (e: unknown) => e instanceof GameRuleError && e.code === "no_more_hints",
  );
  assert.deepEqual(arrive(content, state, S1, "manual", ctx), []); // arriving twice is a no-op
});

test("an arrival method must be one the station offers; manual always is", () => {
  const content = smallTrack();
  content.legs[0].stations[1]!.arrival.methods = ["gps"];
  const ctx = testContext();
  let state = deriveState(startSession(content, START, ctx));
  const notOffered = (e: unknown) => e instanceof GameRuleError && e.code === "method_not_offered";
  assert.throws(() => arrive(content, state, S1, "gps", ctx), notOffered); // S1 is manual-only
  assert.throws(() => arrive(content, state, S1, "qr", ctx), notOffered);
  state = run(state, arrive(content, state, S1, "manual", ctx));
  state = run(state, submitAnswer(content, state, S1, { kind: "text", text: "yes" }, ctx).events);
  assert.throws(() => arrive(content, state, S2, "qr", ctx), notOffered);
  const gps = arrive(content, state, S2, "gps", ctx);
  assert.equal(gps[0]?.type === "station_arrived" && gps[0].method, "gps");
  // Manual is never removed by configuration (D6), even where gps is offered.
  state = run(state, arrive(content, state, S2, "manual", ctx));
  assert.equal(stationState(state, S2).status, "arrived");
});

test("free order completes when every station is done, whatever the order", () => {
  const content = smallTrack({ order: "free", visibility: "all" });
  const ctx = testContext();
  let state = deriveState(startSession(content, START, ctx));
  assert.equal(nextStation(content, state), null);
  state = run(state, arrive(content, state, S2, "manual", ctx));
  state = run(
    state,
    submitAnswer(content, state, S2, { kind: "choice", optionId: "b" }, ctx).events,
  );
  assert.equal(state.status, "active");
  state = run(state, arrive(content, state, S3, "manual", ctx));
  assert.equal(state.status, "active");
  state = run(state, arrive(content, state, S1, "manual", ctx));
  state = run(state, submitAnswer(content, state, S1, { kind: "text", text: "yes" }, ctx).events);
  assert.equal(state.status, "finished");
  assert.equal(state.score, 200);
});

test("automatic arrival and info stations cascade at reveal time", () => {
  const content = smallTrack();
  content.legs[0].stations[1]!.arrival = { methods: [], automatic: true };
  const ctx = testContext();
  let state = deriveState(startSession(content, START, ctx));
  state = run(state, arrive(content, state, S1, "manual", ctx));
  const done = submitAnswer(content, state, S1, { kind: "text", text: "yes" }, ctx);
  assert.deepEqual(
    done.events.map((e) => e.type),
    ["answer_submitted", "station_completed", "station_revealed", "station_arrived"],
  );
  state = run(state, done.events);
  assert.equal(stationState(state, S2).status, "arrived");
});

test("play time excludes pauses and the gap after the last event", () => {
  const content = smallTrack();
  const ctx = testContext();
  let state = deriveState(startSession(content, START, ctx));
  ctx.advance(10_000);
  assert.equal(playTimeAt(state, ctx.mono()), 10_000);
  state = run(state, pause(state, ctx));
  ctx.advance(60_000);
  assert.equal(playTimeAt(state, ctx.mono()), 10_000);
  assert.throws(
    () => arrive(content, state, S1, "manual", ctx),
    (e: unknown) => e instanceof GameRuleError && e.code === "not_active",
  );
  state = run(state, resume(state, ctx));
  ctx.advance(5_000);
  state = run(state, arrive(content, state, S1, "manual", ctx));
  state = run(state, submitAnswer(content, state, S1, { kind: "text", text: "yes" }, ctx).events);
  state = run(state, arrive(content, state, S2, "manual", ctx));
  state = run(
    state,
    submitAnswer(content, state, S2, { kind: "choice", optionId: "b" }, ctx).events,
  );
  ctx.advance(5_000);
  state = run(state, arrive(content, state, S3, "manual", ctx));
  assert.equal(state.status, "finished");
  assert.equal(state.finished?.playTimeMs, 20_000);
  assert.deepEqual(leave(state, ctx), []);
});

test("leaving an active session abandons it", () => {
  const content = smallTrack();
  const ctx = testContext();
  let state = deriveState(startSession(content, START, ctx));
  state = run(state, leave(state, ctx));
  assert.equal(state.status, "abandoned");
});

const springTrail = fileURLToPath(
  new URL("../../../content/ein-dror/tracks/spring-trail/content.json", import.meta.url),
);

test(
  "the Spring Trail can be played through without a dead end",
  { skip: !existsSync(springTrail) },
  () => {
    const content = JSON.parse(readFileSync(springTrail, "utf8")) as TrackContent;
    const ctx = testContext();
    let state = deriveState(
      startSession(content, { trackVersion: 1, language: "en", teamName: "Testers" }, ctx),
    );
    for (const station of content.legs[0].stations) {
      assert.equal(nextStation(content, state)?.id, station.id);
      state = run(state, arrive(content, state, station.id, "manual", ctx));
      // Every challenge must be escapable: hints exist or reveal is available immediately.
      assert.ok(
        station.hints.length > 0 || canRevealAndContinue(content, state, station.id),
        `dead end at ${station.title.en}`,
      );
      state = run(state, revealHint(content, state, station.id, ctx));
      state = run(state, revealAndContinue(content, state, station.id, ctx));
    }
    assert.equal(state.status, "finished");
    assert.equal(state.score, 0);
  },
);
