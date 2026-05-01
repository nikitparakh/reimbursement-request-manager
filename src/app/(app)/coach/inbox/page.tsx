import Link from "next/link";
import { unauthorized } from "next/navigation";

import { ApprovalDecision } from "@/components/reimbursements/approval-decision";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canManageReimbursements, getCachedAccessContext } from "@/lib/access";
import { formatCurrency, formatDate } from "@/lib/format";

const PAGE_SIZE = 10;

function coachDecisionEndpoint(requestId: string) {
  return `/api/requests/${requestId}/coach-decision`;
}

function requestDetailHref(
  access: Awaited<ReturnType<typeof getCachedAccessContext>>,
  request: {
    id: string;
    team: {
      id: string;
      schoolId: string;
      programId: string;
      school: { districtId: string };
    };
  }
) {
  if (
    canManageReimbursements(access, {
      districtId: request.team.school.districtId,
      schoolId: request.team.schoolId,
      programId: request.team.programId,
      teamId: request.team.id,
    })
  ) {
    return `/admin/requests/${request.id}`;
  }
  return `/user/requests/${request.id}`;
}

export default async function CoachInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await auth();
  if (!session?.user) unauthorized();

  const access = await getCachedAccessContext(session.user.id);
  if (!access.isCoach) unauthorized();

  const coachTeamIds = access.teamMemberships
    .filter((m) => m.roleInTeam === "COACH")
    .map((m) => m.teamId);

  if (coachTeamIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Coach Inbox"
          description="Review reimbursement requests submitted by your teams."
        />
        <EmptyState
          title="No teams to review"
          description="You are not assigned as a coach on any team yet."
        />
      </div>
    );
  }

  const { cursor } = await searchParams;

  const teamFilter = { teamId: { in: coachTeamIds } };

  const [requests, totalCount] = await Promise.all([
    db.reimbursementRequest.findMany({
      where: {
        AND: [teamFilter, { status: "SUBMITTED" }],
      },
      include: {
        createdBy: { select: { email: true } },
        team: {
          select: {
            id: true,
            name: true,
            schoolId: true,
            programId: true,
            school: { select: { districtId: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    db.reimbursementRequest.count({
      where: {
        AND: [teamFilter, { status: "SUBMITTED" }],
      },
    }),
  ]);

  const hasMore = requests.length > PAGE_SIZE;
  const items = hasMore ? requests.slice(0, PAGE_SIZE) : requests;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coach Inbox"
        badge={
          totalCount > 0 ? <StatusBadge status={`${totalCount} pending`} /> : undefined
        }
        description="Review reimbursement requests submitted by your teams."
      />

      {items.length === 0 && !cursor ? (
        <EmptyState
          title="No pending requests"
          description="There are no submitted requests awaiting your review."
        />
      ) : (
        <>
          <div className="space-y-4">
            {items.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={requestDetailHref(access, request)}
                          className="text-base font-semibold text-foreground transition-colors hover:text-primary"
                        >
                          {request.title}
                        </Link>
                        <StatusBadge status="SUBMITTED" />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {request.team.name} · {request.createdBy.email}
                      </p>
                      {request.submittedAt ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Submitted {formatDate(request.submittedAt)}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-xl font-bold text-foreground">
                      {formatCurrency(Number(request.requestedTotal))}
                    </div>
                  </div>
                </CardHeader>
                <CardFooter>
                  <ApprovalDecision
                    requestId={request.id}
                    endpoint={coachDecisionEndpoint(request.id)}
                  />
                </CardFooter>
              </Card>
            ))}
          </div>
          <PaginationControls
            basePath="/coach/inbox"
            prevCursor={cursor ? (items[0]?.id ?? null) : null}
            nextCursor={nextCursor}
          />
        </>
      )}
    </div>
  );
}
