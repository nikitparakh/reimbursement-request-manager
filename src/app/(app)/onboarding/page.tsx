import { unauthorized } from "next/navigation";
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

  const teams = await db.team.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, shortCode: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Get Started"
        description="Select your team and role before submitting reimbursements."
      />
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Join a Team</h2>
        </CardHeader>
        <CardContent>
          <TeamSelector teams={teams} />
        </CardContent>
      </Card>
      <Card className="border-dashed">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Team Not Listed?</h2>
          <p className="text-sm text-slate-500">Coaches can propose a team for admin approval.</p>
        </CardHeader>
        <CardContent>
          <TeamRegistrationForm />
        </CardContent>
      </Card>
    </div>
  );
}
