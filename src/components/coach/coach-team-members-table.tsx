"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { SortableColumnHeader } from "@/components/admin/sortable-column-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  roleInTeam: string;
};

const columns: ColumnDef<MemberRow>[] = [
  {
    id: "name",
    accessorFn: (m) => (m.name || "").toLowerCase(),
    sortingFn: "alphanumeric",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Name" />
    ),
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
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.email}</span>
    ),
  },
  {
    accessorKey: "roleInTeam",
    id: "role",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => (
      <StatusBadge status={row.original.roleInTeam} />
    ),
  },
];

export function CoachTeamMembersTable({ data }: { data: MemberRow[] }) {
  return <DataTable columns={columns} data={data} />;
}
