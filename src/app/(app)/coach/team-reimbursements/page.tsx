import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  TeamReimbursementsTable,
  type ReimbursementRow,
} from "@/components/reimbursements/team-reimbursements-table";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function TeamReimbursementsPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "COACH" && session.user.role !== "ADMIN") unauthorized();

  const coachedTeamIds = (
    await db.teamMembership.findMany({
      where: { userId: session.user.id, roleInTeam: "COACH", approved: true },
      select: { teamId: true },
    })
  ).map((item) => item.teamId);

  const teamFilter = { teamId: { in: coachedTeamIds } };

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
      where: { teamId: { in: coachedTeamIds }, status: "SUBMITTED" },
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
        badge={pendingCount > 0 ? <Badge status={`${pendingCount} pending review`} /> : undefined}
        description="View and manage all reimbursement requests across your coached teams."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No team requests"
          description="There are no reimbursement requests for your teams yet."
        />
      ) : (
        <TeamReimbursementsTable data={rows} />
      )}
    </div>
  );
}
