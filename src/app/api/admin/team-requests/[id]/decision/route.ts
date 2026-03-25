import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

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
    actorId = (await requireRole("ADMIN")).id;
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const req = await db.teamRegistrationRequest.findUnique({ where: { id } });
  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    data: { name: req.teamName, shortCode: req.shortCode ?? undefined, glAccount: req.glAccount ?? undefined },
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
