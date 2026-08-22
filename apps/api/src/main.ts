import { config } from "./config.ts";
import { createDatabase } from "./db/client.ts";
import { registerConsole } from "./editor/routes.ts";
import { buildServer } from "./server.ts";
import { PostgresStorage } from "./storage.ts";

/** Starts the API. DATABASE_URL selects managed Postgres; otherwise a local PGlite file is used. */
async function main(): Promise<void> {
  // Backstop: a stray rejection or exception is logged, not fatal — one bad request must not take
  // the demo down. Real bugs still show in the logs.
  process.on("unhandledRejection", (reason) => console.error("[api] unhandled rejection:", reason));
  process.on("uncaughtException", (error) => console.error("[api] uncaught exception:", error));
  const { db } = await createDatabase({ url: config.databaseUrl, dataDir: config.dataDir });
  const storage = new PostgresStorage(db);
  const app = buildServer({
    db,
    storage,
    bundleBaseUrl: config.bundleBaseUrl,
    leaderboardTimezone: config.leaderboardTimezone,
  });
  await registerConsole(app, {
    db,
    storage,
    password: config.consolePassword,
    cookieSecret: config.cookieSecret,
    secureCookie: Boolean(config.databaseUrl),
    consoleDir: config.consoleDir,
    build: config.protomapsBuild,
    pmtilesBin: config.pmtilesBin,
  });
  await app.listen({ port: config.port, host: config.host });
  // eslint-disable-next-line no-console
  console.log(`api listening on http://${config.host}:${config.port}`);
}

void main();
