import Link from "next/link";
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
import { DownloadPdfLink } from "@/components/reimbursements/download-pdf-link";

const PAGE_SIZE = 10;
const INBOX_STATUSES = ["COACH_APPROVED", "ADMIN_APPROVED"] as const;

function adminEndpoint(requestId: string) {
  return `/api/requests/${requestId}/admin-decision`;
}

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "ADMIN") unauthorized();

  const { cursor } = await searchParams;
  const statusFilter = { in: [...INBOX_STATUSES] };

  const [requests, totalCount] = await Promise.all([
    db.reimbursementRequest.findMany({
      where: { status: statusFilter },
      include: {
        createdBy: true,
        team: true,
        receiptFiles: {
          include: {
            extraction: {
              include: { lineItems: { orderBy: { position: "asc" } } },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    db.reimbursementRequest.count({ where: { status: statusFilter } }),
  ]);

  const hasMore = requests.length > PAGE_SIZE;
  const items = hasMore ? requests.slice(0, PAGE_SIZE) : requests;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Inbox"
        badge={totalCount > 0 ? <Badge status={`${totalCount} pending`} /> : undefined}
        description="Review submitted requests, approve, reject, or mark paid."
      />

      {items.length === 0 && !cursor ? (
        <EmptyState
          title="No pending requests"
          description="All requests have been processed."
        />
      ) : (
        <>
          <div className="space-y-4">
            {items.map((request) => {
              const isAdminApproved = request.status === "ADMIN_APPROVED";
              const isCoachApproved = request.status === "COACH_APPROVED";
              const receiptsForEditor = serializeReceipts(request.receiptFiles);

              return (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/requests/${request.id}`} className="text-base font-semibold text-slate-900 hover:text-emerald-600 transition">{request.title}</Link>
                          <Badge status={request.status} />
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {request.team.name} &middot; {request.createdBy.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xl font-bold text-slate-900">
                          ${Number(request.requestedTotal).toFixed(2)}
                        </div>
                        <DownloadPdfLink requestId={request.id} />
                      </div>
                    </div>
                  </CardHeader>
                  {isCoachApproved && receiptsForEditor.length > 0 && (
                    <CardContent>
                      <EditableLineItems requestId={request.id} receipts={receiptsForEditor} />
                    </CardContent>
                  )}
                  <CardFooter>
                    <ApprovalDecision
                      requestId={request.id}
                      endpoint={adminEndpoint(request.id)}
                      allowMarkPaid={isAdminApproved}
                      showApproveReject={!isAdminApproved}
                    />
                  </CardFooter>
                </Card>
              );
            })}
          </div>
          <PaginationControls
            basePath="/admin/inbox"
            prevCursor={cursor ? items[0]?.id ?? null : null}
            nextCursor={nextCursor}
          />
        </>
      )}
    </div>
  );
}
