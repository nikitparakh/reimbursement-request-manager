import { notFound, unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ExtractionReview } from "@/components/reimbursements/extraction-review";
import { RequestActions } from "@/components/reimbursements/request-actions";
import { RequestTimeline } from "@/components/reimbursements/request-timeline";

export default async function StudentRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const session = await auth();
  if (!session?.user) unauthorized();

  const { requestId } = await params;
  const requestRecord = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
    include: {
      receiptFiles: { include: { extraction: { include: { lineItems: { orderBy: { position: "asc" } } } } } },
      approvals: { include: { actor: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!requestRecord || requestRecord.createdById !== session.user.id) {
    notFound();
  }

  return (
    <section>
      <h1>{requestRecord.title}</h1>
      <p>Status: {requestRecord.status}</p>
      <p>Requested total: ${requestRecord.requestedTotal.toString()}</p>

      <RequestActions requestId={requestRecord.id} />
      <ExtractionReview receipts={requestRecord.receiptFiles} />
      <RequestTimeline
        items={requestRecord.approvals.map((approval) => ({
          id: approval.id,
          action: approval.action,
          actor: approval.actor.email,
          comment: approval.comment,
          createdAt: approval.createdAt,
        }))}
      />
    </section>
  );
}
