import Link from "next/link";
import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCachedAccessContext } from "@/lib/access";
import {
  buildManagedTeamRegistrationWhere,
  buildManagedTeamWhere,
} from "@/lib/admin-scope";
import { TeamRequestDecision } from "@/components/onboarding/team-request-decision";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateTeamForm } from "@/components/admin/create-team-form";

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
  const teamFilters = {
    ...(schoolId ? { schoolId } : {}),
    ...(programId ? { programId } : {}),
    ...(districtId ? { school: { districtId } } : {}),
  };
  const registrationFilters = {
    ...(districtId ? { districtId } : {}),
    ...(schoolId ? { schoolId } : {}),
    ...(programId ? { programId } : {}),
  };

  const [teams, registrationRequests, createTeamSchools, createTeamPrograms] = await Promise.all([
    db.team.findMany({
      where: {
        AND: [buildManagedTeamWhere(access), teamFilters],
      },
      include: {
        school: { include: { district: true } },
        program: true,
        memberships: {
          where: { approved: true },
          select: { roleInTeam: true },
        },
        requests: {
          where: {
            status: {
              in: [
                "COACH_APPROVED",
                "COACH_REJECTED",
                "ADMIN_APPROVED",
                "ADMIN_REJECTED",
                "PAID",
              ],
            },
          },
          select: { status: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.teamRegistrationRequest.findMany({
      where: {
        AND: [
          { status: "PENDING" },
          buildManagedTeamRegistrationWhere(access),
          registrationFilters,
        ],
      },
      include: { requestedBy: true, school: true, district: true, program: true },
      orderBy: { createdAt: "asc" },
    }),
    access.isSuperAdmin
      ? db.school.findMany({
          select: {
            id: true,
            name: true,
            district: {
              select: {
                name: true,
              },
            },
          },
          orderBy: [{ districtId: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    access.isSuperAdmin
      ? db.program.findMany({
          where: { active: true },
          select: { id: true, name: true, code: true },
          orderBy: { code: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const teamsWithStats = teams.map((team) => ({
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
        badge={<StatusBadge status={`${teams.length} teams`} />}
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-3 pr-4 font-medium text-muted-foreground">Team</th>
            <th className="hidden pb-3 pr-4 font-medium text-muted-foreground lg:table-cell">
              School / Program
            </th>
            <th className="hidden pb-3 pr-4 font-medium text-muted-foreground sm:table-cell">
              Short Code
            </th>
            <th className="hidden pb-3 pr-4 font-medium text-muted-foreground sm:table-cell">
              GL Account
            </th>
            <th className="hidden pb-3 pr-4 font-medium text-muted-foreground md:table-cell">
              Coaches
            </th>
            <th className="hidden pb-3 pr-4 font-medium text-muted-foreground md:table-cell">
              Parents/Mentors
            </th>
            <th className="hidden pb-3 pr-4 font-medium text-muted-foreground md:table-cell">
              Requests
            </th>
            <th className="pb-3 font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.id} className="border-b border-border/60 last:border-0">
              <td className="py-3 pr-4">
                <Link
                  href={`/admin/teams/${team.id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {team.name}
                </Link>
              </td>
              <td className="hidden py-3 pr-4 text-foreground lg:table-cell">
                <div>{team.schoolName}</div>
                <div className="text-xs text-muted-foreground">{team.programName}</div>
              </td>
              <td className="hidden py-3 pr-4 text-foreground sm:table-cell">
                {team.shortCode || (
                  <span className="italic text-muted-foreground">—</span>
                )}
              </td>
              <td className="hidden py-3 pr-4 text-foreground sm:table-cell">
                {team.glAccount || (
                  <span className="italic text-muted-foreground">—</span>
                )}
              </td>
              <td className="hidden py-3 pr-4 text-foreground md:table-cell">
                {team.coaches}
              </td>
              <td className="hidden py-3 pr-4 text-foreground md:table-cell">
                {team.parents}
              </td>
              <td className="hidden py-3 pr-4 text-foreground md:table-cell">
                {team.totalRequests}
              </td>
              <td className="py-3">
                <StatusBadge status={team.active ? "APPROVED" : "REJECTED"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
