import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams } from "@/db/schema";
import { canManageTeams, getAccessContext } from "@/lib/access";
import { requireUser } from "@/lib/rbac";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  shortCode: z.string().max(12).nullable().optional(),
  glAccount: z.string().max(30).nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId } = await params;
  const body = updateSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const [access, team] = await Promise.all([
    getAccessContext(userId),
    db.query.teams.findFirst({
      where: eq(teams.id, teamId),
      with: {
        school: {
          columns: {
            districtId: true,
          },
        },
      },
    }),
  ]);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  if (
    !canManageTeams(access, {
      districtId: team.school.districtId,
      schoolId: team.schoolId,
      programId: team.programId,
      teamId: team.id,
    })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [updated] = await db
    .update(teams)
    .set(body.data)
    .where(eq(teams.id, teamId))
    .returning();

  return NextResponse.json(updated);
}
