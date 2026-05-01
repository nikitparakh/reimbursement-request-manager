import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { canManageTeamRequests, getAccessContext } from "@/lib/access";
import { requireUser } from "@/lib/rbac";

const schema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let actorId = "";
  try {
    const actor = await requireUser();
    actorId = actor.id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const [access, req] = await Promise.all([
    getAccessContext(actorId),
    db.teamRegistrationRequest.findUnique({ where: { id } }),
  ]);
  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (req.status !== "PENDING") {
    return NextResponse.json(
      { error: "This request has already been reviewed" },
      { status: 409 }
    );
  }
  if (
    !canManageTeamRequests(access, {
      districtId: req.districtId,
      schoolId: req.schoolId,
      programId: req.programId,
    })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.data.decision === "REJECT") {
    const updated = await db.teamRegistrationRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedById: actorId,
        reviewedAt: new Date(),
        rejectionReason: body.data.comment,
      },
    });
    return NextResponse.json(updated);
  }

  const team = await db.team.create({
    data: {
      schoolId: req.schoolId,
      programId: req.programId,
      name: req.teamName,
      shortCode: req.shortCode ?? undefined,
      glAccount: req.glAccount ?? undefined,
      fllDivision: req.fllDivision ?? undefined,
    },
  });

  const updated = await db.teamRegistrationRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedById: actorId,
      reviewedAt: new Date(),
      approvedTeamId: team.id,
    },
  });

  return NextResponse.json({ request: updated, team });
}
