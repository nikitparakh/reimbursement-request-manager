"use client";

import { Fragment, useState } from "react";

import { MessageCircle } from "lucide-react";
import { CommentIcon } from "@/components/reimbursements/line-item-comments";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
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
      <h3 className="text-lg font-semibold text-foreground">Receipts</h3>
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
              <span className="text-sm font-medium text-foreground">{receipt.fileName}</span>
              {status ? <StatusBadge status={status} /> : null}
            </CardHeader>
            {ext ? (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-muted-foreground">Type</div>
                    <div className="font-medium text-foreground">{ext.documentType}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Merchant</div>
                    <div className="font-medium text-foreground">{ext.merchant ?? "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total</div>
                    <div className="font-medium text-foreground">{formatMoney(ext.total, currency)}</div>
                  </div>
                </div>

                {allItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="hidden text-right sm:table-cell">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                        <TableHead className="hidden sm:table-cell">Category</TableHead>
                        <TableHead className="w-10" aria-label="Comments" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allItems.map((item) => {
                        const isExcluded = !!item.excludedAt;
                        const commentCount = item.comments.length;
                        const isExpanded = expandedComments.has(item.id);

                        const rowMuted = isExcluded ? "bg-destructive/5 hover:bg-destructive/10" : "";
                        const cellExcluded = isExcluded ? "text-muted-foreground line-through" : "";

                        return (
                          <Fragment key={item.id}>
                            <TableRow className={`${rowMuted}`}>
                              <TableCell className={`whitespace-normal ${cellExcluded}`}>
                                {item.description}
                              </TableCell>
                              <TableCell className={`hidden text-right sm:table-cell ${cellExcluded}`}>
                                {item.quantity ?? "-"}
                              </TableCell>
                              <TableCell className={`text-right ${cellExcluded}`}>
                                {item.unitPrice ? `${currency} ${item.unitPrice}` : "-"}
                              </TableCell>
                              <TableCell className={`text-right ${cellExcluded}`}>
                                {item.lineTotal ? `${currency} ${item.lineTotal}` : "-"}
                              </TableCell>
                              <TableCell className={`hidden sm:table-cell ${cellExcluded}`}>
                                {item.category ?? "-"}
                              </TableCell>
                              <TableCell className="p-1 align-middle">
                                {commentCount > 0 ? (
                                  <CommentIcon
                                    count={commentCount}
                                    aria-label={`${commentCount} comment${commentCount !== 1 ? "s" : ""}`}
                                    title="View comments"
                                    type="button"
                                    onClick={() => toggleComments(item.id)}
                                  />
                                ) : null}
                              </TableCell>
                            </TableRow>
                            {commentCount > 0 && (
                              <TableRow key={`${item.id}-comments`}>
                                <TableCell colSpan={6} className="p-0">
                                  <Collapsible open={isExpanded}>
                                    <CollapsibleContent>
                                      <div className="flex gap-3 border-border border-l-2 border-l-primary/40 bg-muted/40 px-4 py-3">
                                        <MessageCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                                        <div className="space-y-2">
                                          {item.comments.map((c) => (
                                            <div key={c.id} className="text-xs">
                                              <span className="font-medium text-foreground">{c.authorEmail}</span>
                                              <span className="text-muted-foreground ml-1.5">{timeAgo(c.createdAt)}</span>
                                              <p className="text-muted-foreground mt-0.5">{c.text}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No itemized expenses detected.</p>
                )}

                <div className="border-t border-border pt-3 space-y-1">
                  {(tax > 0 || excludedSum > 0) && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium text-foreground">{currency} {(lineItemsSum + excludedSum).toFixed(2)}</span>
                      </div>
                      {excludedSum > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Excluded <span className="text-xs text-destructive">(removed)</span>
                          </span>
                          <span className="font-medium text-muted-foreground line-through">{currency} {excludedSum.toFixed(2)}</span>
                        </div>
                      )}
                      {tax > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Sales Tax{" "}
                            <span className="text-xs text-muted-foreground">(not reimbursable)</span>
                          </span>
                          <span className="font-medium text-muted-foreground line-through">{currency} {tax.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {receiptTotal > 0 && (
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-foreground">Reimbursable Total</span>
                      <span className="text-foreground">{currency} {receiptTotal.toFixed(2)}</span>
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
