import { layers, namedFlavor } from "@protomaps/basemaps";
import {
  BASEMAP_ASSETS_BASE_URL,
  glyphsUrlTemplate,
  protomapsBuildUrl,
  spriteUrl,
} from "@riddles/bundle-schema/map-assets";
import { addProtocol, type StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";

let registered = false;

/** Registers the pmtiles:// protocol once, so the map can read the public Protomaps build. */
export function registerPmtiles(): void {
  if (registered) return;
  const protocol = new Protocol();
  addProtocol("pmtiles", protocol.tile);
  registered = true;
}

/**
 * The console's map style, assembled from the public Protomaps daily build and the public basemap
 * assets — the same layers the app uses, but online (the console is used at a desk). Grayscale so a
 * dragged pin stands out.
 */
export function consoleStyle(build: string): StyleSpecification {
  return {
    version: 8,
    glyphs: glyphsUrlTemplate(BASEMAP_ASSETS_BASE_URL),
    sprite: spriteUrl(BASEMAP_ASSETS_BASE_URL, "grayscale", true),
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${protomapsBuildUrl(build)}`,
        attribution: "© OpenStreetMap contributors · Protomaps",
      },
    },
    layers: layers("protomaps", namedFlavor("grayscale"), { lang: "en" }),
  } as unknown as StyleSpecification;
}

/** Yesterday in UTC as YYYYMMDD — the Protomaps build for today may not be published yet. */
export function yesterdayBuild(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replaceAll("-", "");
}
