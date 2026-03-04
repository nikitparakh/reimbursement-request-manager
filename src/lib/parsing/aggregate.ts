type ExtractionForTotals = {
  documentType: string;
  total: number | { toString(): string } | null;
  lineItems?: Array<{
    lineTotal: number | { toString(): string } | null;
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
      // Always use line item totals — excludes tax, reflects user edits
      const lineItemTotal =
        item.lineItems
          ?.map((line) => toNumber(line.lineTotal) ?? 0)
          .reduce((sum, amount) => sum + amount, 0) ?? 0;
      return lineItemTotal;
    });

  return Number(totals.reduce((sum, value) => sum + value, 0).toFixed(2));
}
