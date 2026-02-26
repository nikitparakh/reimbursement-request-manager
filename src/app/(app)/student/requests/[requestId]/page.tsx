import { notFound, unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ExtractionReview } from "@/components/reimbursements/extraction-review";
import { RequestActions } from "@/components/reimbursements/request-actions";
import { RequestTimeline } from "@/components/reimbursements/request-timeline";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function StudentRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const session = await auth();
  if (!session?.user) unauthorized();

  const { requestId } = await params;
  const requestRecord = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
    include: {
      team: true,
      receiptFiles: { include: { extraction: { include: { lineItems: { orderBy: { position: "asc" } } } } } },
      approvals: { include: { actor: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!requestRecord || requestRecord.createdById !== session.user.id) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={requestRecord.title}
        badge={<Badge status={requestRecord.status} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="text-sm text-slate-500">Requested Total</div>
            <div className="text-2xl font-bold text-slate-900">
              ${requestRecord.requestedTotal.toString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-slate-500">Team</div>
            <div className="text-lg font-semibold text-slate-900">{requestRecord.team.name}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-slate-500">Created</div>
            <div className="text-lg font-semibold text-slate-900">
              {requestRecord.createdAt.toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {requestRecord.status === "DRAFT" ? (
        <Card>
          <CardContent>
            <RequestActions requestId={requestRecord.id} />
          </CardContent>
        </Card>
      ) : null}

      <ExtractionReview receipts={requestRecord.receiptFiles} />

      <RequestTimeline
        items={requestRecord.approvals.map((approval) => ({
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
