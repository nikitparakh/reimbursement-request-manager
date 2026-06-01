import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/rbac";
import { processReceipt, recomputeRequestTotal } from "@/lib/jobs/process-receipt";
import { db } from "@/lib/db";
import { receiptFiles } from "@/db/schema";
import { getRequestAccess } from "@/lib/reimbursements/request-access";
import { getReceiptQueue } from "@/lib/queue";

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

  // Idempotent, stampede-safe claim: atomically flip QUEUED/FAILED receipts to
  // PROCESSING and only act on the rows THIS request actually claimed. Rows
  // already PROCESSING (a concurrent/retried parse) are left alone, so we never
  // re-enqueue them or fire duplicate Gemini calls.
  const receiptsToProcess = await db
    .update(receiptFiles)
    .set({ parseStatus: "PROCESSING" })
    .where(
      and(
        eq(receiptFiles.requestId, requestId),
        inArray(receiptFiles.parseStatus, ["QUEUED", "FAILED"])
      )
    )
    .returning();

  if (receiptsToProcess.length === 0) {
    // Either nothing to parse, or a concurrent request already claimed every
    // pending receipt — treat as a no-op rather than re-parsing PROCESSING rows.
    return NextResponse.json({ queued: 0 });
  }

  // On Workers, hand off to the Cloudflare Queue consumer (decoupled from the
  // client connection). The frontend polls receiptFile.parseStatus.
  const queue = getReceiptQueue();
  if (queue) {
    try {
      await queue.sendBatch(
        receiptsToProcess.map((receipt) => ({
          body: { receiptFileId: receipt.id, requestId },
        }))
      );
    } catch (error) {
      // Enqueue failed after we claimed the rows: release them back to QUEUED so
      // they aren't stranded in PROCESSING with no consumer to advance them.
      console.error("[parse] failed to enqueue claimed receipts", error);
      await db
        .update(receiptFiles)
        .set({ parseStatus: "QUEUED" })
        .where(
          inArray(
            receiptFiles.id,
            receiptsToProcess.map((receipt) => receipt.id)
          )
        );
      return NextResponse.json(
        { error: "Could not start parsing. Please try again." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { queued: receiptsToProcess.length, async: true },
      { status: 202 }
    );
  }

  // Fallback (tests / local dev without a queue binding): process inline.
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
