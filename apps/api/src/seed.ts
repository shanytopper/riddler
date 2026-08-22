import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Tenant, TrackContent } from "@riddles/bundle-schema";
import { config } from "./config.ts";
import { createDatabase } from "./db/client.ts";
import { buildFromContent, storePublished } from "./publish.ts";
import { PostgresStorage } from "./storage.ts";

/**
 * Publishes the Ein Dror demo from the repository's content/ folder (design.md §11.2 seed).
 * Re-running republishes version 1 in place. Needs the go-pmtiles CLI for the map extract, like
 * `npm run bundle`. Point DATABASE_URL at the hosted database to publish there — the archive and the
 * map-artifact cache go into Postgres too, so the API needs no disk.
 */
async function main(): Promise<void> {
  const { db, close } = await createDatabase({ url: config.databaseUrl, dataDir: config.dataDir });
  const storage = new PostgresStorage(db);
  const tenantDir = join(config.contentDir, "ein-dror");
  const tenant = JSON.parse(readFileSync(join(tenantDir, "tenant.json"), "utf8")) as Tenant;
  const content = JSON.parse(
    readFileSync(join(tenantDir, "tracks", "spring-trail", "content.json"), "utf8"),
  ) as TrackContent;

  const built = await buildFromContent(
    { tenant, content, version: 1 },
    {
      storage,
      cacheDir: config.cacheDir,
      build: config.protomapsBuild,
      pmtilesBin: config.pmtilesBin,
    },
  );
  await storePublished(db, storage, tenant, built, 1);
  // eslint-disable-next-line no-console
  console.log(`published Ein Dror · The Spring Trail (${built.content.trackId}) v1`);
  await close();
}

void main();
