/**
 * What a bundle needs so the standard map works with the radio off (design.md §8): a PMTiles
 * extract per leg, the basemap's fonts for the languages in play, and its sprites. Shared by the
 * bundle builder, the tile-extract tool, and the app, which assembles the style on the device.
 * No Node dependencies: this module is also imported by the mobile app.
 */

export const PROTOMAPS_BUILDS_BASE_URL = "https://build.protomaps.com/";
export const BASEMAP_ASSETS_BASE_URL = "https://protomaps.github.io/basemaps-assets";
export const BASEMAP_SPRITE_VERSION = "v4";
/** The public Protomaps builds stop at this zoom; the map overzooms beyond it. */
export const PROTOMAPS_MAX_TILE_ZOOM = 15;

export type BasemapFlavor = "light" | "dark" | "white" | "grayscale" | "black";

/** Neutral greys per UI scheme, so the tenant's colors carry the interface (design.md §9.1). */
export const FLAVOR_FOR_SCHEME: Record<"light" | "dark", BasemapFlavor> = {
  light: "grayscale",
  dark: "dark",
};

/** Font stacks the basemap layers reference. Regular and Medium include the Hebrew block. */
export const FONT_STACKS = ["Noto Sans Regular", "Noto Sans Medium", "Noto Sans Italic"] as const;
export type FontStack = (typeof FONT_STACKS)[number];

/**
 * Always bundled: Latin through Latin Extended-B, combining diacritics and Greek (names with accents
 * fall back to these), General Punctuation and currency symbols, and the presentation-forms blocks
 * MapLibre requests when shaping Hebrew and Arabic. Place names in the tile data carry their local
 * scripts whatever the UI language is, so the set is wider than the track's languages alone.
 */
const BASE_GLYPH_RANGES: readonly string[] = [
  "0-255",
  "256-511",
  "512-767",
  "768-1023",
  "8192-8447",
  "64256-64511",
  "65024-65279",
];

/** Israel's maps carry Arabic names alongside Hebrew ones, so `he` pulls both blocks. */
const GLYPH_RANGES_BY_LANGUAGE: Record<string, readonly string[]> = {
  he: ["1280-1535", "1536-1791"],
  ar: ["1536-1791", "1280-1535"],
  ru: ["1024-1279"],
  uk: ["1024-1279"],
  el: [],
};

export function protomapsBuildUrl(build: string): string {
  if (!/^\d{8}$/.test(build)) throw new Error(`Protomaps build must be YYYYMMDD, got "${build}"`);
  return `${PROTOMAPS_BUILDS_BASE_URL}${build}.pmtiles`;
}

/** Glyph ranges (256-codepoint blocks, as in the file names) a track in these languages needs. */
export function glyphRangesFor(languages: readonly string[]): string[] {
  const ranges = new Set(BASE_GLYPH_RANGES);
  for (const language of languages) {
    const base = language.toLowerCase().split(/[-_]/)[0] ?? "";
    for (const range of GLYPH_RANGES_BY_LANGUAGE[base] ?? []) ranges.add(range);
  }
  return [...ranges];
}

/** Relative path of one glyph file inside a bundle or the assets host. */
export function glyphPath(stack: FontStack, range: string): string {
  return `fonts/${stack}/${range}.pbf`;
}

/** The `glyphs` template for a style, for a remote host or a local directory (`file:///...`). */
export function glyphsUrlTemplate(baseUrl: string): string {
  return `${trimSlash(baseUrl)}/fonts/{fontstack}/{range}.pbf`;
}

/** The `sprite` URL for a style; MapLibre appends .json/.png and @2x itself. */
export function spriteUrl(baseUrl: string, flavor: BasemapFlavor, remote: boolean): string {
  const dir = remote ? `sprites/${BASEMAP_SPRITE_VERSION}` : "sprites";
  return `${trimSlash(baseUrl)}/${dir}/${flavor}`;
}

/** Relative paths of the sprite files for one flavor, as stored in a bundle. */
export function spriteFiles(flavor: BasemapFlavor): string[] {
  return [
    `sprites/${flavor}.json`,
    `sprites/${flavor}.png`,
    `sprites/${flavor}@2x.json`,
    `sprites/${flavor}@2x.png`,
  ];
}

/** Where a sprite file lives on the public assets host. */
export function remoteSpriteFilePath(localPath: string): string {
  return localPath.replace(/^sprites\//, `sprites/${BASEMAP_SPRITE_VERSION}/`);
}

const trimSlash = (url: string): string => url.replace(/\/+$/, "");
