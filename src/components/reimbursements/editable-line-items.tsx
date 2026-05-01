"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LineItemComments, CommentIcon } from "@/components/reimbursements/line-item-comments";
import { useLiveTotal } from "@/components/reimbursements/live-total-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  inferTax,
  type SerializedLineItem,
  type SerializedLineItemComment,
  type SerializedReceipt,
} from "@/lib/reimbursements/serialize-receipts";

type EditableLineItemsProps = {
  requestId: string;
  receipts: SerializedReceipt[];
  allowReceiptDeletion?: boolean;
  canComment?: boolean;
};

type EditableRow = {
  id: string;
  receiptExtractionId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  category: string;
  isNew?: boolean;
  excluded?: boolean;
  comments: SerializedLineItemComment[];
};

function toEditableRow(item: SerializedLineItem): EditableRow {
  return {
    id: item.id,
    receiptExtractionId: item.receiptExtractionId,
    description: item.description,
    quantity: item.quantity ?? "",
    unitPrice: item.unitPrice ?? "",
    lineTotal: item.lineTotal ?? "",
    category: item.category ?? "",
    excluded: !!item.excludedAt,
    comments: item.comments,
  };
}

function parseNum(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number, currency: string) {
  return `${currency} ${value.toFixed(2)}`;
}

export function EditableLineItems({
  requestId,
  receipts,
  allowReceiptDeletion,
  canComment = false,
}: EditableLineItemsProps) {
  const instanceId = useId();
  const nextTempId = useRef(0);
  const router = useRouter();
  const [deletingReceiptId, setDeletingReceiptId] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  function toggleComments(rowId: string) {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  const [receiptRows, setReceiptRows] = useState<Map<string, EditableRow[]>>(() => {
    const map = new Map<string, EditableRow[]>();
    for (const receipt of receipts) {
      if (receipt.extraction) {
        map.set(
          receipt.extraction.id,
          receipt.extraction.lineItems.map(toEditableRow),
        );
      }
    }
    return map;
  });

  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const saveLineItem = useCallback(
    async (row: EditableRow) => {
      await fetch(`/api/requests/${requestId}/line-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItemId: row.id,
          description: row.description,
          quantity: row.quantity ? parseFloat(row.quantity) : null,
          unitPrice: row.unitPrice ? parseFloat(row.unitPrice) : null,
          lineTotal: row.lineTotal ? parseFloat(row.lineTotal) : null,
          category: row.category || null,
        }),
      });
    },
    [requestId],
  );

  const debouncedSave = useCallback(
    (row: EditableRow) => {
      const existing = debounceTimers.current.get(row.id);
      if (existing) clearTimeout(existing);
      debounceTimers.current.set(
        row.id,
        setTimeout(() => {
          void saveLineItem(row);
          debounceTimers.current.delete(row.id);
        }, 600),
      );
    },
    [saveLineItem],
  );

  function updateRow(extractionId: string, rowId: string, field: keyof EditableRow, value: string) {
    setReceiptRows((prev) => {
      const next = new Map(prev);
      const rows = [...(next.get(extractionId) ?? [])];
      const idx = rows.findIndex((r) => r.id === rowId);
      if (idx === -1) return prev;
      const updated = { ...rows[idx], [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        const qty = parseNum(updated.quantity);
        const price = parseNum(updated.unitPrice);
        updated.lineTotal = (qty * price).toFixed(2);
      }
      rows[idx] = updated;
      next.set(extractionId, rows);
      if (!updated.isNew) {
        debouncedSave(updated);
      }
      return next;
    });
  }

  async function deleteRow(extractionId: string, rowId: string, isNew?: boolean) {
    if (!isNew) {
      const res = await fetch(`/api/requests/${requestId}/line-items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItemId: rowId }),
      });
      const result = (await res.json()) as { soft?: boolean };
      if (result.soft) {
        setReceiptRows((prev) => {
          const next = new Map(prev);
          const rows = [...(next.get(extractionId) ?? [])];
          const idx = rows.findIndex((r) => r.id === rowId);
          if (idx !== -1) rows[idx] = { ...rows[idx], excluded: true };
          next.set(extractionId, rows);
          return next;
        });
        return;
      }
    }
    setReceiptRows((prev) => {
      const next = new Map(prev);
      const rows = (next.get(extractionId) ?? []).filter((r) => r.id !== rowId);
      next.set(extractionId, rows);
      return next;
    });
  }

  async function restoreRow(extractionId: string, rowId: string) {
    await fetch(`/api/requests/${requestId}/line-items`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineItemId: rowId, excluded: false }),
    });
    setReceiptRows((prev) => {
      const next = new Map(prev);
      const rows = [...(next.get(extractionId) ?? [])];
      const idx = rows.findIndex((r) => r.id === rowId);
      if (idx !== -1) rows[idx] = { ...rows[idx], excluded: false };
      next.set(extractionId, rows);
      return next;
    });
  }

  async function addRow(extractionId: string) {
    const tempId = `new-${instanceId}-${nextTempId.current++}`;
    const newRow: EditableRow = {
      id: tempId,
      receiptExtractionId: extractionId,
      description: "",
      quantity: "1",
      unitPrice: "",
      lineTotal: "",
      category: "",
      isNew: true,
      comments: [],
    };
    setReceiptRows((prev) => {
      const next = new Map(prev);
      const rows = [...(next.get(extractionId) ?? []), newRow];
      next.set(extractionId, rows);
      return next;
    });
  }

  async function saveNewRow(extractionId: string, rowId: string) {
    const rows = receiptRows.get(extractionId) ?? [];
    const row = rows.find((r) => r.id === rowId);
    if (!row || !row.description.trim()) return;

    const res = await fetch(`/api/requests/${requestId}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiptExtractionId: extractionId,
        description: row.description,
        quantity: row.quantity ? parseFloat(row.quantity) : null,
        unitPrice: row.unitPrice ? parseFloat(row.unitPrice) : null,
        lineTotal: row.lineTotal ? parseFloat(row.lineTotal) : null,
        category: row.category || null,
      }),
    });

    if (res.ok) {
      const created = (await res.json()) as { id: string };
      setReceiptRows((prev) => {
        const next = new Map(prev);
        const currentRows = [...(next.get(extractionId) ?? [])];
        const idx = currentRows.findIndex((r) => r.id === rowId);
        if (idx !== -1) {
          currentRows[idx] = { ...currentRows[idx], id: created.id, isNew: false };
        }
        next.set(extractionId, currentRows);
        return next;
      });
    }
  }

  async function deleteReceipt(receiptId: string) {
    setDeletingReceiptId(receiptId);
    try {
      const res = await fetch(`/api/requests/${requestId}/receipts/${receiptId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setReceiptRows((prev) => {
          const receipt = receipts.find((r) => r.id === receiptId);
          if (!receipt?.extraction) return prev;
          const next = new Map(prev);
          next.delete(receipt.extraction.id);
          return next;
        });
        router.refresh();
      }
    } finally {
      setDeletingReceiptId(null);
    }
  }

  const receiptsWithExtractions = receipts.filter((r) => r.extraction && r.id !== deletingReceiptId);

  const grandTotal = receiptsWithExtractions.reduce((sum, receipt) => {
    const rows = receiptRows.get(receipt.extraction!.id) ?? [];
    return sum + rows.filter((r) => !r.excluded).reduce((s, r) => s + parseNum(r.lineTotal), 0);
  }, 0);

  const { setTotal } = useLiveTotal();
  useEffect(() => {
    setTotal(grandTotal);
  }, [grandTotal, setTotal]);

  const receiptCards = receiptsWithExtractions.map((receipt) => {
    const ext = receipt.extraction!;
    const currency = ext.currency ?? "USD";
    const rows = receiptRows.get(ext.id) ?? [];

    const activeRows = rows.filter((r) => !r.excluded);
    const excludedRows = rows.filter((r) => r.excluded);
    const subtotal = activeRows.reduce((sum, r) => sum + parseNum(r.lineTotal), 0);
    const excludedTotal = excludedRows.reduce((sum, r) => sum + parseNum(r.lineTotal), 0);
    const tax = inferTax(parseNum(ext.tax ?? "0"), parseNum(ext.total ?? "0"), subtotal + excludedTotal);
    const receiptTotal = subtotal;

    const colSpan = 7;

    return (
      <Card key={receipt.id}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{receipt.fileName}</span>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {ext.merchant ? <span>{ext.merchant}</span> : null}
              <span className="uppercase">{ext.documentType}</span>
              {allowReceiptDeletion && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${receipt.fileName}`}
                  title="Remove receipt"
                  onClick={() => void deleteReceipt(receipt.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="hidden w-20 text-right sm:table-cell">Qty</TableHead>
                <TableHead className="w-20 text-right sm:w-28">Unit Price</TableHead>
                <TableHead className="w-20 text-right sm:w-28">Line Total</TableHead>
                <TableHead className="hidden w-32 sm:table-cell">Category</TableHead>
                <TableHead className="w-10" aria-label="Delete row" />
                <TableHead className="w-10" aria-label="Comments" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const commentCount = row.comments.length;
                const isExpanded = expandedComments.has(row.id);

                if (row.excluded) {
                  return (
                    <Fragment key={row.id}>
                      <TableRow className="bg-destructive/5 hover:bg-destructive/10">
                        <TableCell className="whitespace-normal text-sm text-muted-foreground line-through">
                          {row.description}
                        </TableCell>
                        <TableCell className="hidden text-right text-sm text-muted-foreground line-through sm:table-cell">
                          {row.quantity || "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground line-through">
                          {row.unitPrice || "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground line-through">
                          {row.lineTotal || "-"}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground line-through sm:table-cell">
                          {row.category || "-"}
                        </TableCell>
                        <TableCell className="p-1 align-middle">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            type="button"
                            className="text-primary hover:text-primary/90"
                            aria-label="Restore line item"
                            title="Undo exclusion"
                            onClick={() => void restoreRow(ext.id, row.id)}
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        </TableCell>
                        <TableCell className="p-1 align-middle">
                          {(commentCount > 0 || canComment) && !row.isNew ? (
                            <CommentIcon
                              count={commentCount}
                              className={
                                commentCount > 0
                                  ? "text-primary"
                                  : "text-muted-foreground hover:text-foreground"
                              }
                              aria-label={`${commentCount} comment${commentCount !== 1 ? "s" : ""}`}
                              title="Line item comments"
                              type="button"
                              onClick={() => toggleComments(row.id)}
                            />
                          ) : null}
                        </TableCell>
                      </TableRow>
                      {isExpanded && !row.isNew && (
                        <TableRow>
                          <TableCell colSpan={colSpan} className="p-0">
                            <LineItemComments
                              requestId={requestId}
                              lineItemId={row.id}
                              comments={row.comments}
                              canComment={canComment}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                }

                return (
                  <Fragment key={row.id}>
                    <TableRow className="hover:bg-muted/50">
                      <TableCell className="align-top">
                        <Input
                          type="text"
                          value={row.description}
                          className="h-8 whitespace-normal md:text-xs"
                          onChange={(e) => updateRow(ext.id, row.id, "description", e.target.value)}
                          onBlur={() =>
                            row.isNew && row.description.trim() ? void saveNewRow(ext.id, row.id) : undefined
                          }
                          placeholder="Item description"
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Input
                          type="number"
                          value={row.quantity}
                          className="h-8 md:text-xs"
                          onChange={(e) => updateRow(ext.id, row.id, "quantity", e.target.value)}
                          onBlur={() =>
                            row.isNew && row.description.trim() ? void saveNewRow(ext.id, row.id) : undefined
                          }
                          min={0}
                          step={1}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.unitPrice}
                          className="h-8 md:text-xs"
                          onChange={(e) => updateRow(ext.id, row.id, "unitPrice", e.target.value)}
                          onBlur={() =>
                            row.isNew && row.description.trim() ? void saveNewRow(ext.id, row.id) : undefined
                          }
                          min={0}
                          step={0.01}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.lineTotal}
                          className="h-8 md:text-xs"
                          onChange={(e) => updateRow(ext.id, row.id, "lineTotal", e.target.value)}
                          onBlur={() =>
                            row.isNew && row.description.trim() ? void saveNewRow(ext.id, row.id) : undefined
                          }
                          min={0}
                          step={0.01}
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Input
                          type="text"
                          value={row.category}
                          className="h-8 md:text-xs"
                          onChange={(e) => updateRow(ext.id, row.id, "category", e.target.value)}
                          onBlur={() =>
                            row.isNew && row.description.trim() ? void saveNewRow(ext.id, row.id) : undefined
                          }
                          placeholder="Category"
                        />
                      </TableCell>
                      <TableCell className="p-1 align-middle">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Delete line item"
                          onClick={() => void deleteRow(ext.id, row.id, row.isNew)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="p-1 align-middle">
                        {(commentCount > 0 || canComment) && !row.isNew ? (
                          <CommentIcon
                            count={commentCount}
                            className={
                              commentCount > 0
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground"
                            }
                            aria-label={`${commentCount} comment${commentCount !== 1 ? "s" : ""}`}
                            title="Line item comments"
                            type="button"
                            onClick={() => toggleComments(row.id)}
                          />
                        ) : null}
                      </TableCell>
                    </TableRow>
                    {isExpanded && !row.isNew && (
                      <TableRow>
                        <TableCell colSpan={colSpan} className="p-0">
                          <LineItemComments
                            requestId={requestId}
                            lineItemId={row.id}
                            comments={row.comments}
                            canComment={canComment}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>

          <Button
            type="button"
            variant="link"
            className="inline-flex h-auto items-center gap-1 px-0 text-primary hover:text-primary/90"
            onClick={() => void addRow(ext.id)}
          >
            <Plus className="size-4" aria-hidden />
            Add item
          </Button>

          <div className="border-t border-border pt-3 space-y-1">
            {(tax > 0 || excludedTotal > 0) && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium text-foreground">{formatCurrency(subtotal + excludedTotal, currency)}</span>
                </div>
                {excludedTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Excluded <span className="text-xs text-destructive">(removed)</span>
                    </span>
                    <span className="font-medium text-muted-foreground line-through">{formatCurrency(excludedTotal, currency)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Sales Tax{" "}
                      <span className="text-xs text-muted-foreground">(not reimbursable)</span>
                    </span>
                    <span className="font-medium text-muted-foreground line-through">{formatCurrency(tax, currency)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-foreground">Reimbursable Total</span>
              <span className="text-foreground">{formatCurrency(receiptTotal, currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  });

  if (receiptCards.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Line Items</h3>
      {receiptCards}
      {receiptCards.length > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
          <span className="text-base font-semibold text-foreground">Grand Total</span>
          <span className="text-lg font-bold text-foreground">${grandTotal.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
