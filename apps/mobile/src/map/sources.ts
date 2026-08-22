import {
  BASEMAP_ASSETS_BASE_URL,
  FLAVOR_FOR_SCHEME,
  FONT_STACKS,
  glyphPath,
  glyphRangesFor,
  glyphsUrlTemplate,
  protomapsBuildUrl,
  spriteFiles,
  spriteUrl,
  type BasemapFlavor,
} from "@riddles/bundle-schema/map-assets";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type { MapSource } from "./types.ts";

/** The public Protomaps build used when no extract is on the device (dev web, and a fallback). */
const PUBLIC_BUILD = process.env.EXPO_PUBLIC_PROTOMAPS_BUILD ?? "20260821";
/** Where `tools/extract-map.ts` output is served during the prototype, e.g. http://192.168.1.20:8081/maps */
const EXTRACT_BASE_URL = process.env.EXPO_PUBLIC_MAP_ASSETS_URL ?? null;
/** On-device directory with the bundle layout (maps/, fonts/, sprites/). Step 5 makes this per bundle. */
const LOCAL_DIR_NAME = "map-spike";

export interface ResolveMapSourceOptions {
  legId: string;
  languages: readonly string[];
  scheme: "light" | "dark";
}

export interface ResolvedMapSource {
  source: MapSource;
  /** Why a remote source was used, when it was. */
  note: string | null;
}

/**
 * Picks where the map's tiles, fonts, and sprites come from: the local copy when it exists (or can
 * be fetched from the configured assets host), otherwise the public Protomaps build over the network.
 */
export async function resolveMapSource(
  options: ResolveMapSourceOptions,
): Promise<ResolvedMapSource> {
  const flavor = FLAVOR_FOR_SCHEME[options.scheme];
  const remote = remoteSource(flavor);

  if (Platform.OS === "web") {
    if (!EXTRACT_BASE_URL) return { source: remote, note: "EXPO_PUBLIC_MAP_ASSETS_URL is not set" };
    return {
      source: {
        tilesUrl: `pmtiles://${EXTRACT_BASE_URL}/maps/${options.legId}.pmtiles`,
        glyphsUrl: glyphsUrlTemplate(EXTRACT_BASE_URL),
        spriteUrl: spriteUrl(EXTRACT_BASE_URL, flavor, false),
        offline: false,
      },
      note: null,
    };
  }

  try {
    const local = await ensureLocalAssets(options, flavor);
    if (local) return { source: local, note: null };
    return {
      source: remote,
      note: "no extract on the device and EXPO_PUBLIC_MAP_ASSETS_URL is not set",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { source: remote, note: `local assets unavailable: ${message}` };
  }
}

function remoteSource(flavor: BasemapFlavor): MapSource {
  return {
    tilesUrl: `pmtiles://${protomapsBuildUrl(PUBLIC_BUILD)}`,
    glyphsUrl: glyphsUrlTemplate(BASEMAP_ASSETS_BASE_URL),
    spriteUrl: spriteUrl(BASEMAP_ASSETS_BASE_URL, flavor, true),
    offline: false,
  };
}

/**
 * Downloads into a `.part` file and renames only when the byte count matches the server's
 * Content-Length, so an interrupted or short transfer can never be mistaken for a finished file.
 */
async function downloadAtomically(url: string, dir: Directory, parts: string[]): Promise<void> {
  const name = parts[parts.length - 1] ?? "";
  const parent = new Directory(dir, ...parts.slice(0, -1));
  if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
  const final = new File(parent, name);
  const partial = new File(parent, `${name}.part`);
  if (partial.exists) partial.delete();

  const head = await fetch(url, { method: "HEAD" });
  const expected = head.ok ? Number(head.headers.get("content-length")) : NaN;

  await File.downloadFileAsync(url, partial);
  if (Number.isFinite(expected) && expected > 0 && partial.size !== expected) {
    const got = partial.size;
    partial.delete();
    throw new Error(`short download of ${name}: ${got} of ${expected} bytes`);
  }
  if (final.exists) final.delete();
  partial.move(final);
  if (__DEV__) console.log(`[map] downloaded ${name} (${final.size} bytes)`);
}

/** Relative paths, in bundle layout, that a leg needs for a fully offline map. */
export function requiredMapFiles(
  legId: string,
  languages: readonly string[],
  flavor: BasemapFlavor,
): string[] {
  const files = [`maps/${legId}.pmtiles`];
  for (const stack of FONT_STACKS)
    for (const range of glyphRangesFor(languages)) files.push(glyphPath(stack, range));
  files.push(...spriteFiles(flavor));
  return files;
}

async function ensureLocalAssets(
  { legId, languages }: ResolveMapSourceOptions,
  flavor: BasemapFlavor,
): Promise<MapSource | null> {
  const dir = new Directory(Paths.document, LOCAL_DIR_NAME);
  const files = requiredMapFiles(legId, languages, flavor);
  const missing = files.filter((path) => !new File(dir, ...path.split("/")).exists);

  if (missing.length > 0) {
    if (!EXTRACT_BASE_URL) return null;
    for (const path of missing) {
      await downloadAtomically(`${EXTRACT_BASE_URL}/${encodeURI(path)}`, dir, path.split("/"));
    }
  }

  const tiles = new File(dir, "maps", `${legId}.pmtiles`);
  if (__DEV__) {
    console.log(`[map] local assets ready: ${files.length} files, ${missing.length} downloaded`);
  }
  // MapLibre Native reads local archives as pmtiles://file:///absolute/path; File.uri is that file:// URI.
  return {
    tilesUrl: `pmtiles://${tiles.uri}`,
    glyphsUrl: glyphsUrlTemplate(dir.uri),
    spriteUrl: spriteUrl(dir.uri, flavor, false),
    offline: true,
  };
}
