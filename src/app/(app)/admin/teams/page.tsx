import Link from "next/link";
import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TeamRequestDecision } from "@/components/onboarding/team-request-decision";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateTeamForm } from "@/components/admin/create-team-form";

export default async function AdminTeamsPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "ADMIN") unauthorized();

  const [teams, registrationRequests] = await Promise.all([
    db.team.findMany({
      include: {
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
      where: { status: "PENDING" },
      include: { requestedBy: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const teamsWithStats = teams.map((team) => ({
    id: team.id,
    name: team.name,
    shortCode: team.shortCode,
    active: team.active,
    coaches: team.memberships.filter((m) => m.roleInTeam === "COACH").length,
    parents: team.memberships.filter((m) => m.roleInTeam === "STUDENT").length,
    totalRequests: team.requests.length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Teams"
        badge={<Badge status={`${teams.length} teams`} />}
        description="Create, view, and manage all teams in the system."
        action={<CreateTeamForm />}
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
          description="Create a team to get started."
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
                    <th className="pb-3 pr-4 font-medium text-slate-500 hidden sm:table-cell">
                      Short Code
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
                      <td className="py-3 pr-4 text-slate-600 hidden sm:table-cell">
                        {team.shortCode || (
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
