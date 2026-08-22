/**
 * Text normalization for answer matching (design.md §4.4). Applied to accepted answers and to what
 * the party typed, so both sides are compared in the same form.
 */

/** Hebrew cantillation (U+0591–U+05AF) and points (U+05B0–U+05BD, rafe, shin/sin dots, U+05C4/5/7) — not the punctuation in the same block. */
const HEBREW_MARKS = /[֑-ׇֽֿׁׂׅׄ]/g;

const HEBREW_FINAL_LETTERS = /[ךםןףץ]/g;
const HEBREW_FINAL_TO_REGULAR: Record<string, string> = {
  ך: "כ", // final kaf
  ם: "מ", // final mem
  ן: "נ", // final nun
  ף: "פ", // final pe
  ץ: "צ", // final tsadi
};

/** Arabic-Indic (U+0660–U+0669) and Eastern Arabic-Indic (U+06F0–U+06F9) digits. */
const EASTERN_DIGITS = /[٠-٩۰-۹]/g;

/** Marks that sit inside a word and are simply dropped: apostrophes, quotes, geresh (U+05F3), gershayim (U+05F4). */
const WORD_INTERNAL_MARKS = /['‘’ʼ`´"“”׳״]/g;

/** Everything else that is punctuation or a symbol becomes a word boundary. */
const PUNCTUATION_AND_SYMBOLS = /[\p{P}\p{S}]/gu;

export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(HEBREW_MARKS, "")
    .replace(HEBREW_FINAL_LETTERS, (letter) => HEBREW_FINAL_TO_REGULAR[letter] ?? letter)
    .replace(EASTERN_DIGITS, (digit) => String(easternDigitValue(digit)))
    .replace(WORD_INTERNAL_MARKS, "")
    .replace(PUNCTUATION_AND_SYMBOLS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Replaces Arabic-Indic digits with ASCII digits; used before parsing numbers. */
export function normalizeDigits(text: string): string {
  return text.replace(EASTERN_DIGITS, (digit) => String(easternDigitValue(digit)));
}

function easternDigitValue(digit: string): number {
  const codePoint = digit.codePointAt(0) ?? 0;
  return codePoint >= 0x06f0 ? codePoint - 0x06f0 : codePoint - 0x0660;
}
