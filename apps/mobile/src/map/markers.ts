import type { ThemeColors } from "../theme/tokens.ts";
import type { Position, StationMarker, Waypoint } from "./types.ts";

/** Minimal GeoJSON shapes, so neither platform's map types leak into shared code. */
export interface PointFeature<P> {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: P;
}
export interface PointCollection<P> {
  type: "FeatureCollection";
  features: PointFeature<P>[];
}

export interface StationProperties {
  id: string;
  label: string;
  state: StationMarker["state"];
}

export interface WaypointProperties {
  kind: Waypoint["kind"];
  label: string;
}

export const STATIONS_SOURCE_ID = "stations";
export const WAYPOINTS_SOURCE_ID = "waypoints";
export const POSITION_SOURCE_ID = "position";
export const LAYER_IDS = {
  stationCircle: "stations-circle",
  stationLabel: "stations-label",
  waypointRing: "waypoints-ring",
  waypointLabel: "waypoints-label",
  positionHalo: "position-halo",
  positionDot: "position-dot",
} as const;

export function stationsToGeoJSON(stations: StationMarker[]): PointCollection<StationProperties> {
  return {
    type: "FeatureCollection",
    features: stations
      .filter((station) => station.state !== "hidden")
      .map((station) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [station.lng, station.lat] },
        properties: { id: station.id, label: station.label, state: station.state },
      })),
  };
}

export function waypointsToGeoJSON(waypoints: Waypoint[]): PointCollection<WaypointProperties> {
  return {
    type: "FeatureCollection",
    features: waypoints.map((waypoint) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [waypoint.lng, waypoint.lat] },
      properties: { kind: waypoint.kind, label: waypoint.label },
    })),
  };
}

export function positionToGeoJSON(
  position: Position | null,
): PointCollection<{ accuracy: number }> {
  return {
    type: "FeatureCollection",
    features: position
      ? [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [position.lng, position.lat] },
            properties: { accuracy: position.accuracy ?? 0 },
          },
        ]
      : [],
  };
}

/** Style expressions shared by the native and web maps. Typed loosely; each platform casts at its boundary. */
export type Expression = unknown[];

export function stationCircleColor(colors: ThemeColors): Expression {
  return [
    "match",
    ["get", "state"],
    "current",
    colors.accent,
    "done",
    colors.primary,
    "locked",
    colors.border,
    colors.surfaceAlt,
  ];
}

export function stationCircleRadius(): Expression {
  return ["match", ["get", "state"], "current", 14, 11];
}

export function stationStrokeColor(colors: ThemeColors): Expression {
  return [
    "match",
    ["get", "state"],
    "current",
    colors.onAccent,
    "done",
    colors.onPrimary,
    colors.textMuted,
  ];
}

export function stationLabelColor(colors: ThemeColors): Expression {
  return [
    "match",
    ["get", "state"],
    "current",
    colors.onAccent,
    "done",
    colors.onPrimary,
    colors.text,
  ];
}

export const STATION_LABEL_FONT = ["Noto Sans Medium"];

/**
 * Start/finish markers (D36) must not read as stations: a hollow ring in the theme's primary color
 * with its name written underneath, against the stations' filled, numbered discs.
 */
export const WAYPOINT_RING_RADIUS = 9;
export const WAYPOINT_RING_WIDTH = 3;
/** Ems from the ring's center; with a top anchor the label sits just under the ring. */
export const WAYPOINT_LABEL_OFFSET: [number, number] = [0, 1.1];
