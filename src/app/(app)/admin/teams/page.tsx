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
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Teams"
        badge={<Badge status={`${teams.length} teams`} />}
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
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            Pending Registrations
            <Badge status={`${registrationRequests.length} pending`} />
          </h2>
          {registrationRequests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <h3 className="text-base font-semibold text-slate-900">
                  {request.teamName}
                </h3>
                <p className="text-sm text-slate-500">
                  Requested by {request.requestedBy.email}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {request.district.name} · {request.school.name} · {request.program.name}
                </p>
                {(request.shortCode || request.glAccount) && (
                  <p className="text-sm text-slate-500 mt-1">
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
        <Card>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-3 pr-4 font-medium text-slate-500">
                      Team
                    </th>
                    <th className="pb-3 pr-4 font-medium text-slate-500 hidden lg:table-cell">
                      School / Program
                    </th>
                    <th className="pb-3 pr-4 font-medium text-slate-500 hidden sm:table-cell">
                      Short Code
                    </th>
                    <th className="pb-3 pr-4 font-medium text-slate-500 hidden sm:table-cell">
                      GL Account
                    </th>
                    <th className="pb-3 pr-4 font-medium text-slate-500 hidden md:table-cell">
                      Coaches
                    </th>
                    <th className="pb-3 pr-4 font-medium text-slate-500 hidden md:table-cell">
                      Parents/Mentors
                    </th>
                    <th className="pb-3 pr-4 font-medium text-slate-500 hidden md:table-cell">
                      Requests
                    </th>
                    <th className="pb-3 font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teamsWithStats.map((team) => (
                    <tr
                      key={team.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/teams/${team.id}`}
                          className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                        >
                          {team.name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-slate-600 hidden lg:table-cell">
                        <div>{team.schoolName}</div>
                        <div className="text-xs text-slate-400">{team.programName}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600 hidden sm:table-cell">
                        {team.shortCode || (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-600 hidden sm:table-cell">
                        {team.glAccount || (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-700 hidden md:table-cell">
                        {team.coaches}
                      </td>
                      <td className="py-3 pr-4 text-slate-700 hidden md:table-cell">
                        {team.parents}
                      </td>
                      <td className="py-3 pr-4 text-slate-700 hidden md:table-cell">
                        {team.totalRequests}
                      </td>
                      <td className="py-3">
                        <Badge status={team.active ? "APPROVED" : "REJECTED"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
