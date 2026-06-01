"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { SortableColumnHeader } from "@/components/admin/sortable-column-header";
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
  // Role-correct detail route resolved server-side (admin vs user route).
  detailHref: string;
};

const columns: ColumnDef<RequestRow>[] = [
  {
    id: "title",
    accessorFn: (r) => r.title.toLowerCase(),
    sortingFn: "alphanumeric",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => (
      <Link
        href={row.original.detailHref}
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
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Submitted By" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.submittedBy}</span>
    ),
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => (
      <span className="text-foreground">
        ${row.original.amount.toFixed(2)}
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
  {
    id: "date",
    accessorFn: (r) => r.dateMs,
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.date}</span>
    ),
  },
];

export function CoachTeamRequestsTable({ data }: { data: RequestRow[] }) {
  return <DataTable columns={columns} data={data} />;
}
