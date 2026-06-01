import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reimbursementRequests, receiptFiles } from "@/db/schema";
import { aggregateReimbursableTotals } from "@/lib/parsing/aggregate";
import { requireUser } from "@/lib/rbac";
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

  // Authorize through getRequestAccess, then gate on a writable (DRAFT) state so
  // auto-fill can never overwrite the pinned total on an approved/paid request.
  const requestAccess = await getRequestAccess(userId, requestId);
  if (!requestAccess || requestAccess.request.createdById !== userId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (!requestAccess.canEditDraft) {
    return NextResponse.json(
      { error: "This request can no longer be auto-filled." },
      { status: 409 }
    );
  }

  const files = await db.query.receiptFiles.findMany({
    where: eq(receiptFiles.requestId, requestId),
    with: { extraction: { with: { lineItems: true } } },
  });

  const pendingParses = files.filter(
    (item) => item.parseStatus === "QUEUED" || item.parseStatus === "PROCESSING"
  );
  if (pendingParses.length > 0) {
    return NextResponse.json(
      {
        error: "Parsing still in progress. Please wait a moment and try auto-fill again.",
        pendingCount: pendingParses.length,
      },
      { status: 409 }
    );
  }

  const extractions = files
    .map((item) => item.extraction)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const total = aggregateReimbursableTotals(extractions);

  const [updated] = await db
    .update(reimbursementRequests)
    .set({ requestedTotal: Number(total.toFixed(2)) })
    .where(eq(reimbursementRequests.id, requestId))
    .returning();

  return NextResponse.json({
    requestedTotal: Number(updated.requestedTotal),
    extractionCount: extractions.length,
  });
}
