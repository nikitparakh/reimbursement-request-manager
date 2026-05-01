"use client";

import type { ColumnDef, HeaderContext } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";

import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export type RequestRow = {
  id: string;
  title: string;
  submittedBy: string;
  amount: number;
  status: string;
  date: string;
  dateMs: number;
};

function SortableHeader<TData, TValue>({
  column,
  title,
}: HeaderContext<TData, TValue> & { title: string }) {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      onClick={column.getToggleSortingHandler()}
    >
      {title}
      {sorted === "asc" ? (
        <ArrowUp className="size-3 shrink-0" aria-hidden />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3 shrink-0" aria-hidden />
      ) : (
        <ArrowUpDown className="size-3 shrink-0 opacity-50" aria-hidden />
      )}
    </button>
  );
}

const columns: ColumnDef<RequestRow>[] = [
  {
    id: "title",
    accessorFn: (r) => r.title.toLowerCase(),
    sortingFn: "alphanumeric",
    header: (ctx) => <SortableHeader {...ctx} title="Title" />,
    cell: ({ row }) => (
      <Link
        href={`/user/requests/${row.original.id}`}
        className="font-medium text-primary underline-offset-4 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {row.original.title}
      </Link>
    ),
  },
  {
    id: "submittedBy",
    accessorFn: (r) => r.submittedBy.toLowerCase(),
    sortingFn: "alphanumeric",
    header: (ctx) => <SortableHeader {...ctx} title="Submitted By" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.submittedBy}</span>
    ),
  },
  {
    accessorKey: "amount",
    header: (ctx) => <SortableHeader {...ctx} title="Amount" />,
    cell: ({ row }) => (
      <span className="text-foreground">
        ${row.original.amount.toFixed(2)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: (ctx) => <SortableHeader {...ctx} title="Status" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "date",
    accessorFn: (r) => r.dateMs,
    header: (ctx) => <SortableHeader {...ctx} title="Date" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.date}</span>
    ),
  },
];

export function CoachTeamRequestsTable({ data }: { data: RequestRow[] }) {
  return <DataTable columns={columns} data={data} />;
}
