import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCachedAccessContext } from "@/lib/access";
import { buildManagedTeamWhere } from "@/lib/admin-scope";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { getDashboardTeamRegistrationsDescription } from "@/lib/ui-copy";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Image src="/novi-logo.png" alt="Novi Community School District" width={131} height={40} className="mx-auto mb-4 h-14 w-auto" />
        <h1 className="text-4xl font-bold text-slate-900">Reimbursement Request Manager</h1>
        <p className="mt-3 max-w-md text-lg text-slate-500">
          Manage robotics reimbursements across districts, schools, programs, and teams.
        </p>
        <div className="mt-8 flex gap-4">
          <Link href="/sign-in">
            <Button variant="primary">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button variant="secondary">Create Account</Button>
          </Link>
        </div>
      </div>
    );
  }

  const [user, access] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingDone: true },
    }),
    getCachedAccessContext(session.user.id),
  ]);

  let adminPrograms: Array<{
    id: string;
    districtId: string;
    districtName: string;
    schoolId: string;
    programId: string;
    name: string;
    code: string;
    gradeRangeLabel: string | null;
    ageRangeLabel: string | null;
    teamCount: number;
    schoolName: string;
    href: string;
  }> = [];

  if (access.canManageTeams) {
    const managedTeams = await db.team.findMany({
      where: {
        AND: [
          buildManagedTeamWhere(access),
          { active: true },
        ],
      },
      select: {
        id: true,
        schoolId: true,
        programId: true,
        school: {
          select: {
            name: true,
            district: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        program: {
          select: {
            id: true,
            code: true,
            name: true,
            gradeRangeLabel: true,
            ageRangeLabel: true,
          },
        },
      },
    });

    const groupedPrograms = new Map<string, (typeof adminPrograms)[number]>();

    for (const team of managedTeams) {
      const key = `${team.schoolId}:${team.programId}`;
      const existing = groupedPrograms.get(key);
      if (existing) {
        existing.teamCount += 1;
        continue;
      }

      groupedPrograms.set(key, {
        id: key,
        districtId: team.school.district.id,
        districtName: team.school.district.name,
        schoolId: team.schoolId,
        programId: team.programId,
        name: team.program.name,
        code: team.program.code,
        gradeRangeLabel: team.program.gradeRangeLabel,
        ageRangeLabel: team.program.ageRangeLabel,
        teamCount: 1,
        schoolName: team.school.name,
        href: `/admin/teams?districtId=${team.school.district.id}&schoolId=${team.schoolId}&programId=${team.programId}`,
      });
    }

    adminPrograms = Array.from(groupedPrograms.values()).sort((a, b) => {
      return (
        a.districtName.localeCompare(b.districtName) ||
        a.schoolName.localeCompare(b.schoolName) ||
        a.name.localeCompare(b.name)
      );
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Welcome back, ${session.user.name ?? session.user.email}`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {access.isSuperAdmin ? (
          <Link href="/admin/teams" prefetch={false} className="block">
            <Card className="transition hover:border-emerald-300">
              <CardContent>
                <div className="text-sm font-medium text-slate-500">Platform</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">All Districts</div>
                <p className="mt-1 text-sm text-slate-500">Manage all schools, programs, teams, and requests.</p>
              </CardContent>
            </Card>
          </Link>
        ) : null}

        {adminPrograms.map((program) => (
          <Link key={program.id} href={program.href} prefetch={false} className="block">
            <Card className="border-slate-200 transition hover:border-emerald-300">
              <CardContent>
                <div className="text-sm font-medium text-slate-500">
                  {program.districtName} · {program.schoolName}
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{program.name}</div>
                <p className="mt-1 text-sm text-slate-500">
                  {program.gradeRangeLabel} {program.ageRangeLabel ? `| ${program.ageRangeLabel}` : ""}
                </p>
                <p className="mt-3 text-sm text-slate-600">{program.teamCount} active team{program.teamCount === 1 ? "" : "s"}</p>
              </CardContent>
            </Card>
          </Link>
        ))}

        {access.isCoach ? (
          <Link href="/coach/team-reimbursements" prefetch={false} className="block">
            <Card className="transition hover:border-emerald-300">
              <CardContent>
                <div className="text-sm font-medium text-slate-500">Coach</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">My Team Queue</div>
                <p className="mt-1 text-sm text-slate-500">Review reimbursements and manage your assigned team workspace.</p>
              </CardContent>
            </Card>
          </Link>
        ) : null}

        {access.canManageTeamRequests ? (
          <Link href="/admin/team-requests" prefetch={false} className="block">
            <Card className="transition hover:border-emerald-300">
              <CardContent>
                <div className="text-sm font-medium text-slate-500">Admin</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  Team Registrations
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {getDashboardTeamRegistrationsDescription(access.isSuperAdmin)}
                </p>
              </CardContent>
            </Card>
          </Link>
        ) : null}

        {access.isParentMentor ? (
          <>
            <Link href="/team" className="block">
              <Card className="transition hover:border-emerald-300">
                <CardContent>
                  <div className="text-sm font-medium text-slate-500">Team</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">My Team</div>
                  <p className="mt-1 text-sm text-slate-500">See your team roster, coach assignments, and school/program details.</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/user/requests/new" className="block">
              <Card className="transition hover:border-emerald-300">
                <CardContent>
                  <div className="text-sm font-medium text-slate-500">Quick Action</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">New Request</div>
                  <p className="mt-1 text-sm text-slate-500">Create a new reimbursement request for your team.</p>
                </CardContent>
              </Card>
            </Link>
          </>
        ) : null}

        {!user?.onboardingDone && !access.isSuperAdmin ? (
          <Link href="/onboarding" className="block">
            <Card className="transition hover:border-emerald-300">
              <CardContent>
                <div className="text-sm font-medium text-slate-500">Setup</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">Onboarding</div>
                <p className="mt-1 text-sm text-slate-500">Join the right district, school, program, and team.</p>
              </CardContent>
            </Card>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
