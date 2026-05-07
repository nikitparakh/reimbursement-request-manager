// One-shot script: inspect the Turso DB schema state without modifying anything.
// Usage: node scripts/turso-inspect.mjs (env vars: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

const tablesRes = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
);
const tables = tablesRes.rows.map((row) => row.name);
console.log("Tables:", tables.join(", ") || "(none)");

const newSchemaTables = ["District", "Program", "School", "UserScopeRole"];
const present = newSchemaTables.filter((name) => tables.includes(name));
const missing = newSchemaTables.filter((name) => !tables.includes(name));

console.log("\nMulti-tenant tables present:", present.join(", ") || "(none)");
console.log("Multi-tenant tables missing:", missing.join(", ") || "(none)");

if (tables.includes("_prisma_migrations")) {
  const migRes = await client.execute(
    "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at",
  );
  console.log("\nPrisma migrations recorded on Turso:");
  for (const row of migRes.rows) {
    console.log(
      `  ${row.finished_at ? "DONE" : "PENDING"}  ${row.migration_name}`,
    );
  }
} else {
  console.log("\n_prisma_migrations table not present.");
}

if (tables.includes("Team")) {
  const teamSchemaRes = await client.execute(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='Team'",
  );
  console.log("\nTeam table DDL:");
  console.log(teamSchemaRes.rows[0]?.sql ?? "(not found)");
}

if (tables.includes("User")) {
  const countRes = await client.execute("SELECT COUNT(*) as n FROM User");
  console.log(`\nUser row count: ${countRes.rows[0]?.n}`);
}

for (const t of [
  "User",
  "ReimbursementRequest",
  "TeamMembership",
  "TeamRegistrationRequest",
]) {
  if (tables.includes(t)) {
    const ddl = await client.execute(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='${t}'`,
    );
    console.log(`\n${t} DDL:\n${ddl.rows[0]?.sql ?? "(missing)"}`);
  }
}

// Row counts that matter for the migration's data-copy steps
for (const t of [
  "User",
  "Team",
  "TeamMembership",
  "TeamRegistrationRequest",
  "ReimbursementRequest",
  "ReceiptFile",
  "ApprovalAction",
  "Notification",
]) {
  if (tables.includes(t)) {
    const r = await client.execute(`SELECT COUNT(*) as n FROM "${t}"`);
    console.log(`Row count ${t}: ${r.rows[0]?.n}`);
  }
}
