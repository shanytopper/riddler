import assert from "node:assert/strict";
import { test } from "node:test";
import { SCHEMA_KINDS, loadSchema, schemaIssues } from "./schema.ts";
import { exampleManifest, minimalContent, minimalTenant } from "./test-fixtures.ts";

test("every schema loads and declares schemaVersion 1", () => {
  for (const kind of SCHEMA_KINDS) {
    const schema = loadSchema(kind) as { properties: { schemaVersion: { const: number } } };
    assert.equal(schema.properties.schemaVersion.const, 1, kind);
  }
});

test("the minimal content, tenant, and manifest pass their schemas", () => {
  assert.deepEqual(schemaIssues("content", minimalContent()), []);
  assert.deepEqual(schemaIssues("tenant", minimalTenant()), []);
  assert.deepEqual(schemaIssues("manifest", exampleManifest()), []);
});

test("progressive visibility requires linear order", () => {
  const content = minimalContent();
  content.rules.order = "free";
  assert.ok(schemaIssues("content", content).some((issue) => issue.path === "/rules/order"));
});

test("a clue reveal requires the clue", () => {
  const content = minimalContent();
  content.legs[0].stations[0].reveal = { as: "clue" };
  assert.ok(
    schemaIssues("content", content).some((issue) => issue.path === "/legs/0/stations/0/reveal"),
  );
});

test("automatic arrival excludes verification methods", () => {
  const content = minimalContent();
  content.legs[0].stations[0].arrival = { methods: ["gps"], automatic: true };
  assert.ok(
    schemaIssues("content", content).some(
      (issue) => issue.path === "/legs/0/stations/0/arrival/methods",
    ),
  );
});

test("more than three hints are rejected", () => {
  const content = minimalContent();
  const hint = { text: { he: "רמז", en: "Hint" }, cost: 10 };
  (content.legs[0].stations[0] as { hints: unknown }).hints = [hint, hint, hint, hint];
  assert.ok(
    schemaIssues("content", content).some((issue) => issue.path === "/legs/0/stations/0/hints"),
  );
});

test("unknown properties are rejected at every level", () => {
  const content = { ...minimalContent(), extra: 1 };
  const issues = schemaIssues("content", content);
  assert.ok(issues.some((issue) => issue.path === "/" && issue.message.includes('"extra"')));
});

test("a challenge must match exactly one type", () => {
  const content = minimalContent();
  (content.legs[0].stations[0] as { challenge: unknown }).challenge = {
    type: "essay",
    prompt: { he: "?", en: "?" },
  };
  assert.ok(
    schemaIssues("content", content).some((issue) => issue.path === "/legs/0/stations/0/challenge"),
  );
});

test("tenant colors must be #rrggbb and URLs https", () => {
  const tenant = minimalTenant();
  tenant.theme.primary = "green";
  tenant.legal.privacyUrl = "http://example.invalid/privacy";
  const paths = schemaIssues("tenant", tenant).map((issue) => issue.path);
  assert.ok(paths.includes("/theme/primary"));
  assert.ok(paths.includes("/legal/privacyUrl"));
});

test("manifest artifacts reject unknown fields", () => {
  const manifest = exampleManifest();
  (manifest.files.media[0] as unknown as Record<string, unknown>).extra = true;
  assert.ok(schemaIssues("manifest", manifest).some((issue) => issue.path === "/files/media/0"));
});
