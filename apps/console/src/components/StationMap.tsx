import type { Feature, Polygon } from "geojson";
import { Map as MlMap, Marker, NavigationControl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import {
  BASEMAPS,
  basemapLabel,
  consoleStyle,
  getLastBasemap,
  rememberBasemap,
  type Basemap,
} from "../map.ts";

export interface ContextPin {
  id: string;
  /** What the pin shows: a station's number, or "S"/"F" for the start/finish. */
  label: string;
  lat: number;
  lng: number;
}

interface Props {
  /** What this pin shows — a station's number (1-based) or "S"/"F" for the start/finish. */
  label: string;
  /** Its current position. */
  location: { lat: number; lng: number };
  /** The other points of the leg, drawn faint for orientation. */
  context: ContextPin[];
  /** The gps arrival radius to draw around the pin, in metres; null or absent draws none. */
  radiusMeters?: number | null;
  /** Read-only: the pin can't be dragged, the map can't be clicked, and the controls are off. */
  disabled?: boolean;
  onMove: (lat: number, lng: number) => void;
}

type LngLat = { lat: number; lng: number };

const RADIUS_SOURCE = "radius";
const RADIUS_LAYERS = ["radius-fill", "radius-line"] as const;

/** A 64-point polygon approximating a circle of `metres` around `at`, in lng/lat degrees. */
function circlePolygon(at: LngLat, metres: number): Feature<Polygon> {
  const dLat = metres / 111320;
  const dLng = metres / (111320 * Math.cos((at.lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * 2 * Math.PI;
    ring.push([at.lng + dLng * Math.cos(angle), at.lat + dLat * Math.sin(angle)]);
  }
  ring.push(ring[0] as [number, number]);
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

/**
 * Draw, move, or remove the translucent radius circle. Only valid once the style has loaded —
 * `addSource` throws before that — so callers guard with the style-ready flag.
 */
function syncRadius(m: MlMap, at: LngLat, metres: number | null): void {
  const source = m.getSource(RADIUS_SOURCE) as GeoJSONSource | undefined;
  if (metres === null) {
    for (const id of RADIUS_LAYERS) if (m.getLayer(id)) m.removeLayer(id);
    if (source) m.removeSource(RADIUS_SOURCE);
    return;
  }
  const data = circlePolygon(at, metres);
  if (source) {
    source.setData(data);
    return;
  }
  m.addSource(RADIUS_SOURCE, { type: "geojson", data });
  m.addLayer({
    id: RADIUS_LAYERS[0],
    type: "fill",
    source: RADIUS_SOURCE,
    paint: { "fill-color": "#b06a12", "fill-opacity": 0.15 },
  });
  m.addLayer({
    id: RADIUS_LAYERS[1],
    type: "line",
    source: RADIUS_SOURCE,
    paint: { "line-color": "#b06a12", "line-width": 1 },
  });
}

function pinElement(label: string, current: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = label;
  Object.assign(el.style, {
    width: current ? "28px" : "22px",
    height: current ? "28px" : "22px",
    borderRadius: "50%",
    background: current ? "#b06a12" : "#9aa0a6",
    color: "#fff",
    font: `700 ${current ? 13 : 11}px system-ui, sans-serif`,
    display: "grid",
    placeItems: "center",
    border: "2px solid #fff",
    boxShadow: "0 1px 4px rgba(0,0,0,.4)",
    opacity: current ? "1" : "0.75",
    cursor: current ? "grab" : "default",
    // Markers stack in DOM order; keep the draggable pin above a context pin at the same spot
    // (e.g. a finish defaulting onto the last station) so it stays visible and grabbable.
    zIndex: current ? "2" : "1",
  });
  return el;
}

/**
 * A raster map for placing one point — a station or the leg's start/finish. Its pin is draggable;
 * the other points show faint for orientation. Dragging, clicking the map, or typing coordinates
 * moves the pin. With gps arrival on, the arrival radius is drawn as a translucent circle around it.
 */
export function StationMap({ label, location, context, radiusMeters, disabled, onMove }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const contextMarkers = useRef<Map<string, Marker>>(new Map());
  const [basemap, setBasemap] = useState<Basemap>(getLastBasemap);
  // Keep the latest onMove and disabled flag without re-creating the map.
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const disabledRef = useRef(Boolean(disabled));
  disabledRef.current = Boolean(disabled);
  // The latest circle, for the style-load handler (which outlives any one render).
  const circleRef = useRef<{ at: LngLat; metres: number | null }>({ at: location, metres: null });
  circleRef.current = { at: location, metres: radiusMeters ?? null };
  // True between a style finishing loading and the next `setStyle`. `isStyleLoaded()` is no
  // substitute: it also waits for tiles, which are still streaming in while the operator types.
  const styleReady = useRef(false);

  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new MlMap({
      container: container.current,
      style: consoleStyle(getLastBasemap()),
      center: [location.lng, location.lat],
      zoom: 15,
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");

    // A style load drops every source and layer we added, so the circle is (re)drawn here — on
    // the first load and after each basemap switch (which forces a full reload, see below).
    m.on("style.load", () => {
      styleReady.current = true;
      const { at, metres } = circleRef.current;
      syncRadius(m, at, metres);
    });

    const mk = new Marker({ element: pinElement(label, true), draggable: true })
      .setLngLat([location.lng, location.lat])
      .addTo(m);
    mk.on("dragend", () => {
      const at = mk.getLngLat();
      moveRef.current(at.lat, at.lng);
    });
    marker.current = mk;

    // Click on the map to move the pin there too (unless the map is read-only).
    m.on("click", (e) => {
      if (!disabledRef.current) moveRef.current(e.lngLat.lat, e.lngLat.lng);
    });

    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
      contextMarkers.current.clear();
      styleReady.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the pin and the radius field. Before the style is ready the style-load handler draws it.
  useEffect(() => {
    const m = map.current;
    if (!m || !styleReady.current) return;
    syncRadius(m, location, radiusMeters ?? null);
  }, [location.lat, location.lng, radiusMeters]);

  // The draggable pin's label can change (e.g. after a reorder) without the map re-creating.
  useEffect(() => {
    const el = marker.current?.getElement();
    if (el) el.textContent = label;
  }, [label]);

  // Read-only mode (e.g. a finish locked to "same as start"): the pin can't be dragged.
  useEffect(() => {
    marker.current?.setDraggable(!disabled);
    const el = marker.current?.getElement();
    if (el) el.style.cursor = disabled ? "default" : "grab";
  }, [disabled]);

  // Move the pin (and re-centre if it would leave the view) when the coordinates change from the
  // inputs. After a drag the marker is already in place, so the guard skips it — no fighting.
  useEffect(() => {
    const m = map.current;
    const mk = marker.current;
    if (!m || !mk) return;
    const at = mk.getLngLat();
    if (Math.abs(at.lat - location.lat) > 1e-9 || Math.abs(at.lng - location.lng) > 1e-9) {
      mk.setLngLat([location.lng, location.lat]);
      if (!m.getBounds().contains([location.lng, location.lat]))
        m.easeTo({ center: [location.lng, location.lat], duration: 300 });
    }
  }, [location.lat, location.lng]);

  // Keep the faint context pins in sync with the other points (positions, labels, add/remove).
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const live = contextMarkers.current;
    const seen = new Set<string>();
    for (const pin of context) {
      seen.add(pin.id);
      let mk = live.get(pin.id);
      if (!mk) {
        mk = new Marker({ element: pinElement(pin.label, false) })
          .setLngLat([pin.lng, pin.lat])
          .addTo(m);
        live.set(pin.id, mk);
      } else {
        mk.getElement().textContent = pin.label;
        const at = mk.getLngLat();
        if (Math.abs(at.lat - pin.lat) > 1e-9 || Math.abs(at.lng - pin.lng) > 1e-9)
          mk.setLngLat([pin.lng, pin.lat]);
      }
    }
    for (const [id, mk] of live) {
      if (!seen.has(id)) {
        mk.remove();
        live.delete(id);
      }
    }
  }, [context]);

  const switchBasemap = (next: Basemap) => {
    setBasemap(next);
    rememberBasemap(next);
    // `diff: false` makes the switch a full reload, which always fires `style.load` (a diffed swap
    // silently removes our circle and fires nothing) — so one handler covers every path.
    styleReady.current = false;
    map.current?.setStyle(consoleStyle(next), { diff: false });
  };

  // Drop the pin where the operator is standing — the natural way to mark a station on site.
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocateError("Location isn't available in this browser.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude: lat, longitude: lng } = position.coords;
        moveRef.current(lat, lng);
        map.current?.easeTo({ center: [lng, lat], zoom: 16, duration: 400 });
      },
      (error) => {
        setLocating(false);
        setLocateError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied — allow it in the browser to use this."
            : "Couldn't get your location. Try again outdoors or with location services on.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={container}
        style={{
          height: 260,
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      />
      <div className="actions" style={{ position: "absolute", top: 8, left: 8, gap: 4 }}>
        {BASEMAPS.map((b) => (
          <button
            key={b}
            type="button"
            className={`small ${b === basemap ? "primary" : ""}`}
            onClick={() => switchBasemap(b)}
            disabled={disabled}
          >
            {basemapLabel(b)}
          </button>
        ))}
        <button
          type="button"
          className="small"
          onClick={useMyLocation}
          disabled={disabled || locating}
        >
          {locating ? "Locating…" : "Use my location"}
        </button>
      </div>
      {locateError ? (
        <p className="small" style={{ margin: "6px 0 0", color: "var(--danger, #b00020)" }}>
          {locateError}
        </p>
      ) : null}
    </div>
  );
}
