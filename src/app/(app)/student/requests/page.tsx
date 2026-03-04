import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CollapsibleRequestCard } from "@/components/reimbursements/collapsible-request-card";
import { ExtractionReview } from "@/components/reimbursements/extraction-review";
import { RequestTimeline } from "@/components/reimbursements/request-timeline";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function StudentRequestsPage() {
  const session = await auth();
  if (!session?.user) unauthorized();

  const requests = await db.reimbursementRequest.findMany({
    where: { createdById: session.user.id },
    include: {
      receiptFiles: {
        include: {
          extraction: {
            include: {
              lineItems: { orderBy: { position: "asc" } },
            },
          },
        },
      },
      approvals: { include: { actor: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Requests"
        description="View all your reimbursement requests and their statuses."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No requests yet"
          description="You haven't submitted any reimbursement requests."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <CollapsibleRequestCard
              key={request.id}
              title={request.title}
              status={request.status}
              requestedTotal={`$${Number(request.requestedTotal).toFixed(2)}`}
              createdAt={request.createdAt.toLocaleDateString()}
              href={request.status === "DRAFT" ? `/student/requests/${request.id}` : undefined}
              requestId={request.id}
              isDraft={request.status === "DRAFT"}
            >
              <ExtractionReview receipts={request.receiptFiles} />
              <RequestTimeline
                items={request.approvals.map((approval) => ({
                  id: approval.id,
                  action: approval.action,
                  actor: approval.actor.email,
                  comment: approval.comment,
                  createdAt: approval.createdAt,
                }))}
              />
            </CollapsibleRequestCard>
          ))}
        </div>
      )}
    </div>
  );
}
