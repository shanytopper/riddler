export { normalizeAnswer, normalizeDigits } from "./normalize.ts";
export { editDistance } from "./distance.ts";
export {
  checkAnswer,
  matchMultiChoice,
  matchNumber,
  matchText,
  parseNumber,
  typoAllowance,
} from "./match.ts";
export type { AnswerInput, AnswerResult, NumberTolerance, TextMatch } from "./match.ts";
export { challengeScore, compareResults, timeBonus } from "./scoring.ts";
export type { ChallengeScoreInput, RankedResult, TimeBonusRule } from "./scoring.ts";
export { EVENT_TYPES } from "./events.ts";
export type {
  ArrivalMethod,
  EventBody,
  EventContext,
  EventMeta,
  EventType,
  SessionEvent,
} from "./events.ts";
export { TEAM_NAME_MAX, TEAM_NAME_MIN, validateTeamName } from "./teamName.ts";
export type { TeamNameVerdict } from "./teamName.ts";
export { INITIAL_STATE, applyEvent, deriveState, playTimeAt, stationState } from "./session.ts";
export type { SessionState, SessionStatus, StationState, StationStatus } from "./session.ts";
export {
  GameRuleError,
  arrive,
  canRevealAndContinue,
  currentLeg,
  findStation,
  leave,
  nextStation,
  pause,
  resume,
  revealAndContinue,
  revealHint,
  setLeaderboardOptIn,
  startNextLeg,
  startSession,
  submitAnswer,
} from "./commands.ts";
export type { GameRuleCode, StartOptions, SubmitResult } from "./commands.ts";
