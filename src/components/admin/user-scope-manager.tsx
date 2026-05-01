"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  const selectableOptions = useMemo(() => {
    const currentKeys = new Set(
      scopes.map((scope) =>
        scope.role === "PROGRAM_ADMIN" || scope.role === "SCHOOL_ADMIN" ? scope.label : "",
      ),
    );

    return options.filter((option) => !currentKeys.has(option.label));
  }, [options, scopes]);

  const selectedOption =
    selectableOptions.find((option) => option.key === selectedKey) ??
    selectableOptions[0];

  useEffect(() => {
    setSelectedKey((key) =>
      selectableOptions.some((option) => option.key === key)
        ? key
        : (selectableOptions[0]?.key ?? ""),
    );
  }, [selectableOptions]);

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
        toast.success("Scoped access added");
        router.refresh();
      } else {
        toast.error("Could not add scoped access");
      }
    } finally {
      setSaving(false);
    }
  }

  async function executeRemove(scopeId: string | null) {
    if (!scopeId) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/scopes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeId }),
      });

      if (response.ok) {
        toast.success("Scoped access removed");
        setPendingRemoveId(null);
        router.refresh();
      } else {
        toast.error("Could not remove scoped access");
      }
    } finally {
      setSaving(false);
    }
  }

  const pendingRemoveScope =
    pendingRemoveId === null ? null : scopes.find((s) => s.id === pendingRemoveId);

  if (!canManage) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      <AlertDialog
        open={pendingRemoveId !== null}
        onOpenChange={(openNext) =>
          openNext === false ? setPendingRemoveId(null) : undefined
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove scoped access</AlertDialogTitle>
            <AlertDialogDescription>
              Remove{" "}
              <span className="font-medium text-foreground">
                {pendingRemoveScope?.label}
              </span>{" "}
              from this user? This revokes administrator access tied to that school or program.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={saving || pendingRemoveId === null}
              onClick={() => void executeRemove(pendingRemoveId)}
            >
              Remove access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {scopes.length > 0 ? (
        <div className="space-y-1">
          {scopes.map((scope) => (
            <div key={scope.id} className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{scope.label}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => setPendingRemoveId(scope.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {selectableOptions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedOption ? selectedOption.key : selectedKey}
            onValueChange={(key) => setSelectedKey(key)}
            disabled={saving || !selectedOption}
          >
            <SelectTrigger className="min-w-0 flex-1">
              <SelectValue placeholder="Select scope" />
            </SelectTrigger>
            <SelectContent>
              {selectableOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="outline" loading={saving} onClick={() => void addScope()}>
            Add
          </Button>
        </div>
      ) : null}
    </div>
  );
}
