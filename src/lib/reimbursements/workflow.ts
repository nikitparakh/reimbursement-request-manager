import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertTransition } from "@/lib/reimbursements/status";
import { logAuditEvent } from "@/lib/audit/log";

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
  action: "APPROVE" | "REJECT" | "REOPEN" | "MARK_PAID";
  comment?: string;
}) {
  return db.$transaction(async (tx) => {
    const request = await tx.reimbursementRequest.findUniqueOrThrow({
      where: { id: input.requestId },
      include: { receiptFiles: { include: { extraction: true } } },
    });

    assertTransition(request.status, input.nextStatus);

    const requestedTotal =
      request.receiptFiles.reduce((sum, file) => {
        const amount = file.extraction?.total ? Number(file.extraction.total) : 0;
        return sum + amount;
      }, 0) || Number(request.requestedTotal);

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
