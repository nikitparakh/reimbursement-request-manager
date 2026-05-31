import { unauthorized } from "next/navigation";
import { BanknoteArrowUp, Clock, FileText } from "lucide-react";
import { inArray, ne } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { teams } from "@/db/schema";
import { getCachedAccessContext } from "@/lib/access";
import { buildManagedTeamWhere } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { CoachTeamRequestsTable } from "@/components/coach/coach-team-requests-table";
import { CoachTeamMembersTable } from "@/components/coach/coach-team-members-table";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getPendingReviewStatuses,
  PENDING_REVIEW_FILTER,
} from "@/lib/reimbursements/pending";
import { getTeamOverviewDescription } from "@/lib/ui-copy";

export default async function CoachTeamOverviewPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  const access = await getCachedAccessContext(session.user.id);
  if (!access.isCoach && !access.canManageReimbursements) unauthorized();

  const managedTeams = access.canManageReimbursements
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
      ...managedTeams.map((team) => team.id),
    ])
  );

  if (teamIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team Overview"
          description={getTeamOverviewDescription(access)}
        />
        <EmptyState
          title="No team found"
          description={
            access.canManageReimbursements
              ? "No teams are available in your managed scope."
              : "You are not currently coaching any team."
          }
        />
      </div>
    );
  }

  const teamsList = await db.query.teams.findMany({
    where: inArray(teams.id, teamIds),
    with: {
      school: { with: { district: true } },
      program: true,
      memberships: {
        where: (membership, { eq }) => eq(membership.approved, true),
        with: {
          user: { columns: { id: true, name: true, email: true } },
        },
        orderBy: (membership, { asc }) => [
          asc(membership.roleInTeam),
          asc(membership.createdAt),
        ],
      },
      requests: {
        where: (request) => ne(request.status, "DRAFT"),
        with: {
          createdBy: { columns: { name: true, email: true } },
        },
        orderBy: (request, { desc }) => desc(request.createdAt),
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Overview"
        description={getTeamOverviewDescription(access)}
      />

      {teamsList.map((team) => {
        const paidAmount = team.requests
          .filter((r) => r.status === "PAID")
          .reduce((sum, r) => sum + Number(r.requestedTotal), 0);
        const pendingStatuses = getPendingReviewStatuses(access);
        const pendingCount = team.requests.filter((r) =>
          pendingStatuses.includes(r.status),
        ).length;

        const requestRows = team.requests.map((r) => ({
          id: r.id,
          title: r.title,
          submittedBy: r.createdBy.name || r.createdBy.email,
          amount: Number(r.requestedTotal),
          status: r.status,
          date: formatDate(r.createdAt),
          dateMs: r.createdAt.getTime(),
        }));

        const memberRows = team.memberships.map((m) => ({
          id: m.id,
          name: m.user.name ?? "",
          email: m.user.email,
          roleInTeam: m.roleInTeam,
        }));

        return (
          <div key={team.id} className="space-y-6">
            {teamsList.length > 1 && (
              <Card>
                <CardContent className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-foreground">
                    {team.name}
                  </h2>
                  <StatusBadge status={team.active ? "APPROVED" : "REJECTED"} />
                  {team.shortCode && (
                    <span className="text-sm text-muted-foreground">
                      Code: {team.shortCode}
                    </span>
                  )}
                  {team.glAccount && (
                    <span className="text-sm text-muted-foreground">
                      GL: {team.glAccount}
                    </span>
                  )}
                </CardContent>
              </Card>
            )}

            {teamsList.length === 1 && (
              <PageHeader
                title={team.name}
                badge={
                  <StatusBadge status={team.active ? "APPROVED" : "REJECTED"} />
                }
                description={
                  [
                    `${team.school.district.name} / ${team.school.name}`,
                    team.program.name,
                    team.shortCode ? `Code: ${team.shortCode}` : null,
                    team.glAccount ? `GL: ${team.glAccount}` : null,
                    team.fllDivision ? `FLL ${team.fllDivision}` : null,
                  ]
                    .filter(Boolean)
                    .join("  ·  ") || "No short code"
                }
              />
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile
                label="Requests"
                value={String(team.requests.length)}
                subtitle="Submitted (non-draft)"
                icon={FileText}
                href="/coach/team-reimbursements"
                ariaLabel={`View all ${team.requests.length} requests`}
              />
              <StatTile
                label="Paid Out"
                value={formatCurrency(paidAmount, "USD")}
                subtitle="Marked paid totals"
                icon={BanknoteArrowUp}
                iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                href="/coach/team-reimbursements?status=PAID"
                ariaLabel="View paid requests"
              />
              <StatTile
                label="Pending Review"
                value={String(pendingCount)}
                subtitle="Awaiting approval"
                icon={Clock}
                iconClassName="bg-amber-100 text-amber-800 dark:bg-amber-950/55 dark:text-amber-400"
                href={`/coach/team-reimbursements?status=${PENDING_REVIEW_FILTER}`}
                ariaLabel={`View ${pendingCount} pending review requests`}
              />
            </div>

            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-foreground">
                  Requests ({team.requests.length})
                </h3>
              </CardHeader>
              <CardContent>
                {requestRows.length === 0 ? (
                  <EmptyState
                    title="No requests"
                    description="No submitted requests for this team yet."
                  />
                ) : (
                  <CoachTeamRequestsTable data={requestRows} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-foreground">
                  Members ({team.memberships.length})
                </h3>
              </CardHeader>
              <CardContent>
                {memberRows.length === 0 ? (
                  <EmptyState
                    title="No members yet"
                    description="Approved members will appear here once added."
                  />
                ) : (
                  <CoachTeamMembersTable data={memberRows} />
                )}
              </CardContent>
            </Card>

            {teamsList.length > 1 && (
              <hr className="border-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}
