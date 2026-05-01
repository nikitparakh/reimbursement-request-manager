import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCachedAccessContext } from "@/lib/access";
import { buildManagedTeamRegistrationWhere } from "@/lib/admin-scope";
import { TeamRequestDecision } from "@/components/onboarding/team-request-decision";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getAdminTeamRequestsDescription } from "@/lib/ui-copy";

export default async function AdminTeamRequestsPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  const access = await getCachedAccessContext(session.user.id);
  if (!access.canManageTeamRequests) unauthorized();

  const requests = await db.teamRegistrationRequest.findMany({
    where: {
      AND: [
        { status: "PENDING" },
        buildManagedTeamRegistrationWhere(access),
      ],
    },
    include: { requestedBy: true, district: true, school: true, program: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Registrations"
        badge={requests.length > 0 ? <StatusBadge status={`${requests.length} pending`} /> : undefined}
        description={getAdminTeamRequestsDescription(access.isSuperAdmin)}
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
                <p className="text-sm text-slate-500 mt-1">
                  {request.district.name} · {request.school.name} · {request.program.name}
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
