import Link from "next/link";
import { notFound, unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApprovalDecision } from "@/components/reimbursements/approval-decision";
import { EditableLineItems } from "@/components/reimbursements/editable-line-items";
import { ExtractionReview } from "@/components/reimbursements/extraction-review";
import { serializeReceipts } from "@/lib/reimbursements/serialize-receipts";
import { RequestTimeline } from "@/components/reimbursements/request-timeline";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { DownloadPdfLink } from "@/components/reimbursements/download-pdf-link";

const ADMIN_VISIBLE_STATUSES = [
  "COACH_APPROVED",
  "COACH_REJECTED",
  "ADMIN_APPROVED",
  "ADMIN_REJECTED",
  "PAID",
];

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "ADMIN") unauthorized();

  const { requestId } = await params;
  const request = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
    include: {
      createdBy: { select: { name: true, email: true } },
      team: { select: { id: true, name: true } },
      receiptFiles: {
        include: {
          extraction: {
            include: { lineItems: { orderBy: { position: "asc" } } },
          },
        },
      },
      approvals: {
        include: { actor: { select: { email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!request || !ADMIN_VISIBLE_STATUSES.includes(request.status)) {
    notFound();
  }

  const status = request.status;
  const canEditLineItems = status === "COACH_APPROVED";
  const receipts = serializeReceipts(request.receiptFiles);

  const isAdminApproved = status === "ADMIN_APPROVED";
  const canDecide = status === "COACH_APPROVED" || status === "ADMIN_APPROVED";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/inbox"
          className="text-sm text-slate-500 hover:text-emerald-600 transition"
        >
          &larr; Back to inbox
        </Link>
      </div>

      <PageHeader
        title={request.title}
        badge={<Badge status={status} />}
        description={`${request.team.name} · ${request.createdBy.name || request.createdBy.email}`}
        action={<DownloadPdfLink requestId={request.id} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="text-sm text-slate-500">Requested Total</div>
            <div className="text-2xl font-bold text-slate-900">
              ${Number(request.requestedTotal).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-slate-500">Team</div>
            <div className="text-lg font-semibold text-slate-900">
              <Link
                href={`/admin/teams/${request.team.id}`}
                className="text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                {request.team.name}
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-slate-500">Created</div>
            <div className="text-lg font-semibold text-slate-900">
              {request.createdAt.toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {canEditLineItems && receipts.length > 0 ? (
        <EditableLineItems requestId={request.id} receipts={receipts} />
      ) : (
        <ExtractionReview receipts={request.receiptFiles} />
      )}

      {canDecide ? (
        <Card>
          <CardFooter>
            <ApprovalDecision
              requestId={request.id}
              endpoint={`/api/requests/${request.id}/admin-decision`}
              showApproveReject={!isAdminApproved}
              allowMarkPaid={isAdminApproved}
            />
          </CardFooter>
        </Card>
      ) : null}

      <RequestTimeline
        items={request.approvals.map((approval) => ({
          id: approval.id,
          action: approval.action,
          actor: approval.actor.email,
          comment: approval.comment,
          createdAt: approval.createdAt,
        }))}
      />
    </div>
  );
}
