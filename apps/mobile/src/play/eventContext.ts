import type { EventContext } from "@riddles/game-core";
import * as Crypto from "expo-crypto";

/** Ids and clocks for session events on this device (design.md §8: durations use a monotonic clock). */
export const eventContext: EventContext = {
  id: () => Crypto.randomUUID(),
  now: () => new Date().toISOString(),
  mono: () => performance.now(),
};
