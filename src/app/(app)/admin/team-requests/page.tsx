import { unauthorized } from "next/navigation";
import { and, asc, eq, inArray, or, type SQL } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  getCachedAccessContext,
  type AccessContext,
  type ScopedRoleAssignment,
} from "@/lib/access";
import { teamRegistrationRequests } from "@/db/schema";
import { TeamRequestDecision } from "@/components/onboarding/team-request-decision";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getAdminTeamRequestsDescription } from "@/lib/ui-copy";

function buildRegistrationScopeCondition(
  assignment: ScopedRoleAssignment
): SQL | undefined {
  const conditions: SQL[] = [];

  if (assignment.districtId) {
    conditions.push(eq(teamRegistrationRequests.districtId, assignment.districtId));
  }
  if (assignment.schoolId) {
    conditions.push(eq(teamRegistrationRequests.schoolId, assignment.schoolId));
  }
  if (assignment.programId) {
    conditions.push(eq(teamRegistrationRequests.programId, assignment.programId));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildManagedTeamRegistrationCondition(
  context: AccessContext
): SQL | undefined {
  if (context.isSuperAdmin) {
    return undefined;
  }

  const assignments = context.scopedRoles.filter(
    (assignment) =>
      assignment.role === "SCHOOL_ADMIN" || assignment.role === "PROGRAM_ADMIN"
  );

  const conditions = assignments
    .map(buildRegistrationScopeCondition)
    .filter((condition): condition is SQL => condition !== undefined);

  // Deny-all when there are no managed scopes (matches Prisma `{ id: { in: [] } }`).
  return conditions.length > 0
    ? or(...conditions)
    : inArray(teamRegistrationRequests.id, []);
}

export default async function AdminTeamRequestsPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  const access = await getCachedAccessContext(session.user.id);
  if (!access.canManageTeamRequests) unauthorized();

  const requests = await db.query.teamRegistrationRequests.findMany({
    where: and(
      eq(teamRegistrationRequests.status, "PENDING"),
      buildManagedTeamRegistrationCondition(access)
    ),
    with: { requestedBy: true, district: true, school: true, program: true },
    orderBy: asc(teamRegistrationRequests.createdAt),
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
                <h3 className="text-base font-semibold text-foreground">{request.teamName}</h3>
                <p className="text-sm text-muted-foreground">
                  Requested by {request.requestedBy.email}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {request.district.name} · {request.school.name} · {request.program.name}
                </p>
              </CardHeader>
              {request.notes ? (
                <CardContent>
                  <p className="text-sm text-foreground">{request.notes}</p>
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
