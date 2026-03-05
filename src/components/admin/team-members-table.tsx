"use client";

import { Badge } from "@/components/ui/badge";
import { RemoveMemberButton } from "@/components/admin/remove-member-button";
import { type Column, SortableTable } from "@/components/ui/sortable-table";

export type MemberRow = {
  id: string;
  teamId: string;
  name: string;
  email: string;
  roleInTeam: string;
};

const columns: Column<MemberRow>[] = [
  {
    key: "name",
    label: "Name",
    sortValue: (m) => (m.name || "").toLowerCase(),
    cellClassName: "text-slate-900",
    render: (m) =>
      m.name || <span className="text-slate-400 italic">No name</span>,
  },
  {
    key: "email",
    label: "Email",
    sortValue: (m) => m.email.toLowerCase(),
    cellClassName: "text-slate-600",
    render: (m) => m.email,
  },
  {
    key: "role",
    label: "Role",
    sortValue: (m) => m.roleInTeam,
    render: (m) => <Badge status={m.roleInTeam} />,
  },
  {
    key: "actions",
    label: "Actions",
    render: (m) => (
      <RemoveMemberButton
        teamId={m.teamId}
        membershipId={m.id}
        memberName={m.name || m.email}
      />
    ),
  },
];

export function TeamMembersTable({ data }: { data: MemberRow[] }) {
  return <SortableTable columns={columns} data={data} rowKey={(r) => r.id} />;
}
