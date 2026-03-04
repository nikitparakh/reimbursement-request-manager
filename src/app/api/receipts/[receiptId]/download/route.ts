import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { readStoredObject } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { receiptId } = await params;
  const receipt = await db.receiptFile.findUnique({
    where: { id: receiptId },
    include: { request: { select: { createdById: true, teamId: true } } },
  });

  if (!receipt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canView =
    receipt.request.createdById === userId ||
    (await db.teamMembership.findFirst({
      where: { userId, teamId: receipt.request.teamId, approved: true },
    })) !== null;

  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bytes = await readStoredObject(receipt.storageUrl);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": receipt.mimeType,
      "Content-Disposition": `inline; filename="${receipt.fileName}"`,
    },
  });
}
