import { Map as MlMap, Marker, NavigationControl } from "maplibre-gl";
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
  number: number;
  lat: number;
  lng: number;
}

interface Props {
  /** This station's number (1-based) and current position. */
  number: number;
  location: { lat: number; lng: number };
  /** The other stations, drawn faint for orientation. */
  context: ContextPin[];
  onMove: (lat: number, lng: number) => void;
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
  });
  return el;
}

/**
 * A raster map for placing one station. Its pin is draggable; the other stations show faint for
 * orientation. Dragging, clicking the map, or typing coordinates moves the pin.
 */
export function StationMap({ number, location, context, onMove }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const contextMarkers = useRef<Map<string, Marker>>(new Map());
  const [basemap, setBasemap] = useState<Basemap>(getLastBasemap);
  // Keep the latest onMove without re-creating the map.
  const moveRef = useRef(onMove);
  moveRef.current = onMove;

  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new MlMap({
      container: container.current,
      style: consoleStyle(getLastBasemap()),
      center: [location.lng, location.lat],
      zoom: 15,
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");

    const mk = new Marker({ element: pinElement(String(number), true), draggable: true })
      .setLngLat([location.lng, location.lat])
      .addTo(m);
    mk.on("dragend", () => {
      const at = mk.getLngLat();
      moveRef.current(at.lat, at.lng);
    });
    marker.current = mk;

    // Click on the map to move the pin there too.
    m.on("click", (e) => moveRef.current(e.lngLat.lat, e.lngLat.lng));

    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
      contextMarkers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The draggable pin's number can change (e.g. after a reorder) without the map re-creating.
  useEffect(() => {
    const el = marker.current?.getElement();
    if (el) el.textContent = String(number);
  }, [number]);

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

  // Keep the faint context pins in sync with the other stations (positions, numbers, add/remove).
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const live = contextMarkers.current;
    const seen = new Set<string>();
    for (const pin of context) {
      seen.add(pin.id);
      let mk = live.get(pin.id);
      if (!mk) {
        mk = new Marker({ element: pinElement(String(pin.number), false) })
          .setLngLat([pin.lng, pin.lat])
          .addTo(m);
        live.set(pin.id, mk);
      } else {
        mk.getElement().textContent = String(pin.number);
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
    map.current?.setStyle(consoleStyle(next));
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
          >
            {basemapLabel(b)}
          </button>
        ))}
      </div>
    </div>
  );
}
