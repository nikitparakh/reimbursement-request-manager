import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { transitionRequestStatus } from "@/lib/reimbursements/workflow";
import { isTransitionConflict } from "@/lib/reimbursements/status";
import { db } from "@/lib/db";
import { users, receiptFiles } from "@/db/schema";
import { requireUser } from "@/lib/rbac";
import { invalidateApprovalCaches } from "@/lib/reimbursements/cache";
import { sendNotification } from "@/lib/notifications/sender";
import { getAdminReviewRecipientEmails } from "@/lib/notifications/admin-review-recipients";
import { getRequestAccess } from "@/lib/reimbursements/request-access";
import { findTeamCoach } from "@/lib/reimbursements/repository";
import { aggregateReimbursableTotals } from "@/lib/parsing/aggregate";

function isStaleOrInvalidTransition(error: unknown) {
  // Both the illegal-transition and stale/lost-update races throw a typed
  // TransitionConflictError (code INVALID_TRANSITION / STALE_TRANSITION). Match
  // on the type, not the message text, so a double-click submit returns 409
  // instead of leaking through as a 500.
  return isTransitionConflict(error);
}

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

  // Content gate: a request cannot be submitted unless it has at least one
  // receipt, at least one parsed extraction, and a positive reimbursable total.
  // The client merely hides the Submit button, so this must be enforced here.
  const files = await db.query.receiptFiles.findMany({
    where: eq(receiptFiles.requestId, requestId),
    with: { extraction: { with: { lineItems: true } } },
  });

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Add at least one receipt before submitting." },
      { status: 400 }
    );
  }

  const extractions = files
    .map((f) => f.extraction)
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  if (extractions.length === 0) {
    return NextResponse.json(
      {
        error:
          "Your receipts are still being processed. Wait for parsing to finish before submitting.",
      },
      { status: 400 }
    );
  }

  if (aggregateReimbursableTotals(extractions) <= 0) {
    return NextResponse.json(
      {
        error:
          "The reimbursable total must be greater than $0 before you can submit.",
      },
      { status: 400 }
    );
  }

  // Resolve the CURRENT coach at submit time rather than a stale coachId that
  // was snapshotted when the draft was created.
  const currentCoach = await findTeamCoach(current.teamId);
  const skipCoachApproval =
    requestAccess.isReimbursementAdmin || currentCoach?.userId === userId;

  // No-coach dead-letter guard: a plain member submitting on a team with no
  // coach would otherwise transition to SUBMITTED with zero notifications and a
  // misleading "Submitted to coach" toast. Block it unless scoped admins can be
  // notified instead.
  if (!skipCoachApproval && !currentCoach) {
    const adminEmails = await getAdminReviewRecipientEmails({
      districtId: current.team.school.districtId,
      schoolId: current.team.schoolId,
      programId: current.team.programId,
    });
    if (adminEmails.length === 0) {
      return NextResponse.json(
        {
          error:
            "Your team has no coach assigned yet. Ask an administrator to assign a coach before submitting.",
        },
        { status: 409 }
      );
    }
  }

  let updated;
  try {
    updated = await transitionRequestStatus({
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
    }
  } catch (error) {
    if (isStaleOrInvalidTransition(error)) {
      return NextResponse.json(
        { error: "This request has already been submitted." },
        { status: 409 }
      );
    }
    throw error;
  }

  if (skipCoachApproval) {
    invalidateApprovalCaches(current.teamId);

    const [actor, adminEmails] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, userId) }),
      getAdminReviewRecipientEmails({
        districtId: current.team.school.districtId,
        schoolId: current.team.schoolId,
        programId: current.team.programId,
      }),
    ]);
    if (actor?.email) {
      const otherAdminEmails = adminEmails.filter((email) => email !== actor.email);
      if (otherAdminEmails.length > 0) {
        try {
          await sendNotification("COACH_APPROVED", {
            requestId,
            actorEmail: actor.email,
            recipients: otherAdminEmails,
            message: `Reimbursement ready for admin review: ${updated.title}`,
          });
        } catch {
          // Non-fatal: the transition is already committed; never 500 a
          // successful submit because a notification failed.
        }
      }
      // Notify the creator that their own submission was auto-approved at the
      // initial review stage (otherwise a sole-admin submitter gets no signal).
      try {
        await sendNotification("COACH_APPROVED", {
          requestId,
          actorEmail: actor.email,
          recipients: [actor.email],
          message: `Your reimbursement was auto-approved at the initial review stage: ${updated.title}`,
        });
      } catch {
        // Non-fatal.
      }
    }
  } else if (currentCoach) {
    const [coach, actor] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, currentCoach.userId) }),
      db.query.users.findFirst({ where: eq(users.id, userId) }),
    ]);
    if (actor?.email) {
      try {
        await sendNotification("REQUEST_SUBMITTED", {
          requestId,
          actorEmail: actor.email,
          // Fall back to the coach's userId when no email is recorded so the
          // current coach is still notified.
          recipients: [coach?.email ?? currentCoach.userId],
          message: `A reimbursement request was submitted: ${updated.title}`,
        });
      } catch {
        // Non-fatal.
      }
    }
  } else {
    // No coach on the team, but scoped admins exist (verified above): route the
    // submission to them so it is never silently dead-lettered.
    const [actor, adminEmails] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, userId) }),
      getAdminReviewRecipientEmails({
        districtId: current.team.school.districtId,
        schoolId: current.team.schoolId,
        programId: current.team.programId,
      }),
    ]);
    if (actor?.email) {
      const recipients = adminEmails.filter((email) => email !== actor.email);
      if (recipients.length > 0) {
        try {
          await sendNotification("REQUEST_SUBMITTED", {
            requestId,
            actorEmail: actor.email,
            recipients,
            message: `A reimbursement request was submitted and needs a coach: ${updated.title}`,
          });
        } catch {
          // Non-fatal.
        }
      }
    }
  }

  return NextResponse.json(updated);
}
