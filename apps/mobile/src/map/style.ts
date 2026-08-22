import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import { layers, namedFlavor } from "@protomaps/basemaps";
import { FLAVOR_FOR_SCHEME } from "@riddles/bundle-schema/map-assets";
import type { MapSource } from "./types.ts";

export const BASEMAP_SOURCE_ID = "protomaps";
export const BASEMAP_ATTRIBUTION = "© OpenStreetMap contributors · Protomaps";

export interface MapStyleInput {
  source: Pick<MapSource, "tilesUrl" | "glyphsUrl" | "spriteUrl">;
  scheme: "light" | "dark";
  /** Label language; falls back to the local name when a translation is missing. */
  lang: string;
}

/**
 * The basemap style is assembled on the device from the Protomaps layers, so a bundle ships data
 * (tiles, fonts, sprites) and never a style file that could drift from the app's map version.
 */
export function buildMapStyle({ source, scheme, lang }: MapStyleInput): StyleSpecification {
  return {
    version: 8,
    glyphs: source.glyphsUrl,
    sprite: source.spriteUrl,
    sources: {
      [BASEMAP_SOURCE_ID]: {
        type: "vector",
        url: source.tilesUrl,
        attribution: BASEMAP_ATTRIBUTION,
      },
    },
    layers: layers(BASEMAP_SOURCE_ID, namedFlavor(FLAVOR_FOR_SCHEME[scheme]), { lang }),
  };
}
