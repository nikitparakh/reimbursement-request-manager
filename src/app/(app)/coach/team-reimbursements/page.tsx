import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCachedAccessContext } from "@/lib/access";
import { buildManagedTeamWhere } from "@/lib/admin-scope";
import {
  TeamReimbursementsTable,
  type ReimbursementRow,
} from "@/components/reimbursements/team-reimbursements-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getTeamReimbursementsDescription } from "@/lib/ui-copy";

export default async function TeamReimbursementsPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  const access = await getCachedAccessContext(session.user.id);
  if (!access.isCoach && !access.canManageReimbursements) unauthorized();

  const managedTeamIds = access.canManageReimbursements
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
      ...managedTeamIds.map((team) => team.id),
    ])
  );
  const teamFilter = { teamId: { in: teamIds } };

  const [requests, pendingCount] = await Promise.all([
    db.reimbursementRequest.findMany({
      where: teamFilter,
      include: {
        createdBy: { select: { email: true } },
        team: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.reimbursementRequest.count({
      where: { teamId: { in: teamIds }, status: "SUBMITTED" },
    }),
  ]);

  const rows: ReimbursementRow[] = requests.map((r) => ({
    id: r.id,
    title: r.title,
    requester: r.createdBy.email,
    amount: Number(r.requestedTotal),
    status: r.status,
    date: r.createdAt.toLocaleDateString(),
    dateMs: r.createdAt.getTime(),
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
            <h2 className="text-sm font-semibold text-foreground">
              Requests ({rows.length})
            </h2>
          </CardHeader>
          <CardContent className="pt-0">
            <TeamReimbursementsTable data={rows} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
