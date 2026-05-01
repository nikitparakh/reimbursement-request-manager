import { notFound, unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApprovalDecision } from "@/components/reimbursements/approval-decision";
import { EditableLineItems } from "@/components/reimbursements/editable-line-items";
import { ExtractionReview } from "@/components/reimbursements/extraction-review";
import { ReceiptPollingWrapper } from "@/components/reimbursements/receipt-polling-wrapper";
import { RequestActions } from "@/components/reimbursements/request-actions";
import { RequestProgress } from "@/components/reimbursements/request-progress";
import { serializeReceipts } from "@/lib/reimbursements/serialize-receipts";
import { EditableRequestHeader } from "@/components/reimbursements/editable-request-header";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DownloadPdfLink } from "@/components/reimbursements/download-pdf-link";
import { LiveTotalProvider, LiveRequestedTotal } from "@/components/reimbursements/live-total-context";
import { getRequestAccess } from "@/lib/reimbursements/request-access";
import { getDraftRequestUiState } from "@/lib/reimbursements/request-detail-view";

import { formatDate } from "@/lib/format";

function decisionConfig(
  status: string,
  requestId: string,
  isReimbursementAdmin: boolean
) {
  if (isReimbursementAdmin && status === "ADMIN_APPROVED") {
    return {
      endpoint: `/api/requests/${requestId}/admin-decision`,
      showApproveReject: false,
      allowMarkPaid: true,
    };
  }
  if (
    isReimbursementAdmin &&
    (status === "COACH_APPROVED" || status === "SUBMITTED")
  ) {
    return {
      endpoint:
        status === "SUBMITTED"
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
  const requestAccess = await getRequestAccess(session.user.id, requestId);
  if (!requestAccess || !requestAccess.canView) notFound();

  const requestRecord = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
    include: {
      team: true,
      receiptFiles: {
        include: {
          extraction: {
            include: {
              lineItems: {
                orderBy: { position: "asc" },
                include: {
                  comments: {
                    orderBy: { createdAt: "asc" },
                    include: { author: { select: { email: true } } },
                  },
                },
              },
            },
          },
        },
      },
      approvals: {
        select: { id: true, action: true, comment: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!requestRecord) notFound();

  const status = requestRecord.status;
  const hasExtractions = requestRecord.receiptFiles.some((f) => f.extraction !== null);
  const hasUnparsedReceipts = requestRecord.receiptFiles.some(
    (f) => f.parseStatus === "QUEUED" || f.parseStatus === "PROCESSING" || f.parseStatus === "FAILED"
  );

  const receiptsWithExtractions = serializeReceipts(requestRecord.receiptFiles);
  const draftUi = getDraftRequestUiState({
    status,
    canEditDraft: requestAccess.canEditDraft,
    isOwner: requestAccess.isOwner,
  });

  const canEditLineItems = status !== "DRAFT" && requestAccess.canEditLineItems;
  const canDecide =
    (requestAccess.isReimbursementAdmin &&
      ["SUBMITTED", "COACH_APPROVED", "ADMIN_APPROVED"].includes(status)) ||
    (requestAccess.isCoach && status === "SUBMITTED");

  const decision = canDecide
    ? decisionConfig(
        status,
        requestRecord.id,
        requestAccess.isReimbursementAdmin
      )
    : null;

  return (
    <LiveTotalProvider initialTotal={Number(requestRecord.requestedTotal)}>
    <div className="space-y-6">
      {draftUi.showEditableDraftSections ? (
        <EditableRequestHeader
          requestId={requestRecord.id}
          initialTitle={requestRecord.title}
          initialDescription={requestRecord.description}
        />
      ) : (
        <PageHeader
          title={requestRecord.title}
          description={requestRecord.description ?? undefined}
          badge={<StatusBadge status={status} />}
          action={<DownloadPdfLink requestId={requestRecord.id} />}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-1">
            <div className="text-sm text-muted-foreground">Requested total</div>
            <div className="text-2xl font-semibold text-foreground">
              <LiveRequestedTotal />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <div className="text-sm text-muted-foreground">Team</div>
            <div className="text-lg font-semibold text-foreground">{requestRecord.team.name}</div>
            {requestRecord.team.glAccount ? (
              <div className="mt-1 text-xs text-muted-foreground">GL: {requestRecord.team.glAccount}</div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <div className="text-sm text-muted-foreground">Created</div>
            <div className="text-lg font-semibold text-foreground">
              {formatDate(requestRecord.createdAt)}
            </div>
          </CardContent>
        </Card>
      </div>

      {draftUi.showEditableDraftSections ? (
        <Card>
          <CardHeader>
            <CardTitle>Draft actions</CardTitle>
          </CardHeader>
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
              redirectUrl={requestAccess.redirectUrl}
              submitToAdmin={
                requestAccess.isReimbursementAdmin || requestAccess.isCoach
              }
              canSubmit={draftUi.canSubmitDraft}
            />
          </CardContent>
        </Card>
      ) : null}

      {draftUi.showReadOnlyDraftSections ? (
        <Card>
          <CardHeader>
            <CardTitle>Receipts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This draft is view-only for you. Only the request creator, team
              coach, or a scoped admin can edit it.
            </p>
            <ReceiptPollingWrapper
              requestId={requestRecord.id}
              hasProcessing={requestRecord.receiptFiles.some(
                (f) => f.parseStatus === "QUEUED" || f.parseStatus === "PROCESSING"
              )}
            >
              <ExtractionReview
                receipts={receiptsWithExtractions}
                parseStatuses={Object.fromEntries(
                  requestRecord.receiptFiles.map((f) => [f.id, f.parseStatus])
                )}
              />
            </ReceiptPollingWrapper>
          </CardContent>
        </Card>
      ) : null}

      {status !== "DRAFT" && canEditLineItems ? (
        <EditableLineItems requestId={requestRecord.id} receipts={receiptsWithExtractions} canComment />
      ) : null}

      {status !== "DRAFT" && !canEditLineItems ? (
        <Card>
          <CardHeader>
            <CardTitle>Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            {requestRecord.receiptFiles.length === 0 ? (
              <EmptyState
                title="No receipts uploaded"
                description="No receipts were attached to this request."
              />
            ) : (
              <ReceiptPollingWrapper
                requestId={requestRecord.id}
                hasProcessing={requestRecord.receiptFiles.some(
                  (f) => f.parseStatus === "QUEUED" || f.parseStatus === "PROCESSING"
                )}
              >
                <ExtractionReview
                  receipts={receiptsWithExtractions}
                  parseStatuses={Object.fromEntries(requestRecord.receiptFiles.map((f) => [f.id, f.parseStatus]))}
                />
              </ReceiptPollingWrapper>
            )}
          </CardContent>
        </Card>
      ) : null}

      {decision ? (
        <Card>
          <CardHeader>
            <CardTitle>Review decision</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalDecision
              requestId={requestRecord.id}
              endpoint={decision.endpoint}
              showApproveReject={decision.showApproveReject}
              allowMarkPaid={decision.allowMarkPaid}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Workflow progress</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestProgress status={status} approvals={requestRecord.approvals} />
        </CardContent>
      </Card>
    </div>
    </LiveTotalProvider>
  );
}
