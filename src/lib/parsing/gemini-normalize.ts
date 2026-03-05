import {
  normalizedLineItemSchema,
  normalizedReceiptSchema,
  type NormalizedLineItem,
  type NormalizedReceipt,
} from "@/lib/parsing/parse-types";

type JsonRecord = Record<string, unknown>;

const VALID_DOCUMENT_TYPES = new Set([
  "RECEIPT",
  "INVOICE",
  "W9",
  "CHECK_REQUEST_FORM",
  "OTHER",
]);

const NESTED_DOCUMENT_KEYS = [
  "response",
  "responses",
  "documents",
  "items",
  "results",
  "receipts",
  "data",
  "raw",
];

const LINE_ITEM_ARRAY_KEYS = ["lineItems", "items", "entries", "charges"];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDocumentType(value: unknown): NormalizedReceipt["documentType"] {
  if (typeof value !== "string") return "OTHER";
  const normalized = value.trim().toUpperCase();
  return VALID_DOCUMENT_TYPES.has(normalized)
    ? (normalized as NormalizedReceipt["documentType"])
    : "OTHER";
}

function toIsoDateOrNull(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toNumberOrNull(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toConfidenceOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(Math.max(value, 0), 1);
  }
  if (!isRecord(value)) return null;

  const numericValues = Object.values(value).filter(
    (entry): entry is number => typeof entry === "number" && Number.isFinite(entry)
  );
  if (numericValues.length === 0) return null;

  const normalizedValues = numericValues.map((entry) =>
    entry > 1 && entry <= 100 ? entry / 100 : entry
  );
  const average = normalizedValues.reduce((sum, entry) => sum + entry, 0) / normalizedValues.length;
  return Math.min(Math.max(average, 0), 1);
}

function toFlags(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function toStringOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toLineItem(value: unknown): NormalizedLineItem | null {
  if (!isRecord(value)) return null;

  const description =
    toStringOrNull(value.description) ??
    toStringOrNull(value.name) ??
    toStringOrNull(value.item) ??
    toStringOrNull(value.service) ??
    toStringOrNull(value.label);
  const quantity = toNumberOrNull(value.quantity ?? value.qty);
  const unitPrice = toNumberOrNull(value.unitPrice ?? value.price ?? value.rate);
  const amount = toNumberOrNull(value.lineTotal ?? value.total ?? value.amount ?? value.extendedPrice);
  const lineTotal =
    amount ?? (quantity !== null && unitPrice !== null ? Number((quantity * unitPrice).toFixed(2)) : null);
  const category = toStringOrNull(value.category ?? value.type);

  if (!description && lineTotal === null) return null;

  return normalizedLineItemSchema.parse({
    description: description ?? "Unlabeled expense",
    quantity,
    unitPrice,
    lineTotal,
    category,
  });
}

function toLineItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => toLineItem(entry))
    .filter((entry): entry is NormalizedLineItem => Boolean(entry));
}

function looksLikeDocument(value: unknown): value is JsonRecord {
  if (!isRecord(value)) return false;
  return [
    "documentType",
    "merchant",
    "receiptDate",
    "subtotal",
    "tax",
    "total",
    "currency",
    "confidence",
    "flags",
  ].some((key) => key in value);
}

function collectCandidates(payload: unknown) {
  const candidates: JsonRecord[] = [];

  const maybePush = (value: unknown) => {
    if (looksLikeDocument(value)) candidates.push(value);
  };

  const collectNested = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        maybePush(entry);
      }
      return;
    }
    if (!isRecord(value)) return;
    maybePush(value);
    for (const key of NESTED_DOCUMENT_KEYS) {
      if (key in value) {
        collectNested(value[key]);
      }
    }
  };

  collectNested(payload);
  return candidates;
}

function scoreCandidate(candidate: JsonRecord) {
  const type = normalizeDocumentType(candidate.documentType);
  const typeWeight: Record<NormalizedReceipt["documentType"], number> = {
    CHECK_REQUEST_FORM: 5,
    RECEIPT: 4,
    INVOICE: 3,
    OTHER: 2,
    W9: 1,
  };
  const total = toNumberOrNull(candidate.total) ?? toNumberOrNull(candidate.subtotal) ?? 0;
  const confidence = toConfidenceOrNull(candidate.confidence) ?? 0.5;
  const hasMerchant = typeof candidate.merchant === "string" && candidate.merchant.trim() ? 0.1 : 0;
  const hasDate = toIsoDateOrNull(candidate.receiptDate) ? 0.1 : 0;

  return typeWeight[type] * 100 + Math.min(total, 100000) / 10000 + confidence + hasMerchant + hasDate;
}

function collectLineItems(candidates: JsonRecord[]) {
  // Deduplicate candidate references (source may already be in candidates)
  const uniqueCandidates = candidates.filter(
    (c, i) => candidates.indexOf(c) === i
  );

  const receiptInvoice = uniqueCandidates.filter((c) => {
    const type = normalizeDocumentType(c.documentType);
    return type === "RECEIPT" || type === "INVOICE";
  });
  const checkRequestForm = uniqueCandidates.filter((c) => {
    return normalizeDocumentType(c.documentType) === "CHECK_REQUEST_FORM";
  });

  // If receipt/invoice candidates have line items, use those (skip CHECK_REQUEST_FORM
  // summaries which duplicate the detailed items from actual receipts)
  const receiptItems = receiptInvoice.flatMap((c) =>
    LINE_ITEM_ARRAY_KEYS.flatMap((key) => toLineItems(c[key]))
  );
  const relevantCandidates =
    receiptItems.length > 0 ? receiptInvoice : [...checkRequestForm, ...receiptInvoice];

  // Dedup within each candidate (same receipt/order) but NOT across candidates.
  // Identical items from different orders (different candidates) are legitimate
  // repeat purchases and must be kept.
  const result: NormalizedLineItem[] = [];
  for (const candidate of relevantCandidates) {
    const items = LINE_ITEM_ARRAY_KEYS.flatMap((key) =>
      toLineItems(candidate[key])
    );
    const seen = new Set<string>();
    for (const item of items) {
      const desc = item.description.trim().toLowerCase();
      const key = `${desc}|${item.lineTotal ?? ""}|${item.quantity ?? ""}|${item.unitPrice ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
  }
  return result;
}

function reconciliationFlags(
  docType: NormalizedReceipt["documentType"],
  lineItems: NormalizedLineItem[],
  subtotal: number | null,
  tax: number | null,
  total: number | null,
): string[] {
  if (docType === "CHECK_REQUEST_FORM" || docType === "W9" || lineItems.length === 0) {
    return [];
  }

  const flags: string[] = [];
  const lineItemsSum =
    Math.round(lineItems.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0) * 100) / 100;

  if (subtotal !== null) {
    const diff = Math.abs(lineItemsSum - subtotal);
    if (diff > Math.max(subtotal * 0.02, 1.0)) {
      flags.push("LINE_ITEMS_SUBTOTAL_MISMATCH");
    }
  }

  if (total !== null) {
    const expectedTotal = lineItemsSum + (tax ?? 0);
    const diff = Math.abs(expectedTotal - total);
    if (diff > Math.max(total * 0.02, 1.0)) {
      flags.push("LINE_ITEMS_TOTAL_MISMATCH");
    }
  }

  return flags;
}

export function normalizeGeminiPayload(payload: unknown, model: string) {
  const candidates = collectCandidates(payload);
  const selected = candidates.sort((left, right) => scoreCandidate(right) - scoreCandidate(left))[0];
  const source = selected ?? (isRecord(payload) ? payload : {});
  const lineItems = collectLineItems(candidates);

  const selectedTax = toNumberOrNull(source.tax);
  const aggregatedTax = candidates.reduce(
    (sum, c) => sum + (toNumberOrNull(c.tax) ?? 0),
    0
  );
  const tax =
    selectedTax && selectedTax > 0
      ? selectedTax
      : aggregatedTax > 0
        ? aggregatedTax
        : null;

  const subtotal = toNumberOrNull(source.subtotal);
  const total = toNumberOrNull(source.total);
  const docType = normalizeDocumentType(source.documentType);
  const reconFlags = reconciliationFlags(docType, lineItems, subtotal, tax, total);

  return normalizedReceiptSchema.parse({
    documentType: docType,
    merchant: typeof source.merchant === "string" ? source.merchant : null,
    receiptDate: toIsoDateOrNull(source.receiptDate),
    subtotal,
    tax,
    total,
    currency: typeof source.currency === "string" && source.currency ? source.currency : "USD",
    confidence: toConfidenceOrNull(source.confidence) ?? 0.5,
    flags: [...toFlags(source.flags), ...reconFlags],
    lineItems,
    raw: {
      source: "gemini",
      model,
      response: payload,
      selected,
      candidateCount: candidates.length,
    },
  });
}
