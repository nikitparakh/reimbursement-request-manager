import { execSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import path from "node:path";

const testDbPath = path.resolve(process.cwd(), "prisma/test.db");

export function setup() {
  // Remove stale test.db if it exists
  try {
    unlinkSync(testDbPath);
  } catch {
    // File doesn't exist — that's fine
  }
  try {
    unlinkSync(testDbPath + "-journal");
  } catch {
    // No journal — fine
  }

  // Push the schema to a fresh test database
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: {
      ...process.env,
      DATABASE_URL: `file:${testDbPath}`,
    },
    stdio: "pipe",
  });
}

export function teardown() {
  try {
    unlinkSync(testDbPath);
  } catch {
    // Already gone
  }
  try {
    unlinkSync(testDbPath + "-journal");
  } catch {
    // No journal
  }
}
