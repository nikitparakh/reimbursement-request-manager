import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function createRequestDraft(input: {
  title: string;
  description?: string;
  teamId: string;
  createdById: string;
  managerId?: string;
}) {
  return db.reimbursementRequest.create({
    data: {
      title: input.title,
      description: input.description,
      teamId: input.teamId,
      createdById: input.createdById,
      managerId: input.managerId,
      requestedTotal: new Prisma.Decimal(0),
      status: "DRAFT",
    },
  });
}

export async function getRequestWithDetails(requestId: string) {
  return db.reimbursementRequest.findUnique({
    where: { id: requestId },
    include: {
      team: true,
      receiptFiles: {
        include: { extraction: true },
      },
      approvals: {
        include: { actor: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function findTeamManager(teamId: string) {
  return db.teamMembership.findFirst({
    where: { teamId, roleInTeam: "MANAGER", approved: true },
  });
}
