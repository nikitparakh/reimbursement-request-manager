import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { transitionRequestStatus } from "@/lib/reimbursements/workflow";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/rbac";
import { invalidateApprovalCaches } from "@/lib/reimbursements/cache";
import { sendNotification } from "@/lib/notifications/sender";
import { getAdminReviewRecipientEmails } from "@/lib/notifications/admin-review-recipients";
import { getRequestAccess } from "@/lib/reimbursements/request-access";

const schema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().max(1000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let actorId = "";
  try {
    actorId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;
  const requestAccess = await getRequestAccess(actorId, requestId);
  if (!requestAccess || !requestAccess.canView) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (!requestAccess.isCoach && !requestAccess.isReimbursementAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const current = requestAccess.request;

  if (body.data.decision === "REJECT" && !body.data.comment) {
    return NextResponse.json(
      { error: "Rejection comment is required" },
      { status: 400 }
    );
  }

  const updated = await transitionRequestStatus({
    requestId,
    actorId,
    nextStatus: body.data.decision === "APPROVE" ? "COACH_APPROVED" : "COACH_REJECTED",
    action: body.data.decision,
    comment: body.data.comment,
  });
  invalidateApprovalCaches(current.teamId);
  const [creator, actor, adminEmails] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, current.createdById) }),
    db.query.users.findFirst({ where: eq(users.id, actorId) }),
    getAdminReviewRecipientEmails({
      districtId: current.team.school.districtId,
      schoolId: current.team.schoolId,
      programId: current.team.programId,
    }),
  ]);
  if (creator?.email && actor?.email) {
    const event = body.data.decision === "APPROVE" ? "COACH_APPROVED" as const : "COACH_REJECTED" as const;
    const reviewerLabel = requestAccess.isReimbursementAdmin ? "Admin" : "Coach";
    const message = `${reviewerLabel} ${body.data.decision.toLowerCase()}d reimbursement: ${current.title}`;

    await sendNotification(event, {
      requestId,
      actorEmail: actor.email,
      recipients: [creator.email],
      message,
    });

    if (body.data.decision === "APPROVE") {
      const otherAdminEmails = adminEmails.filter((email) => email !== actor.email);
      if (otherAdminEmails.length > 0) {
        await sendNotification("COACH_APPROVED", {
          requestId,
          actorEmail: actor.email,
          recipients: otherAdminEmails,
          message: `Reimbursement ready for admin review: ${current.title}`,
        });
      }
    }
  }

  return NextResponse.json(updated);
}
