"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

type Team = {
  id: string;
  name: string;
  shortCode: string | null;
};

export function TeamSelector({ teams }: { teams: Team[] }) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [roleIntent, setRoleIntent] = useState<"STUDENT" | "MANAGER">("STUDENT");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  async function submit() {
    setMessage("");
    const response = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, roleIntent }),
    });
    if (!response.ok) {
      const errorMessage = await readErrorMessage(response);
      setMessage(errorMessage);
      setIsSuccess(false);
      if (response.status === 401) {
        window.location.href = "/sign-in";
      }
      return;
    }
    setIsSuccess(true);
    setMessage("Onboarding complete. You can now create reimbursement requests.");
  }

  return (
    <div className="space-y-4">
      <FormField label="Team" htmlFor="teamId">
        <Select id="teamId" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Role" htmlFor="roleIntent">
        <Select
          id="roleIntent"
          value={roleIntent}
          onChange={(event) => setRoleIntent(event.target.value as "STUDENT" | "MANAGER")}
        >
          <option value="STUDENT">Parent/Mentor</option>
          <option value="MANAGER">Coach</option>
        </Select>
      </FormField>

      <Button onClick={submit}>Save</Button>

      {message ? (
        <Alert variant={isSuccess ? "success" : "error"}>{message}</Alert>
      ) : null}
    </div>
  );
}

async function readErrorMessage(response: Response) {
  const fallback = "Unable to complete onboarding.";
  const body = await response.text();
  if (!body) return fallback;
  try {
    const payload = JSON.parse(body) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}
