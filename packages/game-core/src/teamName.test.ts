/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { validateTeamName } from "./teamName.ts";

test("team names need a sensible length and pass the light filter", () => {
  assert.equal(validateTeamName("הנמרים"), "ok");
  assert.equal(validateTeamName("The Owls"), "ok");
  assert.equal(validateTeamName(" x "), "length");
  assert.equal(validateTeamName("a".repeat(25)), "length");
  assert.equal(validateTeamName("Team Shit"), "blocked");
  assert.equal(validateTeamName("fuck PWNED"), "blocked");
});
