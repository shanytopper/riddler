import { eq } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import { bundleObjects } from "./db/schema.ts";

/**
 * Object storage for bundle archives (design.md §11.1). The prototype keeps archives in Postgres
 * (D27: Render's free web service has an ephemeral disk, and this avoids a separate object-storage
 * account); v1 moves them to S3-compatible storage behind a CDN by implementing this same interface.
 * The API serves the archive itself for now — one track of a few megabytes — and returns a download
 * URL so the app never needs to know where the bytes live.
 */
export interface Storage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}

export class PostgresStorage implements Storage {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    await this.db
      .insert(bundleObjects)
      .values({ key, bytes, byteLength: bytes.byteLength, contentType: "application/zip" })
      .onConflictDoUpdate({
        target: bundleObjects.key,
        set: { bytes, byteLength: bytes.byteLength, contentType: "application/zip" },
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
}

/** The storage key for a track version's archive. */
export const bundleKey = (trackId: string, version: number): string => `${trackId}-v${version}.zip`;
