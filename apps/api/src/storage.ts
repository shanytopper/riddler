import { eq, like } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import { bundleObjects } from "./db/schema.ts";

/**
 * Object storage for bundle archives and the map-artifact cache (design.md §11.1). The prototype
 * keeps everything in Postgres (D27: Render's free web service has an ephemeral disk, and this
 * avoids a separate object-storage account); v1 moves to S3-compatible storage behind a CDN by
 * implementing this same interface. The API serves archives itself for now — one track of a few
 * megabytes — and returns a download URL so the app never needs to know where the bytes live.
 */
export interface Storage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  /** Keys starting with the prefix (e.g. "cache/"). */
  list(prefix: string): Promise<string[]>;
}

export class PostgresStorage implements Storage {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const contentType = key.endsWith(".zip") ? "application/zip" : "application/octet-stream";
    await this.db
      .insert(bundleObjects)
      .values({ key, bytes, byteLength: bytes.byteLength, contentType })
      .onConflictDoUpdate({
        target: bundleObjects.key,
        set: { bytes, byteLength: bytes.byteLength, contentType },
      });
  }

  async get(key: string): Promise<Uint8Array | null> {
    const row = (
      await this.db
        .select({ bytes: bundleObjects.bytes })
        .from(bundleObjects)
        .where(eq(bundleObjects.key, key))
        .limit(1)
    )[0];
    return row?.bytes ?? null;
  }

  async list(prefix: string): Promise<string[]> {
    const rows = await this.db
      .select({ key: bundleObjects.key })
      .from(bundleObjects)
      .where(like(bundleObjects.key, `${prefix.replace(/[%_]/g, "\\$&")}%`));
    return rows.map((row) => row.key);
  }
}

/** The storage key for a track version's archive. */
export const bundleKey = (trackId: string, version: number): string => `${trackId}-v${version}.zip`;
