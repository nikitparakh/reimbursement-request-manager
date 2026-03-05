import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { aggregateReimbursableTotals } from "@/lib/parsing/aggregate";
import { parseReceiptWithProvider } from "@/lib/parsing/provider";
import { readStoredObject } from "@/lib/storage";

function parseDateOrNull(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parses a single receipt file: runs AI extraction and persists results.
 * Does NOT recompute the parent request total — call
 * {@link recomputeRequestTotal} once after all receipts are processed.
 */
export async function processReceipt(receiptFileId: string) {
  const file = await db.receiptFile.findUnique({ where: { id: receiptFileId } });
  if (!file) {
    throw new Error(`Receipt file not found: ${receiptFileId}`);
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
    });

    console.info("[parse][persist] Extraction write complete", {
      receiptFileId: file.id,
      requestId: file.requestId,
      finalParseStatus: "DONE",
      persistedLineItemCount: lineItemRows.length,
    });
  } catch (error) {
    await db.receiptFile.update({
      where: { id: file.id },
      data: { parseStatus: "FAILED" },
    });
    throw error;
  }
}

/**
 * Recomputes the reimbursable total for a request from its current
 * extractions. Safe to call after one or many receipts have been processed.
 */
export async function recomputeRequestTotal(requestId: string) {
  const request = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
    include: {
      receiptFiles: {
        include: {
          extraction: { include: { lineItems: true } },
        },
      },
    },
  });

  if (!request) return;

  const extractions = request.receiptFiles
    .map((f) => f.extraction)
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const total = aggregateReimbursableTotals(extractions);

  await db.reimbursementRequest.update({
    where: { id: requestId },
    data: { requestedTotal: new Prisma.Decimal(total.toFixed(2)) },
  });

  console.info("[parse][total] Request total recomputed", { requestId, total });
}
