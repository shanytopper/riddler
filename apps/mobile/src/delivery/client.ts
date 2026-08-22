import { FixtureDeliveryClient } from "./fixtures.ts";
import { HttpDeliveryClient } from "./http.ts";
import type { DeliveryClient } from "./types.ts";

/** Where the API lives (e.g. http://10.0.2.2:4000 from the emulator); unset falls back to fixtures. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? null;

/** The delivery client the screens use: the HTTP API when configured, the repository fixtures otherwise. */
export const delivery: DeliveryClient = API_URL
  ? new HttpDeliveryClient(API_URL)
  : new FixtureDeliveryClient();
