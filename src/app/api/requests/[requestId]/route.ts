import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";

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
