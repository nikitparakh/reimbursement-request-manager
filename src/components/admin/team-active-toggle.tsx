"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";

type TeamActiveToggleProps = {
  teamId: string;
  active: boolean;
};

export function TeamActiveToggle({ teamId, active }: TeamActiveToggleProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function persist(next: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });

      if (res.ok) {
        toast.success(next ? "Team activated" : "Team deactivated");
        router.refresh();
      } else {
        const detail = await readErrorMessage(res, "Could not update team status");
        toast.error(
          res.status === 403
            ? "You do not have permission to change this team's status."
            : detail,
        );
      }
    } catch {
      toast.error("Network error. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Switch
      checked={active}
      disabled={saving}
      aria-label={active ? "Deactivate team" : "Activate team"}
      onCheckedChange={(next) => {
        if (next === active || saving) return;
        void persist(next);
      }}
    />
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
