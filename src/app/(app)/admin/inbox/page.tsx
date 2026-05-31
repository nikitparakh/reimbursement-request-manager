import Link from "next/link";
import { unauthorized } from "next/navigation";
import { and, desc, eq, inArray, lt } from "drizzle-orm";

import { ApprovalDecision } from "@/components/reimbursements/approval-decision";
import { EditableLineItems } from "@/components/reimbursements/editable-line-items";
import { serializeReceipts } from "@/lib/reimbursements/serialize-receipts";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DownloadPdfLink } from "@/components/reimbursements/download-pdf-link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { reimbursementRequests } from "@/db/schema";
import { getCachedAccessContext } from "@/lib/access";
import { buildManagedReimbursementWhere } from "@/lib/admin-scope";

const PAGE_SIZE = 10;
const INBOX_STATUSES = ["SUBMITTED", "COACH_APPROVED"] as const;

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
  const access = await getCachedAccessContext(session.user.id);
  if (!access.canManageReimbursements) unauthorized();

  const { cursor } = await searchParams;
  const scopedWhere = buildManagedReimbursementWhere(access);

  const baseWhere = and(
    scopedWhere,
    inArray(reimbursementRequests.status, [...INBOX_STATUSES])
  );

  // D1 has no Prisma-style row cursor: resolve the cursor row's updatedAt and
  // page on `updatedAt < cursor.updatedAt` to mirror `orderBy updatedAt desc`.
  let cursorWhere = baseWhere;
  if (cursor) {
    const cursorRow = await db.query.reimbursementRequests.findFirst({
      where: eq(reimbursementRequests.id, cursor),
      columns: { updatedAt: true },
    });
    if (cursorRow) {
      cursorWhere = and(
        baseWhere,
        lt(reimbursementRequests.updatedAt, cursorRow.updatedAt)
      );
    }
  }

  const [requests, totalCount] = await Promise.all([
    db.query.reimbursementRequests.findMany({
      where: cursorWhere,
      with: {
        createdBy: true,
        team: true,
        receiptFiles: {
          with: {
            extraction: {
              with: {
                lineItems: {
                  orderBy: (t, { asc }) => asc(t.position),
                  with: {
                    comments: {
                      orderBy: (t, { asc }) => asc(t.createdAt),
                      with: { author: { columns: { email: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: desc(reimbursementRequests.updatedAt),
      limit: PAGE_SIZE + 1,
    }),
    db.$count(reimbursementRequests, baseWhere),
  ]);

  const hasMore = requests.length > PAGE_SIZE;
  const items = hasMore ? requests.slice(0, PAGE_SIZE) : requests;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Inbox"
        badge={totalCount > 0 ? <StatusBadge status={`${totalCount} pending`} /> : undefined}
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
              const isCoachApproved = request.status === "COACH_APPROVED";
              const receiptsForEditor = serializeReceipts(request.receiptFiles);

              return (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/requests/${request.id}`}
                            className="text-base font-semibold text-foreground transition-colors hover:text-primary"
                          >
                            {request.title}
                          </Link>
                          <StatusBadge status={request.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {request.team.name} &middot; {request.createdBy.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xl font-bold text-foreground">
                          ${Number(request.requestedTotal).toFixed(2)}
                        </div>
                        <DownloadPdfLink requestId={request.id} />
                      </div>
                    </div>
                  </CardHeader>
                  {isCoachApproved && receiptsForEditor.length > 0 && (
                    <CardContent>
                      <EditableLineItems requestId={request.id} receipts={receiptsForEditor} canComment />
                    </CardContent>
                  )}
                  <CardFooter>
                    <ApprovalDecision
                      requestId={request.id}
                      endpoint={adminEndpoint(request.id)}
                      allowMarkPaid={isCoachApproved}
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
