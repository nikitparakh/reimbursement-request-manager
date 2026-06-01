import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db as defaultDb, type DB } from "@/lib/db";
import {
  receiptExtractions,
  receiptFiles,
  receiptLineItems,
  reimbursementRequests,
} from "@/db/schema";
import { aggregateReimbursableTotals } from "@/lib/parsing/aggregate";
import { parseReceiptWithProvider } from "@/lib/parsing/provider";
import { readStoredObject } from "@/lib/storage";

/**
 * Optional execution context so the receipt job can run both inside the Next
 * app (OpenNext request context — defaults pulled from bindings) and inside a
 * standalone Cloudflare Queue consumer Worker (which must inject db/bucket/AI
 * config explicitly, since getCloudflareContext() is unavailable there).
 */
export type ReceiptJobContext = {
  db?: DB;
  bucket?: R2Bucket;
  aiApiKey?: string;
  aiModel?: string;
};

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
export async function processReceipt(
  receiptFileId: string,
  ctx?: ReceiptJobContext
) {
  const db = ctx?.db ?? defaultDb;
  const file = await db.query.receiptFiles.findFirst({
    where: eq(receiptFiles.id, receiptFileId),
  });
  if (!file) {
    throw new Error(`Receipt file not found: ${receiptFileId}`);
  }

  await db
    .update(receiptFiles)
    .set({ parseStatus: "PROCESSING" })
    .where(eq(receiptFiles.id, file.id));

  try {
    const fileBytes = await readStoredObject(file.storageUrl, ctx?.bucket);

    const result = await parseReceiptWithProvider(
      {
        fileName: file.fileName,
        mimeType: file.mimeType,
        bytes: fileBytes,
      },
      { apiKey: ctx?.aiApiKey, model: ctx?.aiModel }
    );

    const receiptDate = parseDateOrNull(result.receiptDate);
    const extractionData = {
      documentType: result.documentType,
      merchant: result.merchant,
      receiptDate,
      subtotal: result.subtotal !== null ? Number(result.subtotal.toFixed(2)) : null,
      tax: result.tax !== null ? Number(result.tax.toFixed(2)) : null,
      total: result.total !== null ? Number(result.total.toFixed(2)) : null,
      currency: result.currency,
      confidence: result.confidence,
      flags: result.flags,
      rawJson: result.raw,
    };

    const lineItemRows = result.lineItems.map((item, position) => ({
      position,
      description: item.description,
      quantity: item.quantity !== null ? item.quantity : null,
      unitPrice: item.unitPrice !== null ? item.unitPrice : null,
      lineTotal: item.lineTotal !== null ? item.lineTotal : null,
      category: item.category,
    }));

    // Preserve reviewer exclusions and user edits across a re-parse. Look up the
    // existing extraction (if any) and its current line items; if a human has
    // already excluded items (excludedAt/excludedById) or edited rows exist, we
    // MUST NOT blow them away — only seed line items when none exist yet.
    const existingExtraction = await db.query.receiptExtractions.findFirst({
      where: eq(receiptExtractions.receiptFileId, file.id),
      with: { lineItems: true },
    });

    const existingLineItems = existingExtraction?.lineItems ?? [];
    const hasHumanEdits = existingLineItems.some(
      (item) => item.excludedAt !== null || item.excludedById !== null
    );
    // Only (re)seed line items from the AI extraction when there are none yet.
    // Once any line items exist — and especially once a reviewer has excluded
    // or edited them — we keep the existing rows untouched.
    const shouldSeedLineItems =
      existingLineItems.length === 0 && !hasHumanEdits;

    // Use an app-side id so the extraction upsert can be folded into the same
    // atomic db.batch() as the dependent line-item / status writes (D1 has no
    // interactive transactions).
    const extractionId = existingExtraction?.id ?? nanoid();

    await db.batch([
      db
        .insert(receiptExtractions)
        .values({
          id: extractionId,
          receiptFileId: file.id,
          ...extractionData,
        })
        .onConflictDoUpdate({
          target: receiptExtractions.receiptFileId,
          set: extractionData,
        }),
      ...(shouldSeedLineItems && lineItemRows.length > 0
        ? [
            db.insert(receiptLineItems).values(
              lineItemRows.map((item) => ({
                receiptExtractionId: extractionId,
                ...item,
              })),
            ),
          ]
        : []),
      db
        .update(receiptFiles)
        .set({ parseStatus: "DONE" })
        .where(eq(receiptFiles.id, file.id)),
    ]);
  } catch (error) {
    await db
      .update(receiptFiles)
      .set({ parseStatus: "FAILED" })
      .where(eq(receiptFiles.id, file.id));
    throw error;
  }
}

/**
 * Recomputes the reimbursable total for a request from its current
 * extractions. Safe to call after one or many receipts have been processed.
 */
export async function recomputeRequestTotal(
  requestId: string,
  ctx?: ReceiptJobContext
) {
  const db = ctx?.db ?? defaultDb;
  const request = await db.query.reimbursementRequests.findFirst({
    where: eq(reimbursementRequests.id, requestId),
    with: {
      receiptFiles: {
        with: {
          extraction: { with: { lineItems: true } },
        },
      },
    },
  });

  if (!request) return;

  // Only sum extractions whose receipt finished parsing (parseStatus === DONE).
  // Receipts still QUEUED/PROCESSING/FAILED may carry stale or partially-written
  // line items; including them would fold a stale total into requestedTotal.
  const extractions = request.receiptFiles
    .filter((f) => f.parseStatus === "DONE")
    .map((f) => f.extraction)
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const total = aggregateReimbursableTotals(extractions);

  await db
    .update(reimbursementRequests)
    .set({ requestedTotal: Number(total.toFixed(2)) })
    .where(eq(reimbursementRequests.id, requestId));
}
