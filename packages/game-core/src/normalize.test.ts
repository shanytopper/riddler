import assert from "node:assert/strict";
import { test } from "node:test";
import { editDistance } from "./distance.ts";
import { normalizeAnswer, normalizeDigits } from "./normalize.ts";

test("case, whitespace, and punctuation are neutral", () => {
  assert.equal(normalizeAnswer("  The   Jay! "), "the jay");
  assert.equal(normalizeAnswer("Tel-Aviv"), "tel aviv");
  assert.equal(normalizeAnswer("o'brien"), "obrien");
  assert.equal(normalizeAnswer('"quoted"'), "quoted");
  assert.equal(normalizeAnswer("ＴＲＥＥ"), "tree");
});

test("Hebrew vowel points and cantillation are stripped, final letters are unified", () => {
  assert.equal(normalizeAnswer("עוֹרְבָנִי"), "עורבני");
  assert.equal(normalizeAnswer("ירושלים"), normalizeAnswer("ירושלימ"));
  assert.equal(normalizeAnswer("עץ"), "עצ");
  assert.equal(normalizeAnswer("צה״ל"), "צהל");
  assert.equal(normalizeAnswer("ג׳ירפה"), "גירפה");
  assert.equal(normalizeAnswer("בית־ספר"), "בית ספר");
});

test("Arabic-Indic digits become ASCII digits", () => {
  assert.equal(normalizeAnswer("٩٤"), "94");
  assert.equal(normalizeDigits("۲۰۲۶"), "2026");
});

test("edit distance counts substitutions, insertions, deletions, and transpositions once each", () => {
  assert.equal(editDistance("jay", "jay"), 0);
  assert.equal(editDistance("jay", "jey"), 1);
  assert.equal(editDistance("salamander", "salamnader"), 1);
  assert.equal(editDistance("עורבני", "עורבנ"), 1);
  assert.equal(editDistance("", "abc"), 3);
  assert.equal(editDistance("kitten", "sitting"), 3);
});
