import { NextResponse } from "next/server";
import { z } from "zod";
import { createRequestDraft, findTeamCoach } from "@/lib/reimbursements/repository";
import { db } from "@/lib/db";
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

  const requests = await db.reimbursementRequest.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "desc" },
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

  const membership = await db.teamMembership.findFirst({
    where: { userId, teamId: body.data.teamId, approved: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "User is not a member of this team" }, { status: 403 });
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
