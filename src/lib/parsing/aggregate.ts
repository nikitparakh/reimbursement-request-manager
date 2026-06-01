type ExtractionForTotals = {
  documentType: string;
  total: number | { toString(): string } | null;
  lineItems?: Array<{
    lineTotal: number | { toString(): string } | null;
    excludedAt?: Date | string | null;
  }>;
};

function toNumber(value: number | { toString(): string } | null | undefined) {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(numeric) ? numeric : null;
}

export function aggregateReimbursableTotals(extractions: ExtractionForTotals[]) {
  const allowed = new Set(["RECEIPT", "INVOICE", "CHECK_REQUEST_FORM"]);
  const totals = extractions
    .filter((item) => allowed.has(item.documentType))
    .map((item) => {
      // Always use line item totals — excludes tax, reflects user edits.
      // Non-finite line totals are treated as 0 so a single bad value cannot
      // drive the reimbursable total to NaN. Negative discounts are preserved.
      const lineItemTotal =
        item.lineItems
          ?.filter((line) => !line.excludedAt)
          .map((line) => toNumber(line.lineTotal) ?? 0)
          .reduce((sum, amount) => sum + amount, 0) ?? 0;
      return Number.isFinite(lineItemTotal) ? lineItemTotal : 0;
    });

  const total = totals.reduce((sum, value) => sum + value, 0);
  // Keep rounding deterministic (toFixed(2) then a single Number parse) and
  // never return a non-finite total.
  return Number.isFinite(total) ? Number(total.toFixed(2)) : 0;
}
