export interface LngLat {
  lng: number;
  lat: number;
}

/** [west, south, east, north] in degrees, as in content.json. */
export type Bounds = [number, number, number, number];

const EARTH_RADIUS_M = 6_371_000;
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/** Great-circle distance in meters (haversine). */
export function distanceMeters(a: LngLat, b: LngLat): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b in degrees clockwise from north, 0–360. */
export function bearingDegrees(a: LngLat, b: LngLat): number {
  const φ1 = toRadians(a.lat);
  const φ2 = toRadians(b.lat);
  const Δλ = toRadians(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function contains(bounds: Bounds, point: LngLat): boolean {
  const [west, south, east, north] = bounds;
  return point.lng >= west && point.lng <= east && point.lat >= south && point.lat <= north;
}

export function centerOf(bounds: Bounds): LngLat {
  const [west, south, east, north] = bounds;
  return { lng: (west + east) / 2, lat: (south + north) / 2 };
}

/** Grows bounds by a distance in meters on every side. */
export function padBounds(bounds: Bounds, meters: number): Bounds {
  const [west, south, east, north] = bounds;
  const dLat = toDegrees(meters / EARTH_RADIUS_M);
  const midLat = toRadians((south + north) / 2);
  const dLng = toDegrees(meters / (EARTH_RADIUS_M * Math.cos(midLat)));
  return [west - dLng, south - dLat, east + dLng, north + dLat];
}

/** Rounds a distance the way it is spoken: 5 m steps under 100 m, 10 m steps under 1 km. */
export function roundDistance(meters: number): number {
  if (meters < 100) return Math.round(meters / 5) * 5;
  if (meters < 1000) return Math.round(meters / 10) * 10;
  return Math.round(meters / 50) * 50;
}
