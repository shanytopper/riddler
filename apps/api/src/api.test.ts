/// <reference types="node" />
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import type { EventBody, SessionEvent } from "@riddles/game-core";
import type { Database } from "./db/client.ts";
import { sessionEvents, sessions } from "./db/schema.ts";
import { buildServer, startOfTodayIn } from "./server.ts";
import {
  FAKE_ZIP,
  newDatabase,
  newStorage,
  playThrough,
  seedSpringTrail,
  testContext,
} from "./test-support.ts";

const open: Database[] = [];
after(async () => {
  for (const database of open) await database.close();
});

async function harness() {
  const database = await newDatabase();
  open.push(database);
  const storage = newStorage(database);
  const seed = await seedSpringTrail(database, storage);
  const app = buildServer({ db: database.db, storage });
  return { database, app, ...seed };
}

type App = Awaited<ReturnType<typeof harness>>["app"];

const post = (app: App, sessionId: string, events: unknown, deviceId?: string) =>
  app.inject({
    method: "POST",
    url: `/sessions/${sessionId}/events`,
    payload: deviceId ? { deviceId, events } : { events },
  });

const board = async (app: App, trackId: string) =>
  (await app.inject({ url: `/tracks/${trackId}/leaderboard` })).json().entries as {
    teamName: string;
    score: number;
  }[];

/** A well-formed event with the given sequence number, for hand-built logs. */
const mk = (seq: number, body: EventBody): SessionEvent =>
  ({
    id: `hand-${seq}`,
    seq,
    at: "2026-01-01T00:00:00.000Z",
    mono: seq * 1000,
    ...body,
  }) as SessionEvent;

test("serves venue, track summary, and bundle release", async () => {
  const { app, tenant, content } = await harness();

  const venue = await app.inject({ url: "/v/ein-dror" });
  assert.equal(venue.statusCode, 200);
  assert.equal(venue.json().tenantId, tenant.tenantId);

  const venues = await app.inject({ url: "/venues" });
  assert.equal(venues.json().length, 1);

  const tracks = await app.inject({ url: `/tenants/${tenant.tenantId}/tracks` });
  const summaries = tracks.json();
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].trackId, content.trackId);
  assert.deepEqual(summaries[0].languages, ["he", "en"]);

  const track = await app.inject({ url: `/tracks/${content.trackId}` });
  assert.equal(track.json().tenant.slug, "ein-dror");
  assert.equal(track.json().track.slug, content.slug);

  const bundle = await app.inject({ url: `/tracks/${content.trackId}/bundle` });
  const release = bundle.json();
  assert.equal(release.manifest.trackId, content.trackId);
  assert.match(release.zipUrl, /\/storage\/.+\.zip$/);

  const zip = await app.inject({ url: `/storage/${content.trackId}-v1.zip` });
  assert.equal(zip.statusCode, 200);
  assert.deepEqual(new Uint8Array(zip.rawPayload), FAKE_ZIP);
});

test("honours the proxy's protocol when building the bundle URL", async () => {
  const { app, content } = await harness();
  const bundle = await app.inject({
    url: `/tracks/${content.trackId}/bundle`,
    headers: { "x-forwarded-proto": "https", host: "riddles-api.onrender.com" },
  });
  assert.match(bundle.json().zipUrl, /^https:\/\/riddles-api\.onrender\.com\/storage\//);
});

test("ingests an offline playthrough and publishes a leaderboard entry with the server score", async () => {
  const { app, database, content } = await harness();
  const events = playThrough(content, testContext(), { optIn: true, teamName: "The Owls" });
  const sessionId = "session-1";

  const res = await post(app, sessionId, events);
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.status, "finished");
  assert.equal(body.serverScore, 700); // 7 stations × 100, no hints, no wrong answers
  assert.equal(body.mismatch, false);
  assert.equal(body.acknowledgedThroughSeq, events[events.length - 1]!.seq);

  const entries = await board(app, content.trackId);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.teamName, "The Owls");
  assert.equal(entries[0]!.score, 700);

  const result = await app.inject({ url: `/sessions/${sessionId}/result` });
  assert.equal(result.json().status, "finished");
  assert.equal(result.json().score, 700);

  // Replaying the same batch changes nothing.
  await post(app, sessionId, events);
  assert.equal((await board(app, content.trackId)).length, 1);
  const count = await database.db
    .select({ seq: sessionEvents.seq })
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId));
  assert.equal(count.length, events.length);
});

test("flags a score mismatch and keeps the server's value", async () => {
  const { app, database, content } = await harness();
  const events = playThrough(content, testContext(), { optIn: true });
  // Tamper the client-reported score in the finish event.
  const tampered = events.map((event) =>
    event.type === "session_finished" ? { ...event, score: 9999 } : event,
  );
  const sessionId = "session-tampered";

  const res = await post(app, sessionId, tampered);
  assert.equal(res.json().mismatch, true);
  assert.equal(res.json().serverScore, 700);

  const row = (
    await database.db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
  )[0];
  assert.equal(row?.mismatch, true);
  assert.equal(row?.score, 9999); // client's claim is recorded…
  assert.equal(row?.serverScore, 700); // …but the server's value wins on the leaderboard
  assert.equal((await board(app, content.trackId))[0]!.score, 700);
});

test("recomputes the score from the track's content, never from the client's points", async () => {
  const { app, content } = await harness();
  // A forged log: every completion claims 1000 points and the finish report agrees with itself.
  const forged = playThrough(content, testContext(), { optIn: true, teamName: "Forgers" }).map(
    (event) =>
      event.type === "station_completed"
        ? { ...event, points: 1000 }
        : event.type === "session_finished"
          ? { ...event, score: 7000 }
          : event,
  );
  const res = await post(app, "session-forged", forged);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().serverScore, 700);
  assert.equal(res.json().mismatch, true);
  assert.equal((await board(app, content.trackId))[0]!.score, 700);
});

test("ignores completions of stations the track does not have", async () => {
  const { app, content } = await harness();
  const log = [
    mk(1, {
      type: "session_started",
      trackId: content.trackId,
      trackVersion: 1,
      language: "en",
      teamName: "PWNED",
    }),
    mk(2, {
      type: "station_completed",
      stationId: "whatever",
      points: 999999,
      answerRevealed: false,
    }),
    mk(3, { type: "session_finished", score: 999999, playTimeMs: 1000 }),
    mk(4, { type: "leaderboard_opt_in", optIn: true }),
  ];
  const res = await post(app, "session-pwned", log);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().serverScore, 0);
  const entries = await board(app, content.trackId);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.score, 0);
});

test("hides a leaderboard entry whose team name fails the shared filter", async () => {
  const { app, content } = await harness();
  const events = playThrough(content, testContext(), { optIn: true, teamName: "fuck PWNED" });
  const res = await post(app, "session-rude", events);
  assert.equal(res.statusCode, 200);
  assert.equal((await board(app, content.trackId)).length, 0);
});

test("rejects malformed batches with a 400 rather than a 500", async () => {
  const { app } = await harness();
  assert.equal((await post(app, "s-bad-1", "nope")).statusCode, 400);
  assert.equal((await post(app, "s-bad-2", [{}])).statusCode, 400);
  assert.equal(
    (
      await post(app, "s-bad-3", [
        { id: "x", seq: 1, type: "totally_bogus", at: "2026-01-01T00:00:00Z", mono: 1 },
      ])
    ).statusCode,
    400,
  );
  assert.equal(
    (await post(app, "s-bad-4", [{ id: "x", seq: 1, type: "session_paused" }])).statusCode,
    400,
  );
  const huge = Array.from({ length: 501 }, (_, i) => mk(i + 1, { type: "session_paused" }));
  assert.equal((await post(app, "s-bad-5", huge)).statusCode, 413);
});

test("binds a session to the device that opened it", async () => {
  const { app, content } = await harness();
  const events = playThrough(content, testContext(), { optIn: true });
  assert.equal((await post(app, "session-owned", events, "device-A")).statusCode, 200);
  assert.equal((await board(app, content.trackId)).length, 1);

  // Another device tries to withdraw the entry.
  const last = events[events.length - 1]!;
  const optOut = mk(last.seq + 1, { type: "leaderboard_opt_in", optIn: false });
  const res = await post(app, "session-owned", [optOut], "device-B");
  assert.equal(res.statusCode, 403);
  assert.equal((await board(app, content.trackId)).length, 1);
});

test("refuses a sequence collision and acknowledges only the contiguous prefix", async () => {
  const { app, content } = await harness();
  const events = playThrough(content, testContext(), { optIn: true });
  const sessionId = "session-gaps";

  const first = await post(app, sessionId, events.slice(0, 10));
  assert.equal(first.json().acknowledgedThroughSeq, 10);

  // Sequence 7 already holds a different event.
  const collide = { ...events[6]!, id: "different-id" };
  assert.equal((await post(app, sessionId, [collide])).statusCode, 409);

  // A batch that skips 11: stored, but the ack stays at 10 until the gap is filled.
  const gapped = await post(app, sessionId, events.slice(11, 14));
  assert.equal(gapped.statusCode, 200);
  assert.equal(gapped.json().acknowledgedThroughSeq, 10);

  const filled = await post(app, sessionId, [events[10]!]);
  assert.equal(filled.json().acknowledgedThroughSeq, 14);
});

test("accepts a real device's fractional play time (stored as whole ms)", async () => {
  const { app, database, content } = await harness();
  // A real monotonic clock yields fractional milliseconds; the integer column must not choke on it.
  const events = playThrough(content, testContext(), { optIn: true }).map((event) =>
    event.type === "session_finished"
      ? { ...event, playTimeMs: event.playTimeMs + 0.7770000006 }
      : event,
  );
  const sessionId = "session-fractional";

  const res = await post(app, sessionId, events);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().serverScore, 700);

  const row = (
    await database.db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
  )[0];
  assert.equal(Number.isInteger(row?.playTimeMs), true);
  assert.equal(Number.isInteger(row?.serverPlayTimeMs), true);
});

test("opting out withdraws a posted entry", async () => {
  const { app, content } = await harness();
  const ctx = testContext();
  const events = playThrough(content, ctx, { optIn: true });
  const sessionId = "session-optout";
  await post(app, sessionId, events);
  assert.equal((await board(app, content.trackId)).length, 1);

  // A later opt-out event removes the entry.
  const last = events[events.length - 1]!;
  await post(app, sessionId, [mk(last.seq + 1, { type: "leaderboard_opt_in", optIn: false })]);
  assert.equal((await board(app, content.trackId)).length, 0);
});

test("the 'today' window starts at the venue's local midnight", () => {
  // 2026-08-22 01:00 in Jerusalem (UTC+3 in summer) is still 2026-08-21 in UTC.
  const now = new Date("2026-08-21T22:00:00.000Z");
  const start = startOfTodayIn("Asia/Jerusalem", now);
  assert.equal(start.toISOString(), "2026-08-21T21:00:00.000Z"); // local midnight of the 22nd
  assert.equal(startOfTodayIn("UTC", now).toISOString(), "2026-08-21T00:00:00.000Z");
});
