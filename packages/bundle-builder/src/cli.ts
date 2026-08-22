#!/usr/bin/env node
import { parseArgs } from "node:util";
import { buildBundle } from "./build.ts";
import { writeMapAssetsDir } from "./map-assets-dir.ts";

const USAGE = `Usage:
  riddles-bundle build <content.json> --out <dir> --tenant <tenantId> --version <n> [--build YYYYMMDD] [--pmtiles <bin>] [--cache <dir>] [--skip-map-data]
  riddles-bundle map-assets <content.json> --out <dir> [--build YYYYMMDD] [--pmtiles <bin>] [--cache <dir>]

build       validates the track and writes <trackId>-v<n>.zip plus its manifest into --out
map-assets  writes the offline map data (maps/, fonts/, sprites/) into a directory for the dev server`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string" },
    tenant: { type: "string" },
    version: { type: "string" },
    build: { type: "string" },
    pmtiles: { type: "string" },
    cache: { type: "string" },
    "skip-map-data": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const [command, contentPath] = positionals;
if (values.help || !command || !contentPath || !values.out) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 2);
}

const todayUtc = (): string => new Date().toISOString().slice(0, 10).replace(/-/g, "");
const mb = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(2);

try {
  if (command === "build") {
    if (!values.tenant || !values.version) {
      console.error("build needs --tenant and --version");
      process.exit(2);
    }
    const result = await buildBundle({
      contentPath,
      outDir: values.out,
      tenantId: values.tenant,
      trackVersion: Number(values.version),
      build: values.build,
      pmtilesBin: values.pmtiles,
      cacheDir: values.cache,
      skipMapData: values["skip-map-data"],
    });
    for (const warning of result.warnings)
      console.log(`warning  ${warning.path}  ${warning.message}`);
    for (const entry of result.entries.sort((a, b) => b.bytes - a.bytes).slice(0, 8)) {
      console.log(`  ${mb(entry.bytes).padStart(7)} MB  ${entry.path}`);
    }
    console.log(
      `${result.entries.length} files, ${mb(result.manifest.totalBytes)} MB → ${result.zipPath}`,
    );
    console.log(`manifest → ${result.manifestPath}`);
  } else if (command === "map-assets") {
    const result = await writeMapAssetsDir({
      contentPath,
      outDir: values.out,
      build: values.build ?? todayUtc(),
      pmtilesBin: values.pmtiles,
      cacheDir: values.cache,
    });
    console.log(
      `tiles ${mb(result.tilesBytes)} MB, fonts and sprites ${mb(result.assetBytes)} MB, ${result.files.length} files → ${values.out}`,
    );
  } else {
    console.log(USAGE);
    process.exit(2);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
