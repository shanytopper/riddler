import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { TrackContent } from "@riddles/bundle-schema";
import { ensureBasemapAssets, ensureTilesExtract, type MapAssetOptions } from "./maps.ts";

export interface MapAssetsDirOptions {
  contentPath: string;
  outDir: string;
  build: string;
  cacheDir?: string;
  pmtilesBin?: string;
}

export interface MapAssetsDirResult {
  tilesBytes: number;
  assetBytes: number;
  files: string[];
}

/**
 * Writes a track's offline map data in bundle layout (maps/, fonts/, sprites/) into a plain
 * directory — what the prototype's dev server serves to the app before bundles are downloaded whole.
 */
export async function writeMapAssetsDir(options: MapAssetsDirOptions): Promise<MapAssetsDirResult> {
  const content = JSON.parse(readFileSync(options.contentPath, "utf8")) as TrackContent;
  const out = resolve(options.outDir);
  const mapOptions: MapAssetOptions = {
    build: options.build,
    cacheDir: options.cacheDir ?? join(out, ".cache"),
    pmtilesBin: options.pmtilesBin,
  };
  const files: string[] = [];
  let tilesBytes = 0;
  for (const leg of content.legs) {
    if (leg.map.kind !== "tiles") continue;
    const extract = ensureTilesExtract(leg, mapOptions);
    const relative = `maps/${leg.id}.pmtiles`;
    const target = join(out, relative);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(extract.path, target);
    tilesBytes += extract.bytes;
    files.push(relative);
  }
  const assets = await ensureBasemapAssets(content.languages, mapOptions.cacheDir);
  for (const [relative, source] of assets.files) {
    const target = join(out, relative);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    files.push(relative);
  }
  return { tilesBytes, assetBytes: assets.bytes, files };
}
