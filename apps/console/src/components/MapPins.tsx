import { Map as MlMap, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { consoleStyle, registerPmtiles, yesterdayBuild } from "../map.ts";

export interface Pin {
  id: string;
  number: number;
  lat: number;
  lng: number;
}

interface Props {
  pins: Pin[];
  /** [west, south, east, north] — the leg's bounds, for the initial camera. */
  bounds: [number, number, number, number];
  onMove: (id: string, lat: number, lng: number) => void;
}

/** A basemap with one draggable numbered marker per station; dragging reports the new position. */
export function MapPins({ pins, bounds, onMove }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  // Keep the latest onMove without re-creating the map.
  const moveRef = useRef(onMove);
  moveRef.current = onMove;

  useEffect(() => {
    if (!container.current || map.current) return;
    registerPmtiles();
    const m = new MlMap({
      container: container.current,
      style: consoleStyle(yesterdayBuild()),
      bounds: [bounds[0], bounds[1], bounds[2], bounds[3]],
      fitBoundsOptions: { padding: 48 },
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      markers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers with the pins.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const live = markers.current;
    const seen = new Set<string>();

    for (const pin of pins) {
      seen.add(pin.id);
      let marker = live.get(pin.id);
      if (!marker) {
        const el = document.createElement("div");
        el.className = "map-pin";
        el.textContent = String(pin.number);
        Object.assign(el.style, {
          width: "26px",
          height: "26px",
          borderRadius: "50%",
          background: "#b06a12",
          color: "#fff",
          font: "700 13px system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          border: "2px solid #fff",
          boxShadow: "0 1px 4px rgba(0,0,0,.4)",
          cursor: "grab",
        });
        marker = new Marker({ element: el, draggable: true });
        marker.setLngLat([pin.lng, pin.lat]).addTo(m);
        marker.on("dragend", () => {
          const at = marker!.getLngLat();
          moveRef.current(pin.id, at.lat, at.lng);
        });
        live.set(pin.id, marker);
      } else {
        marker.getElement().textContent = String(pin.number);
        // Don't fight an in-progress drag: only move the marker if it's meaningfully off.
        const at = marker.getLngLat();
        if (Math.abs(at.lat - pin.lat) > 1e-9 || Math.abs(at.lng - pin.lng) > 1e-9)
          marker.setLngLat([pin.lng, pin.lat]);
      }
    }
    for (const [id, marker] of live) {
      if (!seen.has(id)) {
        marker.remove();
        live.delete(id);
      }
    }
  }, [pins]);

  return <div className="map" ref={container} />;
}
