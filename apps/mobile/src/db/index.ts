import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";

/**
 * The on-device database (design.md §8). Session state and the event log live here; every state
 * change appends its event before the state updates, so a crash never loses progress. Writes are
 * synchronous so "append-then-apply" holds without an await between the write and the React update.
 *
 * Only native has SQLite. On web (used to preview screens) the handle is null and every repo
 * degrades to a no-op, so the app runs from in-memory state exactly as it did before step 6.
 */

let handle: SQLiteDatabase | null = null;

if (Platform.OS !== "web") {
  handle = openDatabaseSync("riddles.db");
  handle.execSync("PRAGMA journal_mode = WAL;");
  migrate(handle);
}

export const db = handle;

/** The bundle/content schema version this app understands (manifest.schemaVersion). */
export const SUPPORTED_SCHEMA_VERSION = 1;
/** The oldest schema version this app still plays; below it a bundle is refused. */
export const MIN_SCHEMA_VERSION = 1;

function migrate(database: SQLiteDatabase): void {
  const { user_version: version } = database.getFirstSync<{ user_version: number }>(
    "PRAGMA user_version;",
  ) ?? { user_version: 0 };

  if (version < 1) {
    database.execSync(`
      CREATE TABLE sessions (
        id            TEXT PRIMARY KEY NOT NULL,
        track_id      TEXT NOT NULL,
        track_version INTEGER NOT NULL,
        tenant_slug   TEXT,
        team_name     TEXT NOT NULL,
        language      TEXT NOT NULL,
        status        TEXT NOT NULL,
        score         INTEGER NOT NULL DEFAULT 0,
        play_time_ms  INTEGER NOT NULL DEFAULT 0,
        started_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        finished_at   TEXT
      );
      CREATE TABLE events (
        session_id TEXT NOT NULL,
        seq        INTEGER NOT NULL,
        type       TEXT NOT NULL,
        data       TEXT NOT NULL,
        PRIMARY KEY (session_id, seq)
      );
      CREATE TABLE bundles (
        track_id       TEXT NOT NULL,
        version        INTEGER NOT NULL,
        schema_version INTEGER NOT NULL,
        track_name     TEXT NOT NULL,
        total_bytes    INTEGER NOT NULL,
        dir_uri        TEXT NOT NULL,
        installed_at   TEXT NOT NULL,
        PRIMARY KEY (track_id, version)
      );
      CREATE TABLE recent_venues (
        tenant_id      TEXT PRIMARY KEY NOT NULL,
        slug           TEXT NOT NULL,
        display_name   TEXT NOT NULL,
        cover_url      TEXT,
        last_opened_at TEXT NOT NULL
      );
      CREATE TABLE settings (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
  }

  if (version < 2) {
    // High-water mark of events uploaded to the API and acknowledged (step 7 sync).
    database.execSync(`
      ALTER TABLE sessions ADD COLUMN synced_seq INTEGER NOT NULL DEFAULT 0;
      PRAGMA user_version = 2;
    `);
  }
}
