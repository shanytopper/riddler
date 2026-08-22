// maplibre-gl v6 spawns its web worker at runtime from `./maplibre-gl-worker.mjs`, resolved against
// the main bundle's URL — i.e. /console/assets/maplibre-gl-worker.mjs. Vite bundles maplibre into the
// app chunk but does not emit that separate worker module, so without this the request 404s into the
// SPA fallback (served as text/html) and the map quietly falls back to main-thread rendering. Copy the
// exact worker the installed maplibre ships next to the app bundle so it loads as a module worker.
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "dist", "assets");

// Resolve through maplibre's package (workspace deps hoist to the repo root node_modules).
const maplibreDist = dirname(require.resolve("maplibre-gl/package.json"));
const worker = join(maplibreDist, "dist", "maplibre-gl-worker.mjs");

if (!existsSync(worker)) {
  throw new Error(`maplibre worker not found at ${worker}`);
}
mkdirSync(outDir, { recursive: true });
copyFileSync(worker, join(outDir, "maplibre-gl-worker.mjs"));
const map = `${worker}.map`;
if (existsSync(map)) copyFileSync(map, join(outDir, "maplibre-gl-worker.mjs.map"));
console.log("copied maplibre-gl-worker.mjs into dist/assets");
