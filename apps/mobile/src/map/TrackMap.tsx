import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { Camera, GeoJSONSource, Layer, Map as MapLibreMap } from "@maplibre/maplibre-react-native";
import { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
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

const expr = (value: unknown[]): ExpressionSpecification =>
  value as unknown as ExpressionSpecification;
const CAMERA_PADDING = { top: 48, right: 32, bottom: 48, left: 32 };

/** Native rendering of the track map: MapLibre Native reading the bundle's PMTiles extract offline. */
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
  const readyReported = useRef(false);

  const mapStyle = useMemo(
    () => buildMapStyle({ source, scheme, lang: language }),
    [source.tilesUrl, source.glyphsUrl, source.spriteUrl, scheme, language],
  );
  const stationData = useMemo(() => stationsToGeoJSON(stations), [stations]);
  const waypointData = useMemo(() => waypointsToGeoJSON(waypoints ?? []), [waypoints]);
  const positionData = useMemo(() => positionToGeoJSON(position), [position]);

  return (
    <View style={[{ flex: 1, minHeight: 240 }, style]}>
      <MapLibreMap
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle}
        attribution={false}
        logo={false}
        compass={false}
        onDidFinishRenderingMapFully={() => {
          if (readyReported.current) return;
          readyReported.current = true;
          onReady?.();
        }}
        onDidFailLoadingMap={() => onError?.("the map style or its tiles could not be loaded")}
      >
        <Camera
          initialViewState={{ bounds, padding: CAMERA_PADDING }}
          maxBounds={bounds}
          minZoom={minZoom}
          maxZoom={maxZoom}
        />
        {/* Beneath the position dot and the stations: at the start, the party still sees itself. */}
        <GeoJSONSource id={WAYPOINTS_SOURCE_ID} data={waypointData}>
          <Layer
            id={LAYER_IDS.waypointRing}
            type="circle"
            paint={{
              "circle-radius": WAYPOINT_RING_RADIUS,
              "circle-color": colors.background,
              "circle-opacity": 0.9,
              "circle-stroke-width": WAYPOINT_RING_WIDTH,
              "circle-stroke-color": colors.primary,
            }}
          />
          <Layer
            id={LAYER_IDS.waypointLabel}
            type="symbol"
            layout={{
              "text-field": ["get", "label"],
              "text-font": STATION_LABEL_FONT,
              "text-size": 12,
              "text-anchor": "top",
              "text-offset": WAYPOINT_LABEL_OFFSET,
              "text-allow-overlap": true,
            }}
            paint={{
              "text-color": colors.primary,
              "text-halo-color": colors.background,
              "text-halo-width": 1.5,
            }}
          />
        </GeoJSONSource>
        <GeoJSONSource id={POSITION_SOURCE_ID} data={positionData}>
          <Layer
            id={LAYER_IDS.positionHalo}
            type="circle"
            paint={{ "circle-radius": 18, "circle-color": colors.primary, "circle-opacity": 0.2 }}
          />
          <Layer
            id={LAYER_IDS.positionDot}
            type="circle"
            paint={{
              "circle-radius": 7,
              "circle-color": colors.primary,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            }}
          />
        </GeoJSONSource>
        <GeoJSONSource
          id={STATIONS_SOURCE_ID}
          data={stationData}
          onPress={(event) => {
            const id: unknown = event.nativeEvent.features[0]?.properties?.id;
            if (typeof id === "string") onStationPress?.(id);
          }}
        >
          <Layer
            id={LAYER_IDS.stationCircle}
            type="circle"
            paint={{
              "circle-radius": expr(stationCircleRadius()),
              "circle-color": expr(stationCircleColor(colors)),
              "circle-stroke-width": 2,
              "circle-stroke-color": expr(stationStrokeColor(colors)),
            }}
          />
          <Layer
            id={LAYER_IDS.stationLabel}
            type="symbol"
            layout={{
              "text-field": ["get", "label"],
              "text-font": STATION_LABEL_FONT,
              "text-size": 12,
              "text-allow-overlap": true,
            }}
            paint={{ "text-color": expr(stationLabelColor(colors)) }}
          />
        </GeoJSONSource>
      </MapLibreMap>
    </View>
  );
}
