import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkAnswer,
  matchMultiChoice,
  matchNumber,
  matchText,
  parseNumber,
  typoAllowance,
} from "./match.ts";

test("typo allowance depends on the accepted answer's length", () => {
  assert.equal(typoAllowance(3), 0);
  assert.equal(typoAllowance(5), 1);
  assert.equal(typoAllowance(9), 1);
  assert.equal(typoAllowance(10), 2);
});

test("text answers match after normalization and within the typo allowance", () => {
  const accepted = ["jay", "Eurasian jay", "עורבני"];
  assert.equal(matchText("JAY", accepted).correct, true);
  assert.equal(matchText("jey", accepted).correct, false); // 3 letters: no typos allowed
  assert.deepEqual(matchText("eurasian jey", accepted), {
    correct: true,
    matched: "Eurasian jay",
    distance: 1,
  });
  assert.equal(matchText("eurasan jey", accepted).correct, true); // 12 letters: two typos allowed
  assert.equal(matchText("eurasan jeyy", accepted).correct, false);
  assert.equal(matchText("עורבנִי", accepted).correct, true);
  assert.equal(matchText("eurasian jey", accepted, false).correct, false);
  assert.equal(matchText("   ", accepted).correct, false);
});

test("numbers are parsed the way people type them", () => {
  assert.equal(parseNumber("94"), 94);
  assert.equal(parseNumber(" 2,000,000 "), 2_000_000);
  assert.equal(parseNumber("2.000.000"), 2_000_000);
  assert.equal(parseNumber("2 000 000"), 2_000_000);
  assert.equal(parseNumber("19,5"), 19.5);
  assert.equal(parseNumber("٩٤"), 94);
  assert.equal(parseNumber("-3.25"), -3.25);
  assert.equal(parseNumber("ninety"), null);
  assert.equal(parseNumber(""), null);
});

test("number tolerance is absolute or a percentage", () => {
  assert.equal(matchNumber("94", 94, { kind: "absolute", value: 0 }), true);
  assert.equal(matchNumber("95", 94, { kind: "absolute", value: 0 }), false);
  assert.equal(matchNumber("95", 94, { kind: "absolute", value: 1 }), true);
  assert.equal(matchNumber("2,100,000", 2_000_000, { kind: "percent", value: 5 }), true);
  assert.equal(matchNumber("2,200,000", 2_000_000, { kind: "percent", value: 5 }), false);
});

test("multiple choice is all-or-nothing, order-insensitive", () => {
  assert.equal(matchMultiChoice(["b", "a"], ["a", "b"]), true);
  assert.equal(matchMultiChoice(["a"], ["a", "b"]), false);
  assert.equal(matchMultiChoice(["a", "b", "c"], ["a", "b"]), false);
});

test("checkAnswer dispatches by challenge type and reports a normalized form for wrong answers", () => {
  const text = checkAnswer(
    { type: "text", prompt: {}, accepted: { en: ["jay"] }, closeMatch: true },
    { kind: "text", text: " Crow! " },
  );
  assert.deepEqual(text, { correct: false, normalizedText: "crow" });
  const number = checkAnswer(
    { type: "number", prompt: {}, answer: 94, tolerance: { kind: "absolute", value: 0 } },
    { kind: "number", text: "ninety-four" },
  );
  assert.deepEqual(number, { correct: false, normalizedText: "ninety four" });
  const choice = checkAnswer(
    {
      type: "choice",
      prompt: {},
      options: [
        { id: "a", text: {} },
        { id: "b", text: {} },
      ],
      correctOptionId: "b",
    },
    { kind: "choice", optionId: "b" },
  );
  assert.equal(choice.correct, true);
  assert.throws(
    () =>
      checkAnswer(
        { type: "number", prompt: {}, answer: 1, tolerance: { kind: "absolute", value: 0 } },
        { kind: "text", text: "1" },
      ),
    /expected a number/,
  );
});
