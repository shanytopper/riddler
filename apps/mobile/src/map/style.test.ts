/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { BASEMAP_SOURCE_ID, buildMapStyle } from "./style.ts";

const source = {
  tilesUrl: "pmtiles://file:///data/app/maps/leg.pmtiles",
  glyphsUrl: "file:///data/app/maps/fonts/{fontstack}/{range}.pbf",
  spriteUrl: "file:///data/app/maps/sprites/grayscale",
};

const BUNDLED_FONTS = ["Noto Sans Regular", "Noto Sans Medium", "Noto Sans Italic"];

// Expression operators that can appear where a font stack is chosen, e.g. ["case", cond, ["literal", [...]], ...].
const OPERATORS = new Set([
  "case",
  "match",
  "step",
  "interpolate",
  "coalesce",
  "literal",
  "get",
  "has",
  "let",
  "var",
  "zoom",
  "==",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "!",
  "all",
  "any",
  "in",
  "to-string",
  "concat",
  "format",
  "downcase",
  "upcase",
]);

/** Every font stack referenced by a text-font value, whether it is a plain array or an expression. */
function fontStacks(value: unknown, found: Set<string>): void {
  if (!Array.isArray(value)) return;
  const [head, ...rest] = value;
  if (typeof head === "string" && OPERATORS.has(head)) {
    rest.forEach((part) => fontStacks(part, found));
    return;
  }
  if (value.every((part) => typeof part === "string")) {
    value.forEach((font) => found.add(font as string));
    return;
  }
  value.forEach((part) => fontStacks(part, found));
}

test("the style points every resource at the bundle and labels in the requested language", () => {
  const style = buildMapStyle({ source, scheme: "light", lang: "he" });
  assert.equal(style.version, 8);
  assert.equal(style.glyphs, source.glyphsUrl);
  assert.equal(style.sprite, source.spriteUrl);
  const vector = style.sources[BASEMAP_SOURCE_ID];
  assert.ok(vector && vector.type === "vector" && vector.url === source.tilesUrl);
  assert.ok(style.layers.length > 20, `only ${style.layers.length} layers`);
  assert.ok(
    style.layers.every(
      (layer) =>
        layer.type === "background" || ("source" in layer && layer.source === BASEMAP_SOURCE_ID),
    ),
  );
  assert.ok(JSON.stringify(style.layers).includes("name:he"), "Hebrew names are not referenced");
});

test("only the fonts we bundle are referenced, in either scheme", () => {
  for (const scheme of ["light", "dark"] as const) {
    const style = buildMapStyle({ source, scheme, lang: "en" });
    const fonts = new Set<string>();
    for (const layer of style.layers) {
      const textFont = (layer as { layout?: { "text-font"?: unknown } }).layout?.["text-font"];
      fontStacks(textFont, fonts);
    }
    assert.ok(fonts.size > 0, "no fonts found");
    for (const font of fonts)
      assert.ok(BUNDLED_FONTS.includes(font), `unexpected font "${font}" (${scheme})`);
  }
});
