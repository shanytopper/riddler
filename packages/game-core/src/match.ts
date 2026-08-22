import type { Challenge } from "@riddles/bundle-schema";
import { editDistance } from "./distance.ts";
import { normalizeAnswer, normalizeDigits } from "./normalize.ts";

/** What the party entered, per challenge type. */
export type AnswerInput =
  | { kind: "text"; text: string }
  | { kind: "number"; text: string }
  | { kind: "choice"; optionId: string }
  | { kind: "multi_choice"; optionIds: readonly string[] };

export interface AnswerResult {
  correct: boolean;
  /** The normalized text or parsed number as a string, for analytics on wrong answers. */
  normalizedText: string | null;
}

/** Typos tolerated for an accepted answer of this normalized length (design.md §4.4). */
export function typoAllowance(normalizedLength: number): number {
  if (normalizedLength >= 10) return 2;
  if (normalizedLength >= 5) return 1;
  return 0;
}

export interface TextMatch {
  correct: boolean;
  /** The accepted answer that matched, as the operator wrote it. */
  matched: string | null;
  distance: number | null;
}

export function matchText(
  input: string,
  accepted: readonly string[],
  closeMatch = true,
): TextMatch {
  const typed = normalizeAnswer(input);
  if (!typed) return { correct: false, matched: null, distance: null };
  let best: TextMatch = { correct: false, matched: null, distance: null };
  for (const candidate of accepted) {
    const target = normalizeAnswer(candidate);
    if (!target) continue;
    if (target === typed) return { correct: true, matched: candidate, distance: 0 };
    if (!closeMatch) continue;
    const allowed = typoAllowance(Array.from(target).length);
    if (allowed === 0) continue;
    const distance = editDistance(typed, target);
    if (distance <= allowed && (best.distance === null || distance < best.distance)) {
      best = { correct: true, matched: candidate, distance };
    }
  }
  return best;
}

/**
 * Parses what people type for a number: Arabic-Indic digits, spaces, thousands separators with a
 * comma or a dot, and a decimal comma. Returns null when it is not a number.
 */
export function parseNumber(input: string): number | null {
  let text = normalizeDigits(input).trim().replace(/\s+/g, "");
  if (!text) return null;
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, "");
  else if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  else text = text.replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export interface NumberTolerance {
  kind: "absolute" | "percent";
  value: number;
}

export function matchNumber(input: string, answer: number, tolerance: NumberTolerance): boolean {
  const value = parseNumber(input);
  if (value === null) return false;
  const allowed =
    tolerance.kind === "percent" ? (Math.abs(answer) * tolerance.value) / 100 : tolerance.value;
  return Math.abs(value - answer) <= allowed + 1e-9;
}

export function matchMultiChoice(selected: readonly string[], correct: readonly string[]): boolean {
  const chosen = new Set(selected);
  if (chosen.size !== correct.length) return false;
  return correct.every((id) => chosen.has(id));
}

/** Checks an answer against a challenge. Throws when the input kind does not fit the challenge. */
export function checkAnswer(challenge: Challenge, input: AnswerInput): AnswerResult {
  switch (challenge.type) {
    case "text": {
      if (input.kind !== "text") throw new Error(`expected a text answer, got ${input.kind}`);
      const match = matchText(
        input.text,
        acceptedAnswers(challenge.accepted),
        challenge.closeMatch ?? true,
      );
      return {
        correct: match.correct,
        normalizedText: normalizeAnswer(input.text).slice(0, 100) || null,
      };
    }
    case "number": {
      if (input.kind !== "number") throw new Error(`expected a number answer, got ${input.kind}`);
      const value = parseNumber(input.text);
      return {
        correct: matchNumber(input.text, challenge.answer, challenge.tolerance),
        normalizedText:
          value === null ? normalizeAnswer(input.text).slice(0, 100) || null : String(value),
      };
    }
    case "choice": {
      if (input.kind !== "choice") throw new Error(`expected a choice, got ${input.kind}`);
      return {
        correct: input.optionId === challenge.correctOptionId,
        normalizedText: input.optionId,
      };
    }
    case "multi_choice": {
      if (input.kind !== "multi_choice")
        throw new Error(`expected a multi-choice answer, got ${input.kind}`);
      return {
        correct: matchMultiChoice(input.optionIds, challenge.correctOptionIds),
        normalizedText: [...input.optionIds].sort().join(","),
      };
    }
  }
}

/** Accepted answers across every language: a party may answer in either language of the track. */
function acceptedAnswers(accepted: Record<string, readonly string[] | undefined>): string[] {
  return Object.values(accepted).flatMap((list) => list ?? []);
}
