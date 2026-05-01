import Link from "next/link";
import { notFound, unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canManageTeams, getCachedAccessContext } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamActiveToggle } from "@/components/admin/team-active-toggle";
import { EditTeamForm } from "@/components/admin/edit-team-form";
import { TeamRequestsTable } from "@/components/admin/team-requests-table";
import { TeamMembersTable } from "@/components/admin/team-members-table";

export default async function AdminTeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const session = await auth();
  if (!session?.user) unauthorized();
  const access = await getCachedAccessContext(session.user.id);
  if (!access.canManageTeams) unauthorized();

  const { teamId } = await params;

  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      school: { include: { district: true } },
      program: true,
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: [{ roleInTeam: "asc" }, { createdAt: "asc" }],
      },
      requests: {
        where: {
          status: {
            in: [
              "COACH_APPROVED",
              "COACH_REJECTED",
              "ADMIN_APPROVED",
              "ADMIN_REJECTED",
              "PAID",
            ],
          },
        },
        include: {
          createdBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!team) notFound();

  if (
    !canManageTeams(access, {
      districtId: team.school.district.id,
      schoolId: team.schoolId,
      programId: team.programId,
      teamId: team.id,
    })
  ) {
    notFound();
  }

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
    teamId: team.id,
    name: m.user.name ?? "",
    email: m.user.email,
    roleInTeam: m.roleInTeam,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/teams"
          className="text-sm text-slate-500 hover:text-emerald-600 transition"
        >
          &larr; Back to teams
        </Link>
      </div>

      <PageHeader
        title={team.name}
        badge={<StatusBadge status={team.active ? "APPROVED" : "REJECTED"} />}
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
        action={
          <EditTeamForm
            teamId={team.id}
            currentName={team.name}
            currentShortCode={team.shortCode}
            currentGlAccount={team.glAccount}
          />
        }
      />

      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-900">
                Active Status
              </h3>
              <p className="text-sm text-slate-500">
                {team.active
                  ? "Team is visible and members can submit requests."
                  : "Team is hidden. Members cannot submit new requests."}
              </p>
            </div>
            <TeamActiveToggle teamId={team.id} active={team.active} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Requests" value={String(team.requests.length)} />
        <StatCard label="Paid Out" value={`$${paidAmount.toFixed(2)}`} />
        <StatCard label="Pending Review" value={String(pendingCount)} />
      </div>

      {/* Request history */}
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
            <TeamRequestsTable data={requestRows} teamId={team.id} />
          )}
        </CardContent>
      </Card>

      {/* Members */}
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
            <TeamMembersTable data={memberRows} />
          )}
        </CardContent>
      </Card>
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
