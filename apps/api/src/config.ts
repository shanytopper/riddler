import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** Configuration from the environment, with prototype-friendly defaults. */
export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  databaseUrl: process.env.DATABASE_URL,
  /** Where PGlite persists when no DATABASE_URL is set; unset means in-memory. */
  dataDir: process.env.PGLITE_DIR ?? resolve(here, "../.data/pglite"),
  /** A CDN origin for bundle downloads; Render provides its own public URL, else the request's origin. */
  bundleBaseUrl: process.env.BUNDLE_BASE_URL ?? process.env.RENDER_EXTERNAL_URL,
  /** The venue's timezone for the leaderboard's "today" window (one venue in the prototype). */
  leaderboardTimezone: process.env.LEADERBOARD_TIMEZONE ?? "Asia/Jerusalem",
  /** Repository content root the seed publishes from. */
  contentDir: process.env.CONTENT_DIR ?? resolve(here, "../../../content"),
  cacheDir: process.env.MAP_CACHE_DIR ?? resolve(here, "../../../.cache/map-assets"),
  /**
   * The Protomaps daily build (YYYYMMDD) the seed extracts tiles from. Defaults to yesterday's,
   * which is always published; today's may not be yet. Pin it to reproduce a bundle exactly.
   */
  protomapsBuild: process.env.PROTOMAPS_BUILD ?? yesterdayUtc(),
};

function yesterdayUtc(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}
