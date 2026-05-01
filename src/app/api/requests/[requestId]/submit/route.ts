import { NextResponse } from "next/server";
import { transitionRequestStatus } from "@/lib/reimbursements/workflow";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { invalidateApprovalCaches } from "@/lib/reimbursements/cache";
import { sendNotification } from "@/lib/notifications/sender";
import { getAdminReviewRecipientEmails } from "@/lib/notifications/admin-review-recipients";
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
  if (!requestAccess || requestAccess.request.createdById !== userId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const current = requestAccess.request;
  const skipCoachApproval =
    requestAccess.isReimbursementAdmin || current.coachId === userId;

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
      comment:
        "Auto-approved at the initial review stage (submitted by a coach or reimbursement admin)",
    });
    invalidateApprovalCaches(current.teamId);

    const [actor, adminEmails] = await Promise.all([
      db.user.findUnique({ where: { id: userId } }),
      getAdminReviewRecipientEmails({
        districtId: current.team.school.districtId,
        schoolId: current.team.schoolId,
        programId: current.team.programId,
      }),
    ]);
    if (actor?.email) {
      const otherAdminEmails = adminEmails.filter((email) => email !== actor.email);
      if (otherAdminEmails.length > 0) {
        await sendNotification("COACH_APPROVED", {
          requestId,
          actorEmail: actor.email,
          recipients: otherAdminEmails,
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
