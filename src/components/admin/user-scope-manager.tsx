"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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
        const detail = await readErrorMessage(response, "Could not add scoped access");
        toast.error(
          response.status === 403
            ? "You do not have permission to add this scoped access."
            : detail,
        );
      }
    } catch {
      toast.error("Network error. Please check your connection and try again.");
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
        const detail = await readErrorMessage(response, "Could not remove scoped access");
        toast.error(
          response.status === 403
            ? "You do not have permission to remove this scoped access."
            : detail,
        );
      }
    } catch {
      toast.error("Network error. Please check your connection and try again.");
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
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
              className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40"
              disabled={saving || pendingRemoveId === null}
              onClick={() => void executeRemove(pendingRemoveId)}
            >
              Remove access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {scopes.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">No scoped access</span>
      ) : (
        scopes.map((scope) => (
          <Badge key={scope.id} variant="secondary" className="max-w-[min(100%,20rem)] gap-1 px-2 py-0.5 font-normal">
            <span className="min-w-0 truncate">{scope.label}</span>
            <button
              type="button"
              disabled={saving}
              className="-me-0.5 inline-flex shrink-0 rounded-sm p-0.5 opacity-70 transition-opacity hover:opacity-100 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-label={`Remove ${scope.label}`}
              onClick={() => setPendingRemoveId(scope.id)}
            >
              <X className="size-3" aria-hidden />
            </button>
          </Badge>
        ))
      )}

      {selectableOptions.length > 0 ? (
        <>
          <Select
            value={selectedOption ? selectedOption.key : selectedKey}
            onValueChange={(key) => setSelectedKey(key)}
            disabled={saving || !selectedOption}
          >
            <SelectTrigger className="h-7 max-w-[12rem] min-w-0 text-xs shrink">
              <SelectValue placeholder="Add scope…" />
            </SelectTrigger>
            <SelectContent>
              {selectableOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="xs" variant="outline" loading={saving} onClick={() => void addScope()}>
            Add
          </Button>
        </>
      ) : null}
    </div>
  );
}

async function readErrorMessage(response: Response, fallback: string) {
  const body = await response.text();
  if (!body) return fallback;
  try {
    const payload = JSON.parse(body) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}
