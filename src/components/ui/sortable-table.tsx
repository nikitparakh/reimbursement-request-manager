"use client";

import { useState, useMemo, type ReactNode } from "react";

type SortDirection = "asc" | "desc";

export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  headerClassName?: string;
  cellClassName?: string;
};

type SortableTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowClassName?: string;
};

export function SortableTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  rowClassName,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return data;
    const extractValue = col.sortValue;
    return [...data].sort((a, b) => {
      const va = extractValue(a);
      const vb = extractValue(b);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir, columns]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            {columns.map((col, i) => {
              const sortable = !!col.sortValue;
              const isLast = i === columns.length - 1;
              const active = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  className={`pb-3 font-medium text-slate-500 ${!isLast ? "pr-4" : ""} ${sortable ? "cursor-pointer select-none hover:text-slate-700 transition-colors" : ""} ${col.headerClassName ?? ""}`}
                  onClick={sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortable && <SortIndicator active={active} direction={active ? sortDir : null} />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              className={`border-b border-slate-100 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-emerald-50 transition-colors" : ""} ${rowClassName ?? ""}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col, i) => {
                const isLast = i === columns.length - 1;
                return (
                  <td
                    key={col.key}
                    className={`py-3 ${!isLast ? "pr-4" : ""} ${col.cellClassName ?? ""}`}
                  >
                    {col.render(row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection | null;
}) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className={`shrink-0 ${active ? "text-slate-700" : "text-slate-300"}`}
    >
      <path
        d="M6 2L9 5H3L6 2Z"
        fill={direction === "asc" ? "currentColor" : active ? "none" : "currentColor"}
        stroke={direction === "asc" ? "none" : active ? "currentColor" : "none"}
        strokeWidth="0.5"
        opacity={!active ? 0.5 : 1}
      />
      <path
        d="M6 10L3 7H9L6 10Z"
        fill={direction === "desc" ? "currentColor" : active ? "none" : "currentColor"}
        stroke={direction === "desc" ? "none" : active ? "currentColor" : "none"}
        strokeWidth="0.5"
        opacity={!active ? 0.5 : 1}
      />
    </svg>
  );
}
