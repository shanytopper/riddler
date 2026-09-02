import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import type { Position } from "../map/types.ts";

export type PermissionState = "undetermined" | "granted" | "denied";

export interface PositionState {
  position: Position | null;
  permission: PermissionState;
  /** False once the OS will no longer show its prompt; the party must use the settings app. */
  canAskAgain: boolean;
  /** True once the permission pre-check has answered; until then `permission` is a placeholder. */
  checked: boolean;
  error: string | null;
  /** Shows the OS permission prompt. The watch starts on its own once granted. */
  request: () => Promise<PermissionState>;
}

const WATCH_OPTIONS: Location.LocationOptions = {
  // No Google "improve location accuracy" dialog: GPS alone is what the product relies on,
  // and declining that dialog makes the watch fail outright.
  accuracy: Location.Accuracy.High,
  distanceInterval: 3,
  timeInterval: 2000,
  mayShowUserSettingsDialog: false,
};

function toPermissionState(response: Location.LocationPermissionResponse): PermissionState {
  if (response.granted) return "granted";
  return response.status === "denied" ? "denied" : "undetermined";
}

/**
 * Foreground position while a map or clue screen is open (design.md §5.7: never in the background).
 * Also the single feed for distance feedback and arrival checks, so the map and the rules agree.
 *
 * Enabling only checks the permission; the screen decides when to prompt, via `request`, so the
 * OS dialog comes after a line of rationale rather than the moment the screen opens.
 */
export function usePosition(enabled: boolean): PositionState {
  const [permission, setPermission] = useState<{
    state: PermissionState;
    canAskAgain: boolean;
    checked: boolean;
  }>({ state: "undetermined", canAskAgain: true, checked: false });
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((response: Location.LocationPermissionResponse) => {
    setPermission({
      state: toPermissionState(response),
      canAskAgain: response.canAskAgain,
      checked: true,
    });
  }, []);

  // Pre-check without prompting, and again on return to the foreground: the party may have
  // changed the answer in the settings app.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const check = () => {
      void Location.getForegroundPermissionsAsync().then((response) => {
        if (!cancelled) apply(response);
      });
    };
    check();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") check();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [enabled, apply]);

  const request = useCallback(async (): Promise<PermissionState> => {
    const response = await Location.requestForegroundPermissionsAsync();
    apply(response);
    return toPermissionState(response);
  }, [apply]);

  // Watch only once granted; the subscription ends with the screen (or the permission).
  useEffect(() => {
    if (!enabled || permission.state !== "granted") return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    void (async () => {
      try {
        const started = await Location.watchPositionAsync(
          WATCH_OPTIONS,
          ({ coords }) => {
            if (cancelled) return;
            setError(null);
            setPosition({
              lng: coords.longitude,
              lat: coords.latitude,
              accuracy: coords.accuracy,
              heading: coords.heading,
            });
          },
          (message) => {
            if (!cancelled) setError(message);
          },
        );
        if (cancelled) started.remove();
        else subscription = started;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      setPosition(null); // a fix from a watch that no longer runs is stale
    };
  }, [enabled, permission.state]);

  return {
    position,
    permission: permission.state,
    canAskAgain: permission.canAskAgain,
    checked: permission.checked,
    error,
    request,
  };
}
