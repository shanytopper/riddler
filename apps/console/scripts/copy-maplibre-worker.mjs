// maplibre-gl v6 spawns its web worker at runtime from `./maplibre-gl-worker.mjs`, resolved against
// the main bundle's URL — i.e. /console/assets/maplibre-gl-worker.mjs — and that worker in turn
// imports its sibling chunk `./maplibre-gl-shared.mjs`. Vite bundles maplibre into the app chunk but
// does not emit either of these separate runtime modules, so without them the requests 404 into the
// SPA fallback (served as text/html), the module worker fails to load, and the map falls back to
// main-thread rendering. Copy both files, unhashed, next to the app bundle so the worker loads.
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "dist", "assets");

// Resolve through maplibre's package (workspace deps hoist to the repo root node_modules).
const maplibreDist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");

// The worker and the shared chunk it imports; the worker's import target is the literal, unhashed
// name, so copy them verbatim. (`maplibre-gl-shared.mjs` is self-contained — no further siblings.)
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

mkdirSync(outDir, { recursive: true });
for (const name of files) {
  const src = join(maplibreDist, name);
  if (!existsSync(src)) throw new Error(`maplibre runtime file not found: ${src}`);
  copyFileSync(src, join(outDir, name));
  if (existsSync(`${src}.map`)) copyFileSync(`${src}.map`, join(outDir, `${name}.map`));
}
console.log(`copied ${files.join(", ")} into dist/assets`);
