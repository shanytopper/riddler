/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Station } from "@riddles/bundle-schema";
import type { Position } from "../map/types.ts";
import { DEFAULT_RADIUS_M, checkArrival } from "./arrival.ts";

const spring = { lat: 32.0998, lng: 34.8082 };

function station(overrides: Partial<Station> = {}): Station {
  return {
    id: "s1",
    title: { he: "מעיין", en: "Spring" },
    location: spring,
    arrival: { methods: ["gps"], automatic: false },
    challenge: null,
    hints: [],
    points: 0,
    reveal: { as: "pin" },
    ...overrides,
  };
}

function fix(accuracy: number | null, metersNorth = 0): Position {
  // One degree of latitude is about 111 km, so this moves the fix a known distance.
  return { lat: spring.lat + metersNorth / 111_320, lng: spring.lng, accuracy, heading: null };
}

test("a usable fix inside the radius makes the gps offer at a station that lists gps", () => {
  const check = checkArrival(station(), fix(12, 10));
  assert.equal(check.radius, DEFAULT_RADIUS_M);
  assert.equal(check.usable, true);
  assert.equal(check.within, true);
  assert.equal(check.reason, "within");
  assert.ok(check.distance !== null && check.distance > 9 && check.distance < 11);
});

test("the offer is withheld where the station is manual-only, though the fix is still described", () => {
  const check = checkArrival(station({ arrival: { methods: [], automatic: false } }), fix(12, 10));
  assert.equal(check.within, false);
  assert.equal(check.reason, "within");
  assert.ok(check.distance !== null);
});

test("a usable fix outside the radius is just too far", () => {
  const check = checkArrival(station(), fix(12, 80));
  assert.equal(check.usable, true);
  assert.equal(check.within, false);
  assert.equal(check.reason, "outside");
});

test("accuracy worse than max(radius, 50 m) makes the fix unusable, even inside the radius", () => {
  const poor = checkArrival(station(), fix(120, 5));
  assert.equal(poor.usable, false);
  assert.equal(poor.within, false);
  assert.equal(poor.reason, "poor_accuracy");
  assert.ok(poor.distance !== null, "the distance still shows, qualified by the accuracy caption");

  // 50 m is the floor for small radii; a larger radius relaxes the requirement to match.
  assert.equal(checkArrival(station(), fix(50, 5)).usable, true);
  assert.equal(checkArrival(station(), fix(51, 5)).usable, false);
  const wide = station({ arrival: { methods: ["gps"], automatic: false, radiusMeters: 200 } });
  const relaxed = checkArrival(wide, fix(150, 120));
  assert.equal(relaxed.radius, 200);
  assert.equal(relaxed.usable, true);
  assert.equal(relaxed.within, true);
});

test("an unknown accuracy is not trusted", () => {
  const check = checkArrival(station(), fix(null, 0));
  assert.equal(check.usable, false);
  assert.equal(check.within, false);
  assert.equal(check.reason, "poor_accuracy");
});

test("no fix and no station location are told apart", () => {
  const noFix = checkArrival(station(), null);
  assert.deepEqual(
    { distance: noFix.distance, usable: noFix.usable, within: noFix.within, reason: noFix.reason },
    { distance: null, usable: false, within: false, reason: "no_fix" },
  );
  const unplaced = station();
  delete unplaced.location;
  const noLocation = checkArrival(unplaced, fix(5));
  assert.equal(noLocation.distance, null);
  assert.equal(noLocation.within, false);
  assert.equal(noLocation.reason, "no_location");
});
