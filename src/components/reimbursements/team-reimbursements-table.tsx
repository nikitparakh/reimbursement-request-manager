"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SortableColumnHeader } from "@/components/admin/sortable-column-header";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";

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
  onOpenRequest: (id: string) => void,
): ColumnDef<ReimbursementRow>[] {
  const cols: ColumnDef<ReimbursementRow>[] = [
    {
      id: "title",
      accessorFn: (r) => r.title.toLowerCase(),
      sortingFn: "alphanumeric",
      header: ({ column }) => <SortableColumnHeader column={column} title="Receipt Name" />,
      cell: ({ row }) => (
        <button
          type="button"
          className="cursor-pointer truncate text-left font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onOpenRequest(row.original.id)}
        >
          {row.original.title}
        </button>
      ),
    },
  ];

  if (showRequester) {
    cols.push({
      id: "requester",
      accessorFn: (r) => r.requester.toLowerCase(),
      sortingFn: "alphanumeric",
      header: ({ column }) => <SortableColumnHeader column={column} title="Requester" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.requester}</span>
      ),
    });
  }

  cols.push(
    {
      accessorKey: "amount",
      header: ({ column }) => <SortableColumnHeader column={column} title="Amount" />,
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          ${row.original.amount.toFixed(2)}
        </span>
      ),
    },
    {
      id: "date",
      accessorFn: (r) => r.dateMs,
      header: ({ column }) => <SortableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.date}</span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <SortableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <StatusBadge status={row.original.status} />
          {hasAnyRejected ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              className={!isRejected(row.original.status) ? "invisible" : ""}
              disabled={!isRejected(row.original.status) || reopeningId === row.original.id}
              onClick={(event) => {
                event.stopPropagation();
                onReopen(row.original.id);
              }}
            >
              {reopeningId === row.original.id ? (
                <>
                  <Loader2 className="mr-1 size-3 animate-spin" aria-hidden />
                  Reopening…
                </>
              ) : (
                "Reopen"
              )}
            </Button>
          ) : null}
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
      if (res.ok) {
        toast.success("Request reopened.");
        router.refresh();
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Failed to reopen request.");
      }
    } catch {
      toast.error("Failed to reopen request.");
    } finally {
      setReopeningId(null);
    }
  }, [router]);

  const hasAnyRejected = useMemo(
    () => data.some((r) => isRejected(r.status)),
    [data],
  );

  const columns = useMemo(
    () =>
      buildColumns(
        (sid) => void handleReopen(sid),
        reopeningId,
        showRequester,
        hasAnyRejected,
        (rid) => router.push(`/user/requests/${rid}`),
      ),
    [handleReopen, reopeningId, showRequester, hasAnyRejected, router],
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] space-y-1">
          <Label htmlFor="team-reimbursements-search" className="text-xs text-muted-foreground">
            Search
          </Label>
          <Input
            id="team-reimbursements-search"
            type="text"
            placeholder={showRequester ? "Search by name or requester..." : "Search by name..."}
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            className="w-full"
          />
        </div>

        <div className="min-w-[160px] space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={filters.status || "all"} onValueChange={(value) => setFilter("status", value === "all" ? "" : value)}>
            <SelectTrigger size="default" className="w-full min-w-[10rem]" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showRequester && (
          <div className="min-w-[180px] space-y-1">
            <Label className="text-xs text-muted-foreground">Requester</Label>
            <Select
              value={filters.requester || "all"}
              onValueChange={(value) => setFilter("requester", value === "all" ? "" : value)}
            >
              <SelectTrigger size="default" className="w-full min-w-[11rem]" aria-label="Filter by requester">
                <SelectValue placeholder="All requesters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All requesters</SelectItem>
                {uniqueRequesters.map((email) => (
                  <SelectItem key={email} value={email}>
                    {email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="min-w-[140px] space-y-1">
          <Label htmlFor="team-reimbursements-date-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="team-reimbursements-date-from"
            aria-label="From date"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilter("dateFrom", e.target.value)}
          />
        </div>

        <div className="min-w-[140px] space-y-1">
          <Label htmlFor="team-reimbursements-date-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="team-reimbursements-date-to"
            aria-label="To date"
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilter("dateTo", e.target.value)}
          />
        </div>

        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setFilters(INITIAL_FILTERS)}>
            Clear
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground text-sm">
          No requests match your filters.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground text-xs">
            {filtered.length} request{filtered.length !== 1 ? "s" : ""}
          </p>
          <DataTable columns={columns} data={filtered} />
        </>
      )}
    </div>
  );
}
