import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FLAVOR_FOR_SCHEME,
  glyphRangesFor,
  glyphsUrlTemplate,
  protomapsBuildUrl,
  remoteSpriteFilePath,
  spriteFiles,
  spriteUrl,
} from "./map-assets.ts";

const BASE = ["0-255", "256-511", "512-767", "768-1023", "8192-8447", "64256-64511", "65024-65279"];

test("glyph ranges cover Latin, diacritics, and punctuation always, plus the track's scripts", () => {
  assert.deepEqual(glyphRangesFor(["en"]), BASE);
  assert.deepEqual(glyphRangesFor(["he", "en"]), [...BASE, "1280-1535", "1536-1791"]);
  assert.deepEqual(glyphRangesFor(["ru"]), [...BASE, "1024-1279"]);
  assert.deepEqual(glyphRangesFor(["he-IL", "ar"]), [...BASE, "1280-1535", "1536-1791"]);
});

test("style URLs are built for a remote host and for a local directory", () => {
  assert.equal(
    glyphsUrlTemplate("https://protomaps.github.io/basemaps-assets/"),
    "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  );
  assert.equal(
    glyphsUrlTemplate("file:///data/app/maps"),
    "file:///data/app/maps/fonts/{fontstack}/{range}.pbf",
  );
  assert.equal(
    spriteUrl("https://protomaps.github.io/basemaps-assets", "grayscale", true),
    "https://protomaps.github.io/basemaps-assets/sprites/v4/grayscale",
  );
  assert.equal(
    spriteUrl("file:///data/app/maps", "dark", false),
    "file:///data/app/maps/sprites/dark",
  );
});

test("sprite files per flavor and their remote counterparts", () => {
  assert.deepEqual(spriteFiles("light"), [
    "sprites/light.json",
    "sprites/light.png",
    "sprites/light@2x.json",
    "sprites/light@2x.png",
  ]);
  assert.equal(remoteSpriteFilePath("sprites/light@2x.png"), "sprites/v4/light@2x.png");
});

test("the basemap flavor is a neutral grey in both schemes", () => {
  assert.equal(FLAVOR_FOR_SCHEME.light, "grayscale");
  assert.equal(FLAVOR_FOR_SCHEME.dark, "dark");
});

test("build URLs require a YYYYMMDD build id", () => {
  assert.equal(protomapsBuildUrl("20260821"), "https://build.protomaps.com/20260821.pmtiles");
  assert.throws(() => protomapsBuildUrl("latest"), /YYYYMMDD/);
});
