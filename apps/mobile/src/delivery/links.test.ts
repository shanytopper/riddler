/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeVenueCode, parseLink } from "./links.ts";

const TRACK = "3f9a2b1c-8d7e-4f60-a1b2-c3d4e5f60718";
const STATION = "0a1b2c3d-4e5f-4061-8a9b-0c1d2e3f4a5b";

test("typed venue codes are tidied and validated", () => {
  assert.equal(normalizeVenueCode("  Ein Dror "), "ein-dror");
  assert.equal(normalizeVenueCode("ein_dror"), "ein-dror");
  assert.equal(normalizeVenueCode("ein--dror"), null);
  assert.equal(normalizeVenueCode("עין דרור"), null);
  assert.equal(normalizeVenueCode(""), null);
});

test("universal links, paths, and the custom scheme all resolve to the same targets", () => {
  const venue = { kind: "venue", slug: "ein-dror" };
  assert.deepEqual(parseLink("https://app.riddles.example/v/ein-dror"), venue);
  assert.deepEqual(parseLink("/v/ein-dror"), venue);
  assert.deepEqual(parseLink("riddles://v/ein-dror"), venue);
  assert.deepEqual(parseLink("riddles:///v/ein-dror"), venue);
  assert.deepEqual(parseLink(`https://app.riddles.example/t/${TRACK}`), {
    kind: "track",
    trackId: TRACK,
  });
  assert.deepEqual(parseLink(`https://app.riddles.example/s/${TRACK}/${STATION}?k=abc123XYZ`), {
    kind: "station",
    trackId: TRACK,
    stationId: STATION,
    token: "abc123XYZ",
  });
  assert.deepEqual(parseLink(`/s/${TRACK}/${STATION}`), {
    kind: "station",
    trackId: TRACK,
    stationId: STATION,
    token: null,
  });
});

test("a bare venue code is accepted, anything else is rejected", () => {
  assert.deepEqual(parseLink("ein-dror"), { kind: "venue", slug: "ein-dror" });
  assert.equal(parseLink("https://example.com/"), null);
  assert.equal(parseLink("https://example.com/v/ein-dror/extra"), null);
  assert.equal(parseLink("/t/not-a-uuid"), null);
  assert.equal(parseLink("WIFI:S:cafe;T:WPA;P:secret;;"), null);
  assert.equal(parseLink(""), null);
});
