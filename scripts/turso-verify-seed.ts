import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
    process.exit(1);
  }

  const client = createClient({ url, authToken });

  const counts: Record<string, number> = {};
  for (const table of [
    "District",
    "School",
    "Program",
    "Team",
    "User",
    "UserScopeRole",
    "TeamMembership",
    "ReimbursementRequest",
    "TeamRegistrationRequest",
  ]) {
    const { rows } = await client.execute(`SELECT count(*) as c FROM "${table}"`);
    counts[table] = Number(rows[0].c);
  }
  console.log(JSON.stringify({ counts }, null, 2));

  const users = await client.execute(
    `SELECT email, role, name FROM "User" ORDER BY email`,
  );
  console.log(JSON.stringify({ users: users.rows }, null, 2));

  const scopes = await client.execute(`
    SELECT u.email, s.role, d.name as district, sc.name as school, p.code as program
    FROM "UserScopeRole" s
    JOIN "User" u ON u.id = s.userId
    LEFT JOIN "District" d ON d.id = s.districtId
    LEFT JOIN "School" sc ON sc.id = s.schoolId
    LEFT JOIN "Program" p ON p.id = s.programId
    ORDER BY u.email, s.role
  `);
  console.log(JSON.stringify({ scopedRoles: scopes.rows }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
