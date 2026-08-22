// Regenerates src/generated/*.ts from schemas/*.schema.json. Run with `npm run generate-types`.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { compile } from "json-schema-to-typescript";

const targets = [
  { kind: "content", title: "TrackContent" },
  { kind: "manifest", title: "BundleManifest" },
  { kind: "tenant", title: "Tenant" },
] as const;

const outDir = new URL("../src/generated/", import.meta.url);
await mkdir(outDir, { recursive: true });

for (const { kind, title } of targets) {
  const schemaUrl = new URL(`../schemas/${kind}.schema.json`, import.meta.url);
  const schema = JSON.parse(await readFile(schemaUrl, "utf8")) as Record<string, unknown>;
  const source = await compile({ ...schema, title }, title, {
    bannerComment: `/* Generated from schemas/${kind}.schema.json by scripts/generate-types.ts. Do not edit. */`,
    additionalProperties: false,
    strictIndexSignatures: true,
    style: { printWidth: 100, trailingComma: "all" },
  });
  await writeFile(new URL(`${kind}.ts`, outDir), source);
  console.log(`generated src/generated/${kind}.ts`);
}
