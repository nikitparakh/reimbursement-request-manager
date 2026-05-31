import {
  Prisma,
  PrismaClient,
  type FllDivision,
  type GlobalRole,
  type Program,
  type School,
  type Team,
  type User,
} from "@prisma/client";
import { hash } from "bcryptjs";
import { CURRENT_POLICY_VERSION } from "../src/lib/policy";
import { buildUserScopeRoleKey } from "../src/lib/user-scope-role";
import { cleanupLegacyTeamScopedRoles } from "./seed-cleanup";

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
  password: string;
  globalRole: GlobalRole;
};

const DEMO_USER_ACCOUNTS: readonly DemoUserAccount[] = [
  {
    key: "super-admin",
    email: "admin@school.org",
    name: "District Super Admin",
    password: "Admin1234",
    globalRole: "SUPER_ADMIN",
  },
  {
    key: "school-admin",
    email: "schooladmin@school.org",
    name: "Novi School Admin",
    password: "SchoolAdmin1234",
    globalRole: "USER",
  },
  {
    key: "program-admin",
    email: "programadmin@school.org",
    name: "Novi FLL Program Admin",
    password: "ProgramAdmin1234",
    globalRole: "USER",
  },
  {
    key: "coach",
    email: "coach@team.org",
    name: "Frog Force Coach",
    password: "Coach1234",
    globalRole: "USER",
  },
  {
    key: "parent-mentor",
    email: "user@team.org",
    name: "Frog Force Parent Mentor",
    password: "User1234",
    globalRole: "USER",
  },
] as const;

const SAMPLE_WORKFLOW_TEAM_SHORT_CODE = "503";
type DemoUserKey = (typeof DEMO_USER_ACCOUNTS)[number]["key"];
type SchoolSlug = (typeof VERIFIED_NOVI_SCHOOLS)[number]["slug"];
type TeamShortCode = (typeof VERIFIED_NOVI_TEAMS)[number]["shortCode"];

async function createSeedClient(): Promise<PrismaClient> {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    const { PrismaLibSql } = await import("@prisma/adapter-libsql");

    const adapter = new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter });
  }

  return new PrismaClient();
}

function getRequired<K, V>(map: Map<K, V>, key: K, label: string) {
  const value = map.get(key);

  if (!value) {
    throw new Error(`Missing ${label}`);
  }

  return value;
}

async function ensurePrograms(prisma: PrismaClient) {
  const programs = await Promise.all(
    PROGRAM_SEEDS.map((program) =>
      prisma.program.upsert({
        where: { code: program.code },
        update: {
          name: program.name,
          description: program.description,
          gradeRangeLabel: program.gradeRangeLabel,
          ageRangeLabel: program.ageRangeLabel,
          active: true,
        },
        create: {
          code: program.code,
          name: program.name,
          description: program.description,
          gradeRangeLabel: program.gradeRangeLabel,
          ageRangeLabel: program.ageRangeLabel,
          active: true,
        },
      })
    )
  );

  return new Map(programs.map((program) => [program.code, program])) as Map<ProgramCode, Program>;
}

async function ensureDistrictAndSchools(prisma: PrismaClient) {
  const district = await prisma.district.upsert({
    where: { slug: VERIFIED_NOVI_DISTRICT.slug },
    update: { name: VERIFIED_NOVI_DISTRICT.name, active: true },
    create: {
      name: VERIFIED_NOVI_DISTRICT.name,
      slug: VERIFIED_NOVI_DISTRICT.slug,
      active: true,
    },
  });

  const schools = await Promise.all(
    VERIFIED_NOVI_SCHOOLS.map((school) =>
      prisma.school.upsert({
        where: {
          districtId_slug: {
            districtId: district.id,
            slug: school.slug,
          },
        },
        update: {
          name: school.name,
          active: true,
        },
        create: {
          districtId: district.id,
          name: school.name,
          slug: school.slug,
          active: true,
        },
      })
    )
  );

  return {
    district,
    schoolsBySlug: new Map(schools.map((school) => [school.slug, school])) as Map<SchoolSlug, School>,
  };
}

async function ensureDemoUsers(prisma: PrismaClient) {
  const users = await Promise.all(
    DEMO_USER_ACCOUNTS.map(async (account) => {
      const passwordHash = await hash(account.password, 12);
      const policyAcceptedAt = new Date();

      const user = await prisma.user.upsert({
        where: { email: account.email },
        update: {
          name: account.name,
          role: account.globalRole,
          onboardingDone: true,
          passwordHash,
          policyAcceptedAt,
          policyVersion: CURRENT_POLICY_VERSION,
        },
        create: {
          email: account.email,
          name: account.name,
          role: account.globalRole,
          onboardingDone: true,
          passwordHash,
          policyAcceptedAt,
          policyVersion: CURRENT_POLICY_VERSION,
        },
      });

      return [account.key, user] as const;
    })
  );

  return new Map(users) as Map<DemoUserKey, User>;
}

async function resetSeedOwnedData(
  prisma: PrismaClient,
  demoUsersByKey: Map<DemoUserKey, User>
) {
  const demoUserIds = Array.from(demoUsersByKey.values()).map((user) => user.id);

  await prisma.notification.deleteMany({
    where: {
      userId: { in: demoUserIds },
    },
  });

  await prisma.auditLog.deleteMany({
    where: {
      actorId: { in: demoUserIds },
    },
  });

  await prisma.teamRegistrationRequest.deleteMany({
    where: {
      requestedById: { in: demoUserIds },
    },
  });

  await prisma.reimbursementRequest.deleteMany({
    where: {
      createdById: { in: demoUserIds },
    },
  });

  await prisma.teamMembership.deleteMany({
    where: {
      userId: { in: demoUserIds },
    },
  });

  await prisma.userScopeRole.deleteMany({
    where: {
      userId: { in: demoUserIds },
    },
  });
}

async function createVerifiedTeams(
  prisma: PrismaClient,
  schoolsBySlug: Map<SchoolSlug, School>,
  programsByCode: Map<ProgramCode, Program>
) {
  const teams = await Promise.all(
    VERIFIED_NOVI_TEAMS.map((team) =>
      prisma.team.upsert({
        where: {
          schoolId_programId_name: {
            schoolId: getRequired(schoolsBySlug, team.schoolSlug, `school ${team.schoolSlug}`).id,
            programId: getRequired(programsByCode, team.programCode, `program ${team.programCode}`).id,
            name: team.name,
          },
        },
        update: {
          shortCode: team.shortCode,
          fllDivision: team.fllDivision ?? null,
          active: true,
        },
        create: {
          schoolId: getRequired(schoolsBySlug, team.schoolSlug, `school ${team.schoolSlug}`).id,
          programId: getRequired(programsByCode, team.programCode, `program ${team.programCode}`).id,
          name: team.name,
          shortCode: team.shortCode,
          fllDivision: team.fllDivision,
          active: true,
        },
      })
    )
  );

  return new Map(teams.map((team) => [team.shortCode, team])) as Map<TeamShortCode, Team>;
}

async function seedAccessAndMemberships(
  prisma: PrismaClient,
  districtId: string,
  schoolsBySlug: Map<SchoolSlug, School>,
  programsByCode: Map<ProgramCode, Program>,
  teamsByShortCode: Map<TeamShortCode, Team>,
  demoUsersByKey: Map<DemoUserKey, User>
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

  await prisma.userScopeRole.createMany({
    data: [
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
    ],
  });

  await prisma.teamMembership.createMany({
    data: [
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
    ],
  });
}

async function seedWorkflowData(
  prisma: PrismaClient,
  districtId: string,
  schoolsBySlug: Map<SchoolSlug, School>,
  programsByCode: Map<ProgramCode, Program>,
  teamsByShortCode: Map<TeamShortCode, Team>,
  demoUsersByKey: Map<DemoUserKey, User>
) {
  const superAdmin = getRequired(demoUsersByKey, "super-admin", "super admin user");
  const coach = getRequired(demoUsersByKey, "coach", "coach user");
  const parentMentor = getRequired(demoUsersByKey, "parent-mentor", "parent mentor user");
  const workflowTeam = getRequired(teamsByShortCode, SAMPLE_WORKFLOW_TEAM_SHORT_CODE, "workflow team");
  const noviMiddle = getRequired(schoolsBySlug, "novi-middle-school", "Novi Middle School");
  const ftcProgram = getRequired(programsByCode, "FTC", "FTC program");

  const draftRequest = await prisma.reimbursementRequest.create({
    data: {
      title: "Robot Parts - Week 3",
      description: "Aluminum extrusions and motor controllers from AndyMark",
      teamId: workflowTeam.id,
      createdById: parentMentor.id,
      coachId: coach.id,
      status: "DRAFT",
      requestedTotal: new Prisma.Decimal("0.00"),
    },
  });

  const submittedRequest = await prisma.reimbursementRequest.create({
    data: {
      title: "Field Trip Supplies",
      description: "Snacks and water for competition travel",
      teamId: workflowTeam.id,
      createdById: parentMentor.id,
      coachId: coach.id,
      status: "SUBMITTED",
      requestedTotal: new Prisma.Decimal("47.83"),
      submittedAt: new Date(),
    },
  });

  const approvedRequest = await prisma.reimbursementRequest.create({
    data: {
      title: "Safety Equipment",
      description: "Safety glasses and gloves for the shop",
      teamId: workflowTeam.id,
      createdById: parentMentor.id,
      coachId: coach.id,
      status: "COACH_APPROVED",
      requestedTotal: new Prisma.Decimal("89.95"),
      submittedAt: new Date(Date.now() - 3 * 86_400_000),
    },
  });

  const draftReceipt = await prisma.receiptFile.create({
    data: {
      requestId: draftRequest.id,
      fileName: "andymark-order.pdf",
      mimeType: "application/pdf",
      storageUrl: "file:///seed/andymark-order.pdf",
      parseStatus: "DONE",
    },
  });

  const draftExtraction = await prisma.receiptExtraction.create({
    data: {
      receiptFileId: draftReceipt.id,
      documentType: "INVOICE",
      merchant: "AndyMark",
      total: new Prisma.Decimal("156.40"),
      tax: new Prisma.Decimal("11.40"),
      subtotal: new Prisma.Decimal("145.00"),
      currency: "USD",
      confidence: 0.92,
    },
  });

  await prisma.receiptLineItem.createMany({
    data: [
      {
        receiptExtractionId: draftExtraction.id,
        position: 0,
        description: "Aluminum C-Channel (4-pack)",
        quantity: new Prisma.Decimal("2"),
        unitPrice: new Prisma.Decimal("35.00"),
        lineTotal: new Prisma.Decimal("70.00"),
        category: "Materials",
      },
      {
        receiptExtractionId: draftExtraction.id,
        position: 1,
        description: "NEO Motor Controller",
        quantity: new Prisma.Decimal("1"),
        unitPrice: new Prisma.Decimal("75.00"),
        lineTotal: new Prisma.Decimal("75.00"),
        category: "Electronics",
      },
    ],
  });

  const submittedReceipt = await prisma.receiptFile.create({
    data: {
      requestId: submittedRequest.id,
      fileName: "walmart-receipt.jpg",
      mimeType: "image/jpeg",
      storageUrl: "file:///seed/walmart-receipt.jpg",
      parseStatus: "DONE",
    },
  });

  const submittedExtraction = await prisma.receiptExtraction.create({
    data: {
      receiptFileId: submittedReceipt.id,
      documentType: "RECEIPT",
      merchant: "Walmart",
      total: new Prisma.Decimal("51.27"),
      tax: new Prisma.Decimal("3.44"),
      subtotal: new Prisma.Decimal("47.83"),
      currency: "USD",
      confidence: 0.97,
    },
  });

  await prisma.receiptLineItem.createMany({
    data: [
      {
        receiptExtractionId: submittedExtraction.id,
        position: 0,
        description: "Trail Mix (12-pack)",
        quantity: new Prisma.Decimal("2"),
        unitPrice: new Prisma.Decimal("8.97"),
        lineTotal: new Prisma.Decimal("17.94"),
        category: "Food",
      },
      {
        receiptExtractionId: submittedExtraction.id,
        position: 1,
        description: "Water Bottles (24-pack)",
        quantity: new Prisma.Decimal("3"),
        unitPrice: new Prisma.Decimal("4.98"),
        lineTotal: new Prisma.Decimal("14.94"),
        category: "Beverages",
      },
      {
        receiptExtractionId: submittedExtraction.id,
        position: 2,
        description: "Granola Bars (10-pack)",
        quantity: new Prisma.Decimal("3"),
        unitPrice: new Prisma.Decimal("4.98"),
        lineTotal: new Prisma.Decimal("14.95"),
        category: "Food",
      },
    ],
  });

  await prisma.approvalAction.createMany({
    data: [
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
    ],
  });

  await prisma.teamRegistrationRequest.create({
    data: {
      districtId,
      schoolId: noviMiddle.id,
      programId: ftcProgram.id,
      teamName: "Novi Middle Circuit Crew",
      shortCode: "24501",
      notes: "Sample pending FTC registration request for a new Novi Middle School team.",
      requestedById: parentMentor.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: superAdmin.id,
      eventType: "SEED_COMPLETE",
      message:
        "Seeded verified Novi district schools and FIRST teams, demo admin scopes, and reimbursement workflow samples.",
    },
  });
}

async function main() {
  const prisma = await createSeedClient();

  try {
    const programsByCode = await ensurePrograms(prisma);
    const { district, schoolsBySlug } = await ensureDistrictAndSchools(prisma);
    const demoUsersByKey = await ensureDemoUsers(prisma);

    // NOTE: seed.ts is still Prisma-based; full Drizzle port is the next step.
    await cleanupLegacyTeamScopedRoles(
      prisma as unknown as Parameters<typeof cleanupLegacyTeamScopedRoles>[0]
    );
    await resetSeedOwnedData(prisma, demoUsersByKey);

    const teamsByShortCode = await createVerifiedTeams(prisma, schoolsBySlug, programsByCode);

    await seedAccessAndMemberships(
      prisma,
      district.id,
      schoolsBySlug,
      programsByCode,
      teamsByShortCode,
      demoUsersByKey
    );

    await seedWorkflowData(
      prisma,
      district.id,
      schoolsBySlug,
      programsByCode,
      teamsByShortCode,
      demoUsersByKey
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
