import { join } from "node:path";
import { config } from "./config.ts";
import { createDatabase } from "./db/client.ts";
import { publishTrack } from "./publish.ts";
import { PostgresStorage } from "./storage.ts";

/**
 * Publishes the Ein Dror demo from the repository's content/ folder (design.md §11.2 seed). Idempotent
 * — re-running republishes the same version. Needs the go-pmtiles CLI for the map extract, like
 * `npm run bundle`. Point DATABASE_URL at the hosted database to publish there (the archive bytes go
 * into Postgres too, so the API needs no disk).
 */
async function main(): Promise<void> {
  const { db, close } = await createDatabase({ url: config.databaseUrl, dataDir: config.dataDir });
  const storage = new PostgresStorage(db);
  const tenantDir = join(config.contentDir, "ein-dror");
  const { trackId } = await publishTrack(db, {
    tenantPath: join(tenantDir, "tenant.json"),
    contentPath: join(tenantDir, "tracks", "spring-trail", "content.json"),
    tenantId: "7c1f0d2e-5a3b-4c8d-9e1f-2a3b4c5d6e7f",
    version: 1,
    storage,
    cacheDir: config.cacheDir,
    build: config.protomapsBuild,
  });
  // eslint-disable-next-line no-console
  console.log(`published Ein Dror · The Spring Trail (${trackId}) v1`);
  await close();
}

void main();
