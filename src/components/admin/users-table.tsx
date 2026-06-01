"use client";

import { useMemo, useState } from "react";
import type { GlobalRole } from "@/db/schema";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";

import {
  UserScopeManager,
  type ManagedScope,
  type ScopeOption,
} from "@/components/admin/user-scope-manager";
import { UserRoleSelect } from "@/components/admin/user-role-select";
import { SortableColumnHeader } from "@/components/admin/sortable-column-header";
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

const ALL = "__all__";

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

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        accessorFn: (u) => (u.name || "\uffff").toLowerCase(),
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
        accessorKey: "email",
        header: ({ column }) => (
          <div className="hidden sm:table-cell">
            <SortableColumnHeader column={column} title="Email" />
          </div>
        ),
        cell: ({ row }) => (
          <span className="hidden text-muted-foreground sm:table-cell">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "globalRole",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Global Access" />
        ),
        cell: ({ row }) =>
          canEditGlobalRoles ? (
            <UserRoleSelect userId={row.original.id} currentRole={row.original.globalRole} />
          ) : (
            <StatusBadge
              status={row.original.globalRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER"}
            />
          ),
      },
      {
        accessorFn: (u) =>
          u.scopedRoles
            .map((scope) => scope.label)
            .sort()
            .join(", ")
            .toLowerCase() || "\uffff",
        id: "scopedRoles",
        sortingFn: "alphanumeric",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Scoped Access" />
        ),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
            <div className="flex min-w-[8rem] flex-1 flex-wrap items-center gap-1">
              {row.original.scopedRoles.length === 0 ? (
                !canManageScopes ? (
                  <span className="text-xs text-muted-foreground italic">No scoped access</span>
                ) : null
              ) : (
                row.original.scopedRoles.map((scope) => (
                  <StatusBadge key={scope.id} status={scope.label} />
                ))
              )}
            </div>
            <UserScopeManager
              userId={row.original.id}
              scopes={row.original.managedScopes}
              options={scopeOptions}
              canManage={canManageScopes}
            />
          </div>
        ),
      },
      {
        accessorFn: (u) =>
          u.memberships
            .map((m) => m.teamName)
            .sort()
            .join(", ")
            .toLowerCase() || "\uffff",
        id: "team",
        sortingFn: "alphanumeric",
        header: ({ column }) => (
          <div className="hidden md:table-cell">
            <SortableColumnHeader column={column} title="Teams" />
          </div>
        ),
        cell: ({ row }) => (
          <div className="hidden flex-wrap gap-1 md:flex">
            {row.original.memberships.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">No teams</span>
            ) : (
              row.original.memberships.map((m) => (
                <StatusBadge key={m.id} status={`${m.teamName} · ${m.roleInTeam}`} />
              ))
            )}
          </div>
        ),
      },
    ],
    [canEditGlobalRoles, canManageScopes, scopeOptions],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
        <div className="flex-1 sm:min-w-[200px]">
          <Input
            type="search"
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="sm:min-w-[200px]">
          <label className="sr-only" htmlFor="role-filter">
            Global role filter
          </label>
          <Select
            value={roleFilter || ALL}
            onValueChange={(v) => setRoleFilter(v === ALL ? "" : v)}
          >
            <SelectTrigger id="role-filter" aria-label="Global role filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((o) => (
                <SelectItem key={o.value || ALL} value={o.value || ALL}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No users match the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <DataTable columns={columns} data={filtered} />
        </div>
      )}
    </div>
  );
}
