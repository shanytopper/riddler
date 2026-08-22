import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BundleManifest, Tenant, TrackContent } from "@riddles/bundle-schema";
import { buildBundle } from "@riddles/bundle-builder";
import { unzipSync } from "fflate";
import type { Db } from "./db/client.ts";
import { bundles, tenants, trackVersions, tracks } from "./db/schema.ts";
import type { Storage } from "./storage.ts";
import { bundleKey } from "./storage.ts";

/**
 * Publishes a track version: builds the bundle, snapshots its content.json as the immutable version,
 * stores the archive, and upserts the tenant, track, version, and bundle rows. This is the server
 * side of "publish" (design.md §11.2); the console will call the same path once it exists.
 */
export interface PublishInput {
  tenantPath: string;
  contentPath: string;
  tenantId: string;
  version: number;
  storage: Storage;
  cacheDir?: string;
  build?: string;
  pmtilesBin?: string;
}

export async function publishTrack(db: Db, input: PublishInput): Promise<{ trackId: string }> {
  const tenant = JSON.parse(readFileSync(input.tenantPath, "utf8")) as Tenant;
  const outDir = join(tmpdir(), `riddles-publish-${input.tenantId}`);
  const result = await buildBundle({
    contentPath: input.contentPath,
    outDir,
    tenantId: input.tenantId,
    trackVersion: input.version,
    cacheDir: input.cacheDir,
    build: input.build,
    pmtilesBin: input.pmtilesBin,
  });

  const zipBytes = readFileSync(result.zipPath);
  const files = unzipSync(zipBytes);
  const contentBytes = files["content.json"];
  if (!contentBytes) throw new Error("built bundle has no content.json");
  const content = JSON.parse(new TextDecoder().decode(contentBytes)) as TrackContent;
  const key = bundleKey(content.trackId, input.version);
  await input.storage.put(key, zipBytes);

  await upsertPublished(
    db,
    tenant,
    content,
    input.version,
    result.manifest,
    key,
    zipBytes.byteLength,
  );
  return { trackId: content.trackId };
}

/** Inserts or updates the tenant, track, version, and bundle rows for a published version. */
export async function upsertPublished(
  db: Db,
  tenant: Tenant,
  content: TrackContent,
  version: number,
  manifest: BundleManifest,
  objectKey: string,
  totalBytes: number,
): Promise<void> {
  await db
    .insert(tenants)
    .values({ id: tenant.tenantId, slug: tenant.slug, data: tenant })
    .onConflictDoUpdate({ target: tenants.id, set: { slug: tenant.slug, data: tenant } });

  await db
    .insert(tracks)
    .values({
      id: content.trackId,
      tenantId: tenant.tenantId,
      slug: content.slug,
      publishedVersion: version,
    })
    .onConflictDoUpdate({
      target: tracks.id,
      set: { slug: content.slug, publishedVersion: version },
    });

  await db
    .insert(trackVersions)
    .values({ trackId: content.trackId, version, schemaVersion: content.schemaVersion, content })
    .onConflictDoUpdate({
      target: [trackVersions.trackId, trackVersions.version],
      set: { schemaVersion: content.schemaVersion, content },
    });

  await db
    .insert(bundles)
    .values({
      trackId: content.trackId,
      version,
      bundleId: manifest.bundleId,
      manifest,
      objectKey,
      totalBytes,
    })
    .onConflictDoUpdate({
      target: [bundles.trackId, bundles.version],
      set: { bundleId: manifest.bundleId, manifest, objectKey, totalBytes },
    });
}
