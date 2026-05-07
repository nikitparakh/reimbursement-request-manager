import type { ComponentType, SVGProps } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Compass,
  FilePlus,
  LayoutDashboard,
  Receipt,
  School,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCachedAccessContext } from "@/lib/access";
import { buildManagedTeamWhere } from "@/lib/admin-scope";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { DashboardTile } from "@/components/dashboard/dashboard-tile";
import { getDashboardTeamRegistrationsDescription } from "@/lib/ui-copy";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement>>;

const LANDING_FEATURES: Array<{
  icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    icon: Receipt,
    title: "For parents & mentors",
    body: "Upload receipts, itemize spending, and track each request from draft to payout.",
  },
  {
    icon: ClipboardCheck,
    title: "For coaches",
    body: "Review your team's submissions in one inbox — no more chasing receipts over email.",
  },
  {
    icon: ShieldCheck,
    title: "For administrators",
    body: "Approve, audit, and pay out reimbursements across districts, schools, and programs.",
  },
];

function tileFooter(text: string) {
  return (
    <>
      <span>{text}</span>
      <ArrowRight
        className="size-4 text-muted-foreground transition-transform group-hover/tile:translate-x-0.5"
        aria-hidden
      />
    </>
  );
}

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="space-y-12 pb-12">
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 pt-10 text-center sm:pt-16">
          <Image
            src="/novi-logo.png"
            alt="Novi Community School District"
            width={262}
            height={80}
            className="h-14 w-auto sm:h-16"
            priority
          />
          <div className="space-y-3">
            <h1 className="text-balance font-heading text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Reimbursement Request Manager
            </h1>
            <p className="mx-auto max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
              Submit, review, and pay out robotics reimbursements across districts, schools,
              programs, and teams — all in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/sign-up">Create account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Reviewing the program first?{" "}
            <Link
              href="/policy"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Read the reimbursement policy
            </Link>
          </p>
        </section>

        <section className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {LANDING_FEATURES.map((feature) => (
              <Card key={feature.title} className="border-border">
                <CardContent className="flex h-full flex-col gap-3 pt-6">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                    <feature.icon className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="space-y-1">
                    <div className="font-heading text-base font-semibold text-foreground">
                      {feature.title}
                    </div>
                    <p className="text-sm text-muted-foreground">{feature.body}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
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

  const showAdminSection = access.isSuperAdmin || access.canManageTeamRequests;
  const showSetupSection = !user?.onboardingDone && !access.isSuperAdmin;

  const visibleSectionCount =
    (adminPrograms.length > 0 ? 1 : 0) +
    (showAdminSection ? 1 : 0) +
    (access.isCoach ? 1 : 0) +
    (access.isParentMentor ? 1 : 0) +
    (showSetupSection ? 1 : 0);

  // Hide the section label when only one section is visible — it would just be
  // visual noise (e.g. a single SETUP label above a single Onboarding tile).
  const hideSectionTitles = visibleSectionCount <= 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session.user.name ?? session.user.email}`}
      />

      <div className="space-y-8">
        {adminPrograms.length > 0 ? (
          <DashboardSection
            title="Programs"
            description="Schools and programs you manage."
            hideTitle={hideSectionTitles}
          >
            {adminPrograms.map((program) => (
              <DashboardTile
                key={program.id}
                href={program.href}
                prefetch={false}
                icon={School}
                title={program.schoolName}
                badge={
                  <Badge variant="secondary" className="font-mono tracking-wide">
                    {program.code}
                  </Badge>
                }
                meta={[
                  { label: "District", value: program.districtName },
                  { label: "Program", value: program.name },
                  {
                    label: "Grades",
                    value:
                      [program.gradeRangeLabel, program.ageRangeLabel]
                        .filter(Boolean)
                        .join(" · ") || "—",
                  },
                ]}
                footer={tileFooter(
                  `${program.teamCount} active team${program.teamCount === 1 ? "" : "s"}`,
                )}
              />
            ))}
          </DashboardSection>
        ) : null}

        {showAdminSection ? (
          <DashboardSection title="Admin" hideTitle={hideSectionTitles}>
            {access.isSuperAdmin ? (
              <DashboardTile
                href="/admin/teams"
                prefetch={false}
                icon={LayoutDashboard}
                title="All Districts"
                description="Manage all schools, programs, teams, and requests."
                footer={tileFooter("Open admin")}
              />
            ) : null}
            {access.canManageTeamRequests ? (
              <DashboardTile
                href="/admin/team-requests"
                prefetch={false}
                icon={UserPlus}
                title="Team Registrations"
                description={getDashboardTeamRegistrationsDescription(access.isSuperAdmin)}
                footer={tileFooter("Review registrations")}
              />
            ) : null}
          </DashboardSection>
        ) : null}

        {access.isCoach ? (
          <DashboardSection title="Coach" hideTitle={hideSectionTitles}>
            <DashboardTile
              href="/coach/team-reimbursements"
              prefetch={false}
              icon={ClipboardCheck}
              title="My Team Queue"
              description="Review reimbursements and manage your assigned team workspace."
              footer={tileFooter("Open queue")}
            />
          </DashboardSection>
        ) : null}

        {access.isParentMentor ? (
          <DashboardSection title="My team" hideTitle={hideSectionTitles}>
            <DashboardTile
              href="/team"
              icon={Users}
              title="My Team"
              description="See your team roster, coach assignments, and school/program details."
              footer={tileFooter("Open team")}
            />
            <DashboardTile
              href="/user/requests/new"
              icon={FilePlus}
              title="New Request"
              description="Create a new reimbursement request for your team."
              footer={tileFooter("Start request")}
            />
            <DashboardTile
              href="/policy"
              icon={BookOpen}
              title="Reimbursement Policy"
              description="Read the policy and submission guidelines."
              footer={tileFooter("Read policy")}
            />
          </DashboardSection>
        ) : null}

        {showSetupSection ? (
          <DashboardSection title="Setup" hideTitle={hideSectionTitles}>
            <DashboardTile
              href="/onboarding"
              icon={Compass}
              title="Onboarding"
              description="Join the right district, school, program, and team."
              footer={tileFooter("Continue onboarding")}
            />
          </DashboardSection>
        ) : null}
      </div>
    </div>
  );
}
