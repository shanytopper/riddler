# @riddles/game-core

The rules of play as pure TypeScript, with no platform dependencies, so the app and the API run the same code: the app to play, the API to recompute a session's score from its events (design.md §8). Design context: §4.4 (answers), §4.5–4.6 (hints and scoring, decision D14), §4.7–4.8 (legs and sessions), §7 (events).

| Module         | What it does                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalize.ts` | `normalizeAnswer` — NFKC, case folding, Hebrew vowel points and cantillation stripped, final letters unified, geresh/gershayim and apostrophes dropped, other punctuation to spaces, Arabic-Indic digits to ASCII                                 |
| `distance.ts`  | Optimal string alignment distance on code points                                                                                                                                                                                                  |
| `match.ts`     | `matchText` with the typo allowance (1 for 5–9 characters, 2 for 10+), `parseNumber`/`matchNumber`, `matchMultiChoice`, and `checkAnswer(challenge, input)`                                                                                       |
| `scoring.ts`   | `challengeScore`, `timeBonus`, `compareResults`                                                                                                                                                                                                   |
| `events.ts`    | The event log types: every event has a client id, a per-session sequence number, wall-clock time, and a monotonic clock reading                                                                                                                   |
| `session.ts`   | `applyEvent` / `deriveState` — a pure reducer that needs no track content, and `playTimeAt`                                                                                                                                                       |
| `commands.ts`  | `startSession`, `arrive`, `revealHint`, `submitAnswer`, `revealAndContinue`, `startNextLeg`, `pause`, `resume`, `leave` — validate against the track's rules and return the events to append; violations throw `GameRuleError` with a stable code |

## Shape of a play session

```ts
import { startSession, arrive, submitAnswer, deriveState, applyEvent } from "@riddles/game-core";

const ctx = {
  id: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
  mono: () => performance.now(),
};
let events = startSession(content, { trackVersion: 1, language: "he", teamName: "הנמרים" }, ctx);
let state = deriveState(events);

const arrived = arrive(content, state, stationId, "manual", ctx); // events to persist, then fold
state = arrived.reduce(applyEvent, state);

const { events: more, result } = submitAnswer(
  content,
  state,
  stationId,
  { kind: "text", text: "עורבני" },
  ctx,
);
state = more.reduce(applyEvent, state);
```

Commands decide (they need the content); the reducer only records (it does not). Persisting the returned events before folding them is what makes the session crash-safe in step 6, and uploading them is all step 7 adds.

Rules worth knowing:

- Accepted answers of every language are accepted, whatever the UI language.
- Wrong attempts are counted for every challenge type but cost points only on choice challenges.
- "Reveal and continue" is available after the first hint, immediately if the track says so, and always when a challenge has no hints.
- An info station (no challenge) completes on arrival; a station with `arrival.automatic` arrives on reveal. Both cascade, so a leg can end from a single command.
- Between legs the session is paused; `startNextLeg` resumes it. Play time excludes pauses and the travel between legs.

Tests: `npm test -w @riddles/game-core`; one test plays the Spring Trail end to end using only hints and reveals, which is the "no dead end" guarantee from design.md §4.5.
