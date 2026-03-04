"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

type TeamOption = { id: string; name: string };

export function RequestForm({ teams }: { teams: TeamOption[] }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [requestId, setRequestId] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  async function createDraft() {
    setMessage("");
    setIsCreating(true);
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, teamId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error ?? "Failed to create request");
        setIsError(true);
        return;
      }
      setRequestId(payload.id);
      setMessage("Draft created successfully.");
      setIsError(false);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <FormField label="Title" htmlFor="title">
        <Input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Competition Travel Expenses"
        />
      </FormField>

      <FormField label="Description" htmlFor="description">
        <Textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe what this reimbursement is for..."
          rows={3}
        />
      </FormField>

      <FormField label="Team" htmlFor="team">
        <Select id="team" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
          {teams.map((team) => (
            <option value={team.id} key={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      </FormField>

      <Button onClick={createDraft} disabled={isCreating}>
        {isCreating ? "Creating..." : "Create Draft"}
      </Button>

      {message ? (
        <Alert variant={isError ? "error" : "success"}>
          {message}
          {requestId ? (
            <Link
              href={`/student/requests/${requestId}`}
              className="ml-2 font-medium underline"
            >
              Open request to upload receipts
            </Link>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
}
