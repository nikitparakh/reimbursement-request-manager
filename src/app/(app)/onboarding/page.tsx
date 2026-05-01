import { redirect, unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TeamSelector } from "@/components/onboarding/team-selector";
import { TeamRegistrationForm } from "@/components/onboarding/team-registration-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    unauthorized();
  }

  if (session.user.role === "SUPER_ADMIN") {
    redirect("/");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingDone: true },
  });

  if (user?.onboardingDone) {
    redirect("/");
  }

  const [districts, programs] = await Promise.all([
    db.district.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        schools: {
          where: { active: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            teams: {
              where: { active: true },
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                shortCode: true,
                programId: true,
              },
            },
          },
        },
      },
    }),
    db.program.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const districtOptions = districts.map((district) => ({
    id: district.id,
    name: district.name,
    schools: district.schools.map((school) => ({
      id: school.id,
      name: school.name,
      programs: programs
        .map((program) => ({
          id: program.id,
          code: program.code,
          name: program.name,
          teams: school.teams.filter((team) => team.programId === program.id).map((team) => ({
            id: team.id,
            name: team.name,
            shortCode: team.shortCode,
          })),
        }))
        .filter((program) => program.teams.length > 0),
    })),
  }));

  const requestDistricts = districts.map((district) => ({
    id: district.id,
    name: district.name,
    schools: district.schools.map((school) => ({
      id: school.id,
      name: school.name,
    })),
  }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title="Get Started"
        description="Choose your district, school, program, and team before you start working in the reimbursement flow."
      />
      <Card>
        <CardHeader>
          <CardTitle>Join an existing team</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamSelector districts={districtOptions} />
        </CardContent>
      </Card>
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Team not listed?</CardTitle>
          <CardDescription>
            Propose a new team inside the right school and program for school admin review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamRegistrationForm districts={requestDistricts} programs={programs} />
        </CardContent>
      </Card>
    </div>
  );
}
