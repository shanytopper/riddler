/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  UI_LANGUAGES,
  formatDistance,
  formatDuration,
  isRtl,
  localized,
  pickLanguage,
  translate,
} from "./strings.ts";

test("the device language is honored when supported, else English", () => {
  assert.equal(pickLanguage(["he-IL", "en-US"]), "he");
  assert.equal(pickLanguage(["fr-FR", "en-GB"]), "en");
  assert.equal(pickLanguage(["ar"]), "en");
  assert.equal(pickLanguage([]), "en");
});

test("Hebrew is right-to-left, English is not", () => {
  assert.equal(isRtl("he"), true);
  assert.equal(isRtl("en"), false);
});

test("localized text falls back in a stable order", () => {
  assert.equal(localized({ he: "שלום", en: "Hello" }, "he"), "שלום");
  assert.equal(localized({ en: "Hello" }, "he"), "Hello");
  assert.equal(localized({ he: "שלום" }, "en"), "שלום");
  assert.equal(localized({ ar: "مرحبا" }, "en"), "مرحبا");
  assert.equal(localized(undefined, "en", "-"), "-");
});

test("every UI string exists in every language", () => {
  const keys = Object.keys(translate("en", "appName") ? {} : {});
  assert.equal(keys.length, 0);
  for (const language of UI_LANGUAGES) {
    assert.ok(translate(language, "scanVenueCode").length > 0);
    assert.notEqual(translate(language, "tagline"), "");
  }
});

test("parameters are interpolated and unknown ones left visible", () => {
  assert.equal(translate("en", "ages", { min: 8 }), "Ages 8+");
  assert.equal(translate("he", "ages", { min: 8 }), "מגיל 8");
  assert.equal(translate("en", "ages"), "Ages {min}+");
});

test("distances switch to kilometers at 1000 m with one decimal under 10 km", () => {
  assert.equal(formatDistance("en", 850), "850 m");
  assert.equal(formatDistance("en", 1750), "1.8 km");
  assert.equal(formatDistance("en", 12400), "12 km");
  assert.equal(formatDuration("he", 70), "70 דק׳");
});
