import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { transitionRequestStatus } from "@/lib/reimbursements/workflow";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/rbac";
import { invalidateApprovalCaches } from "@/lib/reimbursements/cache";
import { sendNotification } from "@/lib/notifications/sender";
import { getRequestAccess } from "@/lib/reimbursements/request-access";

const schema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "MARK_PAID"]),
  comment: z.string().max(1000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let actorId = "";
  try {
    actorId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;
  const requestAccess = await getRequestAccess(actorId, requestId);
  if (!requestAccess || !requestAccess.canView) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (!requestAccess.isReimbursementAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const current = requestAccess.request;

  if (body.data.decision === "REJECT" && !body.data.comment) {
    return NextResponse.json(
      { error: "Rejection comment is required" },
      { status: 400 }
    );
  }

  const nextStatus =
    body.data.decision === "APPROVE"
      ? "ADMIN_APPROVED"
      : body.data.decision === "REJECT"
        ? "ADMIN_REJECTED"
        : "PAID";

  const updated = await transitionRequestStatus({
    requestId,
    actorId,
    nextStatus,
    action: body.data.decision === "MARK_PAID" ? "MARK_PAID" : body.data.decision,
    comment: body.data.comment,
  });
  invalidateApprovalCaches(current.teamId);
  const [creator, actor] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, current.createdById) }),
    db.query.users.findFirst({ where: eq(users.id, actorId) }),
  ]);
  if (creator?.email && actor?.email) {
    const event =
      body.data.decision === "APPROVE"
        ? "ADMIN_APPROVED" as const
        : body.data.decision === "REJECT"
          ? "ADMIN_REJECTED" as const
          : "MARKED_PAID" as const;
    const message =
      body.data.decision === "MARK_PAID"
        ? `Reimbursement marked as paid: ${current.title}`
        : `Admin ${body.data.decision.toLowerCase()}d reimbursement: ${current.title}`;
    await sendNotification(event, {
      requestId,
      actorEmail: actor.email,
      recipients: [creator.email],
      message,
    });
  }

  return NextResponse.json(updated);
}
