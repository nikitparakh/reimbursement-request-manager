import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import type {
  GlobalRole,
  TeamMembershipRole,
  RequestStatus,
  ParseStatus,
  DocumentType,
} from "@prisma/client";
import { db } from "@/lib/db";

let counter = 0;
function seq() {
  return ++counter;
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
      role: overrides.role ?? "STUDENT",
      onboardingDone: overrides.onboardingDone ?? false,
      passwordHash,
    },
  });
}

export async function createTeam(
  overrides: {
    name?: string;
    shortCode?: string;
    active?: boolean;
  } = {}
) {
  const n = seq();
  return db.team.create({
    data: {
      name: overrides.name ?? `Team ${n}`,
      shortCode: overrides.shortCode ?? `T${n}`,
      active: overrides.active ?? true,
    },
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
      lineTotal:
        input.lineTotal != null ? new Prisma.Decimal(input.lineTotal) : null,
      position: input.position ?? 0,
      quantity:
        input.quantity != null ? new Prisma.Decimal(input.quantity) : null,
      unitPrice:
        input.unitPrice != null ? new Prisma.Decimal(input.unitPrice) : null,
      category: input.category,
    },
  });
}

export async function createTeamRegistrationRequest(input: {
  teamName: string;
  requestedById: string;
  shortCode?: string;
  notes?: string;
}) {
  return db.teamRegistrationRequest.create({
    data: {
      teamName: input.teamName,
      requestedById: input.requestedById,
      shortCode: input.shortCode,
      notes: input.notes,
    },
  });
}
