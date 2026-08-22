# apps

Created in their own steps of the order of work ([docs/design.md §12.1](../docs/design.md)):

- `mobile/` — the player app, React Native with Expo. Step 3 (app shell and venue home).
- `api/` — delivery and ingestion APIs, TypeScript on PostgreSQL. Step 7.
- `console/` — the operator console, Next.js. Not part of the prototype.

Each is an npm workspace; the root `package.json` already includes `apps/*`.
