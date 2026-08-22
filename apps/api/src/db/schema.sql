-- Schema for the delivery and ingestion API. Mirrors src/db/schema.ts (the Drizzle definitions used
-- for typed queries). Applied idempotently at startup for the prototype; production uses drizzle-kit
-- migrations. Runs unchanged on PGlite (local, tests) and managed Postgres (a DATABASE_URL).

CREATE TABLE IF NOT EXISTS tenants (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tracks (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL REFERENCES tenants(id),
  slug              TEXT NOT NULL,
  published_version INTEGER
);

CREATE TABLE IF NOT EXISTS track_versions (
  track_id       TEXT NOT NULL REFERENCES tracks(id),
  version        INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  content        JSONB NOT NULL,
  published_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, version)
);

CREATE TABLE IF NOT EXISTS bundles (
  track_id    TEXT NOT NULL,
  version     INTEGER NOT NULL,
  bundle_id   TEXT NOT NULL,
  manifest    JSONB NOT NULL,
  object_key  TEXT NOT NULL,
  total_bytes INTEGER NOT NULL,
  PRIMARY KEY (track_id, version)
);

CREATE TABLE IF NOT EXISTS sessions (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  track_id            TEXT NOT NULL,
  track_version       INTEGER NOT NULL,
  team_name           TEXT NOT NULL,
  language            TEXT NOT NULL,
  status              TEXT NOT NULL,
  score               INTEGER NOT NULL DEFAULT 0,
  play_time_ms        INTEGER NOT NULL DEFAULT 0,
  server_score        INTEGER NOT NULL DEFAULT 0,
  server_play_time_ms INTEGER NOT NULL DEFAULT 0,
  mismatch            BOOLEAN NOT NULL DEFAULT false,
  leaderboard_opt_in  BOOLEAN NOT NULL DEFAULT false,
  device_id           TEXT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at         TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_events (
  session_id  TEXT NOT NULL,
  seq         INTEGER NOT NULL,
  event_id    TEXT NOT NULL UNIQUE,
  type        TEXT NOT NULL,
  data        JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, seq)
);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  track_id      TEXT NOT NULL,
  track_version INTEGER NOT NULL,
  session_id    TEXT NOT NULL UNIQUE,
  team_name     TEXT NOT NULL,
  score         INTEGER NOT NULL,
  play_time_ms  INTEGER NOT NULL,
  hidden        BOOLEAN NOT NULL DEFAULT false,
  finished_at   TIMESTAMPTZ NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leaderboard_by_track ON leaderboard_entries (track_id, track_version, hidden);
CREATE INDEX IF NOT EXISTS tracks_by_tenant ON tracks (tenant_id);

-- Bundle archives themselves (prototype object storage, D27). Keyed by the bundles.object_key.
CREATE TABLE IF NOT EXISTS bundle_objects (
  key          TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  bytes        BYTEA NOT NULL,
  byte_length  INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The editable working copy of a track (Editor v0, D34). Seeded from the published version on first
-- edit; Publish freezes it into the next track_versions row.
CREATE TABLE IF NOT EXISTS track_drafts (
  track_id     TEXT PRIMARY KEY REFERENCES tracks(id),
  content      JSONB NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

