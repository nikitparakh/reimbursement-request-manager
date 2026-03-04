"use client";

import { useState, useCallback, useId, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inferTax, type SerializedLineItem, type SerializedReceipt } from "@/lib/reimbursements/serialize-receipts";

type EditableLineItemsProps = {
  requestId: string;
  receipts: SerializedReceipt[];
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
  };
}

function parseNum(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number, currency: string) {
  return `${currency} ${value.toFixed(2)}`;
}

export function EditableLineItems({ requestId, receipts }: EditableLineItemsProps) {
  const instanceId = useId();
  const nextTempId = useRef(0);

  const [receiptRows, setReceiptRows] = useState<Map<string, EditableRow[]>>(() => {
    const map = new Map<string, EditableRow[]>();
    for (const receipt of receipts) {
      if (receipt.extraction) {
        map.set(
          receipt.extraction.id,
          receipt.extraction.lineItems.map(toEditableRow)
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
    [requestId]
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
        }, 600)
      );
    },
    [saveLineItem]
  );

  function updateRow(extractionId: string, rowId: string, field: keyof EditableRow, value: string) {
    setReceiptRows((prev) => {
      const next = new Map(prev);
      const rows = [...(next.get(extractionId) ?? [])];
      const idx = rows.findIndex((r) => r.id === rowId);
      if (idx === -1) return prev;
      const updated = { ...rows[idx], [field]: value };
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
      await fetch(`/api/requests/${requestId}/line-items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItemId: rowId }),
      });
    }
    setReceiptRows((prev) => {
      const next = new Map(prev);
      const rows = (next.get(extractionId) ?? []).filter((r) => r.id !== rowId);
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

  const receiptsWithExtractions = receipts.filter((r) => r.extraction);

  const grandTotal = receiptsWithExtractions.reduce((sum, receipt) => {
    const rows = receiptRows.get(receipt.extraction!.id) ?? [];
    return sum + rows.reduce((s, r) => s + parseNum(r.lineTotal), 0);
  }, 0);

  const receiptCards = receiptsWithExtractions.map((receipt) => {
      const ext = receipt.extraction!;
      const currency = ext.currency ?? "USD";
      const rows = receiptRows.get(ext.id) ?? [];

      const subtotal = rows.reduce((sum, r) => sum + parseNum(r.lineTotal), 0);
      const tax = inferTax(parseNum(ext.tax ?? "0"), parseNum(ext.total ?? "0"), subtotal);
      const receiptTotal = subtotal;

      return (
        <Card key={receipt.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">{receipt.fileName}</span>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                {ext.merchant && <span>{ext.merchant}</span>}
                <span className="uppercase">{ext.documentType}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Description</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 w-20">Qty</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 w-28">Unit Price</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 w-28">Line Total</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 w-32">Category</th>
                    <th className="py-2 px-2 bg-slate-50 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => updateRow(ext.id, row.id, "description", e.target.value)}
                          onBlur={() => row.isNew && row.description.trim() ? void saveNewRow(ext.id, row.id) : undefined}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Item description"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          value={row.quantity}
                          onChange={(e) => updateRow(ext.id, row.id, "quantity", e.target.value)}
                          onBlur={() => row.isNew && row.description.trim() ? void saveNewRow(ext.id, row.id) : undefined}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-right text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                          min="0"
                          step="1"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          value={row.unitPrice}
                          onChange={(e) => updateRow(ext.id, row.id, "unitPrice", e.target.value)}
                          onBlur={() => row.isNew && row.description.trim() ? void saveNewRow(ext.id, row.id) : undefined}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-right text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          value={row.lineTotal}
                          onChange={(e) => updateRow(ext.id, row.id, "lineTotal", e.target.value)}
                          onBlur={() => row.isNew && row.description.trim() ? void saveNewRow(ext.id, row.id) : undefined}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-right text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={row.category}
                          onChange={(e) => updateRow(ext.id, row.id, "category", e.target.value)}
                          onBlur={() => row.isNew && row.description.trim() ? void saveNewRow(ext.id, row.id) : undefined}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Category"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <button
                          onClick={() => void deleteRow(ext.id, row.id, row.isNew)}
                          className="text-slate-400 hover:text-red-500 transition p-1"
                          aria-label="Delete line item"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={() => void addRow(ext.id)}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add item
            </button>

            <div className="border-t border-slate-200 pt-3 space-y-1">
              {tax > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-medium text-slate-700">{formatCurrency(subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Sales Tax <span className="text-xs text-amber-600">(not reimbursable)</span></span>
                    <span className="font-medium text-slate-400 line-through">{formatCurrency(tax, currency)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-slate-700">Reimbursable Total</span>
                <span className="text-slate-900">{formatCurrency(receiptTotal, currency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    });

  if (receiptCards.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">Line Items</h3>
      {receiptCards}
      {receiptCards.length > 1 && (
        <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <span className="text-base font-semibold text-slate-700">Grand Total</span>
          <span className="text-lg font-bold text-slate-900">
            ${grandTotal.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
