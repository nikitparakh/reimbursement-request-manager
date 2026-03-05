import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { processReceipt, recomputeRequestTotal } from "@/lib/jobs/process-receipt";

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

  const receiptsToProcess = await db.receiptFile.findMany({
    where: { requestId, parseStatus: { in: ["QUEUED", "FAILED"] } },
  });

  if (receiptsToProcess.length === 0) {
    return NextResponse.json({ queued: 0 });
  }

  const results = await Promise.allSettled(
    receiptsToProcess.map((receipt) => processReceipt(receipt.id))
  );

  await recomputeRequestTotal(requestId);

  const errors = results.filter((r) => r.status === "rejected");

  if (errors.length > 0) {
    return NextResponse.json(
      { error: `Failed to process ${errors.length} receipt(s)`, queued: receiptsToProcess.length - errors.length },
      { status: 207 }
    );
  }

  return NextResponse.json({ queued: receiptsToProcess.length });
}
