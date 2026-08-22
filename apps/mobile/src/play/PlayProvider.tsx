import type {
  AnswerInput,
  AnswerResult,
  ArrivalMethod,
  SessionEvent,
  SessionState,
} from "@riddles/game-core";
import {
  applyEvent,
  arrive as arriveCommand,
  deriveState,
  leave as leaveCommand,
  pause as pauseCommand,
  resume as resumeCommand,
  revealAndContinue as revealAndContinueCommand,
  revealHint as revealHintCommand,
  setLeaderboardOptIn as optInCommand,
  startNextLeg as startNextLegCommand,
  startSession,
  submitAnswer as submitAnswerCommand,
} from "@riddles/game-core";
import * as Crypto from "expo-crypto";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { loadInstalled, type InstalledBundle } from "../bundles/bundleStore.ts";
import {
  appendEvents,
  createSessionRow,
  latestResumableSession,
  loadEvents,
} from "../db/sessionRepo.ts";
import { scheduleSync, syncNow } from "../sync/syncManager.ts";
import { eventContext } from "./eventContext.ts";

/**
 * The session in play: its id, the bundle, its event log, and the state folded from it. Commands
 * from game-core produce events; this provider persists them (append-then-apply, design.md §8) and
 * re-folds. On launch it restores the most recent unfinished session so a kill loses nothing.
 */
export interface ActiveSession {
  id: string;
  bundle: InstalledBundle;
  events: SessionEvent[];
  state: SessionState;
}

interface PlayContextValue {
  session: ActiveSession | null;
  /** Null until the launch-time restore has run, so callers can wait before deciding "no session". */
  restored: boolean;
  start: (
    bundle: InstalledBundle,
    options: { language: string; teamName: string },
  ) => ActiveSession;
  arrive: (stationId: string, method: Exclude<ArrivalMethod, "automatic">) => void;
  revealHint: (stationId: string) => void;
  submitAnswer: (stationId: string, input: AnswerInput) => AnswerResult & { points: number | null };
  revealAndContinue: (stationId: string) => void;
  startNextLeg: () => void;
  setLeaderboardOptIn: (optIn: boolean) => void;
  /** Re-anchors the clock and resumes an active leg that was paused (foreground / play focus). */
  resumePlay: () => void;
  leave: () => void;
  clear: () => void;
}

const PlayContext = createContext<PlayContextValue | null>(null);

export function PlayProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [restored, setRestored] = useState(false);
  // Commands need the latest state synchronously, even between renders.
  const current = useRef<ActiveSession | null>(null);

  const commit = useCallback((next: ActiveSession | null) => {
    current.current = next;
    setSession(next);
  }, []);

  /** Persists events (append-then-apply), then updates the in-memory state. */
  const append = useCallback(
    (events: SessionEvent[]) => {
      const active = current.current;
      if (!active || events.length === 0) return active?.state;
      const state = events.reduce(applyEvent, active.state);
      appendEvents(active.id, events, state);
      commit({ ...active, events: [...active.events, ...events], state });
      // A finish or an opt-in is what the leaderboard waits for: upload it now, before the phone
      // goes into a pocket; in-play events can wait for the debounce.
      const urgent = events.some(
        (event) => event.type === "session_finished" || event.type === "leaderboard_opt_in",
      );
      if (urgent) void syncNow();
      else scheduleSync();
      return state;
    },
    [commit],
  );

  const require = (): ActiveSession => {
    const active = current.current;
    if (!active) throw new Error("no session in play");
    return active;
  };

  // Restore the latest unfinished session on launch.
  useEffect(() => {
    let cancelled = false;
    const row = (() => {
      try {
        return latestResumableSession();
      } catch {
        return null; // a restore failure must not block a fresh start
      }
    })();
    void syncNow(); // upload anything left unsynced by a previous offline run
    if (!row) {
      setRestored(true);
      return;
    }
    void restoreSession(row.id, loadEvents(row.id))
      .catch(() => null)
      .then((next) => {
        if (cancelled) return;
        if (next) commit(next);
        setRestored(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit]);

  /** Loads a session's bundle and re-derives its state; re-anchors the clock if it was mid-play. */
  const restoreSession = async (
    id: string,
    events: SessionEvent[],
  ): Promise<ActiveSession | null> => {
    const state = deriveState(events);
    const bundle = await loadInstalled(state.trackId, state.trackVersion);
    if (!bundle) return null; // the bundle was deleted; nothing to resume into
    let restored: ActiveSession = { id, bundle, events, state };
    // A hard crash leaves the session "active" with a monotonic anchor from the dead process; pause
    // it so the lost stretch is dropped rather than counted, then it resumes cleanly on next focus.
    if (state.status === "active") {
      const paused = pauseCommand(state, eventContext);
      appendEvents(id, paused, paused.reduce(applyEvent, state));
      restored = {
        id,
        bundle,
        events: [...events, ...paused],
        state: paused.reduce(applyEvent, state),
      };
    }
    return restored;
  };

  // Pause when the app leaves the foreground; resume when it returns.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void syncNow(); // returning to the foreground may mean back online
      const active = current.current;
      if (!active) return;
      if (next === "active") {
        if (active.state.status === "paused" && active.state.legStarted) {
          append(resumeCommand(active.state, eventContext));
        }
      } else if (active.state.status === "active") {
        append(pauseCommand(active.state, eventContext));
        void syncNow(); // timers pause in the background; push what we have while we still run
      }
    });
    return () => subscription.remove();
  }, [append]);

  const value = useMemo<PlayContextValue>(
    () => ({
      session,
      restored,
      start: (bundle, options) => {
        const id = Crypto.randomUUID();
        createSessionRow({
          id,
          trackId: bundle.trackId,
          trackVersion: bundle.version,
          tenantSlug: null,
          teamName: options.teamName,
          language: options.language,
          at: eventContext.now(),
        });
        const events = startSession(
          bundle.content,
          { trackVersion: bundle.version, ...options },
          eventContext,
        );
        const state = deriveState(events);
        appendEvents(id, events, state);
        const next = { id, bundle, events, state };
        commit(next);
        return next;
      },
      arrive: (stationId, method) => {
        const { bundle, state } = require();
        append(arriveCommand(bundle.content, state, stationId, method, eventContext));
      },
      revealHint: (stationId) => {
        const { bundle, state } = require();
        append(revealHintCommand(bundle.content, state, stationId, eventContext));
      },
      submitAnswer: (stationId, input) => {
        const { bundle, state } = require();
        const { events, result } = submitAnswerCommand(
          bundle.content,
          state,
          stationId,
          input,
          eventContext,
        );
        append(events);
        const completed = events.find(
          (event) => event.type === "station_completed" && event.stationId === stationId,
        );
        return {
          ...result,
          points: completed?.type === "station_completed" ? completed.points : null,
        };
      },
      revealAndContinue: (stationId) => {
        const { bundle, state } = require();
        append(revealAndContinueCommand(bundle.content, state, stationId, eventContext));
      },
      startNextLeg: () => {
        const { bundle, state } = require();
        append(startNextLegCommand(bundle.content, state, eventContext));
      },
      setLeaderboardOptIn: (optIn) => {
        const { state } = require();
        append(optInCommand(state, optIn, eventContext));
      },
      resumePlay: () => {
        const active = current.current;
        if (active && active.state.status === "paused" && active.state.legStarted) {
          append(resumeCommand(active.state, eventContext));
        }
      },
      leave: () => {
        const active = current.current;
        if (active) append(leaveCommand(active.state, eventContext));
      },
      clear: () => commit(null),
    }),
    [session, restored, append, commit],
  );

  return <PlayContext.Provider value={value}>{children}</PlayContext.Provider>;
}

export function usePlay(): PlayContextValue {
  const value = useContext(PlayContext);
  if (!value) throw new Error("usePlay must be used inside PlayProvider");
  return value;
}
