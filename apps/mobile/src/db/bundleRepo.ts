import { db } from "./index.ts";

/** A downloaded bundle, as the storage screen lists it. */
export interface BundleRow {
  trackId: string;
  version: number;
  schemaVersion: number;
  trackName: string;
  totalBytes: number;
  dirUri: string;
  installedAt: string;
}

interface RawBundleRow {
  track_id: string;
  version: number;
  schema_version: number;
  track_name: string;
  total_bytes: number;
  dir_uri: string;
  installed_at: string;
}

/** Records a bundle, keeping the original install time if a record already exists (idempotent). */
export function recordBundle(row: BundleRow): void {
  db?.runSync(
    `INSERT INTO bundles
       (track_id, version, schema_version, track_name, total_bytes, dir_uri, installed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(track_id, version) DO UPDATE SET
       schema_version = excluded.schema_version,
       track_name = excluded.track_name,
       total_bytes = excluded.total_bytes,
       dir_uri = excluded.dir_uri`,
    row.trackId,
    row.version,
    row.schemaVersion,
    row.trackName,
    row.totalBytes,
    row.dirUri,
    row.installedAt,
  );
}

export function listBundles(): BundleRow[] {
  const rows =
    db?.getAllSync<RawBundleRow>("SELECT * FROM bundles ORDER BY installed_at DESC") ?? [];
  return rows.map(toBundleRow);
}

export function forgetBundle(trackId: string, version: number): void {
  db?.runSync("DELETE FROM bundles WHERE track_id = ? AND version = ?", trackId, version);
}

function toBundleRow(row: RawBundleRow): BundleRow {
  return {
    trackId: row.track_id,
    version: row.version,
    schemaVersion: row.schema_version,
    trackName: row.track_name,
    totalBytes: row.total_bytes,
    dirUri: row.dir_uri,
    installedAt: row.installed_at,
  };
}
