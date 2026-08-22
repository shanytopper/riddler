import type { VenueSummary } from "../delivery/types.ts";
import type { LocalizedString } from "../i18n/strings.ts";
import { db } from "./index.ts";

/** Small key/value settings that outlive a launch (design.md §8): the UI language override. */
export function getSetting(key: string): string | null {
  return (
    db?.getFirstSync<{ value: string }>("SELECT value FROM settings WHERE key = ?", key)?.value ??
    null
  );
}

export function setSetting(key: string, value: string): void {
  db?.runSync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value);
}

interface RawVenueRow {
  tenant_id: string;
  slug: string;
  display_name: string;
  cover_url: string | null;
}

const MAX_RECENT = 5;

export function rememberVenue(venue: VenueSummary, at: string): void {
  db?.runSync(
    `INSERT OR REPLACE INTO recent_venues (tenant_id, slug, display_name, cover_url, last_opened_at)
     VALUES (?, ?, ?, ?, ?)`,
    venue.tenantId,
    venue.slug,
    JSON.stringify(venue.displayName),
    venue.coverUrl,
    at,
  );
  // Keep only the most recent few, so the list never grows without bound.
  db?.runSync(
    `DELETE FROM recent_venues WHERE tenant_id NOT IN (
       SELECT tenant_id FROM recent_venues ORDER BY last_opened_at DESC LIMIT ?
     )`,
    MAX_RECENT,
  );
}

export function listRecentVenues(): VenueSummary[] {
  const rows =
    db?.getAllSync<RawVenueRow>(
      "SELECT tenant_id, slug, display_name, cover_url FROM recent_venues ORDER BY last_opened_at DESC",
    ) ?? [];
  return rows.map((row) => ({
    tenantId: row.tenant_id,
    slug: row.slug,
    displayName: JSON.parse(row.display_name) as LocalizedString,
    coverUrl: row.cover_url,
  }));
}
