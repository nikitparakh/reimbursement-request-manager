import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertTransition } from "@/lib/reimbursements/status";
import { logAuditEvent } from "@/lib/audit/log";
import { aggregateReimbursableTotals } from "@/lib/parsing/aggregate";

export async function transitionRequestStatus(input: {
  requestId: string;
  actorId: string;
  nextStatus:
    | "SUBMITTED"
    | "MANAGER_APPROVED"
    | "MANAGER_REJECTED"
    | "ADMIN_APPROVED"
    | "ADMIN_REJECTED"
    | "PAID"
    | "DRAFT";
  action: "APPROVE" | "REJECT" | "REOPEN" | "MARK_PAID" | "SUBMIT";
  comment?: string;
}) {
  return db.$transaction(async (tx) => {
    const request = await tx.reimbursementRequest.findUniqueOrThrow({
      where: { id: input.requestId },
      include: {
        receiptFiles: {
          include: { extraction: { include: { lineItems: true } } },
        },
      },
    });

    assertTransition(request.status, input.nextStatus);

    const extractions = request.receiptFiles
      .map((f) => f.extraction)
      .filter((e): e is NonNullable<typeof e> => Boolean(e));
    const requestedTotal =
      extractions.length > 0
        ? aggregateReimbursableTotals(extractions)
        : Number(request.requestedTotal);

    const updated = await tx.reimbursementRequest.update({
      where: { id: request.id },
      data: {
        status: input.nextStatus,
        requestedTotal: new Prisma.Decimal(requestedTotal.toFixed(2)),
        submittedAt: input.nextStatus === "SUBMITTED" ? new Date() : request.submittedAt,
      },
    });

    await tx.approvalAction.create({
      data: {
        requestId: request.id,
        actorId: input.actorId,
        action: input.action,
        comment: input.comment,
      },
    });

    await logAuditEvent(
      {
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
      },
      tx
    );

    return updated;
  });
}
