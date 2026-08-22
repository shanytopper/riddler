import * as Crypto from "expo-crypto";
import { getSetting, setSetting } from "../db/prefsRepo.ts";
import { eventsAfter, markSynced, sessionsWithUnsyncedEvents } from "../db/sessionRepo.ts";
import { API_URL } from "../delivery/client.ts";

/**
 * Uploads session events to the ingestion API (design.md §8). The event log is the source of truth;
 * this walks sessions with events the server hasn't acknowledged, POSTs the new ones, and advances a
 * per-session high-water mark on success. It's safe to call anytime: idempotent on the server, and a
 * failure (offline) simply leaves the mark where it was for the next attempt. Nothing blocks play.
 */

let running = false;
let queued = false;
let debounce: ReturnType<typeof setTimeout> | null = null;

/** A stable anonymous id for this install (design.md §10: no personal data). */
function deviceId(): string {
  let id = getSetting("deviceId");
  if (!id) {
    id = Crypto.randomUUID();
    setSetting("deviceId", id);
  }
  return id;
}

/**
 * Uploads a session's events after `fromSeq`. Returns "ok" when the API acknowledged them and
 * "rejected" when it refused the batch outright (a 4xx — the data is wrong for that server, not the
 * network); throws on a network failure or a server error, which are worth retrying later.
 */
async function uploadSession(id: string, fromSeq: number): Promise<"ok" | "rejected"> {
  const events = eventsAfter(id, fromSeq);
  if (events.length === 0) return "ok";
  const response = await fetch(`${API_URL}/sessions/${encodeURIComponent(id)}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: deviceId(), events }),
  });
  if (response.status >= 500) throw new Error(`sync failed: ${response.status}`);
  if (!response.ok) return "rejected";
  const body = (await response.json()) as { acknowledgedThroughSeq?: number };
  if (typeof body.acknowledgedThroughSeq === "number") markSynced(id, body.acknowledgedThroughSeq);
  return "ok";
}

/** Uploads every session with unsynced events. Coalesces concurrent calls; never throws. */
export async function syncNow(): Promise<void> {
  if (!API_URL) return;
  if (running) {
    queued = true;
    return;
  }
  running = true;
  try {
    for (const session of sessionsWithUnsyncedEvents()) {
      try {
        let outcome = await uploadSession(session.id, session.syncedSeq);
        // A rejection after a partial sync usually means the server lost the session (a re-created
        // prototype database): resend the whole log once — ingestion is idempotent.
        if (outcome === "rejected" && session.syncedSeq > 0) {
          outcome = await uploadSession(session.id, 0);
        }
        if (outcome === "rejected") {
          // This session is unacceptable to this server; don't let it block the others.
          console.warn(
            `[sync] the API rejected session ${session.id.slice(0, 8)}; will retry later`,
          );
          continue;
        }
      } catch {
        // Offline or a server error: stop this pass and let the next trigger retry.
        break;
      }
    }
  } finally {
    running = false;
    if (queued) {
      queued = false;
      void syncNow();
    }
  }
}

/** Debounced trigger, so a burst of events (finishing a station) makes one upload, not many. */
export function scheduleSync(delayMs = 800): void {
  if (!API_URL) return;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    void syncNow();
  }, delayMs);
}
