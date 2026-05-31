import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reimbursementRequests, teamMemberships } from "@/db/schema";

export async function createRequestDraft(input: {
  title: string;
  description?: string;
  teamId: string;
  createdById: string;
  coachId?: string;
}) {
  const [row] = await db
    .insert(reimbursementRequests)
    .values({
      title: input.title,
      description: input.description,
      teamId: input.teamId,
      createdById: input.createdById,
      coachId: input.coachId,
      requestedTotal: 0,
      status: "DRAFT",
    })
    .returning();
  return row;
}

export async function getRequestWithDetails(requestId: string) {
  const request = await db.query.reimbursementRequests.findFirst({
    where: eq(reimbursementRequests.id, requestId),
    with: {
      team: true,
      receiptFiles: {
        with: { extraction: true },
      },
      approvals: {
        with: { actor: true },
        orderBy: (approval) => asc(approval.createdAt),
      },
    },
  });
  return request ?? null;
}

export async function findTeamCoach(teamId: string) {
  const coach = await db.query.teamMemberships.findFirst({
    where: and(
      eq(teamMemberships.teamId, teamId),
      eq(teamMemberships.roleInTeam, "COACH"),
      eq(teamMemberships.approved, true)
    ),
  });
  return coach ?? null;
}
