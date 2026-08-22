# @riddles/bundle-builder

Turns an authored track into a publishable bundle (design.md §6.4, §8). In the prototype it runs as a command over the JSON in `content/`; in v1 the console runs it as a server job on publish.

```bash
npm run bundle -w @riddles/bundle-builder -- build content/ein-dror/tracks/spring-trail/content.json \
  --out apps/mobile/public/bundles --tenant 7c1f0d2e-5a3b-4c8d-9e1f-2a3b4c5d6e7f --version 1
```

What `build` does, in order:

1. **Validates** with `@riddles/bundle-schema` — schema and every builder invariant. Errors stop the build; warnings are printed.
2. **Snapshots** the content: `authoringNotes` is removed; every `qr` station without a token gets one, and the token is **written back into the authored file** so printed QR codes stay valid across versions.
3. **Media**: each image is resized to at most 1600 px on the long edge (4096 px for custom map images), keeps its format if it is JPEG, PNG, or WebP, is stored as `media/<id>.<ext>`, and the snapshot's paths are rewritten.
4. **Maps**: for each tiles leg, `pmtiles extract` cuts the leg's bounds (zoom 0–15) from the public Protomaps build; the first leg's extract ships in the archive, later legs' are written next to it for on-demand download. Image legs copy their map image to `maps/<legId>.<ext>`. Glyph ranges for the track's languages and both sprite flavors are fetched once. Everything is cached under `--cache` (default `<out>/.cache`).
5. **Manifest and archive**: sizes and SHA-256 of every file, validated against the manifest schema, then `<trackId>-v<n>.zip` plus a sidecar `<trackId>-v<n>.manifest.json` for the delivery API to serve before download. Already-compressed files (tiles, images) are stored, text is deflated.

`map-assets` writes only the map data in bundle layout (`maps/`, `fonts/`, `sprites/`) into a directory — the form the prototype's dev server serves to the app:

```bash
npm run extract-map      # = riddles-bundle map-assets … --out apps/mobile/public/maps
```

Needs the go-pmtiles CLI for tiles (on `PATH`, via `PMTILES_BIN`, `--pmtiles`, or where the setup installed it under `%LOCALAPPDATA%\Programs\pmtiles`). Tests use `--skip-map-data` and never touch the network.
