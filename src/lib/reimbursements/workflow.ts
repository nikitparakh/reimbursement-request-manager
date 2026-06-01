import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { approvalActions, auditLogs, reimbursementRequests } from "@/db/schema";
import { assertTransition } from "@/lib/reimbursements/status";
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

  assertTransition(request.status, input.nextStatus);

  const extractions = request.receiptFiles
    .map((f) => f.extraction)
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const requestedTotal =
    extractions.length > 0
      ? aggregateReimbursableTotals(extractions)
      : Number(request.requestedTotal);

  const submittedAt =
    input.nextStatus === "SUBMITTED" ? new Date() : request.submittedAt;

  const [updatedRows] = await db.batch([
    db
      .update(reimbursementRequests)
      .set({
        status: input.nextStatus,
        requestedTotal: Number(requestedTotal.toFixed(2)),
        submittedAt,
      })
      .where(eq(reimbursementRequests.id, request.id))
      .returning(),
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
      message: `Request moved from ${request.status} to ${input.nextStatus}`,
      metadata: {
        from: request.status,
        to: input.nextStatus,
        action: input.action,
        comment: input.comment ?? null,
      },
    }),
  ]);

  return updatedRows[0];
}
