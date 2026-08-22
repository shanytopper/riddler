import type { StyleSpecification } from "maplibre-gl";

/**
 * The console is used online at a desk, so it shows a plain raster basemap rather than the app's
 * offline Protomaps vector tiles (which the browser cannot range-request cross-origin). Streets
 * (OpenStreetMap) for names and paths; satellite (Esri World Imagery) to place a station on the
 * real ground — useful for an outdoor trail.
 */
export type Basemap = "streets" | "satellite";

const SOURCES: Record<Basemap, { tiles: string[]; attribution: string; maxZoom: number }> = {
  streets: {
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  },
  satellite: {
    // Esri World Imagery uses {z}/{y}/{x} order.
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
};

export const BASEMAPS: Basemap[] = ["streets", "satellite"];

export const basemapLabel = (basemap: Basemap): string =>
  basemap === "streets" ? "Streets" : "Satellite";

// The operator's last basemap choice, remembered for the session so every station map opens the
// same way (a station map is unmounted when its section collapses).
let lastBasemap: Basemap = "streets";
export const getLastBasemap = (): Basemap => lastBasemap;
export const rememberBasemap = (basemap: Basemap): void => {
  lastBasemap = basemap;
};

/** A single-source raster style for the console map. */
export function consoleStyle(basemap: Basemap = "streets"): StyleSpecification {
  const source = SOURCES[basemap];
  return {
    version: 8,
    sources: {
      base: {
        type: "raster",
        tiles: source.tiles,
        tileSize: 256,
        maxzoom: source.maxZoom,
        attribution: source.attribution,
      },
    },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
}
