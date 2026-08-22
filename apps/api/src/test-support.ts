import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BundleManifest, Challenge, Tenant, TrackContent } from "@riddles/bundle-schema";
import type { AnswerInput, EventContext, SessionEvent } from "@riddles/game-core";
import {
  arrive,
  deriveState,
  nextStation,
  setLeaderboardOptIn,
  startSession,
  stationState,
  submitAnswer,
} from "@riddles/game-core";
import { createDatabase, type Database } from "./db/client.ts";
import { upsertPublished } from "./publish.ts";
import { PostgresStorage } from "./storage.ts";

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, "../../../content/ein-dror");

export const springTrailTenant = (): Tenant =>
  JSON.parse(readFileSync(join(contentDir, "tenant.json"), "utf8")) as Tenant;

export const springTrailContent = (): TrackContent =>
  JSON.parse(
    readFileSync(join(contentDir, "tracks/spring-trail/content.json"), "utf8"),
  ) as TrackContent;

export const newDatabase = (): Promise<Database> => createDatabase();

export const newStorage = (database: Database): PostgresStorage => new PostgresStorage(database.db);

/** A fake archive; the tests only check that its bytes round-trip through storage. */
export const FAKE_ZIP = new TextEncoder().encode("PK fake bundle");

/** Publishes the Spring Trail into the DB and storage without running the real bundle builder. */
export async function seedSpringTrail(
  database: Database,
  storage: PostgresStorage,
): Promise<{ tenant: Tenant; content: TrackContent; manifest: BundleManifest }> {
  const tenant = springTrailTenant();
  const content = springTrailContent();
  const objectKey = `${content.trackId}-v1.zip`;
  const manifest: BundleManifest = {
    schemaVersion: 1,
    bundleId: "test-bundle-0001",
    tenantId: tenant.tenantId,
    trackId: content.trackId,
    trackVersion: 1,
    builtAt: "2026-08-21T00:00:00.000Z",
    totalBytes: FAKE_ZIP.byteLength,
    files: {
      content: { path: "content.json", sha256: "0".repeat(64), bytes: 10 },
      media: [],
      maps: [],
    },
  } as unknown as BundleManifest;
  await storage.put(objectKey, FAKE_ZIP);
  await upsertPublished(database.db, tenant, content, 1, manifest, objectKey, FAKE_ZIP.byteLength);
  return { tenant, content, manifest };
}

/** Deterministic ids and clocks, so a generated log is stable and its play time accrues. */
export function testContext(): EventContext {
  let seq = 0;
  let mono = 0;
  return {
    id: () => `evt-${++seq}`,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, Math.min(seq, 59))).toISOString(),
    mono: () => (mono += 1000),
  };
}

function correctInput(challenge: Challenge): AnswerInput {
  switch (challenge.type) {
    case "text":
      return { kind: "text", text: Object.values(challenge.accepted).flat()[0] ?? "" };
    case "number":
      return { kind: "number", text: String(challenge.answer) };
    case "choice":
      return { kind: "choice", optionId: challenge.correctOptionId };
    case "multi_choice":
      return { kind: "multi_choice", optionIds: challenge.correctOptionIds };
  }
}

/** Plays a track to the end with all-correct answers, returning the full event log. */
export function playThrough(
  content: TrackContent,
  ctx: EventContext,
  options: { optIn?: boolean; teamName?: string; language?: string } = {},
): SessionEvent[] {
  let events = startSession(
    content,
    {
      trackVersion: 1,
      language: options.language ?? "en",
      teamName: options.teamName ?? "Testers",
    },
    ctx,
  );
  let state = deriveState(events);
  for (let guard = 0; guard < 100 && state.status === "active"; guard++) {
    const station = nextStation(content, state);
    if (!station) break;
    events = [...events, ...arrive(content, state, station.id, "manual", ctx)];
    state = deriveState(events);
    const current = stationState(state, station.id);
    if (current.status === "arrived" && station.challenge) {
      const { events: answered } = submitAnswer(
        content,
        state,
        station.id,
        correctInput(station.challenge),
        ctx,
      );
      events = [...events, ...answered];
      state = deriveState(events);
    }
  }
  if (options.optIn) {
    events = [...events, ...setLeaderboardOptIn(state, true, ctx)];
  }
  return events;
}
