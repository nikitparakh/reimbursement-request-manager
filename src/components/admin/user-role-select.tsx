"use client";

import { useEffect, useState } from "react";
import type { GlobalRole } from "@prisma/client";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserRoleSelectProps = {
  userId: string;
  currentRole: GlobalRole;
};

const roleOptions: { value: GlobalRole; label: string }[] = [
  { value: "USER", label: "User" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

export function UserRoleSelect({ userId, currentRole }: UserRoleSelectProps) {
  const [role, setRole] = useState<GlobalRole>(currentRole);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRole(currentRole);
  }, [currentRole]);

  async function handleChange(newRole: GlobalRole) {
    if (newRole === role) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setRole(newRole);
        toast.success("Global role updated");
      } else {
        toast.error("Could not update global role");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Select
      value={role}
      onValueChange={(v) => void handleChange(v as GlobalRole)}
      disabled={saving}
    >
      <SelectTrigger size="sm" className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roleOptions.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
