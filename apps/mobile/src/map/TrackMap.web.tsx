import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { useTheme } from "../theme/index.ts";
import {
  LAYER_IDS,
  POSITION_SOURCE_ID,
  STATIONS_SOURCE_ID,
  STATION_LABEL_FONT,
  WAYPOINTS_SOURCE_ID,
  WAYPOINT_LABEL_OFFSET,
  WAYPOINT_RING_RADIUS,
  WAYPOINT_RING_WIDTH,
  positionToGeoJSON,
  stationCircleColor,
  stationCircleRadius,
  stationLabelColor,
  stationStrokeColor,
  stationsToGeoJSON,
  waypointsToGeoJSON,
} from "./markers.ts";
import { buildMapStyle } from "./style.ts";
import type { TrackMapProps } from "./types.ts";

let configured = false;
function configureMapLibre(): void {
  if (configured) return;
  // The worker is served from public/ (scripts/sync-web-assets.mjs); MapLibre's own import.meta.url
  // lookup does not work under Metro.
  maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.js");
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  // MapLibre GL JS needs this plugin to shape Hebrew/Arabic labels (the Start/Finish captions);
  // without it they render mirrored. Loaded lazily, only when RTL text first appears. The web map
  // is a development/preview target, so a CDN load is acceptable here; the native binding shapes
  // RTL itself.
  void maplibregl.setRTLTextPlugin(
    "https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.js",
    true,
  );
  configured = true;
}

const expr = (value: unknown[]): ExpressionSpecification =>
  value as unknown as ExpressionSpecification;

/** Web rendering of the track map (MapLibre GL JS); the dev web target and, later, the console preview. */
export function TrackMap(props: TrackMapProps) {
  const {
    bounds,
    minZoom,
    maxZoom,
    stations,
    waypoints,
    position,
    source,
    onStationPress,
    onReady,
    onError,
    style,
  } = props;
  const { colors, scheme } = useTheme();
  const { language } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);

  // Create the map once per source/scheme/language; markers and position update in place below.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    configureMapLibre();
    readyRef.current = false;
    const map = new maplibregl.Map({
      container,
      style: buildMapStyle({ source, scheme, lang: language }),
      bounds,
      maxBounds: bounds,
      minZoom,
      maxZoom,
      attributionControl: { compact: true },
      fadeDuration: 0,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource(STATIONS_SOURCE_ID, { type: "geojson", data: stationsToGeoJSON(stations) });
      map.addSource(WAYPOINTS_SOURCE_ID, {
        type: "geojson",
        data: waypointsToGeoJSON(waypoints ?? []),
      });
      map.addSource(POSITION_SOURCE_ID, { type: "geojson", data: positionToGeoJSON(position) });
      // Beneath the position dot and the stations: at the start, the party still sees itself.
      map.addLayer({
        id: LAYER_IDS.waypointRing,
        type: "circle",
        source: WAYPOINTS_SOURCE_ID,
        paint: {
          "circle-radius": WAYPOINT_RING_RADIUS,
          "circle-color": colors.background,
          "circle-opacity": 0.9,
          "circle-stroke-width": WAYPOINT_RING_WIDTH,
          "circle-stroke-color": colors.primary,
        },
      });
      map.addLayer({
        id: LAYER_IDS.waypointLabel,
        type: "symbol",
        source: WAYPOINTS_SOURCE_ID,
        layout: {
          "text-field": ["get", "label"],
          "text-font": STATION_LABEL_FONT,
          "text-size": 12,
          "text-anchor": "top",
          "text-offset": WAYPOINT_LABEL_OFFSET,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": colors.primary,
          "text-halo-color": colors.background,
          "text-halo-width": 1.5,
        },
      });
      map.addLayer({
        id: LAYER_IDS.positionHalo,
        type: "circle",
        source: POSITION_SOURCE_ID,
        paint: { "circle-radius": 18, "circle-color": colors.primary, "circle-opacity": 0.2 },
      });
      map.addLayer({
        id: LAYER_IDS.positionDot,
        type: "circle",
        source: POSITION_SOURCE_ID,
        paint: {
          "circle-radius": 7,
          "circle-color": colors.primary,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: LAYER_IDS.stationCircle,
        type: "circle",
        source: STATIONS_SOURCE_ID,
        paint: {
          "circle-radius": expr(stationCircleRadius()),
          "circle-color": expr(stationCircleColor(colors)),
          "circle-stroke-width": 2,
          "circle-stroke-color": expr(stationStrokeColor(colors)),
        },
      });
      map.addLayer({
        id: LAYER_IDS.stationLabel,
        type: "symbol",
        source: STATIONS_SOURCE_ID,
        layout: {
          "text-field": ["get", "label"],
          "text-font": STATION_LABEL_FONT,
          "text-size": 12,
          "text-allow-overlap": true,
        },
        paint: { "text-color": expr(stationLabelColor(colors)) },
      });
      map.on("click", LAYER_IDS.stationCircle, (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") onStationPress?.(id);
      });
    });
    map.once("idle", () => {
      readyRef.current = true;
      onReady?.();
    });
    map.on("error", (event) => {
      onError?.(event.error?.message ?? "map error");
    });
    if (process.env.NODE_ENV !== "production") {
      (globalThis as { __riddlesMap?: maplibregl.Map }).__riddlesMap = map;
    }

    return () => {
      mapRef.current = null;
      map.remove();
    };
    // Station and position data are pushed into existing sources by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    source.tilesUrl,
    source.glyphsUrl,
    source.spriteUrl,
    scheme,
    language,
    bounds.join(","),
    minZoom,
    maxZoom,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource(STATIONS_SOURCE_ID);
    if (src && "setData" in src)
      (src as maplibregl.GeoJSONSource).setData(stationsToGeoJSON(stations) as never);
  }, [stations]);

  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource(WAYPOINTS_SOURCE_ID);
    if (src && "setData" in src)
      (src as maplibregl.GeoJSONSource).setData(waypointsToGeoJSON(waypoints ?? []) as never);
  }, [waypoints]);

  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource(POSITION_SOURCE_ID);
    if (src && "setData" in src)
      (src as maplibregl.GeoJSONSource).setData(positionToGeoJSON(position) as never);
  }, [position]);

  return (
    <View style={[{ flex: 1, minHeight: 240 }, style]}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
    </View>
  );
}
