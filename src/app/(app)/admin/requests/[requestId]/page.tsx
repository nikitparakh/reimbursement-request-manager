import Link from "next/link";
import { notFound, unauthorized } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ApprovalDecision } from "@/components/reimbursements/approval-decision";
import { EditableLineItems } from "@/components/reimbursements/editable-line-items";
import { ExtractionReview } from "@/components/reimbursements/extraction-review";
import { DownloadPdfLink } from "@/components/reimbursements/download-pdf-link";
import { serializeReceipts } from "@/lib/reimbursements/serialize-receipts";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveTotalProvider, LiveRequestedTotal } from "@/components/reimbursements/live-total-context";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  canManageReimbursements,
  getCachedAccessContext,
} from "@/lib/access";

const ADMIN_VISIBLE_STATUSES = [
  "COACH_APPROVED",
  "COACH_REJECTED",
  "ADMIN_APPROVED",
  "ADMIN_REJECTED",
  "PAID",
];

const BACK_LABELS: Record<string, { href: string; label: string }> = {
  inbox: { href: "/admin/inbox", label: "Back to inbox" },
  requests: { href: "/admin/requests", label: "Back to reimbursements" },
};

export default async function AdminRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ from?: string; teamId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) unauthorized();
  const access = await getCachedAccessContext(session.user.id);
  if (!access.canManageReimbursements) unauthorized();

  const [{ requestId }, resolvedSearch] = await Promise.all([params, searchParams]);

  const backTarget = resolvedSearch.teamId
    ? { href: `/admin/teams/${resolvedSearch.teamId}`, label: "Back to team" }
    : BACK_LABELS[resolvedSearch.from ?? ""] ?? BACK_LABELS.inbox;
  const request = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
    include: {
      createdBy: { select: { name: true, email: true } },
      team: {
        select: {
          id: true,
          name: true,
          glAccount: true,
          schoolId: true,
          programId: true,
          school: { select: { districtId: true } },
        },
      },
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
        include: { actor: { select: { email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (
    !request ||
    !ADMIN_VISIBLE_STATUSES.includes(request.status) ||
    !canManageReimbursements(access, {
      districtId: request.team.school.districtId,
      schoolId: request.team.schoolId,
      programId: request.team.programId,
      teamId: request.team.id,
    })
  ) {
    notFound();
  }

  const status = request.status;
  const canEditLineItems = status === "COACH_APPROVED";
  const receipts = serializeReceipts(request.receiptFiles);

  const isAdminApproved = status === "ADMIN_APPROVED";
  const canDecide = status === "COACH_APPROVED" || status === "ADMIN_APPROVED";

  return (
    <LiveTotalProvider initialTotal={Number(request.requestedTotal)}>
      <div className="space-y-6">
      <div>
        <Link
          href={backTarget.href}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          {backTarget.label}
        </Link>
      </div>

      <PageHeader
        title={request.title}
        badge={<StatusBadge status={status} />}
        description={
          [
            request.team.name,
            request.team.glAccount ? `GL: ${request.team.glAccount}` : null,
            request.createdBy.name || request.createdBy.email,
          ]
            .filter(Boolean)
            .join(" · ")
        }
        action={<DownloadPdfLink requestId={request.id} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Requested Total</div>
            <div className="text-2xl font-bold text-foreground">
              <LiveRequestedTotal />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Team</div>
            <div className="text-lg font-semibold text-foreground">
              <Link
                href={`/admin/teams/${request.team.id}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {request.team.name}
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Created</div>
            <div className="text-lg font-semibold text-foreground">
              {request.createdAt.toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receipts & line items</CardTitle>
        </CardHeader>
        <CardContent>
          {request.receiptFiles.length === 0 ? (
            <EmptyState
              title="No receipts uploaded"
              description="The submitter has not yet uploaded receipts for this request."
            />
          ) : canEditLineItems && receipts.length > 0 ? (
            <EditableLineItems requestId={request.id} receipts={receipts} canComment />
          ) : (
            <ExtractionReview
              receipts={receipts}
              parseStatuses={Object.fromEntries(request.receiptFiles.map((f) => [f.id, f.parseStatus]))}
            />
          )}
        </CardContent>
      </Card>

      {canDecide ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin actions</CardTitle>
          </CardHeader>
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

      {request.approvals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval history</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTimeline
              items={request.approvals.map((approval) => ({
                id: approval.id,
                action: approval.action,
                actor: approval.actor.email,
                comment: approval.comment,
                createdAt: approval.createdAt,
              }))}
            />
          </CardContent>
        </Card>
      ) : null}
      </div>
    </LiveTotalProvider>
  );
}
