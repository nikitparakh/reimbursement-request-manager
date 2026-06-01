import { unauthorized } from "next/navigation";
import { and, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { reimbursementRequests } from "@/db/schema";
import { getCachedAccessContext } from "@/lib/access";
import { buildManagedReimbursementWhere } from "@/lib/admin-scope";
import {
  AdminReimbursementsTable,
  type AdminReimbursementRow,
} from "@/components/admin/admin-reimbursements-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";

import { formatDate } from "@/lib/format";
import { getAdminReimbursementsDescription } from "@/lib/ui-copy";

const ADMIN_VISIBLE_STATUSES = [
  "COACH_APPROVED",
  "COACH_REJECTED",
  "ADMIN_APPROVED",
  "ADMIN_REJECTED",
  "PAID",
] as const;

export default async function AdminReimbursementsPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  const access = await getCachedAccessContext(session.user.id);
  if (!access.canManageReimbursements) unauthorized();
  const scopedWhere = buildManagedReimbursementWhere(access);

  const statusFilter = inArray(reimbursementRequests.status, [
    ...ADMIN_VISIBLE_STATUSES,
  ]);
  const where = and(scopedWhere, statusFilter);

  const [requests, totalCount] = await Promise.all([
    db.query.reimbursementRequests.findMany({
      where,
      with: {
        createdBy: { columns: { email: true } },
        team: {
          columns: { name: true },
          with: {
            school: {
              columns: { name: true },
              with: {
                district: { columns: { name: true } },
              },
            },
            program: { columns: { name: true } },
          },
        },
      },
      orderBy: (t, { desc }) => desc(t.createdAt),
    }),
    db.$count(reimbursementRequests, where),
  ]);

  const rows: AdminReimbursementRow[] = requests.map((r) => ({
    id: r.id,
    title: r.title,
    requester: r.createdBy.email,
    team: r.team.name,
    district: r.team.school.district.name,
    school: r.team.school.name,
    program: r.team.program.name,
    amount: Number(r.requestedTotal),
    status: r.status,
    date: formatDate(r.createdAt),
    dateMs: r.createdAt.getTime(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Reimbursements"
        badge={<StatusBadge status={`${totalCount} total`} />}
        description={getAdminReimbursementsDescription(access.isSuperAdmin)}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No requests yet"
          description={
            access.isSuperAdmin
              ? "There are no reimbursement requests in the system."
              : "There are no reimbursement requests in your managed scope."
          }
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <AdminReimbursementsTable data={rows} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
