"use client";

import { Fragment, useState } from "react";

import { AlertTriangle, Loader2, MessageCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CommentIcon } from "@/components/reimbursements/line-item-comments";
import { Button } from "@/components/ui/button";
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
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import { inferTax, type SerializedReceipt } from "@/lib/reimbursements/serialize-receipts";

function parseNum(value: string | null): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function ExtractionReview({
  receipts,
  parseStatuses,
  requestId,
}: {
  receipts: SerializedReceipt[];
  parseStatuses?: Record<string, string>;
  requestId?: string;
}) {
  const router = useRouter();
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState(false);

  async function retryParse() {
    if (!requestId || retrying) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/parse`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Failed to retry parsing.");
        return;
      }
      toast.success("Retrying parsing…");
      router.refresh();
    } catch {
      toast.error("Failed to retry parsing. Please try again.");
    } finally {
      setRetrying(false);
    }
  }

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
        const hasFailed = status === "FAILED";

        return (
          <Card key={receipt.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <span className="text-sm font-medium text-foreground">{receipt.fileName}</span>
              {status ? <StatusBadge status={status} /> : null}
            </CardHeader>
            {hasFailed ? (
              <CardContent>
                <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">
                        We couldn&apos;t read this receipt
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Parsing failed. Try again, or remove and re-upload the file if it keeps failing.
                      </p>
                    </div>
                  </div>
                  {requestId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={retrying}
                      onClick={() => void retryParse()}
                    >
                      {retrying ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <RotateCcw className="size-4" aria-hidden />
                      )}
                      Retry parsing
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            ) : ext ? (
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
                    <div className="font-medium text-foreground">{formatCurrency(ext.total, currency)}</div>
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
                                {item.unitPrice ? formatCurrency(item.unitPrice, currency) : "-"}
                              </TableCell>
                              <TableCell className={`text-right ${cellExcluded}`}>
                                {item.lineTotal ? formatCurrency(item.lineTotal, currency) : "-"}
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
                                              <span className="text-muted-foreground ml-1.5">{formatRelativeTime(c.createdAt)}</span>
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
                        <span className="font-medium text-foreground">{formatCurrency(lineItemsSum + excludedSum, currency)}</span>
                      </div>
                      {excludedSum > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Excluded <span className="text-xs text-destructive">(removed)</span>
                          </span>
                          <span className="font-medium text-muted-foreground line-through">{formatCurrency(excludedSum, currency)}</span>
                        </div>
                      )}
                      {tax > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Sales Tax{" "}
                            <span className="text-xs text-muted-foreground">(not reimbursable)</span>
                          </span>
                          <span className="font-medium text-muted-foreground italic">{formatCurrency(tax, currency)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {receiptTotal > 0 && (
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-foreground">Reimbursable Total</span>
                      <span className="text-foreground">{formatCurrency(receiptTotal, currency)}</span>
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
