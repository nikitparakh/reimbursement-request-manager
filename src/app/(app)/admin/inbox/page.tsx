import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApprovalDecision } from "@/components/reimbursements/approval-decision";

export default async function AdminInboxPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "ADMIN") unauthorized();

  const requests = await db.reimbursementRequest.findMany({
    where: {
      status: { in: ["MANAGER_APPROVED", "ADMIN_APPROVED"] },
    },
    include: { createdBy: true, team: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <section>
      <h1>Admin inbox</h1>
      {requests.length === 0 ? <p>No pending requests.</p> : null}
      <ul>
        {requests.map((request) => (
          <li key={request.id}>
            <p>
              <strong>{request.title}</strong> ({request.team.name}) by {request.createdBy.email}
            </p>
            <p>Status: {request.status}</p>
            <p>Requested total: ${request.requestedTotal.toString()}</p>
            <ApprovalDecision
              requestId={request.id}
              endpoint={`/api/requests/${request.id}/admin-decision`}
              allowMarkPaid
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
