import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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
  const requestRecord = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
    include: {
      receiptFiles: {
        include: { extraction: { include: { lineItems: true } } },
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

  console.info("[autofill] Aggregated request total from extractions", {
    requestId,
    receiptCount: requestRecord.receiptFiles.length,
    extractionCount: extractions.length,
    extractionSummaries: extractions.map((item) => ({
      documentType: item.documentType,
      total: item.total ? Number(item.total) : 0,
      confidence: item.confidence,
      lineItemCount: item.lineItems.length,
      lineItemTotal: item.lineItems.reduce(
        (sum, lineItem) => sum + (lineItem.lineTotal ? Number(lineItem.lineTotal) : 0),
        0
      ),
    })),
    computedTotal: total,
  });

  const updated = await db.reimbursementRequest.update({
    where: { id: requestId },
    data: { requestedTotal: new Prisma.Decimal(total.toFixed(2)) },
  });

  return NextResponse.json({
    requestedTotal: Number(updated.requestedTotal),
    extractionCount: extractions.length,
  });
}
