import { NextResponse } from "next/server";
import { transitionRequestStatus } from "@/lib/reimbursements/workflow";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { invalidateApprovalCaches } from "@/lib/reimbursements/cache";
import { sendNotification } from "@/lib/notifications/sender";

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
  if (!current || current.createdById !== userId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const skipCoachApproval =
    userRole === "ADMIN" || current.coachId === userId;

  let updated = await transitionRequestStatus({
    requestId,
    actorId: userId,
    nextStatus: "SUBMITTED",
    action: "SUBMIT",
    comment: "Submitted for review",
  });

  if (skipCoachApproval) {
    updated = await transitionRequestStatus({
      requestId,
      actorId: userId,
      nextStatus: "COACH_APPROVED",
      action: "APPROVE",
      comment: "Auto-approved (submitted by coach/admin)",
    });
    invalidateApprovalCaches(current.teamId);

    const [actor, admins] = await Promise.all([
      db.user.findUnique({ where: { id: userId } }),
      db.user.findMany({ where: { role: "ADMIN" }, select: { email: true } }),
    ]);
    if (actor?.email) {
      const adminEmails = admins
        .map((a) => a.email)
        .filter((e): e is string => !!e && e !== actor.email);
      if (adminEmails.length > 0) {
        await sendNotification("COACH_APPROVED", {
          requestId,
          actorEmail: actor.email,
          recipients: adminEmails,
          message: `Reimbursement ready for admin review: ${updated.title}`,
        });
      }
    }
  } else if (current.coachId) {
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
