import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@/db/schema";

export type DB = DrizzleD1Database<typeof schema>;

/**
 * D1 is a per-request binding — there is no module-global database handle on
 * Workers. `getDb()` resolves the current request's binding each call.
 */
let testDb: DB | undefined;

/** Test-only hook: inject a Drizzle client backed by a local SQLite file. */
export function __setTestDb(db: DB | undefined) {
  testDb = db;
}

export function getDb(): DB {
  if (testDb) return testDb;
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

/**
 * Backwards-compatible `db` handle. It's a Proxy that forwards every access to
 * the current request's Drizzle client, so existing `import { db }` call sites
 * keep working while remaining request-scoped (never a shared singleton).
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
