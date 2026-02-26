import { NextResponse } from "next/server";
import { z } from "zod";
import { transitionRequestStatus } from "@/lib/reimbursements/workflow";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { invalidateApprovalCaches } from "@/lib/reimbursements/cache";
import { sendNotification } from "@/lib/notifications/sender";

const schema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().max(1000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let actorId = "";
  let actorRole: "MANAGER" | "ADMIN" = "MANAGER";
  try {
    const actor = await requireRole("MANAGER", "ADMIN");
    actorId = actor.id;
    actorRole = actor.role === "ADMIN" ? "ADMIN" : "MANAGER";
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { requestId } = await params;
  const current = await db.reimbursementRequest.findUnique({ where: { id: requestId } });
  if (!current) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  if (actorRole === "MANAGER") {
    const managerMembership = await db.teamMembership.findFirst({
      where: {
        userId: actorId,
        teamId: current.teamId,
        roleInTeam: "MANAGER",
        approved: true,
      },
    });
    if (!managerMembership) {
      return NextResponse.json({ error: "Forbidden for this team" }, { status: 403 });
    }
  }

  if (body.data.decision === "REJECT" && !body.data.comment) {
    return NextResponse.json(
      { error: "Rejection comment is required" },
      { status: 400 }
    );
  }

  const updated = await transitionRequestStatus({
    requestId,
    actorId,
    nextStatus: body.data.decision === "APPROVE" ? "MANAGER_APPROVED" : "MANAGER_REJECTED",
    action: body.data.decision,
    comment: body.data.comment,
  });
  invalidateApprovalCaches(current.teamId);
  const [creator, actor] = await Promise.all([
    db.user.findUnique({ where: { id: current.createdById } }),
    db.user.findUnique({ where: { id: actorId } }),
  ]);
  if (creator?.email && actor?.email) {
    await sendNotification(
      body.data.decision === "APPROVE" ? "MANAGER_APPROVED" : "MANAGER_REJECTED",
      {
        requestId,
        actorEmail: actor.email,
        recipients: [creator.email],
        message: `Manager ${body.data.decision.toLowerCase()}d reimbursement ${current.title}`,
      }
    );
  }

  return NextResponse.json(updated);
}
