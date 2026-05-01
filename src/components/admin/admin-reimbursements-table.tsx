"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";

import { SortableColumnHeader } from "@/components/admin/sortable-column-header";

export type AdminReimbursementRow = {
  id: string;
  title: string;
  requester: string;
  team: string;
  district: string;
  school: string;
  program: string;
  amount: number;
  status: string;
  date: string;
  dateMs: number;
};

const STATUS_OPTIONS = [
  "COACH_APPROVED",
  "COACH_REJECTED",
  "ADMIN_APPROVED",
  "ADMIN_REJECTED",
  "PAID",
] as const;

type Filters = {
  search: string;
  status: string;
  district: string;
  school: string;
  program: string;
  team: string;
  dateFrom: string;
  dateTo: string;
};

const INITIAL_FILTERS: Filters = {
  search: "",
  status: "",
  district: "",
  school: "",
  program: "",
  team: "",
  dateFrom: "",
  dateTo: "",
};

const ALL = "__all__";

export function AdminReimbursementsTable({ data }: { data: AdminReimbursementRow[] }) {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

  const uniqueDistricts = useMemo(
    () => [...new Set(data.map((r) => r.district))].sort(),
    [data],
  );

  const uniqueSchools = useMemo(
    () => [...new Set(data.map((r) => r.school))].sort(),
    [data],
  );

  const uniquePrograms = useMemo(
    () => [...new Set(data.map((r) => r.program))].sort(),
    [data],
  );

  const uniqueTeams = useMemo(() => [...new Set(data.map((r) => r.team))].sort(), [data]);

  const filtered = useMemo(() => {
    let rows = data;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.requester.toLowerCase().includes(q) ||
          r.team.toLowerCase().includes(q) ||
          r.school.toLowerCase().includes(q) ||
          r.program.toLowerCase().includes(q) ||
          r.district.toLowerCase().includes(q),
      );
    }

    if (filters.status) {
      rows = rows.filter((r) => r.status === filters.status);
    }

    if (filters.district) {
      rows = rows.filter((r) => r.district === filters.district);
    }

    if (filters.school) {
      rows = rows.filter((r) => r.school === filters.school);
    }

    if (filters.program) {
      rows = rows.filter((r) => r.program === filters.program);
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

  const columns = useMemo<ColumnDef<AdminReimbursementRow>[]>(
    () => [
      {
        accessorFn: (r) => r.title.toLowerCase(),
        id: "title",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Title" />
        ),
        cell: ({ row }) => (
          <Link
            href={`/admin/requests/${row.original.id}?from=requests`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorFn: (r) => r.requester.toLowerCase(),
        id: "requester",
        header: ({ column }) => (
          <div className="hidden sm:table-cell">
            <SortableColumnHeader column={column} title="Requester" />
          </div>
        ),
        cell: ({ row }) => (
          <span className="hidden text-muted-foreground sm:table-cell">
            {row.original.requester}
          </span>
        ),
      },
      {
        accessorFn: (r) => r.team.toLowerCase(),
        id: "team",
        header: ({ column }) => (
          <div className="hidden sm:table-cell">
            <SortableColumnHeader column={column} title="Team" />
          </div>
        ),
        cell: ({ row }) => (
          <span className="hidden text-muted-foreground sm:table-cell">{row.original.team}</span>
        ),
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            ${row.original.amount.toFixed(2)}
          </span>
        ),
      },
      {
        accessorKey: "dateMs",
        sortingFn: "basic",
        header: ({ column }) => (
          <div className="hidden md:table-cell">
            <SortableColumnHeader column={column} title="Date" />
          </div>
        ),
        cell: ({ row }) => (
          <span className="hidden text-muted-foreground md:table-cell">
            {row.original.date}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="flex-1 sm:min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Search
          </label>
          <Input
            type="text"
            placeholder="Search by title, requester, or team..."
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            className="!w-full"
          />
        </div>

        <div className="sm:min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
          <Select
            value={filters.status || ALL}
            onValueChange={(v) => setFilter("status", v === ALL ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:min-w-[180px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">District</label>
          <Select
            value={filters.district || ALL}
            onValueChange={(v) => setFilter("district", v === ALL ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All districts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All districts</SelectItem>
              {uniqueDistricts.map((district) => (
                <SelectItem key={district} value={district}>
                  {district}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:min-w-[180px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">School</label>
          <Select
            value={filters.school || ALL}
            onValueChange={(v) => setFilter("school", v === ALL ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All schools" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All schools</SelectItem>
              {uniqueSchools.map((school) => (
                <SelectItem key={school} value={school}>
                  {school}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:min-w-[180px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Program</label>
          <Select
            value={filters.program || ALL}
            onValueChange={(v) => setFilter("program", v === ALL ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All programs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All programs</SelectItem>
              {uniquePrograms.map((program) => (
                <SelectItem key={program} value={program}>
                  {program}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Team</label>
          <Select value={filters.team || ALL} onValueChange={(v) => setFilter("team", v === ALL ? "" : v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All teams</SelectItem>
              {uniqueTeams.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:min-w-[140px]">
          <label
            htmlFor="admin-reimbursements-date-from"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            From
          </label>
          <Input
            id="admin-reimbursements-date-from"
            aria-label="From date"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilter("dateFrom", e.target.value)}
          />
        </div>

        <div className="sm:min-w-[140px]">
          <label
            htmlFor="admin-reimbursements-date-to"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            To
          </label>
          <Input
            id="admin-reimbursements-date-to"
            aria-label="To date"
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilter("dateTo", e.target.value)}
          />
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 text-muted-foreground"
            onClick={() => setFilters(INITIAL_FILTERS)}
          >
            Clear
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No requests match your filters.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {filtered.length} request{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="overflow-x-auto">
            <DataTable columns={columns} data={filtered} />
          </div>
        </>
      )}
    </div>
  );
}
