import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
    process.exit(1);
  }

  const migrationName = process.argv[2];
  if (!migrationName) {
    console.error(
      "Usage: tsx scripts/turso-apply-migration.ts <migrationName>",
    );
    process.exit(1);
  }

  const path = resolve(
    process.cwd(),
    "prisma/migrations",
    migrationName,
    "migration.sql",
  );
  const sql = readFileSync(path, "utf8");

  console.log(`Applying ${migrationName} to ${url}`);
  console.log(`SQL length: ${sql.length} chars`);

  const client = createClient({ url, authToken });

  // libsql honors statement boundaries when fed via executeMultiple;
  // PRAGMA + multi-statement migrations work as long as the script is sent
  // in one shot (which mirrors how `turso db shell < migration.sql` runs it).
  await client.executeMultiple(sql);
  console.log("Migration executed");

  // Quick verification: the new tables should now exist.
  const { rows } = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('District','School','Program','UserScopeRole') ORDER BY name",
  );
  const tables = rows.map((r) => String(r.name));
  console.log(`Verified new tables: ${JSON.stringify(tables)}`);

  if (
    !["District", "Program", "School", "UserScopeRole"].every((t) =>
      tables.includes(t),
    )
  ) {
    console.error("Migration verification FAILED — expected tables missing");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
