import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { createRequestDraft, findTeamCoach } from "@/lib/reimbursements/repository";
import { db } from "@/lib/db";
import { reimbursementRequests, teamMemberships, teams } from "@/db/schema";
import { requireUser } from "@/lib/rbac";

const createSchema = z.object({
  title: z.string().min(2),
  description: z.string().max(1000).optional(),
  teamId: z.string().min(1),
});

export async function GET() {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await db.query.reimbursementRequests.findMany({
    where: eq(reimbursementRequests.createdById, userId),
    orderBy: desc(reimbursementRequests.createdAt),
  });

  return NextResponse.json(requests);
}

export async function POST(request: Request) {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const membership = await db.query.teamMemberships.findFirst({
    where: and(
      eq(teamMemberships.userId, userId),
      eq(teamMemberships.teamId, body.data.teamId),
      eq(teamMemberships.approved, true)
    ),
  });
  if (!membership) {
    return NextResponse.json({ error: "User is not a member of this team" }, { status: 403 });
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, body.data.teamId),
  });
  if (!team?.active) {
    return NextResponse.json(
      {
        error:
          "This team is inactive. New requests cannot be created; in-flight requests are unaffected.",
      },
      { status: 409 },
    );
  }

  const coachMembership = await findTeamCoach(body.data.teamId);
  const draft = await createRequestDraft({
    title: body.data.title,
    description: body.data.description,
    teamId: body.data.teamId,
    createdById: userId,
    coachId: coachMembership?.userId,
  });

  return NextResponse.json(draft, { status: 201 });
}
