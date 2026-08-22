#!/usr/bin/env node
import { statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { SCHEMA_KINDS, type Issue, type SchemaKind } from "./schema.ts";
import { hasErrors, validateFile, validateTree, type FileReport } from "./validate.ts";

const USAGE = `Usage: riddles-validate [paths...] [--kind content|tenant|manifest] [--json]

Validates authored content against the bundle schemas and the builder invariants.
A path may be a file (content.json, tenant.json, manifest.json) or a directory,
which is searched recursively. Defaults to ./content. Exits 1 when any file has
errors, 2 on usage errors.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    kind: { type: "string" },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}

const kind = values.kind as SchemaKind | undefined;
if (kind !== undefined && !SCHEMA_KINDS.includes(kind)) {
  console.error(`unknown --kind "${kind}"; expected one of ${SCHEMA_KINDS.join(", ")}`);
  process.exit(2);
}

const cwd = process.cwd();
const targets = positionals.length ? positionals : ["content"];
const reports: FileReport[] = [];
const cross = { errors: [] as Issue[], warnings: [] as Issue[] };

for (const target of targets) {
  const full = resolve(cwd, target);
  let isDirectory: boolean;
  try {
    isDirectory = statSync(full).isDirectory();
  } catch {
    console.error(`not found: ${target}`);
    process.exit(2);
  }
  if (isDirectory) {
    const tree = validateTree(full);
    reports.push(...tree.files);
    cross.errors.push(...tree.cross.errors);
    cross.warnings.push(...tree.cross.warnings);
  } else {
    reports.push(validateFile(full, kind));
  }
}

const failed = reports.filter(hasErrors).length + cross.errors.length;

if (values.json) {
  const files = reports.map(({ doc: _doc, ...rest }) => ({
    ...rest,
    file: relative(cwd, rest.file),
  }));
  console.log(JSON.stringify({ files, cross, ok: failed === 0 }, null, 2));
} else {
  const line = (label: string, issue: Issue): void => {
    console.log(`        ${label.padEnd(8)} ${issue.path}  ${issue.message}`);
  };
  for (const report of reports) {
    const status = hasErrors(report) ? "FAIL" : report.warnings.length ? "WARN" : "OK  ";
    console.log(`${status}  ${relative(cwd, report.file) || report.file}`);
    report.schema.forEach((issue) => line("schema", issue));
    report.errors.forEach((issue) => line("error", issue));
    report.warnings.forEach((issue) => line("warning", issue));
  }
  if (cross.errors.length || cross.warnings.length) {
    console.log("CROSS");
    cross.errors.forEach((issue) => line("error", issue));
    cross.warnings.forEach((issue) => line("warning", issue));
  }
  const warned = reports.filter((r) => r.warnings.length).length;
  console.log(
    `\n${reports.length} file${reports.length === 1 ? "" : "s"}, ${failed} with errors, ${warned} with warnings`,
  );
}

process.exit(failed ? 1 : 0);
