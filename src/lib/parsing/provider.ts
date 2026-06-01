import { env } from "@/lib/env";
import { normalizeGeminiPayload } from "@/lib/parsing/gemini-normalize";
import type { NormalizedReceipt } from "@/lib/parsing/parse-types";

type ParseProviderInput = {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 2;
const INITIAL_BACKOFF_MS = 3_000;

const PROMPT =
  "Extract reimbursement-relevant fields from this document. " +
  "Return a JSON array with one object per document/receipt/invoice found " +
  "(even for a single document, return a one-element array).\n\n" +
  "Rules:\n" +
  "- documentType: RECEIPT, INVOICE, W9, CHECK_REQUEST_FORM, or OTHER.\n" +
  "- lineItems: array of purchased items with description, quantity, unitPrice, lineTotal, category.\n" +
  "- DISCOUNTS: Do NOT bake discounts into the item's lineTotal. " +
  "Instead, add each discount as its own separate line item with a NEGATIVE lineTotal. " +
  "For example, if an item lists at $960 with a 15% discount ($144), create two line items: " +
  "one with lineTotal $960, and one with description '15% Discount' and lineTotal -$144.\n" +
  "- COUPONS: Add coupon savings as a separate line item with a NEGATIVE lineTotal " +
  "(e.g. description 'Coupon Savings', lineTotal -$0.90).\n" +
  "- SHIPPING: Include shipping/handling charges as a separate line item.\n" +
  "- TAX: Put sales tax in the 'tax' field. Do NOT include tax as a line item.\n" +
  "- CHECK_REQUEST_FORM: Cover forms only. Set lineItems to []. " +
  "Actual items come from attached receipts.\n" +
  "- subtotal: pre-tax sum of line items. total: grand total including tax.\n" +
  "- receiptDate: ISO date string. confidence: 0 to 1.";

const RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      documentType: {
        type: "STRING",
        enum: ["RECEIPT", "INVOICE", "W9", "CHECK_REQUEST_FORM", "OTHER"],
      },
      merchant: { type: "STRING", nullable: true },
      receiptDate: { type: "STRING", nullable: true },
      subtotal: { type: "NUMBER", nullable: true },
      tax: { type: "NUMBER", nullable: true },
      total: { type: "NUMBER", nullable: true },
      currency: { type: "STRING" },
      confidence: { type: "NUMBER" },
      flags: { type: "ARRAY", items: { type: "STRING" } },
      lineItems: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            description: { type: "STRING" },
            quantity: { type: "NUMBER", nullable: true },
            unitPrice: { type: "NUMBER", nullable: true },
            lineTotal: { type: "NUMBER", nullable: true },
            category: { type: "STRING", nullable: true },
          },
          required: ["description"],
        },
      },
    },
    required: ["documentType"],
  },
};

function cleanJsonPayload(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return trimmed;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function parseReceiptWithProvider(
  input: ParseProviderInput,
  opts?: { apiKey?: string; model?: string }
): Promise<NormalizedReceipt> {
  const apiKey = opts?.apiKey ?? env.GOOGLE_AI_API_KEY;
  const model = opts?.model ?? env.GOOGLE_AI_MODEL;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured");
  }

  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const requestBody = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
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
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  let lastError: Error = new Error("Gemini parsing failed");

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: requestBody,
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After")) || 0;
        lastError = new Error("Gemini rate limited (429)");
        console.warn("[parse][gemini] Rate limited", {
          attempt: attempt + 1,
          maxAttempts: MAX_ATTEMPTS,
          fileName: input.fileName,
        });
        if (attempt < MAX_ATTEMPTS - 1) {
          const delay =
            retryAfter > 0
              ? retryAfter * 1000
              : INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          await sleep(delay);
        }
        continue;
      }

      if (!response.ok) {
        lastError = new Error(`Gemini request failed: ${response.status}`);
        console.warn("[parse][gemini] Request failed", {
          attempt: attempt + 1,
          maxAttempts: MAX_ATTEMPTS,
          status: response.status,
          fileName: input.fileName,
        });
        if (attempt < MAX_ATTEMPTS - 1) {
          await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
        }
        continue;
      }

      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const rawText =
        payload.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("") ?? "";

      if (!rawText.trim()) {
        lastError = new Error("Gemini returned empty response");
        console.warn("[parse][gemini] Empty response", {
          attempt: attempt + 1,
          maxAttempts: MAX_ATTEMPTS,
          fileName: input.fileName,
        });
        if (attempt < MAX_ATTEMPTS - 1) {
          await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
        }
        continue;
      }

      const json = JSON.parse(cleanJsonPayload(rawText)) as Record<
        string,
        unknown
      >;
      const normalized = normalizeGeminiPayload(json, model);

      console.info("[parse][gemini] Extraction complete", {
        fileName: input.fileName,
        model,
        documentType: normalized.documentType,
        merchant: normalized.merchant,
        lineItemCount: normalized.lineItems.length,
        confidence: normalized.confidence,
        flags: normalized.flags,
        attempts: attempt + 1,
      });

      return normalized;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        lastError = new Error(
          `Gemini request timed out after ${REQUEST_TIMEOUT_MS}ms`
        );
        console.warn("[parse][gemini] Request timed out", {
          attempt: attempt + 1,
          maxAttempts: MAX_ATTEMPTS,
          fileName: input.fileName,
        });
      } else if (error instanceof Error) {
        lastError = error;
        console.warn("[parse][gemini] Attempt failed", {
          attempt: attempt + 1,
          maxAttempts: MAX_ATTEMPTS,
          error: error.message,
          fileName: input.fileName,
        });
      } else {
        lastError = new Error("Unknown error during Gemini parsing");
      }

      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}
