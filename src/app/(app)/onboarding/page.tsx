import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TeamSelector } from "@/components/onboarding/team-selector";
import { TeamRegistrationForm } from "@/components/onboarding/team-registration-form";

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
    <section>
      <h1>Onboarding</h1>
      <p>Select your role and team before submitting reimbursements.</p>
      <TeamSelector teams={teams} />
      <hr />
      <TeamRegistrationForm />
    </section>
  );
}
