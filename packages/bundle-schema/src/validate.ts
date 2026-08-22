import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import type { TrackContent } from "./generated/content.ts";
import type { Tenant } from "./generated/tenant.ts";
import {
  contentInvariants,
  tenantInvariants,
  type ContentContext,
  type InvariantReport,
} from "./invariants.ts";
import { schemaIssues, type Issue, type SchemaKind } from "./schema.ts";

export interface DocumentReport extends InvariantReport {
  /** Schema violations. When non-empty, the invariants were not run. */
  schema: Issue[];
}

export interface FileReport extends DocumentReport {
  file: string;
  kind: SchemaKind;
  /** The parsed document; undefined when the file was not valid JSON. */
  doc: unknown;
}

export interface TreeReport {
  root: string;
  files: FileReport[];
  /** Issues that span files: duplicate track slugs within a tenant, track languages outside the tenant's. */
  cross: InvariantReport;
}

export function hasErrors(report: DocumentReport): boolean {
  return report.schema.length > 0 || report.errors.length > 0;
}

export function validateDocument(
  kind: SchemaKind,
  doc: unknown,
  ctx: ContentContext = {},
): DocumentReport {
  const schema = schemaIssues(kind, doc);
  if (schema.length) return { schema, errors: [], warnings: [] };
  switch (kind) {
    case "content":
      return { schema, ...contentInvariants(doc as TrackContent, ctx) };
    case "tenant":
      return { schema, ...tenantInvariants(doc as Tenant) };
    case "manifest":
      return { schema, errors: [], warnings: [] };
  }
}

export function kindFromFilename(file: string): SchemaKind | undefined {
  switch (basename(file)) {
    case "content.json":
      return "content";
    case "tenant.json":
      return "tenant";
    case "manifest.json":
      return "manifest";
    default:
      return undefined;
  }
}

export function validateFile(
  file: string,
  kind: SchemaKind | undefined = kindFromFilename(file),
): FileReport {
  if (!kind)
    throw new Error(`cannot infer the document kind from "${basename(file)}"; pass it explicitly`);
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      file,
      kind,
      doc: undefined,
      schema: [{ path: "/", message: `invalid JSON: ${message}` }],
      errors: [],
      warnings: [],
    };
  }
  const dir = dirname(file);
  const ctx: ContentContext = {
    mediaBytes: (path) => {
      const full = join(dir, path);
      return existsSync(full) ? statSync(full).size : undefined;
    },
  };
  return { file, kind, doc, ...validateDocument(kind, doc, ctx) };
}

/** Validates every content.json, tenant.json, and manifest.json under `root`, then the cross-file rules. */
export function validateTree(root: string): TreeReport {
  const files = findDocuments(root).map((file) => validateFile(file));
  return { root, files, cross: crossChecks(root, files) };
}

function findDocuments(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist")
      continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findDocuments(full));
    else if (kindFromFilename(entry.name)) found.push(full);
  }
  return found.sort();
}

function crossChecks(root: string, files: FileReport[]): InvariantReport {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const valid = files.filter((f) => f.schema.length === 0);
  for (const tenantFile of valid.filter((f) => f.kind === "tenant")) {
    const tenant = tenantFile.doc as Tenant;
    const tenantDir = dirname(tenantFile.file) + sep;
    const bySlug = new Map<string, string>();
    for (const trackFile of valid.filter(
      (f) => f.kind === "content" && f.file.startsWith(tenantDir),
    )) {
      const content = trackFile.doc as TrackContent;
      const path = relative(root, trackFile.file);
      const previous = bySlug.get(content.slug);
      if (previous)
        errors.push({ path, message: `track slug "${content.slug}" is also used by ${previous}` });
      else bySlug.set(content.slug, path);
      const outside = content.languages.filter((language) => !tenant.languages.includes(language));
      if (outside.length) {
        warnings.push({
          path,
          message: `track language${outside.length > 1 ? "s" : ""} ${outside.join(", ")} not among the tenant's (${tenant.languages.join(", ")})`,
        });
      }
    }
  }
  return { errors, warnings };
}
