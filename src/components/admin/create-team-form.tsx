"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateTeamForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          shortCode: shortCode.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.fieldErrors?.name?.[0] ?? "Failed to create team");
        return;
      }

      setName("");
      setShortCode("");
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        + Create Team
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
          placeholder="e.g. Team 503"
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
          placeholder="e.g. FF503"
          maxLength={12}
          className="w-32"
        />
      </div>
      <Button type="submit" variant="primary" size="md" loading={saving}>
        Create
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="md"
        onClick={() => {
          setOpen(false);
          setError("");
        }}
      >
        Cancel
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
