import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApprovalDecision } from "@/components/reimbursements/approval-decision";
import { ExtractionReview } from "@/components/reimbursements/extraction-review";

export default async function ManagerInboxPage() {
  const session = await auth();
  if (!session?.user) unauthorized();

  const managedTeamIds = (
    await db.teamMembership.findMany({
      where: { userId: session.user.id, roleInTeam: "MANAGER", approved: true },
      select: { teamId: true },
    })
  ).map((item) => item.teamId);

  const requests = await db.reimbursementRequest.findMany({
    where: {
      teamId: { in: managedTeamIds },
      status: "SUBMITTED",
    },
    include: {
      createdBy: true,
      team: true,
      receiptFiles: {
        include: {
          extraction: {
            include: {
              lineItems: {
                orderBy: { position: "asc" },
              },
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <section>
      <h1>Manager inbox</h1>
      {requests.length === 0 ? <p>No pending requests.</p> : null}
      <ul>
        {requests.map((request) => (
          <li key={request.id}>
            <p>
              <strong>{request.title}</strong> ({request.team.name}) by {request.createdBy.email}
            </p>
            <p>Requested total: ${request.requestedTotal.toString()}</p>
            <ExtractionReview receipts={request.receiptFiles} />
            <ApprovalDecision
              requestId={request.id}
              endpoint={`/api/requests/${request.id}/manager-decision`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
