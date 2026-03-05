import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CollapsibleRequestCard } from "@/components/reimbursements/collapsible-request-card";
import { ExtractionReview } from "@/components/reimbursements/extraction-review";
import { RequestTimeline } from "@/components/reimbursements/request-timeline";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

const PAGE_SIZE = 10;

export default async function UserRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; dir?: string }>;
}) {
  const session = await auth();
  if (!session?.user) unauthorized();

  const { cursor, dir } = await searchParams;

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
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = requests.length > PAGE_SIZE;
  const items = hasMore ? requests.slice(0, PAGE_SIZE) : requests;
  const nextCursor = hasMore ? items[items.length - 1].id : null;
  const prevCursor = cursor && dir !== "prev" ? cursor : cursor && items.length > 0 ? items[0].id : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Requests"
        description="View all your reimbursement requests and their statuses."
      />

      {items.length === 0 && !cursor ? (
        <EmptyState
          title="No requests yet"
          description="You haven't submitted any reimbursement requests."
        />
      ) : (
        <>
          <div className="space-y-4">
            {items.map((request) => (
              <CollapsibleRequestCard
                key={request.id}
                title={request.title}
                status={request.status}
                requestedTotal={`$${Number(request.requestedTotal).toFixed(2)}`}
                createdAt={request.createdAt.toLocaleDateString()}
                href={request.status === "DRAFT" ? `/user/requests/${request.id}` : undefined}
                requestId={request.id}
                isDraft={request.status === "DRAFT"}
                isRejected={request.status === "COACH_REJECTED" || request.status === "ADMIN_REJECTED"}
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
          <PaginationControls
            basePath="/user/requests"
            prevCursor={cursor ? items[0]?.id ?? null : null}
            nextCursor={nextCursor}
          />
        </>
      )}
    </div>
  );
}
