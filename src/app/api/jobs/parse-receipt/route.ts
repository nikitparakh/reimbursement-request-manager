import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { aggregateReimbursableTotals } from "@/lib/parsing/aggregate";
import { parseReceiptWithProvider } from "@/lib/parsing/provider";
import { readStoredObject } from "@/lib/storage";

const schema = z.object({
  receiptFileId: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { receiptFileId } = parsed.data;
  const file = await db.receiptFile.findUnique({ where: { id: receiptFileId } });
  if (!file) {
    return NextResponse.json({ error: "Receipt file not found" }, { status: 404 });
  }

  await db.receiptFile.update({
    where: { id: file.id },
    data: { parseStatus: "PROCESSING" },
  });

  try {
    const fileBytes = await readStoredObject(file.storageUrl);

    const result = await parseReceiptWithProvider({
      fileName: file.fileName,
      mimeType: file.mimeType,
      bytes: fileBytes,
    });

    const receiptDate = parseDateOrNull(result.receiptDate);
    const extractionData = {
      documentType: result.documentType,
      merchant: result.merchant,
      receiptDate,
      subtotal: result.subtotal !== null ? new Prisma.Decimal(result.subtotal.toFixed(2)) : null,
      tax: result.tax !== null ? new Prisma.Decimal(result.tax.toFixed(2)) : null,
      total: result.total !== null ? new Prisma.Decimal(result.total.toFixed(2)) : null,
      currency: result.currency,
      confidence: result.confidence,
      flags: result.flags as Prisma.InputJsonValue,
      rawJson: result.raw as Prisma.InputJsonValue,
    } satisfies Omit<Prisma.ReceiptExtractionUncheckedCreateInput, "id" | "receiptFileId">;

    console.info("[parse][persist] Preparing extraction write", {
      receiptFileId: file.id,
      requestId: file.requestId,
      parseStatus: file.parseStatus,
      extractionData,
      lineItemCount: result.lineItems.length,
    });

    const lineItemRows = result.lineItems.map((item, position) => ({
      position,
      description: item.description,
      quantity: item.quantity !== null ? new Prisma.Decimal(item.quantity) : null,
      unitPrice: item.unitPrice !== null ? new Prisma.Decimal(item.unitPrice) : null,
      lineTotal: item.lineTotal !== null ? new Prisma.Decimal(item.lineTotal) : null,
      category: item.category,
    }));
    let computedRequestTotal: number | null = null;

    await db.$transaction(async (tx) => {
      const extraction = await tx.receiptExtraction.upsert({
        where: { receiptFileId: file.id },
        update: extractionData,
        create: {
          receiptFileId: file.id,
          ...extractionData,
        },
      });

      await tx.receiptLineItem.deleteMany({
        where: { receiptExtractionId: extraction.id },
      });

      if (lineItemRows.length > 0) {
        await tx.receiptLineItem.createMany({
          data: lineItemRows.map((item) => ({
            receiptExtractionId: extraction.id,
            ...item,
          })),
        });
      }

      await tx.receiptFile.update({
        where: { id: file.id },
        data: { parseStatus: "DONE" },
      });

      const requestWithExtractions = await tx.reimbursementRequest.findUnique({
        where: { id: file.requestId },
        include: {
          receiptFiles: {
            include: {
              extraction: {
                include: { lineItems: true },
              },
            },
          },
        },
      });

      if (requestWithExtractions) {
        const extractedRows = requestWithExtractions.receiptFiles
          .map((receiptFile) => receiptFile.extraction)
          .filter((item): item is NonNullable<typeof item> => Boolean(item));
        const computedTotal = aggregateReimbursableTotals(extractedRows);
        computedRequestTotal = computedTotal;

        await tx.reimbursementRequest.update({
          where: { id: file.requestId },
          data: { requestedTotal: new Prisma.Decimal(computedTotal.toFixed(2)) },
        });
      }
    });

    console.info("[parse][persist] Extraction write complete", {
      receiptFileId: file.id,
      requestId: file.requestId,
      finalParseStatus: "DONE",
      persistedLineItemCount: lineItemRows.length,
      computedRequestTotal,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await db.receiptFile.update({
      where: { id: file.id },
      data: { parseStatus: "FAILED" },
    });
    return NextResponse.json(
      {
        error: "Parsing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function parseDateOrNull(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
