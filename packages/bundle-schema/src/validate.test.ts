import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { minimalContent, minimalTenant } from "./test-fixtures.ts";
import { hasErrors, kindFromFilename, validateFile, validateTree } from "./validate.ts";

const repoContent = fileURLToPath(new URL("../../../content", import.meta.url));

test("the document kind is inferred from the file name", () => {
  assert.equal(kindFromFilename("x/y/content.json"), "content");
  assert.equal(kindFromFilename("tenant.json"), "tenant");
  assert.equal(kindFromFilename("manifest.json"), "manifest");
  assert.equal(kindFromFilename("notes.json"), undefined);
  assert.throws(() => validateFile("notes.json"), /cannot infer/);
});

test("invalid JSON is reported as a schema issue at the root", () => {
  const dir = mkdtempSync(join(tmpdir(), "riddles-validate-"));
  const file = join(dir, "content.json");
  writeFileSync(file, "{ not json");
  const report = validateFile(file);
  assert.ok(hasErrors(report));
  assert.equal(report.schema[0]?.path, "/");
  assert.match(report.schema[0]?.message ?? "", /invalid JSON/);
});

test("a tree is validated with cross-file checks", () => {
  const root = mkdtempSync(join(tmpdir(), "riddles-tree-"));
  const tenantDir = join(root, "venue");
  mkdirSync(join(tenantDir, "tracks", "one"), { recursive: true });
  mkdirSync(join(tenantDir, "tracks", "two"), { recursive: true });
  writeFileSync(join(tenantDir, "tenant.json"), JSON.stringify(minimalTenant()));
  const one = minimalContent();
  const two = minimalContent();
  two.languages = ["he", "en", "ar"];
  two.name = { he: "א", en: "A", ar: "أ" };
  writeFileSync(join(tenantDir, "tracks", "one", "content.json"), JSON.stringify(one));
  writeFileSync(join(tenantDir, "tracks", "two", "content.json"), JSON.stringify(two));

  const report = validateTree(root);
  assert.equal(report.files.length, 3);
  assert.deepEqual(
    report.cross.errors.map((issue) => issue.message),
    [`track slug "test-track" is also used by ${join("venue", "tracks", "one", "content.json")}`],
  );
  assert.equal(report.cross.warnings.length, 1);
  assert.match(report.cross.warnings[0]!.message, /track language ar not among the tenant's/);
});

test("the repository's content/ passes", { skip: !existsSync(repoContent) }, () => {
  const report = validateTree(repoContent);
  assert.ok(report.files.length >= 2, "expected at least tenant.json and one content.json");
  for (const file of report.files) {
    assert.deepEqual(file.schema, [], file.file);
    assert.deepEqual(file.errors, [], file.file);
  }
  assert.deepEqual(report.cross.errors, []);
});
