import { NextResponse } from "next/server";
import { transitionRequestStatus } from "@/lib/reimbursements/workflow";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { getRequestAccess } from "@/lib/reimbursements/request-access";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let userId = "";
  try {
    const user = await requireUser();
    userId = user.id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;
  const requestAccess = await getRequestAccess(userId, requestId);
  if (!requestAccess) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (!requestAccess.canReopen) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (
    requestAccess.request.status !== "COACH_REJECTED" &&
    requestAccess.request.status !== "ADMIN_REJECTED"
  ) {
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
