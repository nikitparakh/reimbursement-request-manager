import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { teamRegistrationRequests, teams } from "@/db/schema";
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
    db.query.teamRegistrationRequests.findFirst({
      where: eq(teamRegistrationRequests.id, id),
    }),
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
    const comment = body.data.comment?.trim();
    if (!comment) {
      return NextResponse.json(
        { error: "A reason is required when rejecting a request" },
        { status: 400 },
      );
    }
    const [updated] = await db
      .update(teamRegistrationRequests)
      .set({
        status: "REJECTED",
        reviewedById: actorId,
        reviewedAt: new Date(),
        rejectionReason: comment,
      })
      .where(eq(teamRegistrationRequests.id, id))
      .returning();
    return NextResponse.json(updated);
  }

  // APPROVE: insert the team and update the request atomically so a mid-step
  // failure can't strand an orphaned team with a still-PENDING request. The
  // team id is generated app-side so both statements fit in one batch.
  const teamId = nanoid();
  try {
    await db.batch([
      db.insert(teams).values({
        id: teamId,
        schoolId: req.schoolId,
        programId: req.programId,
        name: req.teamName,
        shortCode: req.shortCode ?? undefined,
        glAccount: req.glAccount ?? undefined,
        fllDivision: req.fllDivision ?? undefined,
      }),
      db
        .update(teamRegistrationRequests)
        .set({
          status: "APPROVED",
          reviewedById: actorId,
          reviewedAt: new Date(),
          approvedTeamId: teamId,
        })
        .where(eq(teamRegistrationRequests.id, id)),
    ]);
  } catch (error) {
    if (
      error instanceof Error &&
      /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(error.message)
    ) {
      return NextResponse.json(
        { error: "A team with these details already exists" },
        { status: 409 },
      );
    }
    throw error;
  }

  const [updated, team] = await Promise.all([
    db.query.teamRegistrationRequests.findFirst({
      where: eq(teamRegistrationRequests.id, id),
    }),
    db.query.teams.findFirst({ where: eq(teams.id, teamId) }),
  ]);

  return NextResponse.json({ request: updated, team });
}
