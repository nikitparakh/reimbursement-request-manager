import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { enqueueReceiptParseJob } from "@/lib/jobs/enqueue-parse";

export async function POST(
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
  const reimbursementRequest = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
  });

  if (!reimbursementRequest || reimbursementRequest.createdById !== userId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Pick up both QUEUED (first parse) and FAILED (retry) receipts
  const receiptsToProcess = await db.receiptFile.findMany({
    where: { requestId, parseStatus: { in: ["QUEUED", "FAILED"] } },
  });

  if (receiptsToProcess.length === 0) {
    return NextResponse.json({ queued: 0 });
  }

  // Reset FAILED receipts back to QUEUED before re-enqueuing
  const failedIds = receiptsToProcess.filter((r) => r.parseStatus === "FAILED").map((r) => r.id);
  if (failedIds.length > 0) {
    await db.receiptFile.updateMany({
      where: { id: { in: failedIds } },
      data: { parseStatus: "QUEUED" },
    });
  }

  const errors: string[] = [];
  for (const receipt of receiptsToProcess) {
    try {
      await enqueueReceiptParseJob(receipt.id);
    } catch {
      errors.push(receipt.id);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: `Failed to enqueue ${errors.length} receipt(s)`, queued: receiptsToProcess.length - errors.length },
      { status: 207 }
    );
  }

  return NextResponse.json({ queued: receiptsToProcess.length });
}
