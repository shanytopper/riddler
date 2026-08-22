import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import type { BundleManifest, Issue, Tenant, TrackContent } from "@riddles/bundle-schema";
import { buildBundle } from "@riddles/bundle-builder";
import { unzipSync } from "fflate";
import type { Db } from "./db/client.ts";
import { bundles, tenants, trackVersions, tracks } from "./db/schema.ts";
import { badRequest } from "./errors.ts";
import type { Storage } from "./storage.ts";
import { bundleKey } from "./storage.ts";

/**
 * Publishing (design.md §6.4, §11.2): a content document becomes an immutable track version whose
 * bundle is built here on the server — by the seed from the repository's content/, and by the
 * console from a draft (D34). Map artifacts (the tile extract, fonts, sprites) are cached in storage
 * under `cache/…` so a publish that doesn't move the bounds never re-extracts tiles.
 */

export interface BuiltBundle {
  manifest: BundleManifest;
  zipBytes: Uint8Array;
  /** The content snapshot inside the archive (authoring notes stripped, QR tokens filled). */
  content: TrackContent;
  warnings: Issue[];
}

export interface BuildInput {
  tenant: Tenant;
  content: TrackContent;
  version: number;
}

export interface BuildOptions {
  storage: Storage;
  /** A persistent local cache to seed the storage-backed one from (dev machines); optional. */
  cacheDir?: string;
  build?: string;
  pmtilesBin?: string;
}

/** A function that turns content into a bundle; the real one builds, tests substitute a fake. */
export type BundleBuilderFn = (input: BuildInput) => Promise<BuiltBundle>;

const CACHE_PREFIX = "cache/";

/** Builds a bundle for the content in a temporary directory, reusing cached map artifacts. */
export async function buildFromContent(
  input: BuildInput,
  options: BuildOptions,
): Promise<BuiltBundle> {
  if (input.content.media.length > 0)
    throw badRequest("media uploads are not supported by the prototype editor");
  const tmp = mkdtempSync(join(tmpdir(), "riddles-publish-"));
  try {
    const contentDir = join(tmp, "content");
    mkdirSync(contentDir, { recursive: true });
    const contentPath = join(contentDir, "content.json");
    writeFileSync(contentPath, `${JSON.stringify(input.content, null, 2)}\n`);

    const cacheDir = options.cacheDir ?? join(tmp, "cache");
    const known = await materializeCache(options.storage, cacheDir);

    const result = await buildBundle({
      contentPath,
      outDir: join(tmp, "out"),
      tenantId: input.tenant.tenantId,
      trackVersion: input.version,
      cacheDir,
      build: options.build,
      pmtilesBin: options.pmtilesBin,
      writeTokensBack: false,
    });
    await persistCache(options.storage, cacheDir, known);

    const zipBytes = readFileSync(result.zipPath);
    const snapshot = unzipSync(zipBytes)["content.json"];
    if (!snapshot) throw new Error("built bundle has no content.json");
    const content = JSON.parse(new TextDecoder().decode(snapshot)) as TrackContent;
    return { manifest: result.manifest, zipBytes, content, warnings: result.warnings };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Stores the archive and upserts the tenant, track, version, and bundle rows. */
export async function storePublished(
  db: Db,
  storage: Storage,
  tenant: Tenant,
  built: BuiltBundle,
  version: number,
): Promise<void> {
  const key = bundleKey(built.content.trackId, version);
  await storage.put(key, built.zipBytes);
  await upsertPublished(
    db,
    tenant,
    built.content,
    version,
    built.manifest,
    key,
    built.zipBytes.byteLength,
  );
}

/** Copies every cached map artifact from storage into the local cache directory; returns their keys. */
async function materializeCache(storage: Storage, cacheDir: string): Promise<Set<string>> {
  const keys = await storage.list(CACHE_PREFIX);
  for (const key of keys) {
    const target = join(cacheDir, ...key.slice(CACHE_PREFIX.length).split("/"));
    if (statSafe(target)) continue;
    const bytes = await storage.get(key);
    if (!bytes) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  return new Set(keys);
}

/** Uploads any file in the local cache directory that storage doesn't have yet. */
async function persistCache(storage: Storage, cacheDir: string, known: Set<string>): Promise<void> {
  if (!statSafe(cacheDir)) return;
  for (const entry of readdirSync(cacheDir, { recursive: true, encoding: "utf8" })) {
    const path = join(cacheDir, entry);
    const stat = statSafe(path);
    if (!stat || !stat.isFile()) continue;
    const key = CACHE_PREFIX + relative(cacheDir, path).split(sep).join("/");
    if (known.has(key)) continue;
    await storage.put(key, readFileSync(path));
    known.add(key);
  }
}

function statSafe(path: string) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
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
