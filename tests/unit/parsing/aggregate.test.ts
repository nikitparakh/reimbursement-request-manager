import { describe, expect, it } from "vitest";
import { aggregateReimbursableTotals } from "@/lib/parsing/aggregate";

function extraction(documentType: string, total: number | null) {
  return { documentType, total };
}

describe("aggregate reimbursement totals", () => {
  it("includes check request forms in reimbursement totals", () => {
    const total = aggregateReimbursableTotals([
      {
        documentType: "CHECK_REQUEST_FORM",
        total: 9817.48,
        lineItems: [{ lineTotal: 9817.48 }],
      },
      extraction("OTHER", 999),
    ]);

    expect(total).toBe(9817.48);
  });

  it("falls back to itemized totals when extraction total is missing", () => {
    const total = aggregateReimbursableTotals([
      {
        documentType: "INVOICE",
        total: null,
        lineItems: [{ lineTotal: 100.25 }, { lineTotal: 39.75 }],
      },
    ]);

    expect(total).toBe(140);
  });
});
