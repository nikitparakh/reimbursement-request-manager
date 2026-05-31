import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reimbursementRequests } from "@/db/schema";
import { aggregateReimbursableTotals } from "@/lib/parsing/aggregate";
import { requireUser } from "@/lib/rbac";

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
  const requestRecord = await db.query.reimbursementRequests.findFirst({
    where: eq(reimbursementRequests.id, requestId),
    with: {
      receiptFiles: {
        with: { extraction: { with: { lineItems: true } } },
      },
    },
  });

  if (!requestRecord || requestRecord.createdById !== userId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const pendingParses = requestRecord.receiptFiles.filter(
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

  const extractions = requestRecord.receiptFiles
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
