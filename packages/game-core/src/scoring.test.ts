import assert from "node:assert/strict";
import { test } from "node:test";
import { challengeScore, compareResults, timeBonus } from "./scoring.ts";

const base = {
  points: 100,
  hintCosts: [20, 30, 50],
  hintsRevealed: 0,
  wrongChoiceAttempts: 0,
  wrongChoicePenaltyPercent: 25,
  answerRevealed: false,
};

test("hints cost their price in order and all three are worth the whole challenge", () => {
  assert.equal(challengeScore(base), 100);
  assert.equal(challengeScore({ ...base, hintsRevealed: 1 }), 80);
  assert.equal(challengeScore({ ...base, hintsRevealed: 2 }), 50);
  assert.equal(challengeScore({ ...base, hintsRevealed: 3 }), 0);
});

test("wrong choices cost a fixed share each and the score never goes below zero", () => {
  assert.equal(challengeScore({ ...base, wrongChoiceAttempts: 1 }), 75);
  assert.equal(challengeScore({ ...base, wrongChoiceAttempts: 2, hintsRevealed: 1 }), 30);
  assert.equal(challengeScore({ ...base, wrongChoiceAttempts: 5 }), 0);
});

test("revealing the answer is worth nothing", () => {
  assert.equal(challengeScore({ ...base, answerRevealed: true }), 0);
});

test("the time bonus is full at par and decays linearly to the cutoff", () => {
  const rule = { points: 200, parSeconds: 3600, cutoffSeconds: 7200 };
  assert.equal(timeBonus(rule, 1800), 200);
  assert.equal(timeBonus(rule, 3600), 200);
  assert.equal(timeBonus(rule, 5400), 100);
  assert.equal(timeBonus(rule, 7200), 0);
  assert.equal(timeBonus(rule, 9000), 0);
  assert.equal(timeBonus(null, 10), 0);
});

test("ranking prefers the higher score, then the shorter play time", () => {
  const results = [
    { score: 600, playTimeMs: 4000 },
    { score: 700, playTimeMs: 5000 },
    { score: 700, playTimeMs: 3000 },
  ].sort(compareResults);
  assert.deepEqual(results, [
    { score: 700, playTimeMs: 3000 },
    { score: 700, playTimeMs: 5000 },
    { score: 600, playTimeMs: 4000 },
  ]);
});
