/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { LAYER_IDS, stationsToGeoJSON, waypointsToGeoJSON } from "./markers.ts";

test("waypoints become point features carrying their kind and label", () => {
  const collection = waypointsToGeoJSON([
    { kind: "start", lng: 34.806, lat: 32.099, label: "Start" },
    { kind: "end", lng: 34.809, lat: 32.0982, label: "Finish" },
  ]);
  assert.equal(collection.features.length, 2);
  assert.deepEqual(collection.features[0]?.geometry.coordinates, [34.806, 32.099]);
  assert.deepEqual(collection.features[0]?.properties, { kind: "start", label: "Start" });
  assert.deepEqual(collection.features[1]?.properties, { kind: "end", label: "Finish" });
  assert.equal(waypointsToGeoJSON([]).features.length, 0);
});

test("hidden stations are left off the map", () => {
  const collection = stationsToGeoJSON([
    { id: "a", lng: 34.8, lat: 32.1, label: "1", state: "current" },
    { id: "b", lng: 34.81, lat: 32.1, label: "2", state: "hidden" },
  ]);
  assert.deepEqual(
    collection.features.map((feature) => feature.properties.id),
    ["a"],
  );
});

test("every layer id is distinct, so station, waypoint and position layers never collide", () => {
  const ids = Object.values(LAYER_IDS);
  assert.equal(new Set(ids).size, ids.length);
});
