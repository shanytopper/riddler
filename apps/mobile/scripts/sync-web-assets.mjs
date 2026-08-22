// Copies MapLibre GL JS's worker (and the shared module it imports) into public/ for the web target.
// MapLibre 6 loads its worker from a URL next to its own module via import.meta.url; under Metro that
// resolves to the entry bundle's folder, so the worker must be served as a static file and its URL
// given to MapLibre with setWorkerUrl() (see src/map/TrackMap.web.tsx). Runs before `expo start`.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const distDir = dirname(require.resolve("maplibre-gl/package.json")).concat("/dist");
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "vendor", "maplibre");
mkdirSync(target, { recursive: true });

// Served as .js so every static server sends a JavaScript MIME type, which module workers require.
const worker = readFileSync(join(distDir, "maplibre-gl-worker.mjs"), "utf8").replaceAll(
  "maplibre-gl-shared.mjs",
  "maplibre-gl-shared.js",
);
writeFileSync(join(target, "maplibre-gl-worker.js"), worker);
copyFileSync(join(distDir, "maplibre-gl-shared.mjs"), join(target, "maplibre-gl-shared.js"));
console.log(`maplibre worker → ${target}`);
