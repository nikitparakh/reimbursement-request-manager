import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TeamRequestDecision } from "@/components/onboarding/team-request-decision";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminTeamRequestsPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "ADMIN") unauthorized();

  const requests = await db.teamRegistrationRequest.findMany({
    where: { status: "PENDING" },
    include: { requestedBy: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Registrations"
        badge={requests.length > 0 ? <Badge status={`${requests.length} pending`} /> : undefined}
        description="Review and approve new team registration requests."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No pending registrations"
          description="All team registration requests have been reviewed."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <h3 className="text-base font-semibold text-slate-900">{request.teamName}</h3>
                <p className="text-sm text-slate-500">
                  Requested by {request.requestedBy.email}
                </p>
              </CardHeader>
              {request.notes ? (
                <CardContent>
                  <p className="text-sm text-slate-700">{request.notes}</p>
                </CardContent>
              ) : null}
              <CardFooter>
                <TeamRequestDecision requestId={request.id} />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
