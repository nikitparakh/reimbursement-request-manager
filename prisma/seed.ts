import { createClient } from "@libsql/client";
import { inArray } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import {
  approvalActions,
  auditLogs,
  districts,
  notifications,
  programs,
  receiptExtractions,
  receiptFiles,
  receiptLineItems,
  reimbursementRequests,
  schools,
  teamMemberships,
  teamRegistrationRequests,
  teams,
  userScopeRoles,
  users,
  type FllDivision,
  type GlobalRole,
  type ProgramRow,
  type SchoolRow,
  type TeamRow,
  type UserRow,
} from "@/db/schema";
import * as schema from "@/db/schema";
import { CURRENT_POLICY_VERSION } from "../src/lib/policy";
import { buildUserScopeRoleKey } from "../src/lib/user-scope-role";
import { cleanupLegacyTeamScopedRoles } from "./seed-cleanup";

type DB = LibSQLDatabase<typeof schema>;

const PROGRAM_SEEDS = [
  {
    code: "FLL",
    name: "FIRST LEGO League",
    description: "Grades K-8 robotics program with Discover, Explore, and Challenge divisions.",
    gradeRangeLabel: "Grades K-8",
    ageRangeLabel: "Ages 5-16",
  },
  {
    code: "FTC",
    name: "FIRST Tech Challenge",
    description: "Grades 7-12 robotics program with classroom-scale robot competitions.",
    gradeRangeLabel: "Grades 7-12",
    ageRangeLabel: "Ages 12-18",
  },
  {
    code: "FRC",
    name: "FIRST Robotics Competition",
    description: "Grades 9-12 robotics program with industrial-sized robots.",
    gradeRangeLabel: "Grades 9-12",
    ageRangeLabel: "Ages 14-18",
  },
] as const;

type ProgramCode = (typeof PROGRAM_SEEDS)[number]["code"];
const VERIFIED_NOVI_DISTRICT = {
  name: "Novi Community School District",
  slug: "novi-community-school-district",
} as const;

const VERIFIED_NOVI_SCHOOLS = [
  {
    name: "Novi High School",
    slug: "novi-high-school",
  },
  {
    name: "Novi Middle School",
    slug: "novi-middle-school",
  },
  {
    name: "Novi Meadows Elementary School",
    slug: "novi-meadows-elementary-school",
  },
  {
    name: "Parkview Elementary School",
    slug: "parkview-elementary-school",
  },
] as const;

type VerifiedNoviTeam = {
  name: string;
  shortCode: string;
  schoolSlug: (typeof VERIFIED_NOVI_SCHOOLS)[number]["slug"];
  programCode: ProgramCode;
  fllDivision?: FllDivision;
};

const VERIFIED_NOVI_TEAMS: readonly VerifiedNoviTeam[] = [
  {
    name: "Frog Force 503",
    shortCode: "503",
    schoolSlug: "novi-high-school",
    programCode: "FRC",
  },
  {
    name: "Robo Rhinos",
    shortCode: "11254",
    schoolSlug: "novi-middle-school",
    programCode: "FTC",
  },
  {
    name: "Frog Tech",
    shortCode: "45080",
    schoolSlug: "novi-meadows-elementary-school",
    programCode: "FLL",
    fllDivision: "CHALLENGE",
  },
  {
    name: "Galaxy Frogs",
    shortCode: "45081",
    schoolSlug: "parkview-elementary-school",
    programCode: "FLL",
    fllDivision: "CHALLENGE",
  },
  {
    name: "LEGO RYDERS",
    shortCode: "19397",
    schoolSlug: "parkview-elementary-school",
    programCode: "FLL",
    fllDivision: "EXPLORE",
  },
  {
    name: "Whale Titans",
    shortCode: "19399",
    schoolSlug: "parkview-elementary-school",
    programCode: "FLL",
    fllDivision: "EXPLORE",
  },
] as const;

type DemoUserAccount = {
  key: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
};

const DEMO_USER_ACCOUNTS: readonly DemoUserAccount[] = [
  {
    key: "super-admin",
    email: "admin@school.org",
    name: "District Super Admin",
    globalRole: "SUPER_ADMIN",
  },
  {
    key: "school-admin",
    email: "schooladmin@school.org",
    name: "Novi School Admin",
    globalRole: "USER",
  },
  {
    key: "program-admin",
    email: "programadmin@school.org",
    name: "Novi FLL Program Admin",
    globalRole: "USER",
  },
  {
    key: "coach",
    email: "coach@team.org",
    name: "Frog Force Coach",
    globalRole: "USER",
  },
  {
    key: "parent-mentor",
    email: "user@team.org",
    name: "Frog Force Parent Mentor",
    globalRole: "USER",
  },
] as const;

const SAMPLE_WORKFLOW_TEAM_SHORT_CODE = "503";
type DemoUserKey = (typeof DEMO_USER_ACCOUNTS)[number]["key"];
type SchoolSlug = (typeof VERIFIED_NOVI_SCHOOLS)[number]["slug"];
type TeamShortCode = (typeof VERIFIED_NOVI_TEAMS)[number]["shortCode"];

function createSeedClient() {
  const client = process.env.TURSO_DATABASE_URL
    ? createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      })
    : createClient({
        url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
      });

  const db: DB = drizzle(client, { schema });
  return { db, client };
}

function getRequired<K, V>(map: Map<K, V>, key: K, label: string) {
  const value = map.get(key);

  if (!value) {
    throw new Error(`Missing ${label}`);
  }

  return value;
}

async function ensurePrograms(db: DB) {
  const seeded = await Promise.all(
    PROGRAM_SEEDS.map(async (program) => {
      const [row] = await db
        .insert(programs)
        .values({
          code: program.code,
          name: program.name,
          description: program.description,
          gradeRangeLabel: program.gradeRangeLabel,
          ageRangeLabel: program.ageRangeLabel,
          active: true,
        })
        .onConflictDoUpdate({
          target: programs.code,
          set: {
            name: program.name,
            description: program.description,
            gradeRangeLabel: program.gradeRangeLabel,
            ageRangeLabel: program.ageRangeLabel,
            active: true,
          },
        })
        .returning();
      return row;
    })
  );

  return new Map(seeded.map((program) => [program.code, program])) as Map<
    ProgramCode,
    ProgramRow
  >;
}

async function ensureDistrictAndSchools(db: DB) {
  const [district] = await db
    .insert(districts)
    .values({
      name: VERIFIED_NOVI_DISTRICT.name,
      slug: VERIFIED_NOVI_DISTRICT.slug,
      active: true,
    })
    .onConflictDoUpdate({
      target: districts.slug,
      set: { name: VERIFIED_NOVI_DISTRICT.name, active: true },
    })
    .returning();

  const seededSchools = await Promise.all(
    VERIFIED_NOVI_SCHOOLS.map(async (school) => {
      const [row] = await db
        .insert(schools)
        .values({
          districtId: district.id,
          name: school.name,
          slug: school.slug,
          active: true,
        })
        .onConflictDoUpdate({
          target: [schools.districtId, schools.slug],
          set: {
            name: school.name,
            active: true,
          },
        })
        .returning();
      return row;
    })
  );

  return {
    district,
    schoolsBySlug: new Map(
      seededSchools.map((school) => [school.slug, school])
    ) as Map<SchoolSlug, SchoolRow>,
  };
}

async function ensureDemoUsers(db: DB) {
  const seeded = await Promise.all(
    DEMO_USER_ACCOUNTS.map(async (account) => {
      const policyAcceptedAt = new Date();

      const [user] = await db
        .insert(users)
        .values({
          email: account.email,
          name: account.name,
          role: account.globalRole,
          onboardingDone: true,
          policyAcceptedAt,
          policyVersion: CURRENT_POLICY_VERSION,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            name: account.name,
            role: account.globalRole,
            onboardingDone: true,
            policyAcceptedAt,
            policyVersion: CURRENT_POLICY_VERSION,
          },
        })
        .returning();

      return [account.key, user] as const;
    })
  );

  return new Map(seeded) as Map<DemoUserKey, UserRow>;
}

async function resetSeedOwnedData(
  db: DB,
  demoUsersByKey: Map<DemoUserKey, UserRow>
) {
  const demoUserIds = Array.from(demoUsersByKey.values()).map((user) => user.id);

  await db
    .delete(notifications)
    .where(inArray(notifications.userId, demoUserIds));

  await db.delete(auditLogs).where(inArray(auditLogs.actorId, demoUserIds));

  await db
    .delete(teamRegistrationRequests)
    .where(inArray(teamRegistrationRequests.requestedById, demoUserIds));

  await db
    .delete(reimbursementRequests)
    .where(inArray(reimbursementRequests.createdById, demoUserIds));

  await db
    .delete(teamMemberships)
    .where(inArray(teamMemberships.userId, demoUserIds));

  await db
    .delete(userScopeRoles)
    .where(inArray(userScopeRoles.userId, demoUserIds));
}

async function createVerifiedTeams(
  db: DB,
  schoolsBySlug: Map<SchoolSlug, SchoolRow>,
  programsByCode: Map<ProgramCode, ProgramRow>
) {
  const seeded = await Promise.all(
    VERIFIED_NOVI_TEAMS.map(async (team) => {
      const schoolId = getRequired(
        schoolsBySlug,
        team.schoolSlug,
        `school ${team.schoolSlug}`
      ).id;
      const programId = getRequired(
        programsByCode,
        team.programCode,
        `program ${team.programCode}`
      ).id;

      const [row] = await db
        .insert(teams)
        .values({
          schoolId,
          programId,
          name: team.name,
          shortCode: team.shortCode,
          fllDivision: team.fllDivision,
          active: true,
        })
        .onConflictDoUpdate({
          target: [teams.schoolId, teams.programId, teams.name],
          set: {
            shortCode: team.shortCode,
            fllDivision: team.fllDivision ?? null,
            active: true,
          },
        })
        .returning();
      return row;
    })
  );

  return new Map(seeded.map((team) => [team.shortCode, team])) as Map<
    TeamShortCode,
    TeamRow
  >;
}

async function seedAccessAndMemberships(
  db: DB,
  districtId: string,
  schoolsBySlug: Map<SchoolSlug, SchoolRow>,
  programsByCode: Map<ProgramCode, ProgramRow>,
  teamsByShortCode: Map<TeamShortCode, TeamRow>,
  demoUsersByKey: Map<DemoUserKey, UserRow>
) {
  const schoolAdmin = getRequired(demoUsersByKey, "school-admin", "school admin user");
  const programAdmin = getRequired(demoUsersByKey, "program-admin", "program admin user");
  const coach = getRequired(demoUsersByKey, "coach", "coach user");
  const parentMentor = getRequired(demoUsersByKey, "parent-mentor", "parent mentor user");
  const workflowTeam = getRequired(teamsByShortCode, SAMPLE_WORKFLOW_TEAM_SHORT_CODE, "workflow team");
  const fllProgram = getRequired(programsByCode, "FLL", "FLL program");

  // Scope rules:
  // - SCHOOL_ADMIN is restricted to a single school but oversees every program
  //   inside it. Novi High has both FLL and FRC, so it makes for a good demo.
  // - PROGRAM_ADMIN is restricted to a single school + single program pair.
  //   Novi Meadows + FLL is the canonical example.
  const schoolAdminSchool = getRequired(
    schoolsBySlug,
    "novi-high-school",
    "school novi-high-school",
  );
  const programAdminSchool = getRequired(
    schoolsBySlug,
    "novi-meadows-elementary-school",
    "school novi-meadows-elementary-school",
  );

  await db.insert(userScopeRoles).values([
    {
      userId: schoolAdmin.id,
      role: "SCHOOL_ADMIN",
      districtId,
      schoolId: schoolAdminSchool.id,
      scopeKey: buildUserScopeRoleKey({
        districtId,
        schoolId: schoolAdminSchool.id,
      }),
    },
    {
      userId: programAdmin.id,
      role: "PROGRAM_ADMIN",
      districtId,
      schoolId: programAdminSchool.id,
      programId: fllProgram.id,
      scopeKey: buildUserScopeRoleKey({
        districtId,
        schoolId: programAdminSchool.id,
        programId: fllProgram.id,
      }),
    },
  ]);

  await db.insert(teamMemberships).values([
    {
      userId: coach.id,
      teamId: workflowTeam.id,
      roleInTeam: "COACH",
    },
    {
      userId: parentMentor.id,
      teamId: workflowTeam.id,
      roleInTeam: "PARENT_MENTOR",
    },
  ]);
}

async function seedWorkflowData(
  db: DB,
  districtId: string,
  schoolsBySlug: Map<SchoolSlug, SchoolRow>,
  programsByCode: Map<ProgramCode, ProgramRow>,
  teamsByShortCode: Map<TeamShortCode, TeamRow>,
  demoUsersByKey: Map<DemoUserKey, UserRow>
) {
  const superAdmin = getRequired(demoUsersByKey, "super-admin", "super admin user");
  const coach = getRequired(demoUsersByKey, "coach", "coach user");
  const parentMentor = getRequired(demoUsersByKey, "parent-mentor", "parent mentor user");
  const workflowTeam = getRequired(teamsByShortCode, SAMPLE_WORKFLOW_TEAM_SHORT_CODE, "workflow team");
  const noviMiddle = getRequired(schoolsBySlug, "novi-middle-school", "Novi Middle School");
  const ftcProgram = getRequired(programsByCode, "FTC", "FTC program");

  const [draftRequest] = await db
    .insert(reimbursementRequests)
    .values({
      title: "Robot Parts - Week 3",
      description: "Aluminum extrusions and motor controllers from AndyMark",
      teamId: workflowTeam.id,
      createdById: parentMentor.id,
      coachId: coach.id,
      status: "DRAFT",
      requestedTotal: 0,
    })
    .returning();

  const [submittedRequest] = await db
    .insert(reimbursementRequests)
    .values({
      title: "Field Trip Supplies",
      description: "Snacks and water for competition travel",
      teamId: workflowTeam.id,
      createdById: parentMentor.id,
      coachId: coach.id,
      status: "SUBMITTED",
      requestedTotal: 47.83,
      submittedAt: new Date(),
    })
    .returning();

  const [approvedRequest] = await db
    .insert(reimbursementRequests)
    .values({
      title: "Safety Equipment",
      description: "Safety glasses and gloves for the shop",
      teamId: workflowTeam.id,
      createdById: parentMentor.id,
      coachId: coach.id,
      status: "COACH_APPROVED",
      requestedTotal: 89.95,
      submittedAt: new Date(Date.now() - 3 * 86_400_000),
    })
    .returning();

  const [draftReceipt] = await db
    .insert(receiptFiles)
    .values({
      requestId: draftRequest.id,
      fileName: "andymark-order.pdf",
      mimeType: "application/pdf",
      storageUrl: "file:///seed/andymark-order.pdf",
      parseStatus: "DONE",
    })
    .returning();

  const [draftExtraction] = await db
    .insert(receiptExtractions)
    .values({
      receiptFileId: draftReceipt.id,
      documentType: "INVOICE",
      merchant: "AndyMark",
      total: 156.4,
      tax: 11.4,
      subtotal: 145.0,
      currency: "USD",
      confidence: 0.92,
    })
    .returning();

  await db.insert(receiptLineItems).values([
    {
      receiptExtractionId: draftExtraction.id,
      position: 0,
      description: "Aluminum C-Channel (4-pack)",
      quantity: 2,
      unitPrice: 35.0,
      lineTotal: 70.0,
      category: "Materials",
    },
    {
      receiptExtractionId: draftExtraction.id,
      position: 1,
      description: "NEO Motor Controller",
      quantity: 1,
      unitPrice: 75.0,
      lineTotal: 75.0,
      category: "Electronics",
    },
  ]);

  const [submittedReceipt] = await db
    .insert(receiptFiles)
    .values({
      requestId: submittedRequest.id,
      fileName: "walmart-receipt.jpg",
      mimeType: "image/jpeg",
      storageUrl: "file:///seed/walmart-receipt.jpg",
      parseStatus: "DONE",
    })
    .returning();

  const [submittedExtraction] = await db
    .insert(receiptExtractions)
    .values({
      receiptFileId: submittedReceipt.id,
      documentType: "RECEIPT",
      merchant: "Walmart",
      total: 51.27,
      tax: 3.44,
      subtotal: 47.83,
      currency: "USD",
      confidence: 0.97,
    })
    .returning();

  await db.insert(receiptLineItems).values([
    {
      receiptExtractionId: submittedExtraction.id,
      position: 0,
      description: "Trail Mix (12-pack)",
      quantity: 2,
      unitPrice: 8.97,
      lineTotal: 17.94,
      category: "Food",
    },
    {
      receiptExtractionId: submittedExtraction.id,
      position: 1,
      description: "Water Bottles (24-pack)",
      quantity: 3,
      unitPrice: 4.98,
      lineTotal: 14.94,
      category: "Beverages",
    },
    {
      receiptExtractionId: submittedExtraction.id,
      position: 2,
      description: "Granola Bars (10-pack)",
      quantity: 3,
      unitPrice: 4.98,
      lineTotal: 14.95,
      category: "Food",
    },
  ]);

  await db.insert(approvalActions).values([
    {
      requestId: submittedRequest.id,
      actorId: parentMentor.id,
      action: "SUBMIT",
      comment: "Submitted for review",
    },
    {
      requestId: approvedRequest.id,
      actorId: parentMentor.id,
      action: "SUBMIT",
    },
    {
      requestId: approvedRequest.id,
      actorId: coach.id,
      action: "APPROVE",
      comment: "Looks good, safety first!",
    },
  ]);

  await db.insert(teamRegistrationRequests).values({
    districtId,
    schoolId: noviMiddle.id,
    programId: ftcProgram.id,
    teamName: "Novi Middle Circuit Crew",
    shortCode: "24501",
    notes: "Sample pending FTC registration request for a new Novi Middle School team.",
    requestedById: parentMentor.id,
  });

  await db.insert(auditLogs).values({
    actorId: superAdmin.id,
    eventType: "SEED_COMPLETE",
    message:
      "Seeded verified Novi district schools and FIRST teams, demo admin scopes, and reimbursement workflow samples.",
  });
}

async function main() {
  const { db, client } = createSeedClient();

  try {
    const programsByCode = await ensurePrograms(db);
    const { district, schoolsBySlug } = await ensureDistrictAndSchools(db);
    const demoUsersByKey = await ensureDemoUsers(db);

    await cleanupLegacyTeamScopedRoles(
      db as unknown as Parameters<typeof cleanupLegacyTeamScopedRoles>[0]
    );
    await resetSeedOwnedData(db, demoUsersByKey);

    const teamsByShortCode = await createVerifiedTeams(db, schoolsBySlug, programsByCode);

    await seedAccessAndMemberships(
      db,
      district.id,
      schoolsBySlug,
      programsByCode,
      teamsByShortCode,
      demoUsersByKey
    );

    await seedWorkflowData(
      db,
      district.id,
      schoolsBySlug,
      programsByCode,
      teamsByShortCode,
      demoUsersByKey
    );
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
