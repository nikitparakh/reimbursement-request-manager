import { normalizedReceiptSchema, type NormalizedReceipt } from "@/lib/parsing/parse-types";

function pickFirstAmount(text: string) {
  const match = text.match(/\$?\s?([0-9]+(?:\.[0-9]{2})?)/);
  return match ? Number(match[1]) : null;
}

function inferDocumentType(text: string): NormalizedReceipt["documentType"] {
  const lower = text.toLowerCase();
  if (lower.includes("form w-9")) return "W9";
  if (lower.includes("check request form")) return "CHECK_REQUEST_FORM";
  if (lower.includes("invoice")) return "INVOICE";
  if (lower.includes("receipt") || lower.includes("order total")) return "RECEIPT";
  return "OTHER";
}

export function normalizeExtractedText(rawText: string): NormalizedReceipt {
  const documentType = inferDocumentType(rawText);
  const total = pickFirstAmount(rawText);
  const merchantMatch = rawText.match(/([A-Z][A-Za-z0-9 '&.-]{3,40})/);
  const merchant = merchantMatch?.[1]?.trim() ?? null;
  const dateMatch = rawText.match(/\b([01]?\d\/[0-3]?\d\/\d{2,4})\b/);
  const receiptDate = dateMatch?.[1] ?? null;

  return normalizedReceiptSchema.parse({
    documentType,
    merchant,
    receiptDate,
    subtotal: null,
    tax: null,
    total,
    confidence: total ? 0.65 : 0.4,
    flags: total ? [] : ["LOW_CONFIDENCE_MISSING_TOTAL"],
    lineItems: [],
    raw: { rawText: rawText.slice(0, 5000) },
  });
}
