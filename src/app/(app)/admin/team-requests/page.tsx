import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TeamRequestDecision } from "@/components/onboarding/team-request-decision";

export default async function AdminTeamRequestsPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "ADMIN") unauthorized();

  const requests = await db.teamRegistrationRequest.findMany({
    where: { status: "PENDING" },
    include: { requestedBy: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <section>
      <h1>Pending team registrations</h1>
      {requests.length === 0 ? <p>No pending team registrations.</p> : null}
      <ul>
        {requests.map((request) => (
          <li key={request.id}>
            <strong>{request.teamName}</strong> requested by {request.requestedBy.email}
            <p>{request.notes}</p>
            <TeamRequestDecision requestId={request.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}
