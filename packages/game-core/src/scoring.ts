/** Scoring rules from design.md §4.5–4.6 (decision D14, provisional until the prototype is played). */

export interface ChallengeScoreInput {
  points: number;
  /** Costs of the station's hints, in order. */
  hintCosts: readonly number[];
  hintsRevealed: number;
  /** Wrong submissions on choice challenges; text and number challenges pass 0. */
  wrongChoiceAttempts: number;
  wrongChoicePenaltyPercent: number;
  /** "Reveal and continue" was used: the challenge is worth nothing. */
  answerRevealed: boolean;
}

export function challengeScore(input: ChallengeScoreInput): number {
  if (input.answerRevealed) return 0;
  const hints = input.hintCosts.slice(0, input.hintsRevealed).reduce((sum, cost) => sum + cost, 0);
  const perWrongAttempt = Math.round((input.points * input.wrongChoicePenaltyPercent) / 100);
  const penalty = perWrongAttempt * input.wrongChoiceAttempts;
  return Math.max(0, input.points - hints - penalty);
}

export interface TimeBonusRule {
  points: number;
  parSeconds: number;
  cutoffSeconds: number;
}

/** Full bonus at or under par, decaying linearly to zero at the cutoff. */
export function timeBonus(rule: TimeBonusRule | null, playTimeSeconds: number): number {
  if (!rule) return 0;
  if (playTimeSeconds <= rule.parSeconds) return rule.points;
  if (playTimeSeconds >= rule.cutoffSeconds) return 0;
  const span = rule.cutoffSeconds - rule.parSeconds;
  const remaining = rule.cutoffSeconds - playTimeSeconds;
  return Math.round((rule.points * remaining) / span);
}

export interface RankedResult {
  score: number;
  playTimeMs: number;
}

/** Leaderboard order: higher score first, then lower play time. */
export function compareResults(a: RankedResult, b: RankedResult): number {
  if (a.score !== b.score) return b.score - a.score;
  return a.playTimeMs - b.playTimeMs;
}
