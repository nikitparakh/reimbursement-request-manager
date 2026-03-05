import { NextResponse } from "next/server";
import { transitionRequestStatus } from "@/lib/reimbursements/workflow";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { sendNotification } from "@/lib/notifications/sender";

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

  const updated = await transitionRequestStatus({
    requestId,
    actorId: userId,
    nextStatus: "SUBMITTED",
    action: "SUBMIT",
    comment: "Submitted for review",
  });

  if (current.coachId) {
    const [coach, actor] = await Promise.all([
      db.user.findUnique({ where: { id: current.coachId } }),
      db.user.findUnique({ where: { id: userId } }),
    ]);
    if (coach?.email && actor?.email) {
      await sendNotification("REQUEST_SUBMITTED", {
        requestId,
        actorEmail: actor.email,
        recipients: [coach.email],
        message: `A reimbursement request was submitted: ${updated.title}`,
      });
    }
  }

  return NextResponse.json(updated);
}
