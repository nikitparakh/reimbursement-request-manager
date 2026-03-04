import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApprovalDecision } from "@/components/reimbursements/approval-decision";
import { EditableLineItems } from "@/components/reimbursements/editable-line-items";
import { serializeReceipts } from "@/lib/reimbursements/serialize-receipts";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

const PAGE_SIZE = 10;

export default async function ManagerInboxPage({
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

  const submittedFilter = {
    teamId: { in: managedTeamIds },
    status: "SUBMITTED" as const,
  };

  const [requests, totalCount] = await Promise.all([
    db.reimbursementRequest.findMany({
      where: submittedFilter,
      include: {
        createdBy: true,
        team: true,
        receiptFiles: {
          include: {
            extraction: {
              include: {
                lineItems: {
                  orderBy: { position: "asc" },
                },
              },
            },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    db.reimbursementRequest.count({ where: submittedFilter }),
  ]);

  const hasMore = requests.length > PAGE_SIZE;
  const items = hasMore ? requests.slice(0, PAGE_SIZE) : requests;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coach Inbox"
        badge={totalCount > 0 ? <Badge status={`${totalCount} pending`} /> : undefined}
        description="Review and approve submitted reimbursement requests."
      />

      {items.length === 0 && !cursor ? (
        <EmptyState
          title="No pending requests"
          description="All submitted requests have been reviewed."
        />
      ) : (
        <>
          <div className="space-y-4">
            {items.map((request) => {
              const receiptsForEditor = serializeReceipts(request.receiptFiles);

              return (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{request.title}</h3>
                        <p className="text-sm text-slate-500">
                          {request.team.name} &middot; {request.createdBy.email}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-slate-900">
                          ${Number(request.requestedTotal).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <EditableLineItems requestId={request.id} receipts={receiptsForEditor} />
                  </CardContent>
                  <CardFooter>
                    <ApprovalDecision
                      requestId={request.id}
                      endpoint={`/api/requests/${request.id}/manager-decision`}
                    />
                  </CardFooter>
                </Card>
              );
            })}
          </div>
          <PaginationControls
            basePath="/manager/inbox"
            prevCursor={cursor ? items[0]?.id ?? null : null}
            nextCursor={nextCursor}
          />
        </>
      )}
    </div>
  );
}
