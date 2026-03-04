import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CollapsibleRequestCard } from "@/components/reimbursements/collapsible-request-card";
import { ExtractionReview } from "@/components/reimbursements/extraction-review";
import { RequestTimeline } from "@/components/reimbursements/request-timeline";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function TeamReimbursementsPage() {
  const session = await auth();
  if (!session?.user) unauthorized();

  const managedTeamIds = (
    await db.teamMembership.findMany({
      where: { userId: session.user.id, roleInTeam: "MANAGER", approved: true },
      select: { teamId: true },
    })
  ).map((item) => item.teamId);

  const requests = await db.reimbursementRequest.findMany({
    where: {
      teamId: { in: managedTeamIds },
    },
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
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Reimbursements"
        description="View all reimbursement requests across your managed teams."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No team requests"
          description="There are no reimbursement requests for your teams yet."
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
      )}
    </div>
  );
}
