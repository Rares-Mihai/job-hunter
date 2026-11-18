import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

// Reuse one pool across hot reloads in development; otherwise every file
// save would open new connections until Postgres runs out.
const globalForDb = globalThis as unknown as { __jobHunterDb?: Db };

/**
 * The database handle. Created on first use so that importing this file
 * (for example during `next build`) never needs a database.
 */
export function getDb(): Db {
  if (globalForDb.__jobHunterDb) return globalForDb.__jobHunterDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and point it at your Postgres database.",
    );
  }

  const pool = new Pool({ connectionString, max: 5 });
  const db = drizzle(pool, { schema });
  globalForDb.__jobHunterDb = db;
  return db;
}
