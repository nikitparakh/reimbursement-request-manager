import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  new URL("../../prisma/migrations/20260406005056_add_multi_tenant_rbac/migration.sql", import.meta.url),
  "utf8"
);

const legacySchemaSql = `
CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT,
  "emailVerified" DATETIME,
  "image" TEXT,
  "role" TEXT NOT NULL DEFAULT 'STUDENT',
  "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Team" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "shortCode" TEXT UNIQUE,
  "glAccount" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "TeamMembership" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "roleInTeam" TEXT NOT NULL,
  "approved" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "TeamRegistrationRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "teamName" TEXT NOT NULL,
  "shortCode" TEXT,
  "glAccount" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" DATETIME,
  "rejectionReason" TEXT,
  "approvedTeamId" TEXT UNIQUE,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ReimbursementRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "requestedTotal" DECIMAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "submittedAt" DATETIME,
  "teamId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "managerId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
`;

const legacySeedSql = `
INSERT INTO "User" ("id", "name", "email", "role", "onboardingDone", "updatedAt")
VALUES
  ('legacy-admin', 'Legacy Admin', 'admin@test.com', 'ADMIN', true, CURRENT_TIMESTAMP),
  ('legacy-coach', 'Legacy Coach', 'coach@test.com', 'COACH', true, CURRENT_TIMESTAMP),
  ('legacy-parent', 'Legacy Parent', 'parent@test.com', 'STUDENT', true, CURRENT_TIMESTAMP);

INSERT INTO "Team" ("id", "name", "shortCode", "glAccount", "active", "updatedAt")
VALUES ('legacy-team', 'Legacy Team', 'LT1', '61-100-1000', true, CURRENT_TIMESTAMP);

INSERT INTO "TeamMembership" ("id", "userId", "teamId", "roleInTeam", "approved", "updatedAt")
VALUES
  ('membership-coach', 'legacy-coach', 'legacy-team', 'COACH', true, CURRENT_TIMESTAMP),
  ('membership-parent', 'legacy-parent', 'legacy-team', 'STUDENT', true, CURRENT_TIMESTAMP);

INSERT INTO "TeamRegistrationRequest" (
  "id", "teamName", "shortCode", "glAccount", "status", "requestedById", "updatedAt"
)
VALUES (
  'legacy-registration', 'Legacy Pending Team', 'LPT', '61-200-2000', 'PENDING', 'legacy-parent', CURRENT_TIMESTAMP
);

INSERT INTO "ReimbursementRequest" (
  "id", "title", "requestedTotal", "status", "teamId", "createdById", "managerId", "updatedAt"
)
VALUES (
  'legacy-request', 'Legacy Request', 42.50, 'SUBMITTED', 'legacy-team', 'legacy-parent', 'legacy-coach', CURRENT_TIMESTAMP
);
`;

const tempDirectories: string[] = [];

function openLegacyDatabase() {
  const tempDirectory = mkdtempSync(join(tmpdir(), "veltest-migration-"));
  tempDirectories.push(tempDirectory);
  const databasePath = join(tempDirectory, "legacy.db");
  const db = new DatabaseSync(databasePath);

  db.exec(legacySchemaSql);
  db.exec(legacySeedSql);

  return db;
}

afterEach(() => {
  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe("multi-tenant RBAC migration", () => {
  it("maps legacy single-tenant data into the new role and tenant model", () => {
    const db = openLegacyDatabase();

    db.exec(migrationSql);

    expect(
      db
        .prepare(`SELECT "role" FROM "User" WHERE "id" = 'legacy-admin'`)
        .get() as { role: string }
    ).toEqual({ role: "SUPER_ADMIN" });
    expect(
      db
        .prepare(`SELECT "role" FROM "User" WHERE "id" = 'legacy-coach'`)
        .get() as { role: string }
    ).toEqual({ role: "USER" });
    expect(
      db
        .prepare(`SELECT "role" FROM "User" WHERE "id" = 'legacy-parent'`)
        .get() as { role: string }
    ).toEqual({ role: "USER" });

    expect(
      db
        .prepare(`SELECT "roleInTeam" FROM "TeamMembership" WHERE "id" = 'membership-parent'`)
        .get() as { roleInTeam: string }
    ).toEqual({ roleInTeam: "PARENT_MENTOR" });

    expect(
      db
        .prepare(`SELECT "schoolId", "programId" FROM "Team" WHERE "id" = 'legacy-team'`)
        .get() as { schoolId: string; programId: string }
    ).toEqual({
      schoolId: "legacy-school",
      programId: "legacy-program",
    });

    expect(
      db
        .prepare(`SELECT "districtId", "schoolId", "programId" FROM "TeamRegistrationRequest" WHERE "id" = 'legacy-registration'`)
        .get() as { districtId: string; schoolId: string; programId: string }
    ).toEqual({
      districtId: "legacy-district",
      schoolId: "legacy-school",
      programId: "legacy-program",
    });

    expect(
      db
        .prepare(`SELECT "code", "active" FROM "Program" WHERE "id" = 'legacy-program'`)
        .get() as { code: string; active: number }
    ).toEqual({ code: "LEGACY", active: 0 });

    expect(
      db
        .prepare(`SELECT "coachId" FROM "ReimbursementRequest" WHERE "id" = 'legacy-request'`)
        .get() as { coachId: string }
    ).toEqual({ coachId: "legacy-coach" });

    expect(
      db
        .prepare(`SELECT COUNT(*) AS "count" FROM "UserScopeRole"`)
        .get() as { count: number }
    ).toEqual({ count: 0 });
  });
});
