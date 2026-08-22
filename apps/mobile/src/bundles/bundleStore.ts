import type { BundleManifest, TrackContent } from "@riddles/bundle-schema";
import { FLAVOR_FOR_SCHEME, glyphsUrlTemplate, spriteUrl } from "@riddles/bundle-schema/map-assets";
import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { unzipSync } from "fflate";
import { forgetBundle, recordBundle } from "../db/bundleRepo.ts";
import { MIN_SCHEMA_VERSION, SUPPORTED_SCHEMA_VERSION } from "../db/index.ts";
import type { MapSource } from "../map/types.ts";

/**
 * Installed bundles live at <documents>/bundles/<trackId>/v<version>/ in the archive's own layout
 * (design.md §8). A bundle counts as installed only once every file has been verified against the
 * manifest and the `.installed` marker written, so a crash mid-install leaves nothing half-usable.
 */

export interface InstalledBundle {
  trackId: string;
  version: number;
  dir: Directory;
  manifest: BundleManifest;
  content: TrackContent;
}

const MARKER = ".installed";

/** Whether this app understands a bundle of the given schema version (design.md §8, schema gating). */
export function schemaSupport(schemaVersion: number): "ok" | "app_outdated" | "unsupported" {
  if (schemaVersion > SUPPORTED_SCHEMA_VERSION) return "app_outdated";
  if (schemaVersion < MIN_SCHEMA_VERSION) return "unsupported";
  return "ok";
}

export function bundleDirectory(trackId: string, version: number): Directory {
  return new Directory(Paths.document, "bundles", trackId, `v${version}`);
}

export function isInstalled(trackId: string, version: number): boolean {
  return new File(bundleDirectory(trackId, version), MARKER).exists;
}

export async function loadInstalled(
  trackId: string,
  version: number,
): Promise<InstalledBundle | null> {
  const dir = bundleDirectory(trackId, version);
  if (!new File(dir, MARKER).exists) return null;
  const manifest = JSON.parse(await new File(dir, "manifest.json").text()) as BundleManifest;
  const content = JSON.parse(await new File(dir, "content.json").text()) as TrackContent;
  // Record it on every load (idempotent) so the storage screen also sees bundles installed by an
  // earlier app version or resolved without a fresh download. First-install time is preserved.
  recordBundle({
    trackId: manifest.trackId,
    version: manifest.trackVersion,
    schemaVersion: manifest.schemaVersion,
    trackName: JSON.stringify(content.name),
    totalBytes: manifest.totalBytes,
    dirUri: dir.uri,
    installedAt: new Date().toISOString(),
  });
  return { trackId, version, dir, manifest, content };
}

export interface InstallOptions {
  zipUrl: string;
  manifest: BundleManifest;
  /** 0–1 for the download, then the verification and unpacking phases. */
  onProgress?: (phase: "download" | "verify" | "unpack", fraction: number) => void;
}

export async function installBundle({
  zipUrl,
  manifest,
  onProgress,
}: InstallOptions): Promise<InstalledBundle> {
  const dir = bundleDirectory(manifest.trackId, manifest.trackVersion);
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true, idempotent: true });

  const archive = new File(Paths.cache, `bundle-${manifest.bundleId}.zip`);
  if (archive.exists) archive.delete();
  await File.downloadFileAsync(zipUrl, archive, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      // totalBytes is -1 without a Content-Length; the manifest's uncompressed size is close enough for a bar.
      const expected = totalBytes > 0 ? totalBytes : manifest.totalBytes;
      onProgress?.("download", expected > 0 ? Math.min(1, bytesWritten / expected) : 0);
    },
  });

  const files = unzipSync(await archive.bytes());
  archive.delete();

  const expected = expectedHashes(manifest);
  const paths = Object.keys(files).filter((path) => path !== "manifest.json");
  let verified = 0;
  for (const path of paths) {
    const data = files[path]!;
    const want = expected.get(path);
    if (!want) throw new Error(`unexpected file in bundle: ${path}`);
    const got = await sha256Hex(data);
    if (got !== want) throw new Error(`checksum mismatch for ${path}`);
    onProgress?.("verify", ++verified / paths.length);
  }
  for (const [path, sha] of expected) {
    if (!files[path]) throw new Error(`bundle is missing ${path} (${sha.slice(0, 8)})`);
  }

  let written = 0;
  for (const path of [...paths, "manifest.json"]) {
    const parts = path.split("/");
    const parent = new Directory(dir, ...parts.slice(0, -1));
    if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
    new File(parent, parts[parts.length - 1] ?? path).write(files[path]!);
    onProgress?.("unpack", ++written / (paths.length + 1));
  }
  new File(dir, MARKER).write(new Date().toISOString());

  const installed = await loadInstalled(manifest.trackId, manifest.trackVersion);
  if (!installed) throw new Error("bundle did not install");
  return installed; // loadInstalled records the bundle
}

/** Deletes a downloaded bundle's files and its record (Settings → Downloads). */
export function deleteInstalledBundle(trackId: string, version: number): void {
  const dir = bundleDirectory(trackId, version);
  if (dir.exists) dir.delete();
  forgetBundle(trackId, version);
}

/** Every path the archive must contain, with its hash. Deferred map artifacts are not in the archive. */
function expectedHashes(manifest: BundleManifest): Map<string, string> {
  const map = new Map<string, string>();
  map.set(manifest.files.content.path, manifest.files.content.sha256);
  for (const entry of manifest.files.media) map.set(entry.path, entry.sha256);
  for (const entry of manifest.files.maps)
    if (entry.delivery === "bundled") map.set(entry.path, entry.sha256);
  for (const entry of manifest.files.fonts ?? []) map.set(entry.path, entry.sha256);
  for (const entry of manifest.files.sprites ?? []) map.set(entry.path, entry.sha256);
  return map;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  // A fresh copy guarantees a plain ArrayBuffer behind the view, which is what digest() accepts.
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(data));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The map style inputs for a leg, all from the bundle directory. */
export function bundleMapSource(
  bundle: InstalledBundle,
  legId: string,
  scheme: "light" | "dark",
): MapSource {
  const tiles = new File(bundle.dir, "maps", `${legId}.pmtiles`);
  return {
    tilesUrl: `pmtiles://${tiles.uri}`,
    glyphsUrl: glyphsUrlTemplate(bundle.dir.uri),
    spriteUrl: spriteUrl(bundle.dir.uri, FLAVOR_FOR_SCHEME[scheme], false),
    offline: true,
  };
}

/** A `file://` URI for a media path from content.json. */
export function bundleMediaUri(bundle: InstalledBundle, path: string): string {
  return new File(bundle.dir, ...path.split("/")).uri;
}
