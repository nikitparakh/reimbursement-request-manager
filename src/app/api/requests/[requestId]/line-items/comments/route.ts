import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

const schema = z.object({
  lineItemId: z.string(),
  text: z.string().trim().min(1).max(500),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let actor;
  try {
    actor = await requireRole("COACH", "ADMIN");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { requestId } = await params;
  const reimbursementRequest = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
  });
  if (!reimbursementRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (actor.role === "COACH") {
    const membership = await db.teamMembership.findFirst({
      where: {
        userId: actor.id,
        teamId: reimbursementRequest.teamId,
        roleInTeam: "COACH",
        approved: true,
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden for this team" }, { status: 403 });
    }
  }

  const canComment =
    (actor.role === "ADMIN" &&
      (reimbursementRequest.status === "SUBMITTED" || reimbursementRequest.status === "COACH_APPROVED")) ||
    (actor.role === "COACH" && reimbursementRequest.status === "SUBMITTED");

  if (!canComment) {
    return NextResponse.json(
      { error: "Comments are only allowed during review" },
      { status: 400 }
    );
  }

  const lineItem = await db.receiptLineItem.findUnique({
    where: { id: body.data.lineItemId },
    include: { receiptExtraction: { include: { receiptFile: true } } },
  });
  if (!lineItem || lineItem.receiptExtraction.receiptFile.requestId !== requestId) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  const comment = await db.lineItemComment.create({
    data: {
      lineItemId: body.data.lineItemId,
      authorId: actor.id,
      text: body.data.text,
    },
    include: {
      author: { select: { email: true } },
    },
  });

  return NextResponse.json(
    {
      id: comment.id,
      authorId: comment.authorId,
      authorEmail: comment.author.email,
      text: comment.text,
      createdAt: comment.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
