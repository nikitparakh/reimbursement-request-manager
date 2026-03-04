import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApprovalDecision } from "@/components/reimbursements/approval-decision";
import { EditableLineItems } from "@/components/reimbursements/editable-line-items";
import { serializeReceipts } from "@/lib/reimbursements/serialize-receipts";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ManagerInboxPage() {
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
      status: "SUBMITTED",
    },
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
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coach Inbox"
        badge={requests.length > 0 ? <Badge status={`${requests.length} pending`} /> : undefined}
        description="Review and approve submitted reimbursement requests."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No pending requests"
          description="All submitted requests have been reviewed."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
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
      )}
    </div>
  );
}
