import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lineItemComments, receiptLineItems, users } from "@/db/schema";
import { requireUser } from "@/lib/rbac";
import { getRequestAccess } from "@/lib/reimbursements/request-access";

const schema = z.object({
  lineItemId: z.string(),
  text: z.string().trim().min(1).max(500),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let actorId = "";
  let requestAccess;
  try {
    const actor = await requireUser();
    actorId = actor.id;
    const { requestId } = await params;
    requestAccess = await getRequestAccess(actor.id, requestId);
    if (!requestAccess || !requestAccess.canView) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { requestId } = await params;
  if (!requestAccess) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (!requestAccess.canCommentOnLineItems) {
    return NextResponse.json(
      { error: "Comments are only allowed during review" },
      { status: 400 }
    );
  }

  const lineItem = await db.query.receiptLineItems.findFirst({
    where: eq(receiptLineItems.id, body.data.lineItemId),
    with: { receiptExtraction: { with: { receiptFile: true } } },
  });
  if (!lineItem || lineItem.receiptExtraction.receiptFile.requestId !== requestId) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  const [comment] = await db
    .insert(lineItemComments)
    .values({
      lineItemId: body.data.lineItemId,
      authorId: actorId,
      text: body.data.text,
    })
    .returning();

  const author = await db.query.users.findFirst({
    where: eq(users.id, comment.authorId),
    columns: { email: true },
  });

  return NextResponse.json(
    {
      id: comment.id,
      authorId: comment.authorId,
      authorEmail: author?.email,
      text: comment.text,
      createdAt: comment.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
