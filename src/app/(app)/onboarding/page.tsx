import { redirect, unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TeamSelector } from "@/components/onboarding/team-selector";
import { TeamRegistrationForm } from "@/components/onboarding/team-registration-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
    <div className="space-y-6">
      <PageHeader
        title="Get Started"
        description="Choose your district, school, program, and team before you start working in the reimbursement flow."
      />
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Join an Existing Team</h2>
        </CardHeader>
        <CardContent>
          <TeamSelector districts={districtOptions} />
        </CardContent>
      </Card>
      <Card className="border-dashed">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Team Not Listed?</h2>
          <p className="text-sm text-slate-500">Propose a new team inside the right school and program for school admin review.</p>
        </CardHeader>
        <CardContent>
          <TeamRegistrationForm districts={requestDistricts} programs={programs} />
        </CardContent>
      </Card>
    </div>
  );
}
