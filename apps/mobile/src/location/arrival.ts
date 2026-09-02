import type { Station } from "@riddles/bundle-schema";
import { distanceMeters } from "../map/geo.ts";
import type { Position } from "../map/types.ts";

/**
 * The gps arrival rule (design.md §4.3), kept pure so the clue panel and its tests agree: a fix is
 * usable only when its reported accuracy is at most max(radius, 50 m); the "You've reached" offer
 * needs a usable fix inside the radius at a station that lists `gps`. Manual check-in is never
 * gated on any of this (D6).
 */

export const DEFAULT_RADIUS_M = 30;
/** The accuracy floor: a fix within this many meters is trusted even at a small-radius station. */
export const USABLE_ACCURACY_FLOOR_M = 50;
/** How long the party waits for a usable fix before the manual button gets an explanation. */
export const FIX_WAIT_MS = 30_000;

export type ArrivalReason =
  /** A usable fix inside the radius. */
  | "within"
  /** A usable fix, still outside the radius. */
  | "outside"
  /** No position yet. */
  | "no_fix"
  /** A fix whose accuracy is too poor to trust (or unknown). */
  | "poor_accuracy"
  /** The station has no coordinates, so there is nothing to measure against. */
  | "no_location";

export interface ArrivalCheck {
  /** Straight-line meters to the station; null without a fix or a station location. */
  distance: number | null;
  /** The station's gps radius in meters. */
  radius: number;
  /** Whether the fix is trustworthy for arrival: accuracy known and at most max(radius, 50 m). */
  usable: boolean;
  /** Whether the gps offer applies: the station lists `gps` and a usable fix is within the radius. */
  within: boolean;
  /** What the fix says about the party, regardless of the methods the station offers. */
  reason: ArrivalReason;
}

export function checkArrival(station: Station, position: Position | null): ArrivalCheck {
  const radius = station.arrival.radiusMeters ?? DEFAULT_RADIUS_M;
  const usable =
    position !== null &&
    position.accuracy !== null &&
    position.accuracy <= Math.max(radius, USABLE_ACCURACY_FLOOR_M);
  const distance = position && station.location ? distanceMeters(position, station.location) : null;
  const inRadius = usable && distance !== null && distance <= radius;
  const reason: ArrivalReason = !station.location
    ? "no_location"
    : position === null
      ? "no_fix"
      : !usable
        ? "poor_accuracy"
        : inRadius
          ? "within"
          : "outside";
  return {
    distance,
    radius,
    usable,
    within: inRadius && station.arrival.methods.includes("gps"),
    reason,
  };
}
