"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EditTeamFormProps = {
  teamId: string;
  currentName: string;
  currentShortCode: string | null;
};

export function EditTeamForm({
  teamId,
  currentName,
  currentShortCode,
}: EditTeamFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [shortCode, setShortCode] = useState(currentShortCode ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          shortCode: shortCode.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.fieldErrors?.name?.[0] ?? "Failed to update team");
        return;
      }

      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setEditing(true)}
      >
        Edit
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Team Name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          error={!!error}
          className="w-48"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Short Code
        </label>
        <Input
          value={shortCode}
          onChange={(e) => setShortCode(e.target.value)}
          maxLength={12}
          className="w-32"
        />
      </div>
      <Button type="submit" variant="primary" size="sm" loading={saving}>
        Save
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setEditing(false);
          setName(currentName);
          setShortCode(currentShortCode ?? "");
          setError("");
        }}
      >
        Cancel
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
