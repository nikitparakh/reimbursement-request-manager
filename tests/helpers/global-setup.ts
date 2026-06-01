import { createClient } from "@libsql/client";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const tmpDir = path.resolve(process.cwd(), "tests/.tmp");
const testDbPath = path.join(tmpDir, "test.db");
const migrationPath = path.resolve(process.cwd(), "drizzle/0000_init.sql");

export async function setup() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  // Apply the generated Drizzle migration to a fresh local SQLite file.
  const sql = readFileSync(migrationPath, "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  const client = createClient({ url: `file:${testDbPath}` });
  for (const statement of statements) {
    await client.execute(statement);
  }
  client.close();
}

export async function teardown() {
  rmSync(tmpDir, { recursive: true, force: true });
}
