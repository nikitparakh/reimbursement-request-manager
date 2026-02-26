import type { Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";

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

export function ExtractionReview({ receipts }: { receipts: ReceiptWithExtraction[] }) {
  if (receipts.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">Receipts</h3>
      {receipts.map((receipt) => (
        <Card key={receipt.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <span className="text-sm font-medium text-slate-900">{receipt.fileName}</span>
            <Badge status={receipt.parseStatus} />
          </CardHeader>
          {receipt.extraction ? (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-slate-500">Type</div>
                  <div className="font-medium text-slate-900">{receipt.extraction.documentType}</div>
                </div>
                <div>
                  <div className="text-slate-500">Merchant</div>
                  <div className="font-medium text-slate-900">{receipt.extraction.merchant ?? "N/A"}</div>
                </div>
                <div>
                  <div className="text-slate-500">Total</div>
                  <div className="font-medium text-slate-900">
                    {formatMoney(receipt.extraction.total, receipt.extraction.currency ?? "USD")}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Confidence</div>
                  <div className="font-medium text-slate-900">{receipt.extraction.confidence ?? "N/A"}</div>
                </div>
              </div>

              {Array.isArray(receipt.extraction.flags) &&
              receipt.extraction.flags.every((flag) => typeof flag === "string") &&
              receipt.extraction.flags.length > 0 ? (
                <Alert variant="warning">
                  Flags: {(receipt.extraction.flags as string[]).join(", ")}
                </Alert>
              ) : null}

              {receipt.extraction.lineItems.length > 0 ? (
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
                      {receipt.extraction.lineItems.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-700">{item.description}</td>
                          <td className="py-2 px-3 text-right text-slate-700">{item.quantity?.toString() ?? "-"}</td>
                          <td className="py-2 px-3 text-right text-slate-700">
                            {item.unitPrice
                              ? `${receipt.extraction?.currency ?? "USD"} ${item.unitPrice.toString()}`
                              : "-"}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700">
                            {item.lineTotal
                              ? `${receipt.extraction?.currency ?? "USD"} ${item.lineTotal.toString()}`
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
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
