import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray, max } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  receiptExtractions,
  receiptFiles,
  receiptLineItems,
  reimbursementRequests,
} from "@/db/schema";
import { requireUser } from "@/lib/rbac";
import { aggregateReimbursableTotals } from "@/lib/parsing/aggregate";
import { getRequestAccess } from "@/lib/reimbursements/request-access";

async function recalculateRequestTotal(requestId: string) {
  const files = await db.query.receiptFiles.findMany({
    where: eq(receiptFiles.requestId, requestId),
    columns: { id: true },
  });
  const fileIds = files.map((f) => f.id);

  const extractions =
    fileIds.length > 0
      ? await db.query.receiptExtractions.findMany({
          where: inArray(receiptExtractions.receiptFileId, fileIds),
          with: { lineItems: true },
        })
      : [];

  const total = aggregateReimbursableTotals(extractions);

  await db
    .update(reimbursementRequests)
    .set({ requestedTotal: total })
    .where(eq(reimbursementRequests.id, requestId));
}

const updateSchema = z.object({
  lineItemId: z.string(),
  description: z.string().optional(),
  quantity: z.number().nullable().optional(),
  unitPrice: z.number().nullable().optional(),
  lineTotal: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  excluded: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  let requestAccess;
  try {
    const user = await requireUser();
    requestAccess = await getRequestAccess(user.id, requestId);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requestAccess || !requestAccess.canView) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!requestAccess.canEditLineItems) {
    return NextResponse.json(
      { error: "Line items are not editable in the current request state" },
      { status: 400 }
    );
  }

  const body = updateSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { lineItemId, excluded, ...updates } = body.data;

  const lineItem = await db.query.receiptLineItems.findFirst({
    where: eq(receiptLineItems.id, lineItemId),
    with: { receiptExtraction: { with: { receiptFile: true } } },
  });
  if (!lineItem || lineItem.receiptExtraction.receiptFile.requestId !== requestId) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = { ...updates };
  if (excluded === false) {
    data.excludedAt = null;
    data.excludedById = null;
  }

  const [updated] = await db
    .update(receiptLineItems)
    .set(data)
    .where(eq(receiptLineItems.id, lineItemId))
    .returning();

  await recalculateRequestTotal(requestId);

  return NextResponse.json(updated);
}

const createSchema = z.object({
  receiptExtractionId: z.string(),
  description: z.string(),
  quantity: z.number().nullable().optional(),
  unitPrice: z.number().nullable().optional(),
  lineTotal: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  let requestAccess;
  try {
    const user = await requireUser();
    requestAccess = await getRequestAccess(user.id, requestId);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requestAccess || !requestAccess.canView) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!requestAccess.canEditLineItems) {
    return NextResponse.json(
      { error: "Line items are not editable in the current request state" },
      { status: 400 }
    );
  }

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const extraction = await db.query.receiptExtractions.findFirst({
    where: eq(receiptExtractions.id, body.data.receiptExtractionId),
    with: { receiptFile: true },
  });
  if (!extraction || extraction.receiptFile.requestId !== requestId) {
    return NextResponse.json({ error: "Extraction not found" }, { status: 404 });
  }

  const [maxPos] = await db
    .select({ value: max(receiptLineItems.position) })
    .from(receiptLineItems)
    .where(eq(receiptLineItems.receiptExtractionId, body.data.receiptExtractionId));

  const [created] = await db
    .insert(receiptLineItems)
    .values({
      ...body.data,
      position: (maxPos?.value ?? -1) + 1,
    })
    .returning();

  await recalculateRequestTotal(requestId);

  return NextResponse.json(created, { status: 201 });
}

const deleteSchema = z.object({
  lineItemId: z.string(),
});

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  let requestAccess;
  try {
    const user = await requireUser();
    requestAccess = await getRequestAccess(user.id, requestId);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requestAccess || !requestAccess.canView) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!requestAccess.canEditLineItems) {
    return NextResponse.json(
      { error: "Line items are not editable in the current request state" },
      { status: 400 }
    );
  }

  const body = deleteSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const lineItem = await db.query.receiptLineItems.findFirst({
    where: eq(receiptLineItems.id, body.data.lineItemId),
    with: { receiptExtraction: { with: { receiptFile: true } } },
  });
  if (!lineItem || lineItem.receiptExtraction.receiptFile.requestId !== requestId) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  const isReviewerExclusion =
    (requestAccess.isCoach || requestAccess.isReimbursementAdmin) &&
    requestAccess.request.status !== "DRAFT";

  if (isReviewerExclusion) {
    await db
      .update(receiptLineItems)
      .set({ excludedAt: new Date(), excludedById: requestAccess.userId })
      .where(eq(receiptLineItems.id, body.data.lineItemId));
  } else {
    await db
      .delete(receiptLineItems)
      .where(eq(receiptLineItems.id, body.data.lineItemId));
  }

  await recalculateRequestTotal(requestId);

  return NextResponse.json({ deleted: true, soft: isReviewerExclusion });
}
