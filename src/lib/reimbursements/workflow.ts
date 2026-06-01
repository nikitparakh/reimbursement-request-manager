import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { approvalActions, auditLogs, reimbursementRequests } from "@/db/schema";
import {
  assertTransition,
  TransitionConflictError,
} from "@/lib/reimbursements/status";
import { aggregateReimbursableTotals } from "@/lib/parsing/aggregate";

export async function transitionRequestStatus(input: {
  requestId: string;
  actorId: string;
  nextStatus:
    | "SUBMITTED"
    | "COACH_APPROVED"
    | "COACH_REJECTED"
    | "ADMIN_APPROVED"
    | "ADMIN_REJECTED"
    | "PAID"
    | "DRAFT";
  action: "APPROVE" | "REJECT" | "REOPEN" | "MARK_PAID" | "SUBMIT";
  comment?: string;
}) {
  // D1 has no interactive transactions: read first, then apply the writes
  // atomically with db.batch().
  const request = await db.query.reimbursementRequests.findFirst({
    where: eq(reimbursementRequests.id, input.requestId),
    with: {
      receiptFiles: {
        with: { extraction: { with: { lineItems: true } } },
      },
    },
  });
  if (!request) throw new Error("Reimbursement request not found");

  // Capture the status we read so the write can be conditioned on it; if the
  // request moved underneath us between the read and the write, the conditional
  // UPDATE matches 0 rows and we surface a recognizable conflict.
  const fromStatus = request.status;

  assertTransition(fromStatus, input.nextStatus);

  // The reimbursable total is pinned at submission time. Recompute it only up
  // to (and including) the SUBMITTED transition; never re-derive it on
  // COACH_APPROVED/ADMIN_APPROVED/COACH_REJECTED/ADMIN_REJECTED/PAID/DRAFT so
  // the amount that is reviewed and finally PAID matches what was submitted.
  const recomputeTotal = input.nextStatus === "SUBMITTED";
  const requestedTotal = recomputeTotal
    ? (() => {
        const extractions = request.receiptFiles
          .map((f) => f.extraction)
          .filter((e): e is NonNullable<typeof e> => Boolean(e));
        return extractions.length > 0
          ? aggregateReimbursableTotals(extractions)
          : Number(request.requestedTotal);
      })()
    : Number(request.requestedTotal);

  // Set submittedAt the first time the request becomes SUBMITTED; preserve an
  // earlier submittedAt on resubmit. Clear it when the request is reopened to
  // DRAFT so a stale submission time does not leak into the PDF/inbox.
  let submittedAt = request.submittedAt;
  if (input.nextStatus === "SUBMITTED") {
    submittedAt = request.submittedAt ?? new Date();
  } else if (input.nextStatus === "DRAFT") {
    submittedAt = null;
  }

  const updatedRows = await db
    .update(reimbursementRequests)
    .set({
      status: input.nextStatus,
      requestedTotal: Number(requestedTotal.toFixed(2)),
      submittedAt,
    })
    .where(
      and(
        eq(reimbursementRequests.id, request.id),
        eq(reimbursementRequests.status, fromStatus),
      ),
    )
    .returning();

  // The conditional UPDATE above is an atomic compare-and-swap on the
  // from-status. If it matched no rows, the request's status changed between our
  // read and write (concurrent decision / lost-update race): abort WITHOUT
  // writing the approvalAction/auditLog rows. A zero-row UPDATE is not an error,
  // so folding these inserts into the same db.batch() would still COMMIT them on
  // D1 and record a transition that never happened. Gate them behind the winning
  // update instead — only the racer whose UPDATE matched gets to log side effects.
  if (updatedRows.length === 0) {
    throw new TransitionConflictError(
      "STALE_TRANSITION",
      `Request ${request.id} was no longer in status ${fromStatus}`,
    );
  }

  await db.batch([
    db.insert(approvalActions).values({
      requestId: request.id,
      actorId: input.actorId,
      action: input.action,
      comment: input.comment,
    }),
    db.insert(auditLogs).values({
      actorId: input.actorId,
      requestId: request.id,
      eventType: "REQUEST_STATUS_UPDATED",
      message: `Request moved from ${fromStatus} to ${input.nextStatus}`,
      metadata: {
        from: fromStatus,
        to: input.nextStatus,
        action: input.action,
        comment: input.comment ?? null,
      },
    }),
  ]);

  return updatedRows[0];
}
