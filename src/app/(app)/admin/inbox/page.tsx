import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApprovalDecision } from "@/components/reimbursements/approval-decision";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminInboxPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "ADMIN") unauthorized();

  const requests = await db.reimbursementRequest.findMany({
    where: {
      status: { in: ["MANAGER_APPROVED", "ADMIN_APPROVED"] },
    },
    include: { createdBy: true, team: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Inbox"
        badge={requests.length > 0 ? <Badge status={`${requests.length} pending`} /> : undefined}
        description="Final approval and payment processing for reimbursement requests."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No pending requests"
          description="All requests have been processed."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{request.title}</h3>
                      <Badge status={request.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {request.team.name} &middot; {request.createdBy.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-slate-900">
                      ${request.requestedTotal.toString()}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardFooter>
                <ApprovalDecision
                  requestId={request.id}
                  endpoint={`/api/requests/${request.id}/admin-decision`}
                  allowMarkPaid
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
