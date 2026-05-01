"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type CreateTeamFormProps = {
  schools: Array<{
    id: string;
    name: string;
    districtName: string;
  }>;
  programs: Array<{
    id: string;
    name: string;
    code: string;
  }>;
};

export function CreateTeamForm({ schools, programs }: CreateTeamFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [glAccount, setGlAccount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !schoolId || !programId) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          programId,
          name: name.trim(),
          shortCode: shortCode.trim() || undefined,
          glAccount: glAccount.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(
          data.error?.fieldErrors?.name?.[0] ??
            data.error?.fieldErrors?.schoolId?.[0] ??
            data.error?.fieldErrors?.programId?.[0] ??
            data.error ??
            "Failed to create team"
        );
        return;
      }

      setName("");
      setShortCode("");
      setGlAccount("");
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
        <label
          htmlFor="create-team-school"
          className="block text-xs font-medium text-slate-500 mb-1"
        >
          School
        </label>
        <Select
          id="create-team-school"
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          className="w-56"
          disabled={schools.length === 0}
        >
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.districtName} · {school.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label
          htmlFor="create-team-program"
          className="block text-xs font-medium text-slate-500 mb-1"
        >
          Program
        </label>
        <Select
          id="create-team-program"
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          className="w-44"
          disabled={programs.length === 0}
        >
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.code} · {program.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label
          htmlFor="create-team-name"
          className="block text-xs font-medium text-slate-500 mb-1"
        >
          Team Name
        </label>
        <Input
          id="create-team-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Team 503"
          required
          error={!!error}
          className="w-48"
        />
      </div>
      <div>
        <label
          htmlFor="create-team-short-code"
          className="block text-xs font-medium text-slate-500 mb-1"
        >
          Short Code
        </label>
        <Input
          id="create-team-short-code"
          value={shortCode}
          onChange={(e) => setShortCode(e.target.value)}
          placeholder="e.g. FF503"
          maxLength={12}
          className="w-32"
        />
      </div>
      <div>
        <label
          htmlFor="create-team-gl-account"
          className="block text-xs font-medium text-slate-500 mb-1"
        >
          GL Account
        </label>
        <Input
          id="create-team-gl-account"
          value={glAccount}
          onChange={(e) => setGlAccount(e.target.value)}
          placeholder="e.g. 61-296-7920-099-978-0000"
          maxLength={30}
          className="w-56"
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        size="md"
        loading={saving}
        disabled={!schoolId || !programId}
      >
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
