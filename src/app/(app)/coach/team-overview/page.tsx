import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CoachTeamRequestsTable } from "@/components/coach/coach-team-requests-table";
import { CoachTeamMembersTable } from "@/components/coach/coach-team-members-table";

export default async function CoachTeamOverviewPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "COACH" && session.user.role !== "ADMIN")
    unauthorized();

  const coachedMemberships = await db.teamMembership.findMany({
    where: {
      userId: session.user.id,
      roleInTeam: "COACH",
      approved: true,
    },
    select: { teamId: true },
  });

  const teamIds = coachedMemberships.map((m) => m.teamId);

  if (teamIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team Overview"
          description="View your team details, requests, and members."
        />
        <EmptyState
          title="No team found"
          description="You are not currently coaching any team."
        />
      </div>
    );
  }

  const teams = await db.team.findMany({
    where: { id: { in: teamIds } },
    include: {
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
        description="View your team details, requests, and members."
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
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900">
                  {team.name}
                </h2>
                <Badge status={team.active ? "APPROVED" : "REJECTED"} />
                {team.shortCode && (
                  <span className="text-sm text-slate-500">
                    Code: {team.shortCode}
                  </span>
                )}
                {team.glAccount && (
                  <span className="text-sm text-slate-500">
                    GL: {team.glAccount}
                  </span>
                )}
              </div>
            )}

            {teams.length === 1 && (
              <PageHeader
                title={team.name}
                badge={
                  <Badge status={team.active ? "APPROVED" : "REJECTED"} />
                }
                description={
                  [
                    team.shortCode ? `Code: ${team.shortCode}` : null,
                    team.glAccount ? `GL: ${team.glAccount}` : null,
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
                <h3 className="text-sm font-semibold text-slate-900">
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
                <h3 className="text-sm font-semibold text-slate-900">
                  Members ({team.memberships.length})
                </h3>
              </CardHeader>
              <CardContent>
                {memberRows.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No members yet.
                  </p>
                ) : (
                  <CoachTeamMembersTable data={memberRows} />
                )}
              </CardContent>
            </Card>

            {teams.length > 1 && (
              <hr className="border-slate-200" />
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
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}
