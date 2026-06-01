import { unauthorized } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { teamMemberships } from "@/db/schema";
import { RequestForm } from "@/components/reimbursements/request-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";

export default async function NewRequestPage() {
  const session = await auth();
  if (!session?.user) unauthorized();

  const memberships = await db.query.teamMemberships.findMany({
    where: and(
      eq(teamMemberships.userId, session.user.id),
      eq(teamMemberships.approved, true)
    ),
    with: { team: true },
  });

  const teams = memberships.map((membership) => ({
    id: membership.team.id,
    name: membership.team.name,
  }));

  return (
    <div className="space-y-6">
      <BackLink href="/user/requests" label="Back to my requests" />
      <PageHeader
        title="New Reimbursement Request"
        description="Create a draft request, then upload receipts and submit for approval."
      />
      {teams.length === 0 ? (
        <Alert variant="warning">
          You need to join a team before creating requests.{" "}
          <Link href="/onboarding" className="font-medium underline underline-offset-4">
            Continue onboarding
          </Link>
          .
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Request details</CardTitle>
            <CardDescription>Select a team, then add title, receipts, and line items.</CardDescription>
          </CardHeader>
          <CardContent>
            <RequestForm teams={teams} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
