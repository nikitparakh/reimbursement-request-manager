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
        toast.error("Could not update team status");
      }
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
