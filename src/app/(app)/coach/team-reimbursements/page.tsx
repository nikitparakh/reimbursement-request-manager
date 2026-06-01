import { and, desc, inArray } from "drizzle-orm";
import { forbidden, unauthorized } from "next/navigation";
import { auth } from "@/auth";
import type { RequestStatus } from "@/db/schema";
import { reimbursementRequests, teams } from "@/db/schema";
import { db } from "@/lib/db";
import { getCachedAccessContext } from "@/lib/access";
import { getRequestDetailHref } from "@/lib/navigation";
import { buildManagedTeamWhere } from "@/lib/admin-scope";
import {
  TeamReimbursementsTable,
  type ReimbursementRow,
} from "@/components/reimbursements/team-reimbursements-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import {
  getPendingReviewStatuses,
  PENDING_REVIEW_FILTER,
} from "@/lib/reimbursements/pending";
import { getTeamReimbursementsDescription } from "@/lib/ui-copy";

const VALID_REQUEST_STATUSES: ReadonlySet<string> = new Set<RequestStatus>([
  "DRAFT",
  "SUBMITTED",
  "COACH_APPROVED",
  "COACH_REJECTED",
  "ADMIN_APPROVED",
  "ADMIN_REJECTED",
  "PAID",
]);

function normalizeStatusParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return "";
  if (value === PENDING_REVIEW_FILTER) return PENDING_REVIEW_FILTER;
  return VALID_REQUEST_STATUSES.has(value) ? value : "";
}

export default async function TeamReimbursementsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) unauthorized();
  const access = await getCachedAccessContext(session.user.id);
  if (!access.isCoach && !access.canManageReimbursements) forbidden();

  const { status: rawStatus } = await searchParams;
  const initialStatus = normalizeStatusParam(rawStatus);

  const managedTeamIds = access.canManageReimbursements
    ? await db.query.teams.findMany({
        where: buildManagedTeamWhere(access),
        columns: { id: true },
      })
    : [];

  const teamIds = Array.from(
    new Set([
      ...access.teamMemberships
        .filter((membership) => membership.roleInTeam === "COACH")
        .map((membership) => membership.teamId),
      ...managedTeamIds.map((team) => team.id),
    ])
  );
  const pendingStatuses = getPendingReviewStatuses(access);

  const [requests, pendingCount] = await Promise.all([
    db.query.reimbursementRequests.findMany({
      where: inArray(reimbursementRequests.teamId, teamIds),
      with: {
        createdBy: { columns: { email: true } },
        team: {
          columns: { name: true, schoolId: true, programId: true },
          with: { school: { columns: { districtId: true } } },
        },
      },
      orderBy: desc(reimbursementRequests.createdAt),
    }),
    pendingStatuses.length > 0
      ? db.$count(
          reimbursementRequests,
          and(
            inArray(reimbursementRequests.teamId, teamIds),
            inArray(reimbursementRequests.status, pendingStatuses)
          )
        )
      : Promise.resolve(0),
  ]);

  const rows: ReimbursementRow[] = requests.map((r) => ({
    id: r.id,
    title: r.title,
    requester: r.createdBy.email,
    amount: r.requestedTotal,
    status: r.status,
    date: formatDate(r.createdAt),
    dateMs: r.createdAt.getTime(),
    detailHref: getRequestDetailHref(access, r.id, {
      teamId: r.teamId,
      schoolId: r.team.schoolId,
      programId: r.team.programId,
      districtId: r.team.school.districtId,
    }),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Reimbursements"
        badge={pendingCount > 0 ? <StatusBadge status={`${pendingCount} pending review`} /> : undefined}
        description={getTeamReimbursementsDescription(access)}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No team requests"
          description={
            access.canManageReimbursements
              ? "There are no reimbursement requests for teams in your scope yet."
              : "There are no reimbursement requests for your teams yet."
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Requests ({rows.length})
            </h2>
          </CardHeader>
          <CardContent className="pt-0">
            <TeamReimbursementsTable
              data={rows}
              pendingStatuses={pendingStatuses}
              initialStatus={initialStatus}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
