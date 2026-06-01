import { NextResponse } from "next/server";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  reimbursementRequests,
  teamMemberships,
  teams,
  userScopeRoles,
} from "@/db/schema";
import { canManageTeams, getAccessContext } from "@/lib/access";
import { requireUser } from "@/lib/rbac";

// Non-terminal statuses where an unresolved request still depends on its
// coach/creator. DRAFT is included because removing the author orphans an
// in-progress draft.
const OPEN_REQUEST_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "COACH_APPROVED",
  "ADMIN_APPROVED",
] as const;

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

  // Refuse to remove the team's only *approved* COACH: a coachless team
  // silently drops submission notifications and leaves new requests with
  // coachId=null. A pending (approved=false) coach self-join is not an approved
  // coach, so removing it is always allowed.
  if (membership.roleInTeam === "COACH" && membership.approved) {
    const coachCount = await db.$count(
      teamMemberships,
      and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.roleInTeam, "COACH"),
        eq(teamMemberships.approved, true),
      ),
    );
    if (coachCount <= 1) {
      return NextResponse.json(
        {
          error:
            "This is the team's only coach. Add a replacement coach before removing them.",
        },
        { status: 409 },
      );
    }
  }

  // Block removal while the member is the coach or creator of an open,
  // in-flight request — otherwise the request is orphaned (loses its coach
  // or author with no reassignment).
  const openRequest = await db.query.reimbursementRequests.findFirst({
    where: and(
      eq(reimbursementRequests.teamId, teamId),
      inArray(reimbursementRequests.status, OPEN_REQUEST_STATUSES),
      or(
        eq(reimbursementRequests.coachId, membership.userId),
        eq(reimbursementRequests.createdById, membership.userId),
      ),
    ),
    columns: { id: true },
  });
  if (openRequest) {
    return NextResponse.json(
      {
        error:
          "This member has open reimbursement requests (as coach or creator). Reassign the coach or resolve those requests before removing them.",
      },
      { status: 409 },
    );
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
