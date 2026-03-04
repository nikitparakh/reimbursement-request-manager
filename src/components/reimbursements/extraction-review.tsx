import type { Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { inferTax } from "@/lib/reimbursements/serialize-receipts";

type ReceiptWithExtraction = Prisma.ReceiptFileGetPayload<{
  include: {
    extraction: {
      include: {
        lineItems: true;
      };
    };
  };
}>;

function formatMoney(value: Prisma.Decimal | null, currency: string) {
  if (!value) return "N/A";
  return `${currency} ${value.toString()}`;
}

function toNumber(value: Prisma.Decimal | null) {
  if (!value) return 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

export function ExtractionReview({ receipts }: { receipts: ReceiptWithExtraction[] }) {
  if (receipts.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">Receipts</h3>
      {receipts.map((receipt) => {
        const ext = receipt.extraction;
        const currency = ext?.currency ?? "USD";
        const lineItemsSum = ext ? ext.lineItems.reduce((sum, li) => sum + toNumber(li.lineTotal), 0) : 0;
        const tax = inferTax(ext ? toNumber(ext.tax) : 0, ext ? toNumber(ext.total) : 0, lineItemsSum);
        const receiptTotal = lineItemsSum;

        return (
          <Card key={receipt.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <span className="text-sm font-medium text-slate-900">{receipt.fileName}</span>
              <Badge status={receipt.parseStatus} />
            </CardHeader>
            {ext ? (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">Type</div>
                    <div className="font-medium text-slate-900">{ext.documentType}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Merchant</div>
                    <div className="font-medium text-slate-900">{ext.merchant ?? "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Total</div>
                    <div className="font-medium text-slate-900">
                      {formatMoney(ext.total, currency)}
                    </div>
                  </div>
                </div>

                {ext.lineItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Description</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Qty</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Unit Price</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Line Total</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ext.lineItems.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2 px-3 text-slate-700">{item.description}</td>
                            <td className="py-2 px-3 text-right text-slate-700">{item.quantity?.toString() ?? "-"}</td>
                            <td className="py-2 px-3 text-right text-slate-700">
                              {item.unitPrice
                                ? `${currency} ${item.unitPrice.toString()}`
                                : "-"}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-700">
                              {item.lineTotal
                                ? `${currency} ${item.lineTotal.toString()}`
                                : "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">{item.category ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No itemized expenses detected.</p>
                )}

                <div className="border-t border-slate-200 pt-3 space-y-1">
                  {tax > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-medium text-slate-700">{currency} {lineItemsSum.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Sales Tax <span className="text-xs text-amber-600">(not reimbursable)</span></span>
                        <span className="font-medium text-slate-400 line-through">{currency} {tax.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {receiptTotal > 0 && (
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-slate-700">Reimbursable Total</span>
                      <span className="text-slate-900">{currency} {receiptTotal.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
