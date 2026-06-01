import Link from "next/link";
import { unauthorized } from "next/navigation";
import { and, desc, eq, inArray, lt } from "drizzle-orm";

import { ApprovalDecision } from "@/components/reimbursements/approval-decision";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { reimbursementRequests } from "@/db/schema";
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

  const baseFilter = and(
    inArray(reimbursementRequests.teamId, coachTeamIds),
    eq(reimbursementRequests.status, "SUBMITTED")
  );

  // Cursor pagination ordered by updatedAt desc. The cursor is a request id;
  // resolve its updatedAt and fetch rows strictly older than it (mirrors
  // Prisma's `cursor` + `skip: 1`).
  let cursorFilter = baseFilter;
  if (cursor) {
    const cursorRow = await db.query.reimbursementRequests.findFirst({
      where: eq(reimbursementRequests.id, cursor),
      columns: { updatedAt: true },
    });
    if (cursorRow) {
      cursorFilter = and(
        baseFilter,
        lt(reimbursementRequests.updatedAt, cursorRow.updatedAt)
      );
    }
  }

  const [requests, totalCount] = await Promise.all([
    db.query.reimbursementRequests.findMany({
      where: cursorFilter,
      with: {
        createdBy: { columns: { email: true } },
        team: {
          columns: {
            id: true,
            name: true,
            schoolId: true,
            programId: true,
          },
          with: {
            school: { columns: { districtId: true } },
          },
        },
      },
      orderBy: desc(reimbursementRequests.updatedAt),
      limit: PAGE_SIZE + 1,
    }),
    db.$count(reimbursementRequests, baseFilter),
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
