import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/rbac";
import { processReceipt, recomputeRequestTotal } from "@/lib/jobs/process-receipt";
import { db } from "@/lib/db";
import { receiptFiles } from "@/db/schema";
import { getRequestAccess } from "@/lib/reimbursements/request-access";

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
  const requestAccess = await getRequestAccess(userId, requestId);

  if (!requestAccess || !requestAccess.canView) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (!requestAccess.canEditDraft) {
    return NextResponse.json(
      { error: "Receipts can only be parsed while request is draft" },
      { status: 400 }
    );
  }

  const receiptsToProcess = await db.query.receiptFiles.findMany({
    where: and(
      eq(receiptFiles.requestId, requestId),
      inArray(receiptFiles.parseStatus, ["QUEUED", "FAILED"])
    ),
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
