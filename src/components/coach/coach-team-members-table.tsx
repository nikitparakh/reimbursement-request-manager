"use client";

import type { ColumnDef, HeaderContext } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  roleInTeam: string;
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

const columns: ColumnDef<MemberRow>[] = [
  {
    id: "name",
    accessorFn: (m) => (m.name || "").toLowerCase(),
    sortingFn: "alphanumeric",
    header: (ctx) => <SortableHeader {...ctx} title="Name" />,
    cell: ({ row }) =>
      row.original.name ? (
        <span className="text-foreground">{row.original.name}</span>
      ) : (
        <span className="italic text-muted-foreground">No name</span>
      ),
  },
  {
    id: "email",
    accessorFn: (m) => m.email.toLowerCase(),
    sortingFn: "alphanumeric",
    header: (ctx) => <SortableHeader {...ctx} title="Email" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.email}</span>
    ),
  },
  {
    accessorKey: "roleInTeam",
    id: "role",
    header: (ctx) => <SortableHeader {...ctx} title="Role" />,
    cell: ({ row }) => (
      <StatusBadge status={row.original.roleInTeam} />
    ),
  },
];

export function CoachTeamMembersTable({ data }: { data: MemberRow[] }) {
  return <DataTable columns={columns} data={data} />;
}
