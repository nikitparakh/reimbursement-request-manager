"use client";

import { useMemo, useState } from "react";
import type { GlobalRole } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { type Column, SortableTable } from "@/components/ui/sortable-table";
import { UserRoleSelect } from "@/components/admin/user-role-select";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: GlobalRole;
  memberships: { id: string; teamName: string; roleInTeam: string }[];
};

type UsersTableProps = {
  users: UserRow[];
  teams: { id: string; name: string }[];
};

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Roles" },
  { value: "ADMIN", label: "Admin" },
  { value: "COACH", label: "Coach" },
  { value: "STUDENT", label: "Parent / Mentor" },
];

const columns: Column<UserRow>[] = [
  {
    key: "name",
    label: "Name",
    sortValue: (u) => (u.name || "\uffff").toLowerCase(),
    cellClassName: "text-slate-900",
    render: (u) =>
      u.name || <span className="text-slate-400 italic">No name</span>,
  },
  {
    key: "email",
    label: "Email",
    sortValue: (u) => u.email.toLowerCase(),
    cellClassName: "text-slate-600",
    render: (u) => u.email,
  },
  {
    key: "role",
    label: "Role",
    sortValue: (u) => u.role,
    render: (u) => <UserRoleSelect userId={u.id} currentRole={u.role} />,
  },
  {
    key: "team",
    label: "Team",
    sortValue: (u) =>
      u.memberships
        .map((m) => m.teamName)
        .sort()
        .join(", ")
        .toLowerCase() || "\uffff",
    render: (u) => (
      <div className="flex flex-wrap gap-1">
        {u.memberships.length === 0 ? (
          <span className="text-slate-400">None</span>
        ) : (
          u.memberships.map((m) => (
            <Badge key={m.id} status={m.teamName} />
          ))
        )}
      </div>
    ),
  },
];

export function UsersTable({ users, teams }: UsersTableProps) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return users.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
        return false;
      }
      if (roleFilter && u.role !== roleFilter) return false;
      if (teamFilter && !u.memberships.some((m) => m.teamName === teamFilter)) {
        return false;
      }
      return true;
    });
  }, [users, query, roleFilter, teamFilter]);

  const selectClass =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            type="search"
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className={selectClass}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">All Teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-8 text-sm text-slate-500">
          No users match the current filters.
        </p>
      ) : (
        <SortableTable columns={columns} data={filtered} rowKey={(u) => u.id} />
      )}
    </div>
  );
}
