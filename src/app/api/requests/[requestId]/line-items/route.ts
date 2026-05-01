import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { aggregateReimbursableTotals } from "@/lib/parsing/aggregate";
import { getRequestAccess } from "@/lib/reimbursements/request-access";

async function recalculateRequestTotal(requestId: string) {
  const extractions = await db.receiptExtraction.findMany({
    where: { receiptFile: { requestId } },
    include: { lineItems: true },
  });

  const total = aggregateReimbursableTotals(extractions);

  await db.reimbursementRequest.update({
    where: { id: requestId },
    data: { requestedTotal: total },
  });
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

  const lineItem = await db.receiptLineItem.findUnique({
    where: { id: lineItemId },
    include: { receiptExtraction: { include: { receiptFile: true } } },
  });
  if (!lineItem || lineItem.receiptExtraction.receiptFile.requestId !== requestId) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = { ...updates };
  if (excluded === false) {
    data.excludedAt = null;
    data.excludedById = null;
  }

  const updated = await db.receiptLineItem.update({
    where: { id: lineItemId },
    data,
  });

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

  const extraction = await db.receiptExtraction.findUnique({
    where: { id: body.data.receiptExtractionId },
    include: { receiptFile: true },
  });
  if (!extraction || extraction.receiptFile.requestId !== requestId) {
    return NextResponse.json({ error: "Extraction not found" }, { status: 404 });
  }

  const maxPos = await db.receiptLineItem.aggregate({
    where: { receiptExtractionId: body.data.receiptExtractionId },
    _max: { position: true },
  });

  const created = await db.receiptLineItem.create({
    data: {
      ...body.data,
      position: (maxPos._max.position ?? -1) + 1,
    },
  });

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

  const lineItem = await db.receiptLineItem.findUnique({
    where: { id: body.data.lineItemId },
    include: { receiptExtraction: { include: { receiptFile: true } } },
  });
  if (!lineItem || lineItem.receiptExtraction.receiptFile.requestId !== requestId) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  const isReviewerExclusion =
    (requestAccess.isCoach || requestAccess.isReimbursementAdmin) &&
    requestAccess.request.status !== "DRAFT";

  if (isReviewerExclusion) {
    await db.receiptLineItem.update({
      where: { id: body.data.lineItemId },
      data: { excludedAt: new Date(), excludedById: requestAccess.userId },
    });
  } else {
    await db.receiptLineItem.delete({ where: { id: body.data.lineItemId } });
  }

  await recalculateRequestTotal(requestId);

  return NextResponse.json({ deleted: true, soft: isReviewerExclusion });
}
