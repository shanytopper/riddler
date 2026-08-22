/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bearingDegrees,
  centerOf,
  contains,
  distanceMeters,
  padBounds,
  roundDistance,
} from "./geo.ts";

const gate = { lat: 32.099, lng: 34.806 };
const spring = { lat: 32.0998, lng: 34.8082 };

test("distance between the first two Spring Trail stations is about 226 m", () => {
  const d = distanceMeters(gate, spring);
  assert.ok(d > 220 && d < 232, `got ${d}`);
  assert.equal(distanceMeters(gate, gate), 0);
});

test("bearing is clockwise from north", () => {
  assert.ok(Math.abs(bearingDegrees({ lat: 32, lng: 34.8 }, { lat: 32.01, lng: 34.8 })) < 0.01);
  const east = bearingDegrees({ lat: 32, lng: 34.8 }, { lat: 32, lng: 34.81 });
  assert.ok(east > 89.9 && east < 90.1, `got ${east}`);
  const sw = bearingDegrees(spring, gate);
  assert.ok(sw > 225 && sw < 260, `got ${sw}`);
});

test("bounds contain, center, and pad", () => {
  const bounds: [number, number, number, number] = [34.802, 32.095, 34.818, 32.106];
  assert.equal(contains(bounds, gate), true);
  assert.equal(contains(bounds, { lat: 31, lng: 34.81 }), false);
  assert.deepEqual(centerOf(bounds), { lng: 34.81, lat: 32.1005 });
  const padded = padBounds(bounds, 500);
  assert.ok(
    padded[0] < bounds[0] &&
      padded[1] < bounds[1] &&
      padded[2] > bounds[2] &&
      padded[3] > bounds[3],
  );
  assert.ok(
    Math.abs(distanceMeters({ lng: padded[0], lat: 32.1 }, { lng: bounds[0], lat: 32.1 }) - 500) <
      2,
  );
});

test("spoken distances round to sensible steps", () => {
  assert.equal(roundDistance(42), 40);
  assert.equal(roundDistance(226), 230);
  assert.equal(roundDistance(1468), 1450);
});
