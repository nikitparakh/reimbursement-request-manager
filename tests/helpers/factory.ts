import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  districts,
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
  type DocumentType,
  type FllDivision,
  type GlobalRole,
  type ParseStatus,
  type ProgramCode,
  type RequestStatus,
  type ScopedRole,
  type TeamMembershipRole,
} from "@/db/schema";
import { buildUserScopeRoleKey } from "@/lib/user-scope-role";

let counter = 0;

function seq() {
  return ++counter;
}

async function insertOne<T>(promise: Promise<T[]>): Promise<T> {
  const rows = await promise;
  return rows[0];
}

function getProgramName(code: ProgramCode) {
  switch (code) {
    case "LEGACY":
      return "Legacy Program";
    case "FLL":
      return "FIRST LEGO League";
    case "FTC":
      return "FIRST Tech Challenge";
    case "FRC":
      return "FIRST Robotics Competition";
  }
}

export async function createUser(
  overrides: {
    email?: string;
    name?: string;
    role?: GlobalRole;
    password?: string;
    onboardingDone?: boolean;
  } = {}
) {
  const n = seq();
  return insertOne(
    getDb()
      .insert(users)
      .values({
        email: overrides.email ?? `user${n}@test.com`,
        name: overrides.name ?? `User ${n}`,
        role: overrides.role ?? "USER",
        onboardingDone: overrides.onboardingDone ?? false,
      })
      .returning()
  );
}

export async function createDistrict(
  overrides: { name?: string; slug?: string; active?: boolean } = {}
) {
  const n = seq();
  return insertOne(
    getDb()
      .insert(districts)
      .values({
        name: overrides.name ?? `District ${n}`,
        slug: overrides.slug ?? `district-${n}`,
        active: overrides.active ?? true,
      })
      .returning()
  );
}

export async function createSchool(
  overrides: { districtId?: string; name?: string; slug?: string; active?: boolean } = {}
) {
  const districtId = overrides.districtId ?? (await createDistrict()).id;
  const n = seq();
  return insertOne(
    getDb()
      .insert(schools)
      .values({
        districtId,
        name: overrides.name ?? `School ${n}`,
        slug: overrides.slug ?? `school-${n}`,
        active: overrides.active ?? true,
      })
      .returning()
  );
}

export async function createProgram(
  overrides: {
    code?: ProgramCode;
    name?: string;
    gradeRangeLabel?: string;
    ageRangeLabel?: string;
  } = {}
) {
  const n = seq();
  const code = overrides.code ?? (n % 3 === 0 ? "FRC" : n % 2 === 0 ? "FTC" : "FLL");
  return insertOne(
    getDb()
      .insert(programs)
      .values({
        code,
        name: overrides.name ?? getProgramName(code),
        gradeRangeLabel: overrides.gradeRangeLabel,
        ageRangeLabel: overrides.ageRangeLabel,
      })
      .onConflictDoUpdate({
        target: programs.code,
        set: {
          name: overrides.name ?? getProgramName(code),
          gradeRangeLabel: overrides.gradeRangeLabel,
          ageRangeLabel: overrides.ageRangeLabel,
        },
      })
      .returning()
  );
}

export async function createTeam(
  overrides: {
    schoolId?: string;
    programId?: string;
    name?: string;
    shortCode?: string;
    glAccount?: string;
    active?: boolean;
    fllDivision?: FllDivision;
  } = {}
) {
  const schoolId = overrides.schoolId ?? (await createSchool()).id;
  const programId = overrides.programId ?? (await createProgram()).id;
  const n = seq();
  return insertOne(
    getDb()
      .insert(teams)
      .values({
        schoolId,
        programId,
        name: overrides.name ?? `Team ${n}`,
        shortCode: overrides.shortCode ?? `T${n}`,
        glAccount: overrides.glAccount,
        active: overrides.active ?? true,
        fllDivision: overrides.fllDivision,
      })
      .returning()
  );
}

export async function createScopedRole(input: {
  userId: string;
  role: ScopedRole;
  districtId?: string;
  schoolId?: string;
  programId?: string;
  teamId?: string;
}) {
  return insertOne(
    getDb()
      .insert(userScopeRoles)
      .values({
        ...input,
        scopeKey: buildUserScopeRoleKey(input),
      })
      .returning()
  );
}

export async function createScopedRoleForTeam(input: {
  userId: string;
  teamId: string;
  role: ScopedRole;
}) {
  const team = await getDb().query.teams.findFirst({
    where: eq(teams.id, input.teamId),
    with: { school: true },
  });
  if (!team) throw new Error("Team not found");

  return createScopedRole({
    userId: input.userId,
    role: input.role,
    districtId: team.school.districtId,
    schoolId: team.schoolId,
    programId: team.programId,
    teamId: team.id,
  });
}

export async function createMembership(input: {
  userId: string;
  teamId: string;
  roleInTeam: TeamMembershipRole;
  approved?: boolean;
}) {
  return insertOne(
    getDb()
      .insert(teamMemberships)
      .values({
        userId: input.userId,
        teamId: input.teamId,
        roleInTeam: input.roleInTeam,
        approved: input.approved ?? true,
      })
      .returning()
  );
}

export async function createRequest(input: {
  teamId: string;
  createdById: string;
  coachId?: string;
  status?: RequestStatus;
  requestedTotal?: number;
  title?: string;
  description?: string;
}) {
  const n = seq();
  return insertOne(
    getDb()
      .insert(reimbursementRequests)
      .values({
        title: input.title ?? `Request ${n}`,
        description: input.description,
        teamId: input.teamId,
        createdById: input.createdById,
        coachId: input.coachId,
        status: input.status ?? "DRAFT",
        requestedTotal: input.requestedTotal ?? 0,
      })
      .returning()
  );
}

export async function createReceipt(input: {
  requestId: string;
  parseStatus?: ParseStatus;
  fileName?: string;
}) {
  const n = seq();
  return insertOne(
    getDb()
      .insert(receiptFiles)
      .values({
        requestId: input.requestId,
        fileName: input.fileName ?? `receipt-${n}.pdf`,
        mimeType: "application/pdf",
        storageUrl: `file:///fake/path/receipt-${n}.pdf`,
        parseStatus: input.parseStatus ?? "DONE",
      })
      .returning()
  );
}

export async function createExtraction(input: {
  receiptFileId: string;
  documentType?: DocumentType;
  merchant?: string;
  total?: number;
}) {
  return insertOne(
    getDb()
      .insert(receiptExtractions)
      .values({
        receiptFileId: input.receiptFileId,
        documentType: input.documentType ?? "RECEIPT",
        merchant: input.merchant ?? "Test Store",
        total: input.total ?? null,
        confidence: 0.95,
      })
      .returning()
  );
}

export async function createLineItem(input: {
  receiptExtractionId: string;
  description?: string;
  lineTotal?: number;
  position?: number;
  quantity?: number;
  unitPrice?: number;
  category?: string;
}) {
  const n = seq();
  return insertOne(
    getDb()
      .insert(receiptLineItems)
      .values({
        receiptExtractionId: input.receiptExtractionId,
        description: input.description ?? `Item ${n}`,
        lineTotal: input.lineTotal ?? null,
        position: input.position ?? 0,
        quantity: input.quantity ?? null,
        unitPrice: input.unitPrice ?? null,
        category: input.category,
      })
      .returning()
  );
}

export async function createTeamRegistrationRequest(input: {
  districtId?: string;
  schoolId?: string;
  programId?: string;
  teamName: string;
  requestedById: string;
  shortCode?: string;
  glAccount?: string;
  notes?: string;
  fllDivision?: FllDivision;
}) {
  const districtId = input.districtId ?? (await createDistrict()).id;
  const schoolId = input.schoolId ?? (await createSchool({ districtId })).id;
  const programId = input.programId ?? (await createProgram({ code: "FTC" })).id;
  return insertOne(
    getDb()
      .insert(teamRegistrationRequests)
      .values({
        districtId,
        schoolId,
        programId,
        teamName: input.teamName,
        requestedById: input.requestedById,
        shortCode: input.shortCode,
        glAccount: input.glAccount,
        notes: input.notes,
        fllDivision: input.fllDivision,
      })
      .returning()
  );
}
