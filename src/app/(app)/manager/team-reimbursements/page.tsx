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

export default async function TeamReimbursementsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") unauthorized();

  const { cursor } = await searchParams;

  const managedTeamIds = (
    await db.teamMembership.findMany({
      where: { userId: session.user.id, roleInTeam: "MANAGER", approved: true },
      select: { teamId: true },
    })
  ).map((item) => item.teamId);

  const teamFilter = { teamId: { in: managedTeamIds } };

  const requests = await db.reimbursementRequest.findMany({
    where: teamFilter,
    include: {
      createdBy: true,
      team: true,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Reimbursements"
        description="View all reimbursement requests across your managed teams."
      />

      {items.length === 0 && !cursor ? (
        <EmptyState
          title="No team requests"
          description="There are no reimbursement requests for your teams yet."
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
                subtitle={`${request.team.name} · ${request.createdBy.email}`}
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
            basePath="/manager/team-reimbursements"
            prevCursor={cursor ? items[0]?.id ?? null : null}
            nextCursor={nextCursor}
          />
        </>
      )}
    </div>
  );
}
