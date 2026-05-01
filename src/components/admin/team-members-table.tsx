"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

import { RemoveMemberButton } from "@/components/admin/remove-member-button";
import { SortableColumnHeader } from "@/components/admin/sortable-column-header";

export type MemberRow = {
  id: string;
  teamId: string;
  name: string;
  email: string;
  roleInTeam: string;
};

const columns: ColumnDef<MemberRow>[] = [
  {
    accessorFn: (m) => (m.name || "").toLowerCase(),
    id: "name",
    header: ({ column }) => <SortableColumnHeader column={column} title="Name" />,
    cell: ({ row }) =>
      row.original.name ? (
        <span className="text-foreground">{row.original.name}</span>
      ) : (
        <span className="italic text-muted-foreground">No name</span>
      ),
  },
  {
    accessorFn: (m) => m.email.toLowerCase(),
    id: "email",
    header: ({ column }) => <SortableColumnHeader column={column} title="Email" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.email}</span>
    ),
  },
  {
    accessorKey: "roleInTeam",
    id: "role",
    header: ({ column }) => <SortableColumnHeader column={column} title="Role" />,
    cell: ({ row }) => <StatusBadge status={row.original.roleInTeam} />,
  },
  {
    id: "actions",
    enableSorting: false,
    header: ({ column }) => <SortableColumnHeader column={column} title="Actions" />,
    cell: ({ row }) => (
      <RemoveMemberButton
        teamId={row.original.teamId}
        membershipId={row.original.id}
        memberName={row.original.name || row.original.email}
      />
    ),
  },
];

export function TeamMembersTable({ data }: { data: MemberRow[] }) {
  return (
    <div className="overflow-x-auto">
      <DataTable columns={columns} data={data} />
    </div>
  );
}
