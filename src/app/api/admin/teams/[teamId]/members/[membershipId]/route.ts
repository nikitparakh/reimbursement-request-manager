import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teamMemberships, teams, userScopeRoles } from "@/db/schema";
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
    db.query.teamMemberships.findFirst({
      where: and(
        eq(teamMemberships.id, membershipId),
        eq(teamMemberships.teamId, teamId),
      ),
    }),
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

  await db.batch([
    db.delete(teamMemberships).where(eq(teamMemberships.id, membershipId)),
    db.delete(userScopeRoles).where(
      and(
        eq(userScopeRoles.userId, membership.userId),
        eq(userScopeRoles.role, membership.roleInTeam),
        eq(userScopeRoles.teamId, teamId),
      ),
    ),
  ]);

  return NextResponse.json({ ok: true });
}
