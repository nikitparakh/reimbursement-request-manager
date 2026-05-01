import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ClipboardList,
  Compass,
  FilePlus,
  LayoutDashboard,
  School,
  UserPlus,
  Users,
} from "lucide-react";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCachedAccessContext } from "@/lib/access";
import { buildManagedTeamWhere } from "@/lib/admin-scope";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getDashboardTeamRegistrationsDescription } from "@/lib/ui-copy";
import { cn } from "@/lib/utils";

function TileIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
      {children}
    </div>
  );
}

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="space-y-8 py-8 sm:py-12">
        <PageHeader
          title="Reimbursement Request Manager"
          description="Manage robotics reimbursements across districts, schools, programs, and teams."
        />
        <div className="flex justify-center">
          <Card className={cn("w-full max-w-lg border-border")}>
            <CardContent className="flex flex-col items-center gap-6 px-6 py-10 text-center">
              <Image
                src="/novi-logo.png"
                alt="Novi Community School District"
                width={131}
                height={40}
                className="h-14 w-auto"
              />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild>
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button variant="secondary" asChild>
                  <Link href="/sign-up">Create Account</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
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
        AND: [buildManagedTeamWhere(access), { active: true }],
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

  const cardHover = "transition-colors hover:border-primary/40";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session.user.name ?? session.user.email}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {access.isSuperAdmin ? (
          <Link href="/admin/teams" prefetch={false} className="block">
            <Card className={cn("border-border", cardHover)}>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <TileIcon>
                    <LayoutDashboard className="size-5 text-muted-foreground" aria-hidden />
                  </TileIcon>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-muted-foreground">Platform</div>
                    <div className="mt-1 text-lg font-semibold text-foreground">All Districts</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Manage all schools, programs, teams, and requests.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : null}

        {adminPrograms.map((program) => (
          <Link key={program.id} href={program.href} prefetch={false} className="block">
            <Card className={cn("border-border", cardHover)}>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <TileIcon>
                    <School className="size-5 text-muted-foreground" aria-hidden />
                  </TileIcon>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-muted-foreground">
                      {program.districtName} · {program.schoolName}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-foreground">{program.name}</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {program.gradeRangeLabel}{" "}
                      {program.ageRangeLabel ? `| ${program.ageRangeLabel}` : ""}
                    </p>
                    <p className="mt-3 text-sm text-foreground">
                      {program.teamCount} active team{program.teamCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {access.isCoach ? (
          <Link href="/coach/team-reimbursements" prefetch={false} className="block">
            <Card className={cn("border-border", cardHover)}>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <TileIcon>
                    <ClipboardList className="size-5 text-muted-foreground" aria-hidden />
                  </TileIcon>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-muted-foreground">Coach</div>
                    <div className="mt-1 text-lg font-semibold text-foreground">My Team Queue</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Review reimbursements and manage your assigned team workspace.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : null}

        {access.canManageTeamRequests ? (
          <Link href="/admin/team-requests" prefetch={false} className="block">
            <Card className={cn("border-border", cardHover)}>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <TileIcon>
                    <UserPlus className="size-5 text-muted-foreground" aria-hidden />
                  </TileIcon>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-muted-foreground">Admin</div>
                    <div className="mt-1 text-lg font-semibold text-foreground">
                      Team Registrations
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {getDashboardTeamRegistrationsDescription(access.isSuperAdmin)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : null}

        {access.isParentMentor ? (
          <>
            <Link href="/team" className="block">
              <Card className={cn("border-border", cardHover)}>
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <TileIcon>
                      <Users className="size-5 text-muted-foreground" aria-hidden />
                    </TileIcon>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-muted-foreground">Team</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">My Team</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        See your team roster, coach assignments, and school/program details.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/user/requests/new" className="block">
              <Card className={cn("border-border", cardHover)}>
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <TileIcon>
                      <FilePlus className="size-5 text-muted-foreground" aria-hidden />
                    </TileIcon>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-muted-foreground">Quick Action</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">New Request</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Create a new reimbursement request for your team.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </>
        ) : null}

        {!user?.onboardingDone && !access.isSuperAdmin ? (
          <Link href="/onboarding" className="block">
            <Card className={cn("border-border", cardHover)}>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <TileIcon>
                    <Compass className="size-5 text-muted-foreground" aria-hidden />
                  </TileIcon>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-muted-foreground">Setup</div>
                    <div className="mt-1 text-lg font-semibold text-foreground">Onboarding</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Join the right district, school, program, and team.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
