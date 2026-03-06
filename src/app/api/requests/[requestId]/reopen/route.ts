import { NextResponse } from "next/server";
import { transitionRequestStatus } from "@/lib/reimbursements/workflow";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let userId = "";
  let userRole = "STUDENT";
  try {
    const user = await requireUser();
    userId = user.id;
    userRole = user.role;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;
  const current = await db.reimbursementRequest.findUnique({ where: { id: requestId } });
  if (!current) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const isOwner = current.createdById === userId;
  const isAdmin = userRole === "ADMIN";
  const isTeamCoach =
    userRole === "COACH" &&
    !!(await db.teamMembership.findFirst({
      where: {
        userId,
        teamId: current.teamId,
        roleInTeam: "COACH",
        approved: true,
      },
    }));

  if (!isOwner && !isAdmin && !isTeamCoach) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (current.status !== "COACH_REJECTED" && current.status !== "ADMIN_REJECTED") {
    return NextResponse.json(
      { error: "Only rejected requests can be reopened" },
      { status: 400 }
    );
  }

  const updated = await transitionRequestStatus({
    requestId,
    actorId: userId,
    nextStatus: "DRAFT",
    action: "REOPEN",
  });

  return NextResponse.json(updated);
}
