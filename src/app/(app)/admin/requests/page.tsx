import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  AdminReimbursementsTable,
  type AdminReimbursementRow,
} from "@/components/admin/admin-reimbursements-table";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const ADMIN_VISIBLE_STATUSES = [
  "COACH_APPROVED",
  "ADMIN_APPROVED",
  "ADMIN_REJECTED",
  "PAID",
] as const;

export default async function AdminReimbursementsPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "ADMIN") unauthorized();

  const statusFilter = { in: [...ADMIN_VISIBLE_STATUSES] };

  const [requests, totalCount] = await Promise.all([
    db.reimbursementRequest.findMany({
      where: { status: statusFilter },
      include: {
        createdBy: { select: { email: true } },
        team: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.reimbursementRequest.count({ where: { status: statusFilter } }),
  ]);

  const rows: AdminReimbursementRow[] = requests.map((r) => ({
    id: r.id,
    title: r.title,
    requester: r.createdBy.email,
    team: r.team.name,
    amount: Number(r.requestedTotal),
    status: r.status,
    date: r.createdAt.toLocaleDateString(),
    dateMs: r.createdAt.getTime(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Reimbursements"
        badge={<Badge status={`${totalCount} total`} />}
        description="View and manage all reimbursement requests across all teams."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No requests yet"
          description="There are no reimbursement requests in the system."
        />
      ) : (
        <AdminReimbursementsTable data={rows} />
      )}
    </div>
  );
}
