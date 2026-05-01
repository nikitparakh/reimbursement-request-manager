import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canManageTeams, getAccessContext } from "@/lib/access";
import { requireUser } from "@/lib/rbac";

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ teamId: string; membershipId: string }> },
) {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId, membershipId } = await params;

  const [access, membership, team] = await Promise.all([
    getAccessContext(userId),
    db.teamMembership.findFirst({
      where: { id: membershipId, teamId },
    }),
    db.team.findUnique({
      where: { id: teamId },
      include: {
        school: {
          select: {
            districtId: true,
          },
        },
      },
    }),
  ]);

  if (!membership) {
    return NextResponse.json(
      { error: "Membership not found" },
      { status: 404 },
    );
  }
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

  await db.$transaction([
    db.teamMembership.delete({ where: { id: membershipId } }),
    db.userScopeRole.deleteMany({
      where: {
        userId: membership.userId,
        role: membership.roleInTeam,
        teamId,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
