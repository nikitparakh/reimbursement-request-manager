import { notFound, unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApprovalDecision } from "@/components/reimbursements/approval-decision";
import { EditableLineItems } from "@/components/reimbursements/editable-line-items";
import { ExtractionReview } from "@/components/reimbursements/extraction-review";
import { ReceiptPollingWrapper } from "@/components/reimbursements/receipt-polling-wrapper";
import { RequestActions } from "@/components/reimbursements/request-actions";
import { serializeReceipts } from "@/lib/reimbursements/serialize-receipts";
import { RequestTimeline } from "@/components/reimbursements/request-timeline";
import { EditableRequestHeader } from "@/components/reimbursements/editable-request-header";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { DownloadPdfLink } from "@/components/reimbursements/download-pdf-link";

function decisionConfig(status: string, requestId: string, isAdmin: boolean) {
  if (isAdmin && status === "ADMIN_APPROVED") {
    return {
      endpoint: `/api/requests/${requestId}/admin-decision`,
      showApproveReject: false,
      allowMarkPaid: true,
    };
  }
  if (isAdmin && (status === "COACH_APPROVED" || status === "SUBMITTED")) {
    return {
      endpoint: status === "SUBMITTED"
        ? `/api/requests/${requestId}/coach-decision`
        : `/api/requests/${requestId}/admin-decision`,
      showApproveReject: true,
      allowMarkPaid: status === "COACH_APPROVED",
    };
  }
  if (status === "SUBMITTED") {
    return {
      endpoint: `/api/requests/${requestId}/coach-decision`,
      showApproveReject: true,
      allowMarkPaid: false,
    };
  }
  return null;
}

export default async function UserRequestDetailPage({
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

  if (!requestRecord) notFound();

  const isOwner = requestRecord.createdById === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  const isTeamCoach =
    session.user.role === "COACH" &&
    !!(await db.teamMembership.findFirst({
      where: { userId: session.user.id, teamId: requestRecord.teamId },
    }));

  if (!isOwner && !isAdmin && !isTeamCoach) {
    notFound();
  }

  const status = requestRecord.status;
  const hasExtractions = requestRecord.receiptFiles.some((f) => f.extraction !== null);
  const hasUnparsedReceipts = requestRecord.receiptFiles.some(
    (f) => f.parseStatus === "QUEUED" || f.parseStatus === "PROCESSING" || f.parseStatus === "FAILED"
  );

  const receiptsWithExtractions = serializeReceipts(requestRecord.receiptFiles);

  const canEditLineItems =
    (isAdmin && (status === "SUBMITTED" || status === "COACH_APPROVED")) ||
    (isTeamCoach && status === "SUBMITTED");

  const canDecide =
    (isAdmin && ["SUBMITTED", "COACH_APPROVED", "ADMIN_APPROVED"].includes(status)) ||
    (isTeamCoach && status === "SUBMITTED");

  const redirectUrl = !isOwner && isTeamCoach
    ? "/coach/team-reimbursements"
    : !isOwner && isAdmin
      ? "/admin/team-requests"
      : "/user/requests";

  const decision = canDecide ? decisionConfig(status, requestRecord.id, isAdmin) : null;

  return (
    <div className="space-y-6">
      {status === "DRAFT" ? (
        <EditableRequestHeader
          requestId={requestRecord.id}
          initialTitle={requestRecord.title}
          initialDescription={requestRecord.description}
        />
      ) : (
        <PageHeader
          title={requestRecord.title}
          badge={<Badge status={status} />}
          action={<DownloadPdfLink requestId={requestRecord.id} />}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="text-sm text-slate-500">Requested Total</div>
            <div className="text-2xl font-bold text-slate-900">
              ${Number(requestRecord.requestedTotal).toFixed(2)}
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

      {status === "DRAFT" ? (
        <Card>
          <CardContent>
            <RequestActions
              requestId={requestRecord.id}
              existingReceipts={requestRecord.receiptFiles.map((f) => ({
                id: f.id,
                fileName: f.fileName,
              }))}
              hasExtractions={hasExtractions}
              hasUnparsedReceipts={hasUnparsedReceipts}
              receiptsWithExtractions={receiptsWithExtractions}
              redirectUrl={redirectUrl}
            />
          </CardContent>
        </Card>
      ) : null}

      {status !== "DRAFT" && canEditLineItems ? (
        <EditableLineItems requestId={requestRecord.id} receipts={receiptsWithExtractions} />
      ) : null}

      {status !== "DRAFT" && !canEditLineItems ? (
        <ReceiptPollingWrapper
          requestId={requestRecord.id}
          hasProcessing={requestRecord.receiptFiles.some(
            (f) => f.parseStatus === "QUEUED" || f.parseStatus === "PROCESSING"
          )}
        >
          <ExtractionReview receipts={requestRecord.receiptFiles} />
        </ReceiptPollingWrapper>
      ) : null}

      {decision ? (
        <Card>
          <CardFooter>
            <ApprovalDecision
              requestId={requestRecord.id}
              endpoint={decision.endpoint}
              showApproveReject={decision.showApproveReject}
              allowMarkPaid={decision.allowMarkPaid}
            />
          </CardFooter>
        </Card>
      ) : null}

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
