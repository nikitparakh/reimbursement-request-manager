import Link from "next/link";
import { unauthorized } from "next/navigation";
import { and, asc, eq, inArray, or, type SQL } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCachedAccessContext, type AccessContext, type ScopedRoleAssignment } from "@/lib/access";
import {
  schools,
  teamMemberships,
  teamRegistrationRequests,
  teams,
} from "@/db/schema";
import { TeamRequestDecision } from "@/components/onboarding/team-request-decision";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateTeamForm } from "@/components/admin/create-team-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function getAdminAssignments(access: AccessContext) {
  return access.scopedRoles.filter(
    (assignment) =>
      assignment.role === "SCHOOL_ADMIN" || assignment.role === "PROGRAM_ADMIN",
  );
}

// Drizzle equivalent of buildManagedTeamWhere: returns a condition restricting
// teams to the admin's managed scope. `undefined` means "no restriction"
// (super admin); a never-matching condition means "deny all".
function managedTeamCondition(access: AccessContext): SQL | undefined {
  if (access.isSuperAdmin) return undefined;

  const conditions = getAdminAssignments(access).map((assignment) => {
    const parts: SQL[] = [];
    if (assignment.teamId) {
      parts.push(eq(teams.id, assignment.teamId));
    }
    if (assignment.schoolId) {
      parts.push(eq(teams.schoolId, assignment.schoolId));
    } else if (assignment.districtId) {
      parts.push(
        inArray(
          teams.schoolId,
          db
            .select({ id: schools.id })
            .from(schools)
            .where(eq(schools.districtId, assignment.districtId)),
        ),
      );
    }
    if (assignment.programId) {
      parts.push(eq(teams.programId, assignment.programId));
    }
    return parts.length > 0 ? and(...parts) : undefined;
  });

  const defined = conditions.filter((c): c is SQL => c !== undefined);
  // No admin assignments -> deny all (mirror Prisma `{ id: { in: [] } }`).
  if (getAdminAssignments(access).length === 0) {
    return inArray(teams.id, []);
  }
  return defined.length > 0 ? or(...defined) : undefined;
}

// Drizzle equivalent of buildManagedTeamRegistrationWhere.
function managedRegistrationCondition(access: AccessContext): SQL | undefined {
  if (access.isSuperAdmin) return undefined;

  const assignments = getAdminAssignments(access);
  if (assignments.length === 0) {
    return inArray(teamRegistrationRequests.id, []);
  }

  const conditions = assignments.map((assignment: ScopedRoleAssignment) => {
    const parts: SQL[] = [];
    if (assignment.districtId) {
      parts.push(eq(teamRegistrationRequests.districtId, assignment.districtId));
    }
    if (assignment.schoolId) {
      parts.push(eq(teamRegistrationRequests.schoolId, assignment.schoolId));
    }
    if (assignment.programId) {
      parts.push(eq(teamRegistrationRequests.programId, assignment.programId));
    }
    return parts.length > 0 ? and(...parts) : undefined;
  });

  const defined = conditions.filter((c): c is SQL => c !== undefined);
  return defined.length > 0 ? or(...defined) : undefined;
}

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{
    districtId?: string;
    schoolId?: string;
    programId?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) unauthorized();
  const access = await getCachedAccessContext(session.user.id);
  if (!access.canManageTeams) unauthorized();

  const { districtId, schoolId, programId } = await searchParams;

  // Team filters (mirror the Prisma `teamFilters` object).
  const teamFilterParts: SQL[] = [];
  if (schoolId) teamFilterParts.push(eq(teams.schoolId, schoolId));
  if (programId) teamFilterParts.push(eq(teams.programId, programId));
  if (districtId) {
    teamFilterParts.push(
      inArray(
        teams.schoolId,
        db
          .select({ id: schools.id })
          .from(schools)
          .where(eq(schools.districtId, districtId)),
      ),
    );
  }

  // Registration filters (mirror the Prisma `registrationFilters` object).
  const registrationFilterParts: SQL[] = [];
  if (districtId)
    registrationFilterParts.push(eq(teamRegistrationRequests.districtId, districtId));
  if (schoolId)
    registrationFilterParts.push(eq(teamRegistrationRequests.schoolId, schoolId));
  if (programId)
    registrationFilterParts.push(eq(teamRegistrationRequests.programId, programId));

  const teamWhereParts: SQL[] = [];
  const managedTeam = managedTeamCondition(access);
  if (managedTeam) teamWhereParts.push(managedTeam);
  teamWhereParts.push(...teamFilterParts);

  const registrationWhereParts: SQL[] = [
    eq(teamRegistrationRequests.status, "PENDING"),
  ];
  const managedRegistration = managedRegistrationCondition(access);
  if (managedRegistration) registrationWhereParts.push(managedRegistration);
  registrationWhereParts.push(...registrationFilterParts);

  const [teamsList, registrationRequests, createTeamSchools, createTeamPrograms] =
    await Promise.all([
      db.query.teams.findMany({
        where: teamWhereParts.length > 0 ? and(...teamWhereParts) : undefined,
        with: {
          school: { with: { district: true } },
          program: true,
          memberships: {
            where: (m, { eq: eqOp }) => eqOp(m.approved, true),
            columns: { roleInTeam: true },
          },
          requests: {
            where: (r, { inArray: inArrayOp }) =>
              inArrayOp(r.status, [
                "COACH_APPROVED",
                "COACH_REJECTED",
                "ADMIN_APPROVED",
                "ADMIN_REJECTED",
                "PAID",
              ]),
            columns: { status: true },
          },
        },
        orderBy: (t, { asc: ascOp }) => ascOp(t.name),
      }),
      db.query.teamRegistrationRequests.findMany({
        where: and(...registrationWhereParts),
        with: { requestedBy: true, school: true, district: true, program: true },
        orderBy: (r, { asc: ascOp }) => ascOp(r.createdAt),
      }),
      access.isSuperAdmin
        ? db.query.schools.findMany({
            columns: { id: true, name: true },
            with: { district: { columns: { name: true } } },
            orderBy: (s, { asc: ascOp }) => [ascOp(s.districtId), ascOp(s.name)],
          })
        : Promise.resolve([]),
      access.isSuperAdmin
        ? db.query.programs.findMany({
            where: (p, { eq: eqOp }) => eqOp(p.active, true),
            columns: { id: true, name: true, code: true },
            orderBy: (p, { asc: ascOp }) => ascOp(p.code),
          })
        : Promise.resolve([]),
    ]);

  const teamsWithStats = teamsList.map((team) => ({
    id: team.id,
    name: team.name,
    shortCode: team.shortCode,
    glAccount: team.glAccount,
    schoolName: team.school.name,
    districtName: team.school.district.name,
    programName: team.program.name,
    active: team.active,
    coaches: team.memberships.filter((m) => m.roleInTeam === "COACH").length,
    parents: team.memberships.filter((m) => m.roleInTeam === "PARENT_MENTOR").length,
    totalRequests: team.requests.length,
  }));

  const activeTeams = teamsWithStats.filter((t) => t.active);
  const inactiveTeams = teamsWithStats.filter((t) => !t.active);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Teams"
        badge={<StatusBadge status={`${teamsList.length} teams`} />}
        description={
          access.isSuperAdmin
            ? "Create, view, and manage teams across districts, schools, and programs."
            : "View teams in your managed scope and review pending team registration requests."
        }
        action={
          access.isSuperAdmin ? (
            <CreateTeamForm
              schools={createTeamSchools.map((school) => ({
                id: school.id,
                name: school.name,
                districtName: school.district.name,
              }))}
              programs={createTeamPrograms}
            />
          ) : undefined
        }
      />

      {registrationRequests.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Pending registrations</CardTitle>
              <StatusBadge status={`${registrationRequests.length} pending`} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {registrationRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <h3 className="text-base font-semibold text-foreground">
                    {request.teamName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Requested by {request.requestedBy.email}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {request.district.name} · {request.school.name} · {request.program.name}
                  </p>
                  {(request.shortCode || request.glAccount) && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[
                        request.shortCode ? `Code: ${request.shortCode}` : null,
                        request.glAccount ? `GL: ${request.glAccount}` : null,
                      ]
                        .filter(Boolean)
                        .join("  ·  ")}
                    </p>
                  )}
                </CardHeader>
                {request.notes ? (
                  <CardContent className="pt-0">
                    <p className="text-sm text-foreground">{request.notes}</p>
                  </CardContent>
                ) : null}
                <CardFooter>
                  <TeamRequestDecision requestId={request.id} />
                </CardFooter>
              </Card>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {teamsWithStats.length === 0 ? (
        <EmptyState
          title="No teams yet"
          description={
            access.isSuperAdmin
              ? "Create a team to get started."
              : "No teams match your current scope yet. Review team registration requests to add the next team."
          }
        />
      ) : (
        <div className="space-y-6">
          {activeTeams.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active teams</CardTitle>
              </CardHeader>
              <CardContent>
                <ManageTeamsTable teams={activeTeams} />
              </CardContent>
            </Card>
          ) : null}
          {inactiveTeams.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inactive teams</CardTitle>
              </CardHeader>
              <CardContent>
                <ManageTeamsTable teams={inactiveTeams} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

type TeamStatRow = {
  id: string;
  name: string;
  shortCode: string | null;
  glAccount: string | null;
  schoolName: string;
  districtName: string;
  programName: string;
  active: boolean;
  coaches: number;
  parents: number;
  totalRequests: number;
};

function ManageTeamsTable({ teams }: { teams: TeamStatRow[] }) {
  return (
    <Table className="w-full text-sm">
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <TableHead className="pb-3 pr-4 font-medium text-muted-foreground">Team</TableHead>
          <TableHead className="hidden pb-3 pr-4 font-medium text-muted-foreground lg:table-cell">
            School / Program
          </TableHead>
          <TableHead className="hidden pb-3 pr-4 font-medium text-muted-foreground sm:table-cell">
            Short Code
          </TableHead>
          <TableHead className="hidden pb-3 pr-4 font-medium text-muted-foreground sm:table-cell">
            GL Account
          </TableHead>
          <TableHead className="hidden pb-3 pr-4 font-medium text-muted-foreground md:table-cell">
            Coaches
          </TableHead>
          <TableHead className="hidden pb-3 pr-4 font-medium text-muted-foreground md:table-cell">
            Parents/Mentors
          </TableHead>
          <TableHead className="hidden pb-3 pr-4 font-medium text-muted-foreground md:table-cell">
            Requests
          </TableHead>
          <TableHead className="pb-3 font-medium text-muted-foreground">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teams.map((team) => (
          <TableRow
            key={team.id}
            className="border-border/60 hover:bg-transparent"
          >
            <TableCell className="py-3 pr-4">
              <Link
                href={`/admin/teams/${team.id}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {team.name}
              </Link>
            </TableCell>
            <TableCell className="hidden py-3 pr-4 text-foreground lg:table-cell">
              <div>{team.schoolName}</div>
              <div className="text-xs text-muted-foreground">{team.programName}</div>
            </TableCell>
            <TableCell className="hidden py-3 pr-4 text-foreground sm:table-cell">
              {team.shortCode || (
                <span className="italic text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="hidden py-3 pr-4 text-foreground sm:table-cell">
              {team.glAccount || (
                <span className="italic text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="hidden py-3 pr-4 text-foreground md:table-cell">
              {team.coaches}
            </TableCell>
            <TableCell className="hidden py-3 pr-4 text-foreground md:table-cell">
              {team.parents}
            </TableCell>
            <TableCell className="hidden py-3 pr-4 text-foreground md:table-cell">
              {team.totalRequests}
            </TableCell>
            <TableCell className="py-3">
              <StatusBadge status={team.active ? "APPROVED" : "REJECTED"} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
