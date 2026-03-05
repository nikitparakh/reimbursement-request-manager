"use client";

import { useState } from "react";
import type { GlobalRole } from "@prisma/client";

type UserRoleSelectProps = {
  userId: string;
  currentRole: GlobalRole;
};

const roles: GlobalRole[] = ["STUDENT", "COACH", "ADMIN"];

export function UserRoleSelect({ userId, currentRole }: UserRoleSelectProps) {
  const [role, setRole] = useState<GlobalRole>(currentRole);
  const [saving, setSaving] = useState(false);

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
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={role}
      onChange={(e) => void handleChange(e.target.value as GlobalRole)}
      disabled={saving}
      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 disabled:opacity-50"
    >
      {roles.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}
