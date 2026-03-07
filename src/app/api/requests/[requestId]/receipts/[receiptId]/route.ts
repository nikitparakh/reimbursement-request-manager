import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { recomputeRequestTotal } from "@/lib/jobs/process-receipt";
import { deleteStoredObject } from "@/lib/storage";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ requestId: string; receiptId: string }> }
) {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId, receiptId } = await params;

  const request = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
    select: { createdById: true, status: true },
  });

  if (!request || request.createdById !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (request.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Receipts can only be deleted from draft requests" },
      { status: 400 }
    );
  }

  const receipt = await db.receiptFile.findUnique({
    where: { id: receiptId },
  });

  if (!receipt || receipt.requestId !== requestId) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  await db.receiptFile.delete({ where: { id: receiptId } });

  await recomputeRequestTotal(requestId);

  await deleteStoredObject(receipt.storageUrl);

  return NextResponse.json({ deleted: true });
}
