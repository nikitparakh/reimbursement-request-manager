import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { RequestForm } from "@/components/reimbursements/request-form";

export default async function NewRequestPage() {
  const session = await auth();
  if (!session?.user) unauthorized();

  const memberships = await db.teamMembership.findMany({
    where: { userId: session.user.id, approved: true },
    include: { team: true },
  });

  const teams = memberships.map((membership) => ({
    id: membership.team.id,
    name: membership.team.name,
  }));

  return (
    <section>
      <h1>New reimbursement request</h1>
      {teams.length === 0 ? (
        <p>Complete onboarding and team membership before creating requests.</p>
      ) : (
        <RequestForm teams={teams} />
      )}
      <p>After creating a draft, open /student/requests/&lt;requestId&gt; to upload and submit.</p>
    </section>
  );
}
