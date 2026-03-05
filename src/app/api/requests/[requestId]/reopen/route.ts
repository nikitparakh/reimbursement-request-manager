import { NextResponse } from "next/server";
import { transitionRequestStatus } from "@/lib/reimbursements/workflow";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;
  const current = await db.reimbursementRequest.findUnique({ where: { id: requestId } });
  if (!current || current.createdById !== userId) {
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
