import { describe, expect, it } from "vitest";
import { aggregateReimbursableTotals } from "@/lib/parsing/aggregate";

describe("aggregateReimbursableTotals", () => {
  it("returns 0 for empty extractions", () => {
    expect(aggregateReimbursableTotals([])).toBe(0);
  });

  it("sums line items from RECEIPT documents", () => {
    const total = aggregateReimbursableTotals([
      {
        documentType: "RECEIPT",
        total: null,
        lineItems: [{ lineTotal: 25.0 }, { lineTotal: 49.5 }],
      },
    ]);
    expect(total).toBe(74.5);
  });

  it("sums line items from INVOICE documents", () => {
    const total = aggregateReimbursableTotals([
      {
        documentType: "INVOICE",
        total: null,
        lineItems: [{ lineTotal: 100 }, { lineTotal: 39.75 }],
      },
    ]);
    expect(total).toBe(139.75);
  });

  it("includes CHECK_REQUEST_FORM in reimbursable totals", () => {
    const total = aggregateReimbursableTotals([
      {
        documentType: "CHECK_REQUEST_FORM",
        total: 9817.48,
        lineItems: [{ lineTotal: 9817.48 }],
      },
    ]);
    expect(total).toBe(9817.48);
  });

  it("excludes W9 and OTHER documents", () => {
    const total = aggregateReimbursableTotals([
      {
        documentType: "RECEIPT",
        total: null,
        lineItems: [{ lineTotal: 50 }],
      },
      {
        documentType: "W9",
        total: null,
        lineItems: [{ lineTotal: 999 }],
      },
      {
        documentType: "OTHER",
        total: null,
        lineItems: [{ lineTotal: 888 }],
      },
    ]);
    expect(total).toBe(50);
  });

  it("excludes line items with excludedAt set", () => {
    const total = aggregateReimbursableTotals([
      {
        documentType: "RECEIPT",
        total: null,
        lineItems: [
          { lineTotal: 75 },
          { lineTotal: 25, excludedAt: new Date() },
        ],
      },
    ]);
    expect(total).toBe(75);
  });

  it("treats null lineTotal as 0", () => {
    const total = aggregateReimbursableTotals([
      {
        documentType: "RECEIPT",
        total: null,
        lineItems: [{ lineTotal: 50 }, { lineTotal: null }],
      },
    ]);
    expect(total).toBe(50);
  });

  it("handles Decimal-like objects with toString", () => {
    const total = aggregateReimbursableTotals([
      {
        documentType: "RECEIPT",
        total: { toString: () => "100.50" },
        lineItems: [
          { lineTotal: { toString: () => "60.25" } },
          { lineTotal: { toString: () => "40.25" } },
        ],
      },
    ]);
    expect(total).toBe(100.5);
  });

  it("aggregates across multiple receipts", () => {
    const total = aggregateReimbursableTotals([
      {
        documentType: "RECEIPT",
        total: null,
        lineItems: [{ lineTotal: 30 }],
      },
      {
        documentType: "INVOICE",
        total: null,
        lineItems: [{ lineTotal: 70 }],
      },
    ]);
    expect(total).toBe(100);
  });

  it("handles extractions with no lineItems array", () => {
    const total = aggregateReimbursableTotals([
      { documentType: "RECEIPT", total: 50 },
    ]);
    expect(total).toBe(0);
  });
});
