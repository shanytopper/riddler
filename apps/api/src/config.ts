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
  /** The go-pmtiles binary the server uses to extract tiles when the console publishes (D34). */
  pmtilesBin: process.env.PMTILES_BIN,
  /** The operator's console password (Editor v0, D34). A weak default for local dev only. */
  consolePassword: process.env.CONSOLE_PASSWORD ?? "riddles",
  /** Signs the console session cookie; falls back to the password so a restart keeps sessions. */
  cookieSecret: process.env.COOKIE_SECRET ?? process.env.CONSOLE_PASSWORD ?? "riddles-console-dev",
  /** Where the built console SPA is served from; empty in dev (run Vite separately). */
  consoleDir: process.env.CONSOLE_DIR ?? resolve(here, "../../console/dist"),
};

function yesterdayUtc(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}
