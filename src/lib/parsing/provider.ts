import { normalizeExtractedText } from "@/lib/parsing/normalize";
import { env } from "@/lib/env";
import { normalizeGeminiPayload } from "@/lib/parsing/gemini-normalize";

export type ParseProviderInput = {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function cleanJsonPayload(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return trimmed;
}

async function parseWithGemini(input: ParseProviderInput) {
  if (!env.GOOGLE_AI_API_KEY) return null;

  const response = await fetch(
    `${GEMINI_API_BASE}/models/${encodeURIComponent(env.GOOGLE_AI_MODEL)}:generateContent?key=${encodeURIComponent(env.GOOGLE_AI_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Extract reimbursement-relevant fields from this document. Return ONLY valid JSON.\n\n" +
                  "If the document contains multiple receipts/invoices (e.g. a check request form with attached receipts), " +
                  "return a JSON array with one object per document.\n\n" +
                  "Each object keys: documentType, merchant, receiptDate, subtotal, tax, total, currency, confidence, flags, lineItems, raw.\n\n" +
                  "Rules:\n" +
                  "- documentType: RECEIPT, INVOICE, W9, CHECK_REQUEST_FORM, or OTHER.\n" +
                  "- lineItems: array with keys description, quantity, unitPrice, lineTotal, category.\n" +
                  "- DISCOUNTS: lineTotal MUST be the net amount AFTER discounts. If a product costs $960 with a $144 discount, " +
                  "lineTotal must be $816, NOT $960. Reflect what was actually charged.\n" +
                  "- SHIPPING: Include shipping/handling charges as a separate line item.\n" +
                  "- TAX: Put sales tax in the 'tax' field. Do NOT include tax as a line item.\n" +
                  "- CHECK_REQUEST_FORM: These are cover forms, NOT receipts. Set lineItems to [] (empty). " +
                  "The actual items come from attached receipts/invoices.\n" +
                  "- subtotal: pre-tax sum of line items. total: grand total including tax.\n" +
                  "- receiptDate: ISO date. confidence: 0 to 1.",
              },
              {
                inlineData: {
                  mimeType: input.mimeType || "application/pdf",
                  data: Buffer.from(input.bytes).toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const rawText = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!rawText.trim()) {
    throw new Error("Gemini returned empty response");
  }

  const json = JSON.parse(cleanJsonPayload(rawText)) as Record<string, unknown>;
  const normalized = normalizeGeminiPayload(json, env.GOOGLE_AI_MODEL);
  console.info("[parse][gemini] Model payload received", {
    fileName: input.fileName,
    mimeType: input.mimeType,
    model: env.GOOGLE_AI_MODEL,
    payload: json,
  });
  console.info("[parse][gemini] Normalized receipt selected", {
    fileName: input.fileName,
    documentType: normalized.documentType,
    merchant: normalized.merchant,
    receiptDate: normalized.receiptDate,
    subtotal: normalized.subtotal,
    tax: normalized.tax,
    total: normalized.total,
    confidence: normalized.confidence,
    flags: normalized.flags,
    lineItemCount: normalized.lineItems.length,
    candidateCount:
      typeof normalized.raw === "object" &&
      normalized.raw !== null &&
      "candidateCount" in normalized.raw &&
      typeof normalized.raw.candidateCount === "number"
        ? normalized.raw.candidateCount
        : undefined,
  });
  return normalized;
}

export async function parseReceiptWithProvider(input: ParseProviderInput) {
  const geminiResult = await parseWithGemini(input).catch((error) => {
    console.error("[parse][gemini] Failed to parse with Gemini, using fallback", {
      fileName: input.fileName,
      mimeType: input.mimeType,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  });
  if (geminiResult) return geminiResult;

  // Fallback for local development when AI key is absent/unavailable.
  const rawText = new TextDecoder().decode(input.bytes);
  console.info("[parse][fallback] Using local text normalization", {
    fileName: input.fileName,
  });
  return normalizeExtractedText(rawText || input.fileName);
}
