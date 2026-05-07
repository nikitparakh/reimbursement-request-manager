import { createClient } from "@libsql/client";

/**
 * Deletes every row from every application table on Turso while preserving
 * the schema. Foreign key constraints are temporarily disabled so the order
 * of deletes does not matter.
 *
 * This is intended for non-production demo environments where it's acceptable
 * to start from a clean slate. Do NOT run against a database with real user
 * data without first taking a backup.
 */

const APP_TABLES = [
  // Authentication
  "Account",
  "Session",
  "VerificationToken",
  // Reimbursement workflow children
  "ApprovalAction",
  "LineItemComment",
  "ReceiptLineItem",
  "ReceiptExtraction",
  "ReceiptFile",
  // Notifications and audit
  "AuditLog",
  "Notification",
  // Top-level reimbursement and registration
  "ReimbursementRequest",
  "TeamRegistrationRequest",
  // RBAC and team membership
  "UserScopeRole",
  "TeamMembership",
  // Org graph
  "Team",
  "School",
  "Program",
  "District",
  // Users last
  "User",
] as const;

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const yes = process.argv.includes("--yes") || process.argv.includes("-y");

  console.log(`Target: ${url}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no deletes)" : "LIVE WIPE"}`);

  const client = createClient({ url, authToken });

  if (dryRun) {
    for (const table of APP_TABLES) {
      const { rows } = await client.execute(
        `SELECT count(*) as c FROM "${table}"`,
      );
      console.log(`  ${table}: ${rows[0].c} rows`);
    }
    return;
  }

  if (!yes) {
    console.error(
      "Refusing to run a destructive wipe without --yes. Re-run with --yes to confirm.",
    );
    process.exit(1);
  }

  await client.execute("PRAGMA foreign_keys=OFF");

  for (const table of APP_TABLES) {
    const before = await client.execute(
      `SELECT count(*) as c FROM "${table}"`,
    );
    await client.execute(`DELETE FROM "${table}"`);
    console.log(`  Cleared ${table} (${before.rows[0].c} rows)`);
  }

  await client.execute("PRAGMA foreign_keys=ON");
  console.log("Wipe complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
