import * as Location from "expo-location";
import { useEffect, useState } from "react";
import type { Position } from "../map/types.ts";

export type PermissionState = "unknown" | "granted" | "denied";

export interface PositionState {
  position: Position | null;
  permission: PermissionState;
  error: string | null;
}

/**
 * Foreground position while a map or clue screen is open (design.md §5.7: never in the background).
 * Also the single feed for distance feedback and arrival checks, so the map and the rules agree.
 */
export function usePosition(enabled: boolean): PositionState {
  const [state, setState] = useState<PositionState>({
    position: null,
    permission: "unknown",
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== "granted") {
        setState({ position: null, permission: "denied", error: null });
        return;
      }
      setState((current) => ({ ...current, permission: "granted" }));
      try {
        subscription = await Location.watchPositionAsync(
          // No Google "improve location accuracy" dialog: GPS alone is what the product relies on,
          // and declining that dialog makes the watch fail outright.
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 3,
            timeInterval: 2000,
            mayShowUserSettingsDialog: false,
          },
          ({ coords }) => {
            if (cancelled) return;
            setState({
              permission: "granted",
              error: null,
              position: {
                lng: coords.longitude,
                lat: coords.latitude,
                accuracy: coords.accuracy,
                heading: coords.heading,
              },
            });
          },
          (message) => {
            if (!cancelled) setState((current) => ({ ...current, error: message }));
          },
        );
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setState((current) => ({ ...current, error: message }));
        }
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return state;
}
