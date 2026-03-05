"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { type Column, SortableTable } from "@/components/ui/sortable-table";

export type AdminReimbursementRow = {
  id: string;
  title: string;
  requester: string;
  team: string;
  amount: number;
  status: string;
  date: string;
  dateMs: number;
};

const STATUS_OPTIONS = [
  "COACH_APPROVED",
  "ADMIN_APPROVED",
  "ADMIN_REJECTED",
  "PAID",
] as const;

const columns: Column<AdminReimbursementRow>[] = [
  {
    key: "title",
    label: "Title",
    sortValue: (r) => r.title.toLowerCase(),
    render: (r) => <span className="font-medium text-slate-900">{r.title}</span>,
  },
  {
    key: "requester",
    label: "Requester",
    sortValue: (r) => r.requester.toLowerCase(),
    cellClassName: "text-slate-600",
    render: (r) => r.requester,
  },
  {
    key: "team",
    label: "Team",
    sortValue: (r) => r.team.toLowerCase(),
    cellClassName: "text-slate-600",
    render: (r) => r.team,
  },
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
    render: (r) => <Badge status={r.status} />,
  },
];

type Filters = {
  search: string;
  status: string;
  team: string;
  dateFrom: string;
  dateTo: string;
};

const INITIAL_FILTERS: Filters = {
  search: "",
  status: "",
  team: "",
  dateFrom: "",
  dateTo: "",
};

export function AdminReimbursementsTable({ data }: { data: AdminReimbursementRow[] }) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

  const uniqueTeams = useMemo(
    () => [...new Set(data.map((r) => r.team))].sort(),
    [data],
  );

  const filtered = useMemo(() => {
    let rows = data;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.requester.toLowerCase().includes(q) ||
          r.team.toLowerCase().includes(q),
      );
    }

    if (filters.status) {
      rows = rows.filter((r) => r.status === filters.status);
    }

    if (filters.team) {
      rows = rows.filter((r) => r.team === filters.team);
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
          <Input
            type="text"
            placeholder="Search by title, requester, or team..."
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

        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">Team</label>
          <select
            value={filters.team}
            onChange={(e) => setFilter("team", e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
          >
            <option value="">All teams</option>
            {uniqueTeams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

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
            onRowClick={(r) => router.push(`/admin/requests/${r.id}`)}
          />
        </>
      )}
    </div>
  );
}
