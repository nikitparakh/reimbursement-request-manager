import Link from "next/link";
import { notFound, unauthorized } from "next/navigation";
import { ArrowLeft, BanknoteArrowUp, Clock, FileText } from "lucide-react";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canManageTeams, getCachedAccessContext } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamActiveToggle } from "@/components/admin/team-active-toggle";
import { EditTeamForm } from "@/components/admin/edit-team-form";
import { TeamRequestsTable } from "@/components/admin/team-requests-table";
import { TeamMembersTable } from "@/components/admin/team-members-table";
import { formatCurrency, formatDate } from "@/lib/format";

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
  // Admin team detail only loads non-DRAFT requests post coach review,
  // so this naturally narrows to admin-actionable items.
  const pendingCount = team.requests.filter(
    (r) => r.status === "COACH_APPROVED",
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
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          Back to teams
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
              <CardTitle className="text-sm font-medium text-foreground">
                Active Status
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {team.active
                  ? "Team is visible and members can submit requests."
                  : "Team is hidden. Members cannot submit new requests."}
              </p>
            </div>
            <TeamActiveToggle teamId={team.id} active={team.active} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Requests"
          value={String(team.requests.length)}
          subtitle="Submitted (visible to admin)"
          icon={FileText}
        />
        <StatTile
          label="Paid Out"
          value={formatCurrency(paidAmount, "USD")}
          subtitle="Marked paid totals"
          icon={BanknoteArrowUp}
          iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
        />
        <StatTile
          label="Pending Review"
          value={String(pendingCount)}
          subtitle="Awaiting approval"
          icon={Clock}
          iconClassName="bg-amber-100 text-amber-800 dark:bg-amber-950/55 dark:text-amber-400"
        />
      </div>

      {/* Request history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Requests ({team.requests.length})
          </CardTitle>
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
          <CardTitle className="text-sm font-semibold">
            Members ({team.memberships.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memberRows.length === 0 ? (
            <EmptyState
              title="No members"
              description="No members have joined this team yet."
            />
          ) : (
            <TeamMembersTable data={memberRows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

