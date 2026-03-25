"use client";

import { Badge } from "@/components/ui/badge";
import { type Column, SortableTable } from "@/components/ui/sortable-table";

export type MemberRow = {
  id: string;
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
];

export function CoachTeamMembersTable({ data }: { data: MemberRow[] }) {
  return <SortableTable columns={columns} data={data} rowKey={(r) => r.id} />;
}
