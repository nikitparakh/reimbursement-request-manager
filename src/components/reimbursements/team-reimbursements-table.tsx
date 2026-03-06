"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { type Column, SortableTable } from "@/components/ui/sortable-table";

export type ReimbursementRow = {
  id: string;
  title: string;
  requester: string;
  amount: number;
  status: string;
  date: string;
  dateMs: number;
};

const STATUS_OPTIONS = [
  "DRAFT",
  "SUBMITTED",
  "COACH_APPROVED",
  "COACH_REJECTED",
  "ADMIN_APPROVED",
  "ADMIN_REJECTED",
  "PAID",
] as const;

function isRejected(status: string) {
  return status === "COACH_REJECTED" || status === "ADMIN_REJECTED";
}

function buildColumns(
  onReopen: (id: string) => void,
  reopeningId: string | null,
  showRequester: boolean,
  hasAnyRejected: boolean,
): Column<ReimbursementRow>[] {
  const cols: Column<ReimbursementRow>[] = [
    {
      key: "title",
      label: "Receipt Name",
      sortValue: (r) => r.title.toLowerCase(),
      render: (r) => <span className="font-medium text-slate-900">{r.title}</span>,
    },
  ];

  if (showRequester) {
    cols.push({
      key: "requester",
      label: "Requester",
      sortValue: (r) => r.requester.toLowerCase(),
      cellClassName: "text-slate-600",
      render: (r) => r.requester,
    });
  }

  cols.push(
    {
      key: "amount",
      label: "Amount",
      sortValue: (r) => r.amount,
      cellClassName: "text-slate-700 font-medium",
      render: (r) => `$${r.amount.toFixed(2)}`,
    },
    {
      key: "date",
      label: "Date",
      sortValue: (r) => r.dateMs,
      cellClassName: "text-slate-500",
      render: (r) => r.date,
    },
    {
      key: "status",
      label: "Status",
      sortValue: (r) => r.status,
      render: (r) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Badge status={r.status} />
          {hasAnyRejected && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReopen(r.id);
              }}
              disabled={!isRejected(r.status) || reopeningId === r.id}
              className={`px-2.5 py-1 text-xs font-medium rounded border transition cursor-pointer ${
                isRejected(r.status)
                  ? "text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200 disabled:opacity-50"
                  : "invisible"
              }`}
            >
              {reopeningId === r.id ? "Reopening..." : "Reopen"}
            </button>
          )}
        </div>
      ),
    },
  );

  return cols;
}

type Filters = {
  search: string;
  status: string;
  requester: string;
  dateFrom: string;
  dateTo: string;
};

const INITIAL_FILTERS: Filters = {
  search: "",
  status: "",
  requester: "",
  dateFrom: "",
  dateTo: "",
};

export function TeamReimbursementsTable({
  data,
  showRequester = true,
}: {
  data: ReimbursementRow[];
  showRequester?: boolean;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  const handleReopen = useCallback(async (id: string) => {
    setReopeningId(id);
    try {
      const res = await fetch(`/api/requests/${id}/reopen`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setReopeningId(null);
    }
  }, [router]);

  const hasAnyRejected = useMemo(
    () => data.some((r) => isRejected(r.status)),
    [data],
  );

  const columns = useMemo(
    () => buildColumns((id) => void handleReopen(id), reopeningId, showRequester, hasAnyRejected),
    [handleReopen, reopeningId, showRequester, hasAnyRejected],
  );

  const uniqueRequesters = useMemo(
    () => [...new Set(data.map((r) => r.requester))].sort(),
    [data],
  );

  const filtered = useMemo(() => {
    let rows = data;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.requester.toLowerCase().includes(q),
      );
    }

    if (filters.status) {
      rows = rows.filter((r) => r.status === filters.status);
    }

    if (filters.requester) {
      rows = rows.filter((r) => r.requester === filters.requester);
    }

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      rows = rows.filter((r) => r.dateMs >= from);
    }

    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime() + 86_400_000;
      rows = rows.filter((r) => r.dateMs < to);
    }

    return rows;
  }, [data, filters]);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
          <Input
            type="text"
            placeholder={showRequester ? "Search by name or requester..." : "Search by name..."}
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            className="!w-full"
          />
        </div>

        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        {showRequester && (
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Requester</label>
            <select
              value={filters.requester}
              onChange={(e) => setFilter("requester", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            >
              <option value="">All requesters</option>
              {uniqueRequesters.map((email) => (
                <option key={email} value={email}>
                  {email}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="min-w-[140px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilter("dateFrom", e.target.value)}
          />
        </div>

        <div className="min-w-[140px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilter("dateTo", e.target.value)}
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => setFilters(INITIAL_FILTERS)}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="text-center py-8 text-sm text-slate-400">
          No requests match your filters.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-400">
            {filtered.length} request{filtered.length !== 1 ? "s" : ""}
          </p>
          <SortableTable
            columns={columns}
            data={filtered}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/user/requests/${r.id}`)}
          />
        </>
      )}
    </div>
  );
}
