import { mkdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import pg from "pg";
import * as schema from "./schema.ts";

/**
 * The database handle. Production sets DATABASE_URL and gets managed Postgres (node-postgres, D27);
 * local development and tests get an embedded Postgres (PGlite) that needs no server, so the exact
 * same schema and queries run everywhere. Both are Postgres, so nothing is driver-specific.
 */
export type Db = PgliteDatabase<typeof schema>;

export interface Database {
  db: Db;
  close: () => Promise<void>;
}

const SCHEMA_SQL = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

/**
 * TLS for managed Postgres. Hosted databases (Render, Neon) require TLS on external connections and
 * present certificates from public CAs, so verification stays on; a URL that sets its own sslmode
 * keeps it; a local server gets no TLS. Set PGSSL_NO_VERIFY=1 only for a self-signed development DB.
 */
function sslFor(url: string): { ssl?: boolean | { rejectUnauthorized: boolean } } {
  const parsed = new URL(url);
  if (parsed.searchParams.has("sslmode") || parsed.searchParams.has("ssl")) return {};
  const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  // Render's internal connection strings use a bare private hostname (no dots) that reaches the
  // database over the private network without TLS.
  const privateNetwork = !parsed.hostname.includes(".");
  if (local || privateNetwork) return {};
  return { ssl: { rejectUnauthorized: process.env.PGSSL_NO_VERIFY !== "1" } };
}

export async function createDatabase(options?: {
  url?: string;
  dataDir?: string;
}): Promise<Database> {
  const url = options?.url ?? process.env.DATABASE_URL;
  if (url) {
    const pool = new pg.Pool({ connectionString: url, ...sslFor(url) });
    // A pooled connection the server drops while idle emits "error" on the pool; with no listener
    // Node would turn that into an uncaught exception and kill the process. Log it and carry on —
    // the pool discards the dead client and opens a fresh one on the next query.
    pool.on("error", (error) => {
      console.error("[db] idle connection error:", error.message);
    });
    await pool.query(SCHEMA_SQL);
    return {
      db: drizzleNode(pool, { schema }) as unknown as Db,
      close: () => pool.end(),
    };
  }
  if (options?.dataDir) mkdirSync(options.dataDir, { recursive: true });
  const client = new PGlite(options?.dataDir);
  await client.exec(SCHEMA_SQL);
  return {
    db: drizzlePglite(client, { schema }),
    close: () => client.close(),
  };
}
