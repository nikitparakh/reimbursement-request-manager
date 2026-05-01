import { redirect, unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) unauthorized();

  const hasMembership = await db.teamMembership.count({
    where: { userId: session.user.id, approved: true },
  });
  if (!hasMembership) redirect("/onboarding");

  const myMemberships = await db.teamMembership.findMany({
    where: { userId: session.user.id, approved: true },
    select: {
      roleInTeam: true,
      team: {
        select: {
          id: true,
          name: true,
          shortCode: true,
          glAccount: true,
          fllDivision: true,
          school: { select: { name: true, district: { select: { name: true } } } },
          program: { select: { name: true } },
          memberships: {
            where: { approved: true },
            select: {
              roleInTeam: true,
              user: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  // Deduplicate by team in case a user has multiple scoped roles on the same team.
  const teamMap = new Map<
    string,
    {
      id: string;
      name: string;
      shortCode: string | null;
      glAccount: string | null;
      schoolName: string;
      districtName: string;
      programName: string;
      fllDivision: string | null;
      myRoles: string[];
      coaches: { id: string; name: string | null; email: string }[];
      parents: { id: string; name: string | null; email: string }[];
    }
  >();

  for (const membership of myMemberships) {
    const existing = teamMap.get(membership.team.id);
    if (existing) {
      if (!existing.myRoles.includes(membership.roleInTeam)) {
        existing.myRoles.push(membership.roleInTeam);
      }
    } else {
      teamMap.set(membership.team.id, {
        id: membership.team.id,
        name: membership.team.name,
        shortCode: membership.team.shortCode,
        glAccount: membership.team.glAccount,
        schoolName: membership.team.school.name,
        districtName: membership.team.school.district.name,
        programName: membership.team.program.name,
        fllDivision: membership.team.fllDivision,
        myRoles: [membership.roleInTeam],
        coaches: membership.team.memberships
          .filter((m) => m.roleInTeam === "COACH")
          .map((m) => m.user),
        parents: membership.team.memberships
          .filter((m) => m.roleInTeam === "PARENT_MENTOR")
          .map((m) => m.user),
      });
    }
  }

  const teams = Array.from(teamMap.values());

  return (
    <div className="space-y-6">
      <PageHeader
        title={teams.length > 1 ? "My Teams" : "My Team"}
        description="View your team coaches and parents/mentors."
      />

      {teams.length === 0 ? (
        <EmptyState
          title="No team yet"
          description="Join a team through the onboarding page to get started."
        />
      ) : (
        <div className="space-y-6">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">{team.name}</h2>
                    {team.shortCode ? <StatusBadge status={team.shortCode} /> : null}
                    {team.glAccount ? (
                      <span className="text-sm text-slate-500">GL: {team.glAccount}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {team.myRoles.map((role) => (
                      <StatusBadge key={role} status={role} />
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="mb-3 text-sm text-slate-500">
                    {team.districtName} · {team.schoolName} · {team.programName}
                    {team.fllDivision ? ` · FLL ${team.fllDivision}` : ""}
                  </div>
                  <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Coaches
                  </h3>
                  {team.coaches.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No coach assigned</p>
                  ) : (
                    <ul className="space-y-1">
                      {team.coaches.map((m) => (
                        <li key={m.id} className="text-sm text-slate-700">
                          {m.name ?? m.email}
                          {m.name ? (
                            <span className="text-slate-400 ml-1">{m.email}</span>
                          ) : null}
                          {m.id === session.user.id ? (
                            <span className="text-slate-400 ml-1">(You)</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Parents/Mentors
                  </h3>
                  {team.parents.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No parents/mentors yet</p>
                  ) : (
                    <ul className="space-y-1">
                      {team.parents.map((m) => (
                        <li key={m.id} className="text-sm text-slate-700">
                          {m.name ?? m.email}
                          {m.name ? (
                            <span className="text-slate-400 ml-1">{m.email}</span>
                          ) : null}
                          {m.id === session.user.id ? (
                            <span className="text-slate-400 ml-1">(You)</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
