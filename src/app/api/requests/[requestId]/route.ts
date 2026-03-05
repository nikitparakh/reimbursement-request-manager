import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
}).refine((data) => data.title !== undefined || data.description !== undefined, {
  message: "At least one field (title or description) is required",
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { requestId } = await params;

  const record = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
    include: {
      receiptFiles: { include: { extraction: true } },
      approvals: { include: { actor: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canView =
    record.createdById === userId ||
    (await db.teamMembership.findFirst({
      where: { userId, teamId: record.teamId, approved: true },
    })) !== null;

  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(record);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;
  const record = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
    select: { createdById: true, status: true, teamId: true },
  });

  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (record.status !== "DRAFT")
    return NextResponse.json(
      { error: "Only draft requests can be edited" },
      { status: 400 }
    );

  if (record.createdById !== user.id && user.role !== "ADMIN") {
    const coachMembership = await db.teamMembership.findFirst({
      where: { userId: user.id, teamId: record.teamId, roleInTeam: "COACH", approved: true },
    });
    if (!coachMembership)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = patchSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const updated = await db.reimbursementRequest.update({
    where: { id: requestId },
    data: {
      ...(body.data.title !== undefined && { title: body.data.title }),
      ...(body.data.description !== undefined && { description: body.data.description }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { requestId } = await params;

  const record = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
    select: { createdById: true, status: true, teamId: true },
  });

  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (record.status !== "DRAFT")
    return NextResponse.json(
      { error: "Only draft requests can be deleted" },
      { status: 400 }
    );

  if (record.createdById !== user.id && user.role !== "ADMIN") {
    const coachMembership = await db.teamMembership.findFirst({
      where: { userId: user.id, teamId: record.teamId, roleInTeam: "COACH", approved: true },
    });
    if (!coachMembership)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.reimbursementRequest.delete({ where: { id: requestId } });

  return NextResponse.json({ deleted: true });
}
