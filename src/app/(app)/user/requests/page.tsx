import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect, unauthorized } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { reimbursementRequests } from "@/db/schema";
import { getCachedAccessContext } from "@/lib/access";
import {
  TeamReimbursementsTable,
  type ReimbursementRow,
} from "@/components/reimbursements/team-reimbursements-table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { formatDate } from "@/lib/format";

export default async function UserRequestsPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  const access = await getCachedAccessContext(session.user.id);

  if (access.canManageReimbursements) redirect("/admin/requests");
  if (access.isCoach) redirect("/coach/team-reimbursements");

  const requests = await db.query.reimbursementRequests.findMany({
    where: eq(reimbursementRequests.createdById, session.user.id),
    with: {
      createdBy: { columns: { email: true } },
      team: { columns: { name: true } },
    },
    orderBy: (t, { desc }) => desc(t.createdAt),
  });

  const rows: ReimbursementRow[] = requests.map((r) => ({
    id: r.id,
    title: r.title,
    requester: r.createdBy.email ?? "",
    amount: Number(r.requestedTotal),
    status: r.status,
    date: formatDate(r.createdAt),
    dateMs: r.createdAt.getTime(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Requests"
        description="View all your reimbursement requests and their statuses."
        action={
          <Link href="/user/requests/new">
            <Button>
              <Plus aria-hidden className="size-4" />
              New request
            </Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No requests yet"
          description="You haven't submitted any reimbursement requests."
        />
      ) : (
        <Card>
          <CardContent>
            <TeamReimbursementsTable data={rows} showRequester={false} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
