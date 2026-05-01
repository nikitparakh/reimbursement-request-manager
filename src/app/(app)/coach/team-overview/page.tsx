import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCachedAccessContext } from "@/lib/access";
import { buildManagedTeamWhere } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CoachTeamRequestsTable } from "@/components/coach/coach-team-requests-table";
import { CoachTeamMembersTable } from "@/components/coach/coach-team-members-table";
import { getTeamOverviewDescription } from "@/lib/ui-copy";

export default async function CoachTeamOverviewPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  const access = await getCachedAccessContext(session.user.id);
  if (!access.isCoach && !access.canManageReimbursements) unauthorized();

  const managedTeams = access.canManageReimbursements
    ? await db.team.findMany({
        where: buildManagedTeamWhere(access),
        select: { id: true },
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

  const teams = await db.team.findMany({
    where: { id: { in: teamIds } },
    include: {
      school: { include: { district: true } },
      program: true,
      memberships: {
        where: { approved: true },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ roleInTeam: "asc" }, { createdAt: "asc" }],
      },
      requests: {
        where: {
          status: {
            not: "DRAFT",
          },
        },
        include: {
          createdBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Overview"
        description={getTeamOverviewDescription(access)}
      />

      {teams.map((team) => {
        const paidAmount = team.requests
          .filter((r) => r.status === "PAID")
          .reduce((sum, r) => sum + Number(r.requestedTotal), 0);
        const pendingCount = team.requests.filter(
          (r) => r.status === "SUBMITTED" || r.status === "COACH_APPROVED",
        ).length;

        const requestRows = team.requests.map((r) => ({
          id: r.id,
          title: r.title,
          submittedBy: r.createdBy.name || r.createdBy.email,
          amount: Number(r.requestedTotal),
          status: r.status,
          date: r.createdAt.toLocaleDateString(),
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
            {teams.length > 1 && (
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

            {teams.length === 1 && (
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

            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Requests"
                value={String(team.requests.length)}
              />
              <StatCard
                label="Paid Out"
                value={`$${paidAmount.toFixed(2)}`}
              />
              <StatCard
                label="Pending Review"
                value={String(pendingCount)}
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

            {teams.length > 1 && (
              <hr className="border-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
