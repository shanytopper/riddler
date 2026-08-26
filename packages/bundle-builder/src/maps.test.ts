import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { Leg } from "@riddles/bundle-schema";
import { ensureTilesExtract } from "./maps.ts";

const leg = (): Leg =>
  ({
    id: "new-leg-id",
    map: { kind: "tiles", bounds: [34.802, 32.095, 34.818, 32.106], minZoom: 13, maxZoom: 18 },
    stations: [],
  }) as unknown as Leg;

/** A path that is not a real binary, so any go-pmtiles invocation fails loudly. */
const badBin = (dir: string): string => join(dir, "no-such-pmtiles-binary");

test("reuses a cached extract for the same region instead of re-running go-pmtiles", () => {
  const cacheDir = mkdtempSync(join(tmpdir(), "riddles-tiles-"));
  const tiles = join(cacheDir, "tiles");
  mkdirSync(tiles, { recursive: true });
  // An extract cached under an OLDER key (a different leg id and build date) for the same region.
  const cached = join(tiles, "old-leg-20260101-34.802_32.095_34.818_32.106-z15.pmtiles");
  writeFileSync(cached, Buffer.from("CACHED-TILES"));

  // If reuse fails and go-pmtiles is invoked, the bogus binary would make this throw.
  const extract = ensureTilesExtract(leg(), {
    build: "20260825",
    cacheDir,
    pmtilesBin: badBin(cacheDir),
  });

  const target = join(tiles, "34.802_32.095_34.818_32.106-z15.pmtiles");
  assert.equal(extract.path, target);
  assert.ok(existsSync(target));
  assert.equal(readFileSync(target, "utf8"), "CACHED-TILES"); // reused, not re-extracted
});

test("extracts (and fails loudly) when nothing is cached for the region", () => {
  const cacheDir = mkdtempSync(join(tmpdir(), "riddles-tiles-"));
  assert.throws(
    () => ensureTilesExtract(leg(), { build: "20260825", cacheDir, pmtilesBin: badBin(cacheDir) }),
    /could not run|pmtiles extract/,
  );
});
