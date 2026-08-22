import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import type { BundleManifest, Issue, TrackContent } from "@riddles/bundle-schema";
import { validateDocument, validateFile } from "@riddles/bundle-schema";
import { zipSync, type Zippable } from "fflate";
import { ensureBasemapAssets, ensureTilesExtract, type MapAssetOptions } from "./maps.ts";
import { MAX_IMAGE_EDGE, MAX_MAP_IMAGE_EDGE, prepareImage } from "./media.ts";

export interface BuildOptions {
  /** Authored content.json; media paths resolve relative to its folder. */
  contentPath: string;
  outDir: string;
  tenantId: string;
  trackVersion: number;
  /** Protomaps build (YYYYMMDD). Defaults to today in UTC. */
  build?: string;
  pmtilesBin?: string;
  /** Where tile extracts and basemap assets are cached between builds. */
  cacheDir?: string;
  publishedAt?: string;
  /** Skip tiles, fonts, and sprites — for tests and for tracks whose maps are images only. */
  skipMapData?: boolean;
  /** Write generated QR tokens back into the authored file so printed codes stay valid across versions. */
  writeTokensBack?: boolean;
}

export interface BuildResult {
  zipPath: string;
  manifestPath: string;
  manifest: BundleManifest;
  warnings: Issue[];
  /** Paths inside the archive with their sizes, for reporting. */
  entries: Array<{ path: string; bytes: number }>;
}

type FileEntry = { path: string; bytes: number; sha256: string };

const sha256 = (data: Uint8Array): string => createHash("sha256").update(data).digest("hex");
const encodeJson = (value: unknown): Uint8Array =>
  new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
const entryOf = (path: string, data: Uint8Array): FileEntry => ({
  path,
  bytes: data.byteLength,
  sha256: sha256(data),
});
const todayUtc = (): string => new Date().toISOString().slice(0, 10).replace(/-/g, "");

export async function buildBundle(options: BuildOptions): Promise<BuildResult> {
  const contentPath = resolve(options.contentPath);
  const contentDir = dirname(contentPath);
  const report = validateFile(contentPath, "content");
  if (report.schema.length || report.errors.length) {
    const lines = [...report.schema, ...report.errors].map(
      (issue) => `  ${issue.path}  ${issue.message}`,
    );
    throw new Error(`content is not publishable:\n${lines.join("\n")}`);
  }
  const authored = report.doc as TrackContent;
  const content: TrackContent = structuredClone(authored);
  delete content.authoringNotes;

  if (fillQrTokens(content) && options.writeTokensBack !== false) {
    const updated = structuredClone(authored);
    fillQrTokens(updated, content);
    writeFileSync(contentPath, `${JSON.stringify(updated, null, 2)}\n`);
  }

  const archive: Record<string, Uint8Array> = {};
  const stored = new Set<string>();
  const mediaEntries: BundleManifest["files"]["media"] = [];
  const mapEntries: BundleManifest["files"]["maps"] = [];
  const fontEntries: FileEntry[] = [];
  const spriteEntries: FileEntry[] = [];
  const sidecars: Array<{ path: string; source: string }> = [];

  // Media: resize, rename to the asset id, rewrite the path in the snapshot.
  const mapImageIds = new Set(
    content.legs.flatMap((leg) => (leg.map.kind === "image" ? [leg.map.mediaId] : [])),
  );
  for (const asset of content.media) {
    const source = readFileSync(join(contentDir, asset.path));
    const maxEdge = mapImageIds.has(asset.id) ? MAX_MAP_IMAGE_EDGE : MAX_IMAGE_EDGE;
    const image = await prepareImage(source, maxEdge);
    const path = `media/${asset.id}.${image.ext}`;
    archive[path] = image.data;
    stored.add(path);
    asset.path = path;
    mediaEntries.push({
      ...entryOf(path, image.data),
      id: asset.id,
      mime: image.mime,
      widthPx: image.width,
      heightPx: image.height,
    });
  }

  // Maps: one artifact per leg; the first leg ships in the archive, later legs are fetched on demand.
  const mapOptions: MapAssetOptions = {
    build: options.build ?? todayUtc(),
    cacheDir: options.cacheDir ?? join(resolve(options.outDir), ".cache"),
    pmtilesBin: options.pmtilesBin,
  };
  let needsBasemap = false;
  for (const [index, leg] of content.legs.entries()) {
    const delivery = index === 0 ? "bundled" : "deferred";
    if (leg.map.kind === "image") {
      const media = mediaEntries.find(
        (entry) => entry.id === (leg.map as { mediaId: string }).mediaId,
      );
      if (!media) throw new Error(`leg ${leg.id}: map image ${leg.map.mediaId} is not in media`);
      const path = `maps/${leg.id}.${extname(media.path).slice(1)}`;
      const data = archive[media.path]!;
      if (delivery === "bundled") {
        archive[path] = data;
        stored.add(path);
      } else sidecars.push({ path, source: media.path });
      mapEntries.push({
        ...entryOf(path, data),
        legId: leg.id,
        kind: "image",
        delivery,
        mime: media.mime,
        widthPx: media.widthPx,
        heightPx: media.heightPx,
      });
      continue;
    }
    if (options.skipMapData) continue;
    needsBasemap = true;
    const extract = ensureTilesExtract(leg, mapOptions);
    const path = `maps/${leg.id}.pmtiles`;
    const data = readFileSync(extract.path);
    if (delivery === "bundled") {
      archive[path] = data;
      stored.add(path);
    } else sidecars.push({ path, source: extract.path });
    mapEntries.push({
      ...entryOf(path, data),
      legId: leg.id,
      kind: "pmtiles",
      delivery,
      bounds: extract.bounds,
      minZoom: extract.minZoom,
      maxZoom: extract.maxZoom,
    });
  }
  if (needsBasemap) {
    const assets = await ensureBasemapAssets(content.languages, mapOptions.cacheDir);
    for (const [path, source] of assets.files) {
      const data = readFileSync(source);
      archive[path] = data;
      stored.add(path);
      (path.startsWith("fonts/") ? fontEntries : spriteEntries).push(entryOf(path, data));
    }
  }

  const contentJson = new TextEncoder().encode(`${JSON.stringify(content, null, 2)}\n`);
  archive["content.json"] = contentJson;

  const archiveBytes = Object.values(archive).reduce((sum, data) => sum + data.byteLength, 0);
  const manifest: BundleManifest = {
    schemaVersion: 1,
    bundleId: randomUUID(),
    tenantId: options.tenantId,
    trackId: content.trackId,
    trackVersion: options.trackVersion,
    publishedAt: options.publishedAt ?? new Date().toISOString(),
    languages: [...content.languages] as BundleManifest["languages"],
    files: {
      content: { ...entryOf("content.json", contentJson), path: "content.json" },
      media: mediaEntries,
      maps: mapEntries,
      fonts: fontEntries,
      sprites: spriteEntries,
    },
    totalBytes: archiveBytes,
  };
  const manifestReport = validateDocument("manifest", manifest);
  if (manifestReport.schema.length) {
    throw new Error(
      `manifest does not match its schema:\n${manifestReport.schema.map((i) => `  ${i.path}  ${i.message}`).join("\n")}`,
    );
  }
  // totalBytes counts manifest.json itself, whose length depends on the digits of totalBytes.
  let manifestJson = encodeJson(manifest);
  for (let pass = 0; pass < 4; pass++) {
    const total = archiveBytes + manifestJson.byteLength;
    if (manifest.totalBytes === total) break;
    manifest.totalBytes = total;
    manifestJson = encodeJson(manifest);
  }
  archive["manifest.json"] = manifestJson;

  // Already-compressed formats are stored; text compresses well.
  const zippable: Zippable = {};
  for (const [path, data] of Object.entries(archive)) {
    const compress = /\.(json)$/.test(path) || path.endsWith(".pbf");
    zippable[path] = [data, { level: compress ? 6 : 0 }];
  }
  const zip = zipSync(zippable);

  const outDir = resolve(options.outDir);
  mkdirSync(outDir, { recursive: true });
  const baseName = `${content.trackId}-v${options.trackVersion}`;
  const zipPath = join(outDir, `${baseName}.zip`);
  const manifestPath = join(outDir, `${baseName}.manifest.json`);
  writeFileSync(zipPath, zip);
  writeFileSync(manifestPath, archive["manifest.json"]!);
  for (const sidecar of sidecars) {
    const target = join(outDir, baseName, sidecar.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, archive[sidecar.source] ?? readFileSync(sidecar.source));
  }
  if (!existsSync(zipPath)) throw new Error("archive was not written");

  return {
    zipPath,
    manifestPath,
    manifest,
    warnings: report.warnings,
    entries: Object.entries(archive).map(([path, data]) => ({ path, bytes: data.byteLength })),
  };
}

/** Gives every qr station a token. Returns true when any was generated. With `from`, copies tokens instead. */
function fillQrTokens(content: TrackContent, from?: TrackContent): boolean {
  let generated = false;
  content.legs.forEach((leg, li) =>
    leg.stations.forEach((station, si) => {
      if (!station.arrival.methods.includes("qr") || station.arrival.qrToken) return;
      const token =
        from?.legs[li]?.stations[si]?.arrival.qrToken ?? randomBytes(12).toString("base64url");
      station.arrival.qrToken = token;
      generated = true;
    }),
  );
  return generated;
}
