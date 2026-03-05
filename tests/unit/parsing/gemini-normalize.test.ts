import { describe, expect, it } from "vitest";
import { normalizeGeminiPayload } from "@/lib/parsing/gemini-normalize";

describe("gemini payload normalization", () => {
  it("picks the most reimbursement-relevant document from multi-document output", () => {
    const payload = {
      response: [
        {
          documentType: "CHECK_REQUEST_FORM",
          merchant: "ACME Promotional and Apparel",
          receiptDate: "2025-03-25",
          subtotal: 9817.48,
          tax: 0,
          total: 9817.48,
          currency: "USD",
          confidence: {
            documentType: 1,
            merchant: 1,
            receiptDate: 1,
            subtotal: 0.9,
            tax: 0.9,
            total: 1,
            currency: 1,
          },
          flags: ["INVOICES_REQUIRED_FOR_REIMBURSEMENT"],
        },
        {
          documentType: "INVOICE",
          merchant: "ACME Promotional and Apparel LLC",
          receiptDate: "2025-02-25",
          total: 8213.87,
          currency: "USD",
          confidence: 1,
          flags: [],
          lineItems: [
            {
              description: "Track Jackets",
              quantity: 45,
              unitPrice: 39,
              lineTotal: 1755,
              category: "Apparel",
            },
          ],
        },
      ],
    };

    const normalized = normalizeGeminiPayload(payload, "gemini-2.5-flash");
    expect(normalized.documentType).toBe("CHECK_REQUEST_FORM");
    expect(normalized.total).toBe(9817.48);
    expect(normalized.merchant).toBe("ACME Promotional and Apparel");
    expect(normalized.flags).toContain("INVOICES_REQUIRED_FOR_REIMBURSEMENT");
    expect(normalized.lineItems.length).toBe(1);
    expect(normalized.lineItems[0]?.description).toBe("Track Jackets");
    expect(normalized.lineItems[0]?.lineTotal).toBe(1755);
  });

  it("normalizes selected document line items when present", () => {
    const payload = {
      documentType: "RECEIPT",
      merchant: "Robot Parts Depot",
      total: 124.5,
      lineItems: [
        {
          description: "Gearbox assembly",
          quantity: 3,
          unitPrice: 25,
          lineTotal: 75,
          category: "Parts",
        },
        {
          description: "Fasteners",
          quantity: 1,
          lineTotal: 49.5,
          category: "Hardware",
        },
      ],
    };

    const normalized = normalizeGeminiPayload(payload, "gemini-2.5-flash");
    expect(normalized.documentType).toBe("RECEIPT");
    expect(normalized.lineItems).toHaveLength(2);
    expect(normalized.lineItems[0]).toMatchObject({
      description: "Gearbox assembly",
      quantity: 3,
      unitPrice: 25,
      lineTotal: 75,
    });
  });

  it("prefers receipt/invoice line items over check request form summaries", () => {
    const payload = {
      response: [
        {
          documentType: "CHECK_REQUEST_FORM",
          merchant: "ACME Promotional and Apparel",
          total: 9817.48,
          lineItems: [
            {
              description: "Team spirit wear",
              quantity: 1,
              lineTotal: 9817.48,
              category: "Summary",
            },
          ],
        },
        {
          documentType: "INVOICE",
          merchant: "ACME Promotional and Apparel LLC",
          total: 8213.87,
          lineItems: [
            {
              description: "Track Jackets",
              quantity: 45,
              unitPrice: 39,
              lineTotal: 1755,
              category: "Apparel",
            },
          ],
        },
      ],
    };

    const normalized = normalizeGeminiPayload(payload, "gemini-2.5-flash");
    // When invoice line items exist, CHECK_REQUEST_FORM summary items are skipped
    expect(normalized.lineItems).toHaveLength(1);
    expect(normalized.lineItems[0]?.description).toBe("Track Jackets");
  });

  it("handles empty object payload", () => {
    const normalized = normalizeGeminiPayload({}, "gemini-2.5-flash");
    expect(normalized.documentType).toBe("OTHER");
    expect(normalized.lineItems).toEqual([]);
    expect(normalized.confidence).toBe(0.5);
    expect(normalized.currency).toBe("USD");
  });

  it("handles empty array payload", () => {
    const normalized = normalizeGeminiPayload([], "gemini-2.5-flash");
    expect(normalized.documentType).toBe("OTHER");
    expect(normalized.lineItems).toEqual([]);
  });

  it("handles missing optional fields gracefully", () => {
    const payload = {
      documentType: "RECEIPT",
      lineItems: [{ description: "Item", lineTotal: 25 }],
    };
    const normalized = normalizeGeminiPayload(payload, "gemini-2.5-flash");
    expect(normalized.documentType).toBe("RECEIPT");
    expect(normalized.merchant).toBeNull();
    expect(normalized.receiptDate).toBeNull();
    expect(normalized.subtotal).toBeNull();
    expect(normalized.tax).toBeNull();
    expect(normalized.total).toBeNull();
    expect(normalized.lineItems).toHaveLength(1);
  });

  it("deduplicates identical line items across candidates", () => {
    const payload = [
      {
        documentType: "RECEIPT",
        merchant: "Store A",
        total: 50,
        lineItems: [
          { description: "Widget", quantity: 2, unitPrice: 25, lineTotal: 50 },
        ],
      },
      {
        documentType: "RECEIPT",
        merchant: "Store A",
        total: 50,
        lineItems: [
          { description: "Widget", quantity: 2, unitPrice: 25, lineTotal: 50 },
        ],
      },
    ];
    const normalized = normalizeGeminiPayload(payload, "gemini-2.5-flash");
    expect(normalized.lineItems).toHaveLength(1);
  });
});

describe("reconciliation flags", () => {
  it("flags LINE_ITEMS_SUBTOTAL_MISMATCH when line items diverge from subtotal", () => {
    const payload = {
      documentType: "RECEIPT",
      merchant: "Test Store",
      subtotal: 200,
      tax: 10,
      total: 210,
      lineItems: [{ description: "Widget", quantity: 1, lineTotal: 150 }],
    };
    const normalized = normalizeGeminiPayload(payload, "gemini-2.5-flash");
    expect(normalized.flags).toContain("LINE_ITEMS_SUBTOTAL_MISMATCH");
  });

  it("flags LINE_ITEMS_TOTAL_MISMATCH when line items + tax diverge from total", () => {
    const payload = {
      documentType: "RECEIPT",
      merchant: "Test Store",
      subtotal: 100,
      tax: 8,
      total: 150,
      lineItems: [{ description: "Widget", quantity: 1, lineTotal: 100 }],
    };
    const normalized = normalizeGeminiPayload(payload, "gemini-2.5-flash");
    expect(normalized.flags).toContain("LINE_ITEMS_TOTAL_MISMATCH");
  });

  it("does not flag reconciliation for CHECK_REQUEST_FORM", () => {
    const payload = {
      documentType: "CHECK_REQUEST_FORM",
      merchant: "Test Corp",
      subtotal: 500,
      total: 500,
    };
    const normalized = normalizeGeminiPayload(payload, "gemini-2.5-flash");
    expect(normalized.flags).not.toContain("LINE_ITEMS_SUBTOTAL_MISMATCH");
    expect(normalized.flags).not.toContain("LINE_ITEMS_TOTAL_MISMATCH");
  });

  it("does not flag reconciliation for W9", () => {
    const payload = {
      documentType: "W9",
      merchant: "Contractor Inc",
      total: 0,
    };
    const normalized = normalizeGeminiPayload(payload, "gemini-2.5-flash");
    expect(normalized.flags).not.toContain("LINE_ITEMS_SUBTOTAL_MISMATCH");
    expect(normalized.flags).not.toContain("LINE_ITEMS_TOTAL_MISMATCH");
  });

  it("does not flag when totals match within tolerance", () => {
    const payload = {
      documentType: "RECEIPT",
      merchant: "Test Store",
      subtotal: 99.99,
      tax: 8.0,
      total: 107.99,
      lineItems: [
        { description: "Widget A", quantity: 1, lineTotal: 49.99 },
        { description: "Widget B", quantity: 1, lineTotal: 50.0 },
      ],
    };
    const normalized = normalizeGeminiPayload(payload, "gemini-2.5-flash");
    expect(normalized.flags).not.toContain("LINE_ITEMS_SUBTOTAL_MISMATCH");
    expect(normalized.flags).not.toContain("LINE_ITEMS_TOTAL_MISMATCH");
  });

  it("does not flag when there are no line items", () => {
    const payload = {
      documentType: "RECEIPT",
      merchant: "Test Store",
      subtotal: 100,
      total: 108,
      lineItems: [],
    };
    const normalized = normalizeGeminiPayload(payload, "gemini-2.5-flash");
    expect(normalized.flags).not.toContain("LINE_ITEMS_SUBTOTAL_MISMATCH");
    expect(normalized.flags).not.toContain("LINE_ITEMS_TOTAL_MISMATCH");
  });
});
