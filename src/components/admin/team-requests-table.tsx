"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

import { SortableColumnHeader } from "@/components/admin/sortable-column-header";

export type RequestRow = {
  id: string;
  title: string;
  submittedBy: string;
  amount: number;
  status: string;
  date: string;
  dateMs: number;
};

function buildColumns(teamId?: string): ColumnDef<RequestRow>[] {
  const query = teamId ? `?teamId=${teamId}` : "";

  return [
    {
      accessorFn: (r) => r.title.toLowerCase(),
      id: "title",
      header: ({ column }) => <SortableColumnHeader column={column} title="Title" />,
      cell: ({ row }) => (
        <Link
          href={`/admin/requests/${row.original.id}${query}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorFn: (r) => r.submittedBy.toLowerCase(),
      id: "submittedBy",
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Submitted By" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.submittedBy}</span>
      ),
    },
    {
      accessorKey: "amount",
      header: ({ column }) => <SortableColumnHeader column={column} title="Amount" />,
      cell: ({ row }) => (
        <span className="text-foreground">${row.original.amount.toFixed(2)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <SortableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "dateMs",
      sortingFn: "basic",
      header: ({ column }) => <SortableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.date}</span>
      ),
    },
  ];
}

export function TeamRequestsTable({ data, teamId }: { data: RequestRow[]; teamId?: string }) {
  const columns = useMemo(() => buildColumns(teamId), [teamId]);

  return (
    <div className="overflow-x-auto">
      <DataTable columns={columns} data={data} />
    </div>
  );
}
