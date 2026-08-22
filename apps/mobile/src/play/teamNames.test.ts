/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPlayTime } from "../i18n/strings.ts";
import { TEAM_NAME_SUGGESTIONS, validateTeamName } from "./teamNames.ts";

test("team names need a sensible length and pass the light filter", () => {
  assert.equal(validateTeamName("הנמרים"), "ok");
  assert.equal(validateTeamName(" x "), "length");
  assert.equal(validateTeamName("a".repeat(25)), "length");
  assert.equal(validateTeamName("Team Shit"), "blocked");
  for (const language of ["he", "en"] as const) {
    for (const name of TEAM_NAME_SUGGESTIONS[language])
      assert.equal(validateTeamName(name), "ok", name);
  }
});

test("play time formats as m:ss and h:mm:ss", () => {
  assert.equal(formatPlayTime(0), "0:00");
  assert.equal(formatPlayTime(65_000), "1:05");
  assert.equal(formatPlayTime(3_725_000), "1:02:05");
});
