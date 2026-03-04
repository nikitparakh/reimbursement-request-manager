import type { Prisma } from "@prisma/client";

export type SerializedLineItem = {
  id: string;
  receiptExtractionId: string;
  description: string;
  quantity: string | null;
  unitPrice: string | null;
  lineTotal: string | null;
  category: string | null;
  excludedAt: string | null;
};

export type SerializedExtraction = {
  id: string;
  documentType: string;
  merchant: string | null;
  subtotal: string | null;
  tax: string | null;
  total: string | null;
  currency: string | null;
  lineItems: SerializedLineItem[];
};

export type SerializedReceipt = {
  id: string;
  fileName: string;
  extraction: SerializedExtraction | null;
};

type PrismaReceiptWithExtraction = Prisma.ReceiptFileGetPayload<{
  include: {
    extraction: {
      include: { lineItems: true };
    };
  };
}>;

/**
 * Converts Prisma Decimal fields to strings so the data
 * can be passed from server components to client components.
 */
export function serializeReceipts(
  receipts: PrismaReceiptWithExtraction[]
): SerializedReceipt[] {
  return receipts.map((f) => ({
    id: f.id,
    fileName: f.fileName,
    extraction: f.extraction
      ? {
          id: f.extraction.id,
          documentType: f.extraction.documentType,
          merchant: f.extraction.merchant,
          subtotal: f.extraction.subtotal?.toString() ?? null,
          tax: f.extraction.tax?.toString() ?? null,
          total: f.extraction.total?.toString() ?? null,
          currency: f.extraction.currency,
          lineItems: f.extraction.lineItems.map((li) => ({
            id: li.id,
            receiptExtractionId: li.receiptExtractionId,
            description: li.description,
            quantity: li.quantity?.toString() ?? null,
            unitPrice: li.unitPrice?.toString() ?? null,
            lineTotal: li.lineTotal?.toString() ?? null,
            category: li.category,
            excludedAt: li.excludedAt?.toISOString() ?? null,
          })),
        }
      : null,
  }));
}

/**
 * Infers tax from the gap between extracted total and line-item sum
 * when explicit tax is zero/absent. Returns 0 when there is no gap.
 */
export function inferTax(
  explicitTax: number,
  extractedTotal: number,
  lineItemsSum: number
): number {
  if (explicitTax > 0) return explicitTax;
  if (extractedTotal > lineItemsSum) {
    return Math.round((extractedTotal - lineItemsSum) * 100) / 100;
  }
  return 0;
}
