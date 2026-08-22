/// <reference types="node" />
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { and, eq } from "drizzle-orm";
import type { Station, TrackContent } from "@riddles/bundle-schema";
import type { Database } from "../db/client.ts";
import { leaderboardEntries, trackVersions } from "../db/schema.ts";
import { badRequest } from "../errors.ts";
import type { BuiltBundle, BundleBuilderFn } from "../publish.ts";
import { buildServer } from "../server.ts";
import {
  newDatabase,
  newStorage,
  playThrough,
  seedSpringTrail,
  testContext,
} from "../test-support.ts";
import { registerConsole } from "./routes.ts";

const open: Database[] = [];
after(async () => {
  for (const database of open) await database.close();
});

/** A builder that skips the real map build; content passes through as its own snapshot. */
const fakeBuilder: BundleBuilderFn = async ({ content, version }): Promise<BuiltBundle> => {
  const zipBytes = new TextEncoder().encode(`zip-v${version}`);
  return {
    zipBytes,
    content,
    warnings: [],
    manifest: {
      schemaVersion: 1,
      bundleId: `bundle-v${version}`,
      tenantId: "t",
      trackId: content.trackId,
      trackVersion: version,
      builtAt: "2026-08-22T00:00:00.000Z",
      totalBytes: zipBytes.byteLength,
      files: {
        content: { path: "content.json", sha256: "0".repeat(64), bytes: 1 },
        media: [],
        maps: [],
      },
    } as unknown as BuiltBundle["manifest"],
  };
};

async function harness() {
  const database = await newDatabase();
  open.push(database);
  const storage = newStorage(database);
  const seed = await seedSpringTrail(database, storage);
  const app = buildServer({ db: database.db, storage });
  await registerConsole(app, {
    db: database.db,
    storage,
    password: "hunter2",
    cookieSecret: "test-secret",
    secureCookie: false,
    builder: fakeBuilder,
  });
  return { database, app, storage, ...seed };
}

type App = Awaited<ReturnType<typeof harness>>["app"];

/** Signs in and returns the session cookie header for subsequent requests. */
async function login(app: App, password = "hunter2"): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/console-api/login",
    payload: { password },
  });
  const cookie = res.cookies.find((c) => c.name === "console_session");
  return cookie ? `${cookie.name}=${cookie.value}` : "";
}

test("the console API refuses everything without a valid session", async () => {
  const { app, content } = await harness();
  assert.equal((await app.inject({ url: "/console-api/tracks" })).statusCode, 401);
  assert.equal(
    (await app.inject({ url: `/console-api/tracks/${content.trackId}` })).statusCode,
    401,
  );
  assert.equal(
    (await app.inject({ method: "POST", url: "/console-api/login", payload: { password: "nope" } }))
      .statusCode,
    403,
  );
  const cookie = await login(app);
  assert.notEqual(cookie, "");
  assert.equal(
    (await app.inject({ url: "/console-api/tracks", headers: { cookie } })).statusCode,
    200,
  );
});

test("lists tracks and returns the draft (seeded from the published version)", async () => {
  const { app, content } = await harness();
  const cookie = await login(app);

  const list = (await app.inject({ url: "/console-api/tracks", headers: { cookie } })).json()
    .tracks;
  assert.equal(list.length, 1);
  assert.equal(list[0].trackId, content.trackId);
  assert.equal(list[0].publishedVersion, 1);
  assert.equal(list[0].hasDraft, false);

  const draft = (
    await app.inject({ url: `/console-api/tracks/${content.trackId}`, headers: { cookie } })
  ).json().content as TrackContent;
  assert.equal(draft.trackId, content.trackId);
  assert.equal(draft.legs[0]!.stations.length, content.legs[0]!.stations.length);
});

test("saves an edited draft and publishes it as the next version", async () => {
  const { app, database, content } = await harness();
  const cookie = await login(app);

  const draft = structuredClone(content);
  draft.name = { he: "מסלול חדש", en: "A New Trail" };
  const numberStation = draft.legs[0]!.stations[0]!;
  assert.equal(numberStation.challenge!.type, "number");
  (numberStation.challenge as { answer: number }).answer = 42;
  numberStation.title = { he: "שער חדש", en: "A New Gate" };

  const put = await app.inject({
    method: "PUT",
    url: `/console-api/tracks/${content.trackId}`,
    headers: { cookie },
    payload: { content: draft },
  });
  assert.equal(put.statusCode, 200);

  // The draft now exists and reflects the edit.
  const reloaded = (
    await app.inject({ url: `/console-api/tracks/${content.trackId}`, headers: { cookie } })
  ).json().content as TrackContent;
  assert.equal((reloaded.legs[0]!.stations[0]!.challenge as { answer: number }).answer, 42);

  const publish = await app.inject({
    method: "POST",
    url: `/console-api/tracks/${content.trackId}/publish`,
    headers: { cookie },
  });
  assert.equal(publish.statusCode, 200);
  assert.equal(publish.json().version, 2);

  // Version 2 is stored, the track points at it, and the delivery API serves the new content.
  const versions = await database.db
    .select({ version: trackVersions.version })
    .from(trackVersions)
    .where(eq(trackVersions.trackId, content.trackId));
  assert.deepEqual(versions.map((v) => v.version).sort(), [1, 2]);
  const track = await app.inject({ url: `/tracks/${content.trackId}` });
  assert.equal(track.json().track.name.en, "A New Trail"); // the edited track name
  const published = await database.db
    .select({ content: trackVersions.content })
    .from(trackVersions)
    .where(and(eq(trackVersions.trackId, content.trackId), eq(trackVersions.version, 2)))
    .limit(1);
  assert.equal(
    (published[0]!.content.legs[0]!.stations[0]!.challenge as { answer: number }).answer,
    42,
  ); // the edited answer reached the published version
  const bundle = await app.inject({ url: `/tracks/${content.trackId}/bundle` });
  assert.equal(bundle.json().manifest.trackVersion, 2);
});

test("refuses to publish a draft that fails the validator", async () => {
  const { app, content } = await harness();
  const cookie = await login(app);

  const broken = structuredClone(content);
  // Remove the English side of a title: the "every language present" invariant fails.
  delete (broken.legs[0]!.stations[0]!.title as { en?: string }).en;

  // Saving is allowed (schema still holds — en is optional in the schema, required by the invariant).
  const put = await app.inject({
    method: "PUT",
    url: `/console-api/tracks/${content.trackId}`,
    headers: { cookie },
    payload: { content: broken },
  });
  assert.equal(put.statusCode, 200);

  const report = (
    await app.inject({
      method: "POST",
      url: `/console-api/tracks/${content.trackId}/validate`,
      headers: { cookie },
    })
  ).json();
  assert.equal(report.ok, false);
  assert.ok(report.errors.length > 0);

  const publish = await app.inject({
    method: "POST",
    url: `/console-api/tracks/${content.trackId}/publish`,
    headers: { cookie },
  });
  assert.equal(publish.statusCode, 400);
});

test("hides and unhides a leaderboard entry", async () => {
  const { app, content } = await harness();
  const cookie = await login(app);
  // Post a finished, opted-in session so there is an entry.
  const events = playThrough(content, testContext(), { optIn: true, teamName: "The Owls" });
  await app.inject({
    method: "POST",
    url: "/sessions/mod-1/events",
    payload: { events },
  });
  assert.equal(
    (await app.inject({ url: `/tracks/${content.trackId}/leaderboard` })).json().entries.length,
    1,
  );

  // Moderator hides it: gone from the public board, still listed in the console.
  const hide = await app.inject({
    method: "POST",
    url: "/console-api/leaderboard/mod-1/hide",
    headers: { cookie },
    payload: { hidden: true },
  });
  assert.equal(hide.statusCode, 200);
  assert.equal(
    (await app.inject({ url: `/tracks/${content.trackId}/leaderboard` })).json().entries.length,
    0,
  );
  const consoleBoard = (
    await app.inject({
      url: `/console-api/tracks/${content.trackId}/leaderboard`,
      headers: { cookie },
    })
  ).json().entries;
  assert.equal(consoleBoard.length, 1);
  assert.equal(consoleBoard[0].hidden, true);

  // Unhide restores it.
  await app.inject({
    method: "POST",
    url: "/console-api/leaderboard/mod-1/hide",
    headers: { cookie },
    payload: { hidden: false },
  });
  assert.equal(
    (await app.inject({ url: `/tracks/${content.trackId}/leaderboard` })).json().entries.length,
    1,
  );
});

test("creates a new track with a valid, publishable one-station skeleton", async () => {
  const { app } = await harness();
  const cookie = await login(app);

  const created = await app.inject({
    method: "POST",
    url: "/console-api/tracks",
    headers: { cookie },
    payload: { name: "Autumn Loop" },
  });
  assert.equal(created.statusCode, 200);
  const { trackId, slug } = created.json();
  assert.ok(trackId);
  assert.equal(slug, "autumn-loop"); // slugified from the name

  // It shows in the list as unpublished with a draft.
  const list = (await app.inject({ url: "/console-api/tracks", headers: { cookie } })).json()
    .tracks;
  const row = list.find((t: { trackId: string }) => t.trackId === trackId);
  assert.ok(row);
  assert.equal(row.publishedVersion, null);
  assert.equal(row.hasDraft, true);

  // The seed is a valid one-station skeleton that already passes the full validator.
  const draft = (
    await app.inject({ url: `/console-api/tracks/${trackId}`, headers: { cookie } })
  ).json().content as TrackContent;
  assert.equal(draft.legs[0]!.stations.length, 1);
  const report = (
    await app.inject({
      method: "POST",
      url: `/console-api/tracks/${trackId}/validate`,
      headers: { cookie },
    })
  ).json();
  assert.equal(report.ok, true);

  const publish = await app.inject({
    method: "POST",
    url: `/console-api/tracks/${trackId}/publish`,
    headers: { cookie },
  });
  assert.equal(publish.statusCode, 200);
  assert.equal(publish.json().version, 1); // the first published version
});

test("a station added to a new track's draft reaches the published version", async () => {
  const { app, database } = await harness();
  const cookie = await login(app);

  const { trackId } = (
    await app.inject({
      method: "POST",
      url: "/console-api/tracks",
      headers: { cookie },
      payload: { name: "Winter Walk" },
    })
  ).json();

  const draft = (
    await app.inject({ url: `/console-api/tracks/${trackId}`, headers: { cookie } })
  ).json().content as TrackContent;
  const bounds = (draft.legs[0]!.map as { bounds: [number, number, number, number] }).bounds;
  const second: Station = {
    id: "11111111-2222-4333-8444-555555555555",
    title: { he: "תחנה שנייה", en: "Second station" },
    arrival: { methods: [], automatic: false },
    challenge: null,
    hints: [],
    points: 0,
    reveal: { as: "pin" },
    location: { lat: (bounds[1] + bounds[3]) / 2, lng: (bounds[0] + bounds[2]) / 2 },
  };
  draft.legs[0]!.stations.push(second);

  const put = await app.inject({
    method: "PUT",
    url: `/console-api/tracks/${trackId}`,
    headers: { cookie },
    payload: { content: draft },
  });
  assert.equal(put.statusCode, 200);

  const publish = await app.inject({
    method: "POST",
    url: `/console-api/tracks/${trackId}/publish`,
    headers: { cookie },
  });
  assert.equal(publish.statusCode, 200);
  const version = publish.json().version;

  const published = await database.db
    .select({ content: trackVersions.content })
    .from(trackVersions)
    .where(and(eq(trackVersions.trackId, trackId), eq(trackVersions.version, version)))
    .limit(1);
  assert.equal(published[0]!.content.legs[0]!.stations.length, 2); // the added station reached publish
});

test("a long multi-word track name yields a schema-valid slug (no trailing hyphen)", async () => {
  const { app } = await harness();
  const cookie = await login(app);
  // Before the slugify fix this name truncated to a trailing "-" and 500'd on the schema check.
  const created = await app.inject({
    method: "POST",
    url: "/console-api/tracks",
    headers: { cookie },
    payload: { name: "The Great Downtown Historical Mystery Adventure Hunt" },
  });
  assert.equal(created.statusCode, 200);
  assert.match(created.json().slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("badRequest carries a 400 (sanity for the shared error helper)", () => {
  assert.equal(badRequest("x").status, 400);
});
