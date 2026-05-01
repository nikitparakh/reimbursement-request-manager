import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import type {
  GlobalRole,
  ProgramCode,
  RequestStatus,
  ParseStatus,
  DocumentType,
  TeamMembershipRole,
  ScopedRole,
  FllDivision,
} from "@prisma/client";
import { db } from "@/lib/db";
import { buildUserScopeRoleKey } from "@/lib/user-scope-role";

let counter = 0;

function seq() {
  return ++counter;
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
  const passwordHash = await hash(overrides.password ?? "Password1", 4);
  return db.user.create({
    data: {
      email: overrides.email ?? `user${n}@test.com`,
      name: overrides.name ?? `User ${n}`,
      role: overrides.role ?? "USER",
      onboardingDone: overrides.onboardingDone ?? false,
      passwordHash,
    },
  });
}

export async function createDistrict(overrides: { name?: string; slug?: string; active?: boolean } = {}) {
  const n = seq();
  return db.district.create({
    data: {
      name: overrides.name ?? `District ${n}`,
      slug: overrides.slug ?? `district-${n}`,
      active: overrides.active ?? true,
    },
  });
}

export async function createSchool(
  overrides: { districtId?: string; name?: string; slug?: string; active?: boolean } = {}
) {
  const districtId = overrides.districtId ?? (await createDistrict()).id;
  const n = seq();
  return db.school.create({
    data: {
      districtId,
      name: overrides.name ?? `School ${n}`,
      slug: overrides.slug ?? `school-${n}`,
      active: overrides.active ?? true,
    },
  });
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
  return db.program.upsert({
    where: { code },
    update: {
      name: overrides.name ?? getProgramName(code),
      gradeRangeLabel: overrides.gradeRangeLabel,
      ageRangeLabel: overrides.ageRangeLabel,
    },
    create: {
      code,
      name: overrides.name ?? getProgramName(code),
      gradeRangeLabel: overrides.gradeRangeLabel,
      ageRangeLabel: overrides.ageRangeLabel,
    },
  });
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
  return db.team.create({
    data: {
      schoolId,
      programId,
      name: overrides.name ?? `Team ${n}`,
      shortCode: overrides.shortCode ?? `T${n}`,
      glAccount: overrides.glAccount,
      active: overrides.active ?? true,
      fllDivision: overrides.fllDivision,
    },
  });
}

export async function createScopedRole(input: {
  userId: string;
  role: ScopedRole;
  districtId?: string;
  schoolId?: string;
  programId?: string;
  teamId?: string;
}) {
  return db.userScopeRole.create({
    data: {
      ...input,
      scopeKey: buildUserScopeRoleKey(input),
    },
  });
}

export async function createScopedRoleForTeam(input: {
  userId: string;
  teamId: string;
  role: ScopedRole;
}) {
  const team = await db.team.findUniqueOrThrow({
    where: { id: input.teamId },
    include: {
      school: true,
    },
  });

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
  return db.teamMembership.create({
    data: {
      userId: input.userId,
      teamId: input.teamId,
      roleInTeam: input.roleInTeam,
      approved: input.approved ?? true,
    },
  });
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
  return db.reimbursementRequest.create({
    data: {
      title: input.title ?? `Request ${n}`,
      description: input.description,
      teamId: input.teamId,
      createdById: input.createdById,
      coachId: input.coachId,
      status: input.status ?? "DRAFT",
      requestedTotal: new Prisma.Decimal(input.requestedTotal ?? 0),
    },
  });
}

export async function createReceipt(input: {
  requestId: string;
  parseStatus?: ParseStatus;
  fileName?: string;
}) {
  const n = seq();
  return db.receiptFile.create({
    data: {
      requestId: input.requestId,
      fileName: input.fileName ?? `receipt-${n}.pdf`,
      mimeType: "application/pdf",
      storageUrl: `file:///fake/path/receipt-${n}.pdf`,
      parseStatus: input.parseStatus ?? "DONE",
    },
  });
}

export async function createExtraction(input: {
  receiptFileId: string;
  documentType?: DocumentType;
  merchant?: string;
  total?: number;
}) {
  return db.receiptExtraction.create({
    data: {
      receiptFileId: input.receiptFileId,
      documentType: input.documentType ?? "RECEIPT",
      merchant: input.merchant ?? "Test Store",
      total: input.total != null ? new Prisma.Decimal(input.total) : null,
      confidence: 0.95,
    },
  });
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
  return db.receiptLineItem.create({
    data: {
      receiptExtractionId: input.receiptExtractionId,
      description: input.description ?? `Item ${n}`,
      lineTotal: input.lineTotal != null ? new Prisma.Decimal(input.lineTotal) : null,
      position: input.position ?? 0,
      quantity: input.quantity != null ? new Prisma.Decimal(input.quantity) : null,
      unitPrice: input.unitPrice != null ? new Prisma.Decimal(input.unitPrice) : null,
      category: input.category,
    },
  });
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
  return db.teamRegistrationRequest.create({
    data: {
      districtId,
      schoolId,
      programId,
      teamName: input.teamName,
      requestedById: input.requestedById,
      shortCode: input.shortCode,
      glAccount: input.glAccount,
      notes: input.notes,
      fllDivision: input.fllDivision,
    },
  });
}
