import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Leg } from "@riddles/bundle-schema";
import {
  BASEMAP_ASSETS_BASE_URL,
  FLAVOR_FOR_SCHEME,
  FONT_STACKS,
  PROTOMAPS_MAX_TILE_ZOOM,
  glyphPath,
  glyphRangesFor,
  protomapsBuildUrl,
  remoteSpriteFilePath,
  spriteFiles,
} from "@riddles/bundle-schema/map-assets";

/**
 * Offline map data for a bundle (design.md §8): a PMTiles extract per tiles leg cut from the public
 * Protomaps build, plus the basemap glyph ranges and sprites. Everything is cached under `cacheDir`
 * so repeated builds do not hit the network.
 */

export interface MapAssetOptions {
  /** Protomaps daily build, YYYYMMDD. */
  build: string;
  cacheDir: string;
  pmtilesBin?: string;
}

export interface TilesExtract {
  path: string;
  bytes: number;
  bounds: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
}

/** The go-pmtiles binary: an explicit path, PMTILES_BIN, the setup's install location, or PATH. */
export function findPmtiles(explicit?: string): string {
  if (explicit) return explicit;
  if (process.env.PMTILES_BIN) return process.env.PMTILES_BIN;
  const local = process.env.LOCALAPPDATA;
  const installed = local ? join(local, "Programs", "pmtiles", "pmtiles.exe") : null;
  return installed && existsSync(installed) ? installed : "pmtiles";
}

/** Cuts (or reuses) the extract for a tiles leg. The archive holds zoom 0 up to the build's maximum. */
export function ensureTilesExtract(leg: Leg, options: MapAssetOptions): TilesExtract {
  if (leg.map.kind !== "tiles") throw new Error(`leg ${leg.id} has no tiles map`);
  const { bounds, minZoom, maxZoom } = leg.map;
  const extractMaxZoom = Math.min(maxZoom, PROTOMAPS_MAX_TILE_ZOOM);
  const key = `${leg.id}-${options.build}-${bounds.join("_")}-z${extractMaxZoom}`;
  const target = join(options.cacheDir, "tiles", `${key}.pmtiles`);
  if (!existsSync(target)) {
    mkdirSync(dirname(target), { recursive: true });
    const bin = findPmtiles(options.pmtilesBin);
    const args = [
      "extract",
      protomapsBuildUrl(options.build),
      target,
      `--bbox=${bounds.join(",")}`,
      `--maxzoom=${extractMaxZoom}`,
    ];
    const result = spawnSync(bin, args, { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" });
    if (result.error) throw new Error(`could not run ${bin}: ${result.error.message}`);
    if (result.status !== 0)
      throw new Error(
        `pmtiles extract failed: ${result.stderr.trim().split("\n").pop() ?? "unknown error"}`,
      );
  }
  const bytes = readFileSync(target).byteLength;
  return { path: target, bytes, bounds, minZoom, maxZoom };
}

export interface BasemapAssets {
  /** Relative bundle paths mapped to absolute cache paths. */
  files: Map<string, string>;
  bytes: number;
}

/** Downloads (or reuses) the glyph ranges for these languages and the sprites for both schemes. */
export async function ensureBasemapAssets(
  languages: readonly string[],
  cacheDir: string,
): Promise<BasemapAssets> {
  const files = new Map<string, string>();
  let bytes = 0;
  for (const stack of FONT_STACKS) {
    for (const range of glyphRangesFor(languages)) {
      const relative = glyphPath(stack, range);
      bytes += await cached(
        `${BASEMAP_ASSETS_BASE_URL}/${encodeURI(relative)}`,
        join(cacheDir, relative),
      );
      files.set(relative, join(cacheDir, relative));
    }
  }
  for (const flavor of new Set(Object.values(FLAVOR_FOR_SCHEME))) {
    for (const relative of spriteFiles(flavor)) {
      bytes += await cached(
        `${BASEMAP_ASSETS_BASE_URL}/${remoteSpriteFilePath(relative)}`,
        join(cacheDir, relative),
      );
      files.set(relative, join(cacheDir, relative));
    }
  }
  return { files, bytes };
}

async function cached(url: string, target: string): Promise<number> {
  if (existsSync(target)) return readFileSync(target).byteLength;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  const data = new Uint8Array(await response.arrayBuffer());
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  return data.byteLength;
}
