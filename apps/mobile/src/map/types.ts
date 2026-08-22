import type { StyleProp, ViewStyle } from "react-native";
import type { Bounds } from "./geo.ts";

/** How a station is drawn on the map (design.md §5.3). `hidden` is a progressive track's future station. */
export type StationMarkerState = "current" | "done" | "upcoming" | "locked" | "hidden";

export interface StationMarker {
  id: string;
  lng: number;
  lat: number;
  /** Short label next to the marker, usually the station number. */
  label: string;
  state: StationMarkerState;
}

export interface Position {
  lng: number;
  lat: number;
  accuracy: number | null;
  heading: number | null;
}

/** Where the style's tiles, fonts, and sprites come from: a bundle directory or the public hosts. */
export interface MapSource {
  /** `pmtiles://file:///...` for a bundled extract or `pmtiles://https://...` for a remote archive. */
  tilesUrl: string;
  glyphsUrl: string;
  spriteUrl: string;
  offline: boolean;
}

export interface TrackMapProps {
  bounds: Bounds;
  minZoom: number;
  maxZoom: number;
  stations: StationMarker[];
  position: Position | null;
  source: MapSource;
  onStationPress?: (stationId: string) => void;
  /** Fired once the style and the first tiles have rendered. */
  onReady?: () => void;
  onError?: (message: string) => void;
  style?: StyleProp<ViewStyle>;
}
