"use client";

import { useMemo, useState } from "react";
import type { GlobalRole } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { type Column, SortableTable } from "@/components/ui/sortable-table";
import { UserRoleSelect } from "@/components/admin/user-role-select";
import {
  UserScopeManager,
  type ManagedScope,
  type ScopeOption,
} from "@/components/admin/user-scope-manager";
import { getRoleFilterOptions } from "@/lib/admin-users-ui";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  globalRole: GlobalRole;
  scopedRoles: { id: string; label: string }[];
  managedScopes: ManagedScope[];
  memberships: { id: string; teamName: string; roleInTeam: string }[];
};

type UsersTableProps = {
  users: UserRow[];
  canEditGlobalRoles: boolean;
  canManageScopes: boolean;
  scopeOptions: ScopeOption[];
};

export function UsersTable({
  users,
  canEditGlobalRoles,
  canManageScopes,
  scopeOptions,
}: UsersTableProps) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const roleOptions = getRoleFilterOptions(canEditGlobalRoles);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return users.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
        return false;
      }
      if (roleFilter && u.globalRole !== roleFilter) {
        return false;
      }
      return true;
    });
  }, [users, query, roleFilter]);

  const columns = useMemo<Column<UserRow>[]>(() => [
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
      headerClassName: "hidden sm:table-cell",
      cellClassName: "text-slate-600 hidden sm:table-cell",
      render: (u) => u.email,
    },
    {
      key: "globalRole",
      label: "Global Access",
      sortValue: (u) => u.globalRole,
      render: (u) =>
        canEditGlobalRoles ? (
          <UserRoleSelect userId={u.id} currentRole={u.globalRole} />
        ) : (
          <Badge status={u.globalRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER"} />
        ),
    },
    {
      key: "scopedRoles",
      label: "Scoped Access",
      sortValue: (u) =>
        u.scopedRoles
          .map((scope) => scope.label)
          .sort()
          .join(", ")
          .toLowerCase() || "\uffff",
      render: (u) => (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {u.scopedRoles.length === 0 ? (
              <span className="text-slate-400">None</span>
            ) : (
              u.scopedRoles.map((scope) => (
                <Badge key={scope.id} status={scope.label} />
              ))
            )}
          </div>
          <UserScopeManager
            userId={u.id}
            scopes={u.managedScopes}
            options={scopeOptions}
            canManage={canManageScopes}
          />
        </div>
      ),
    },
    {
      key: "team",
      label: "Teams",
      sortValue: (u) =>
        u.memberships
          .map((m) => m.teamName)
          .sort()
          .join(", ")
          .toLowerCase() || "\uffff",
      headerClassName: "hidden md:table-cell",
      cellClassName: "hidden md:table-cell",
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.memberships.length === 0 ? (
            <span className="text-slate-400">None</span>
          ) : (
            u.memberships.map((m) => (
              <Badge key={m.id} status={`${m.teamName} · ${m.roleInTeam}`} />
            ))
          )}
        </div>
      ),
    },
  ], [canEditGlobalRoles, canManageScopes, scopeOptions]);

  const selectClass =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center gap-3">
        <div className="flex-1 sm:min-w-[200px]">
          <Input
            type="search"
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="sr-only" htmlFor="role-filter">Global role filter</label>
        <select
          id="role-filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className={selectClass}
        >
          {roleOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
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
