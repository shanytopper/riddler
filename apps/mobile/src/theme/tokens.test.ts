/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { FONT_FAMILIES, NEUTRAL_THEME, buildTheme } from "./tokens.ts";

test("tenant colors pass through and surfaces follow the background choice", () => {
  const light = buildTheme({ ...NEUTRAL_THEME, primary: "#1F5E3B", background: "light" });
  assert.equal(light.scheme, "light");
  assert.equal(light.colors.primary, "#1F5E3B");
  assert.equal(light.colors.background, "#FFFFFF");

  const dark = buildTheme({ ...NEUTRAL_THEME, background: "dark" });
  assert.equal(dark.scheme, "dark");
  assert.equal(dark.colors.background, "#121212");
  assert.notEqual(dark.colors.text, light.colors.text);
});

test("typography maps to registered font families, system means platform default", () => {
  assert.deepEqual(
    buildTheme({ ...NEUTRAL_THEME, typography: "heebo" }).fonts,
    FONT_FAMILIES.heebo,
  );
  assert.equal(FONT_FAMILIES.heebo.bold, "Heebo_700Bold");
  assert.deepEqual(buildTheme(NEUTRAL_THEME).fonts, { regular: undefined, bold: undefined });
});

test("spacing is an 8-point grid", () => {
  assert.equal(buildTheme(NEUTRAL_THEME).space(3), 24);
});
