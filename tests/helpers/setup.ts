import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";
import { __setTestDb, type DB } from "@/lib/db";

// Set environment variables BEFORE any module imports
const testDbPath = path.resolve(process.cwd(), "tests/.tmp/test.db");
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.APP_URL = "http://localhost:3000";
process.env.LOCAL_STORAGE_DIR = "data/test-uploads";

// Inject a Drizzle client backed by the local test SQLite file so app code
// (which calls getDb()) talks to it instead of a Cloudflare D1 binding.
const client = createClient({ url: `file:${testDbPath}` });
__setTestDb(drizzle(client, { schema }) as unknown as DB);
