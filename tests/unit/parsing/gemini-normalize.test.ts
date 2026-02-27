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
});
