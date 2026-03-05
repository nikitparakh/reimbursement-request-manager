import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { RequestForm } from "@/components/reimbursements/request-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export default async function NewRequestPage() {
  const session = await auth();
  if (!session?.user) unauthorized();

  const memberships = await db.teamMembership.findMany({
    where: { userId: session.user.id, approved: true },
    include: { team: true },
  });

  const teams = memberships.map((membership) => ({
    id: membership.team.id,
    name: membership.team.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Reimbursement Request"
        description="Create a draft request, then upload receipts and submit for approval."
      />
      {teams.length === 0 ? (
        <Alert variant="warning">
          Complete onboarding and team membership before creating requests.
        </Alert>
      ) : (
        <Card>
          <CardContent>
            <RequestForm teams={teams} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
