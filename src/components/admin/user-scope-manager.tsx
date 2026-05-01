"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export type ManagedScope = {
  id: string;
  role: "SCHOOL_ADMIN" | "PROGRAM_ADMIN";
  label: string;
};

export type ScopeOption = {
  key: string;
  role: "SCHOOL_ADMIN" | "PROGRAM_ADMIN";
  schoolId: string;
  programId?: string;
  label: string;
};

type UserScopeManagerProps = {
  userId: string;
  scopes: ManagedScope[];
  options: ScopeOption[];
  canManage: boolean;
};

export function UserScopeManager({
  userId,
  scopes,
  options,
  canManage,
}: UserScopeManagerProps) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState(options[0]?.key ?? "");
  const [saving, setSaving] = useState(false);

  const selectableOptions = useMemo(() => {
    const currentKeys = new Set(
      scopes.map((scope) =>
        scope.role === "PROGRAM_ADMIN" || scope.role === "SCHOOL_ADMIN"
          ? scope.label
          : ""
      )
    );

    return options.filter((option) => !currentKeys.has(option.label));
  }, [options, scopes]);

  const selectedOption =
    selectableOptions.find((option) => option.key === selectedKey) ??
    selectableOptions[0];

  async function addScope() {
    if (!selectedOption) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/scopes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedOption.role,
          schoolId: selectedOption.schoolId,
          programId: selectedOption.programId,
        }),
      });

      if (response.ok) {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeScope(scopeId: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/scopes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeId }),
      });

      if (response.ok) {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {scopes.length > 0 ? (
        <div className="space-y-1">
          {scopes.map((scope) => (
            <div key={scope.id} className="flex items-center gap-2">
              <span className="text-xs text-slate-600">{scope.label}</span>
              <button
                type="button"
                onClick={() => void removeScope(scope.id)}
                disabled={saving}
                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {selectableOptions.length > 0 ? (
        <div className="flex items-center gap-2">
          <select
            value={selectedOption?.key ?? ""}
            onChange={(event) => setSelectedKey(event.target.value)}
            disabled={saving}
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
          >
            {selectableOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            loading={saving}
            onClick={() => void addScope()}
          >
            Add
          </Button>
        </div>
      ) : null}
    </div>
  );
}
