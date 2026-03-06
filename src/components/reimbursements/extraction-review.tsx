"use client";

import { Fragment, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CommentIcon } from "@/components/reimbursements/line-item-comments";
import { inferTax, type SerializedReceipt } from "@/lib/reimbursements/serialize-receipts";

function parseNum(value: string | null): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: string | null, currency: string) {
  if (!value) return "N/A";
  return `${currency} ${value}`;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ExtractionReview({
  receipts,
  parseStatuses,
}: {
  receipts: SerializedReceipt[];
  parseStatuses?: Record<string, string>;
}) {
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  function toggleComments(itemId: string) {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  if (receipts.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">Receipts</h3>
      {receipts.map((receipt) => {
        const ext = receipt.extraction;
        const currency = ext?.currency ?? "USD";
        const allItems = ext?.lineItems ?? [];
        const activeItems = allItems.filter((li) => !li.excludedAt);
        const excludedItems = allItems.filter((li) => li.excludedAt);
        const lineItemsSum = activeItems.reduce((sum, li) => sum + parseNum(li.lineTotal), 0);
        const excludedSum = excludedItems.reduce((sum, li) => sum + parseNum(li.lineTotal), 0);
        const tax = inferTax(ext ? parseNum(ext.tax) : 0, ext ? parseNum(ext.total) : 0, lineItemsSum + excludedSum);
        const receiptTotal = lineItemsSum;
        const status = parseStatuses?.[receipt.id];

        return (
          <Card key={receipt.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <span className="text-sm font-medium text-slate-900">{receipt.fileName}</span>
              {status && <Badge status={status} />}
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

                {allItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Description</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Qty</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Unit Price</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Line Total</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Category</th>
                          <th className="py-2 px-3 bg-slate-50 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {allItems.map((item) => {
                          const isExcluded = !!item.excludedAt;
                          const commentCount = item.comments.length;
                          const isExpanded = expandedComments.has(item.id);
                          return (
                            <Fragment key={item.id}>
                              <tr className={isExcluded
                                ? "border-b border-slate-100 bg-red-50/40"
                                : "border-b border-slate-100 hover:bg-slate-50"
                              }>
                                <td className={`py-2 px-3 ${isExcluded ? "text-slate-400 line-through" : "text-slate-700"}`}>{item.description}</td>
                                <td className={`py-2 px-3 text-right ${isExcluded ? "text-slate-400 line-through" : "text-slate-700"}`}>{item.quantity ?? "-"}</td>
                                <td className={`py-2 px-3 text-right ${isExcluded ? "text-slate-400 line-through" : "text-slate-700"}`}>
                                  {item.unitPrice
                                    ? `${currency} ${item.unitPrice}`
                                    : "-"}
                                </td>
                                <td className={`py-2 px-3 text-right ${isExcluded ? "text-slate-400 line-through" : "text-slate-700"}`}>
                                  {item.lineTotal
                                    ? `${currency} ${item.lineTotal}`
                                    : "-"}
                                </td>
                                <td className={`py-2 px-3 ${isExcluded ? "text-slate-400 line-through" : "text-slate-700"}`}>{item.category ?? "-"}</td>
                                <td className="py-2 px-3">
                                  {commentCount > 0 && (
                                    <button
                                      onClick={() => toggleComments(item.id)}
                                      className="text-emerald-500 hover:text-emerald-700 p-1 transition"
                                      aria-label={`${commentCount} comment${commentCount !== 1 ? "s" : ""}`}
                                      title="View comments"
                                    >
                                      <CommentIcon count={commentCount} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {isExpanded && commentCount > 0 && (
                                <tr>
                                  <td colSpan={6} className="p-0">
                                    <div className="bg-slate-50 border-l-2 border-emerald-300 px-4 py-3 space-y-1.5">
                                      {item.comments.map((c) => (
                                        <div key={c.id} className="text-xs">
                                          <span className="font-medium text-slate-700">{c.authorEmail}</span>
                                          <span className="text-slate-400 ml-1.5">{timeAgo(c.createdAt)}</span>
                                          <p className="text-slate-600 mt-0.5">{c.text}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No itemized expenses detected.</p>
                )}

                <div className="border-t border-slate-200 pt-3 space-y-1">
                  {(tax > 0 || excludedSum > 0) && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-medium text-slate-700">{currency} {(lineItemsSum + excludedSum).toFixed(2)}</span>
                      </div>
                      {excludedSum > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Excluded <span className="text-xs text-red-500">(removed)</span></span>
                          <span className="font-medium text-slate-400 line-through">{currency} {excludedSum.toFixed(2)}</span>
                        </div>
                      )}
                      {tax > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Sales Tax <span className="text-xs text-amber-600">(not reimbursable)</span></span>
                          <span className="font-medium text-slate-400 line-through">{currency} {tax.toFixed(2)}</span>
                        </div>
                      )}
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
