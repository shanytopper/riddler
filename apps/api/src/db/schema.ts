import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { BundleManifest, Tenant, TrackContent } from "@riddles/bundle-schema";
import type { SessionEvent } from "@riddles/game-core";

/**
 * The system of record (design.md §11.3). A published track version is an immutable JSON snapshot —
 * the same content.json the bundle carries — so the app and the console never disagree about a
 * version. Sessions and events are the source of truth; leaderboard entries are derived and
 * rebuildable. Every tenant-owned row carries tenant_id (design.md §11.1).
 */

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  data: jsonb("data").notNull().$type<Tenant>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tracks = pgTable("tracks", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  slug: text("slug").notNull(),
  publishedVersion: integer("published_version"),
});

export const trackVersions = pgTable(
  "track_versions",
  {
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id),
    version: integer("version").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    content: jsonb("content").notNull().$type<TrackContent>(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.trackId, table.version] })],
);

export const bundles = pgTable(
  "bundles",
  {
    trackId: text("track_id").notNull(),
    version: integer("version").notNull(),
    bundleId: text("bundle_id").notNull(),
    manifest: jsonb("manifest").notNull().$type<BundleManifest>(),
    objectKey: text("object_key").notNull(),
    totalBytes: integer("total_bytes").notNull(),
  },
  (table) => [primaryKey({ columns: [table.trackId, table.version] })],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  trackId: text("track_id").notNull(),
  trackVersion: integer("track_version").notNull(),
  teamName: text("team_name").notNull(),
  language: text("language").notNull(),
  status: text("status").notNull(),
  /** The client-reported figures. */
  score: integer("score").notNull().default(0),
  playTimeMs: integer("play_time_ms").notNull().default(0),
  /** The server's own recomputation from the events (design.md §8); the server's value wins. */
  serverScore: integer("server_score").notNull().default(0),
  serverPlayTimeMs: integer("server_play_time_ms").notNull().default(0),
  mismatch: boolean("mismatch").notNull().default(false),
  leaderboardOptIn: boolean("leaderboard_opt_in").notNull().default(false),
  deviceId: text("device_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionEvents = pgTable(
  "session_events",
  {
    sessionId: text("session_id").notNull(),
    seq: integer("seq").notNull(),
    /** Client-generated UUID; ingestion is idempotent on it (design.md §8). */
    eventId: text("event_id").notNull().unique(),
    type: text("type").notNull(),
    /** The full event, meta included, so the server folds it with the same reducer as the app. */
    data: jsonb("data").notNull().$type<SessionEvent>(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.seq] })],
);

export const leaderboardEntries = pgTable("leaderboard_entries", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  trackId: text("track_id").notNull(),
  trackVersion: integer("track_version").notNull(),
  sessionId: text("session_id").notNull().unique(),
  teamName: text("team_name").notNull(),
  score: integer("score").notNull(),
  playTimeMs: integer("play_time_ms").notNull(),
  /** Operators can hide an entry (design.md §10). */
  hidden: boolean("hidden").notNull().default(false),
  finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Postgres bytea, surfaced as Uint8Array on both drivers (PGlite returns Uint8Array, pg a Buffer). */
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
  toDriver(value) {
    return Buffer.from(value);
  },
  fromDriver(value) {
    return new Uint8Array(value);
  },
});

/** Bundle archives (prototype object storage, D27); keyed by bundles.object_key. */
export const bundleObjects = pgTable("bundle_objects", {
  key: text("key").primaryKey(),
  contentType: text("content_type").notNull(),
  bytes: bytea("bytes").notNull(),
  byteLength: integer("byte_length").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** The editable working copy of a track (Editor v0, D34); Publish freezes it into a track version. */
export const trackDrafts = pgTable("track_drafts", {
  trackId: text("track_id")
    .primaryKey()
    .references(() => tracks.id),
  content: jsonb("content").notNull().$type<TrackContent>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SessionRow = typeof sessions.$inferSelect;
export type LeaderboardRow = typeof leaderboardEntries.$inferSelect;
