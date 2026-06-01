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

  // Segregation of duties: a coach/admin may not approve or reject their own request.
  if (actorId === current.createdById) {
    return NextResponse.json(
      { error: "You cannot review your own reimbursement request" },
      { status: 403 }
    );
  }

  if (body.data.decision === "REJECT" && !body.data.comment) {
    return NextResponse.json(
      { error: "Rejection comment is required" },
      { status: 400 }
    );
  }

  // Precondition: coach decisions are only valid on SUBMITTED requests. A stale
  // tab acting on an already-reviewed request gets a clear 409 (not a 500).
  if (current.status !== "SUBMITTED") {
    return NextResponse.json(
      { error: "This request has already been reviewed. Please refresh." },
      { status: 409 }
    );
  }

  let updated;
  try {
    updated = await transitionRequestStatus({
      requestId,
      actorId,
      nextStatus: body.data.decision === "APPROVE" ? "COACH_APPROVED" : "COACH_REJECTED",
      action: body.data.decision,
      comment: body.data.comment,
    });
  } catch {
    // Stale/concurrent decision (STALE_TRANSITION) or invalid transition: the
    // request was reviewed by someone else first. Surface a friendly 409.
    return NextResponse.json(
      { error: "This request has already been reviewed. Please refresh." },
      { status: 409 }
    );
  }
  invalidateApprovalCaches(current.teamId);

  // Notifications are non-fatal: a notify failure must never 500 a committed
  // transition. Wrap the entire fan-out in try/catch.
  try {
    const [creator, actor, adminEmails] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, current.createdById) }),
      db.query.users.findFirst({ where: eq(users.id, actorId) }),
      getAdminReviewRecipientEmails({
        districtId: current.team.school.districtId,
        schoolId: current.team.schoolId,
        programId: current.team.programId,
      }),
    ]);

    const event = body.data.decision === "APPROVE" ? "COACH_APPROVED" as const : "COACH_REJECTED" as const;
    const reviewerLabel = requestAccess.isReimbursementAdmin ? "Admin" : "Coach";
    const verbMap = { APPROVE: "approved", REJECT: "rejected" } as const;
    const message = `${reviewerLabel} ${verbMap[body.data.decision]} reimbursement: ${current.title}`;

    // Notify the creator (fall back to userId when no email).
    await sendNotification(event, {
      requestId,
      actorEmail: actor?.email ?? actorId,
      recipients: [creator?.email ?? current.createdById],
      message,
    });

    // Admin fan-out for the approve path is NOT gated on the creator having an
    // email; de-dup against both the actor and the creator.
    if (body.data.decision === "APPROVE") {
      const excluded = new Set(
        [actor?.email, creator?.email].filter((e): e is string => Boolean(e))
      );
      const otherAdminEmails = adminEmails.filter((email) => !excluded.has(email));
      if (otherAdminEmails.length > 0) {
        await sendNotification("COACH_APPROVED", {
          requestId,
          actorEmail: actor?.email ?? actorId,
          recipients: otherAdminEmails,
          message: `Reimbursement ready for admin review: ${current.title}`,
        });
      }
    }
  } catch {
    // Swallow notification failures: the transition is already committed.
  }

  return NextResponse.json(updated);
}
