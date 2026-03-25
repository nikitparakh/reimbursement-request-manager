"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

export function TeamRegistrationForm() {
  const [teamName, setTeamName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [glAccount, setGlAccount] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  async function submit() {
    setMessage("");
    const response = await fetch("/api/teams/registration-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamName, shortCode: shortCode || undefined, glAccount: glAccount || undefined, notes }),
    });

    if (!response.ok) {
      setMessage("Unable to send team registration request.");
      setIsSuccess(false);
      return;
    }

    setIsSuccess(true);
    setMessage("Team request sent for admin approval.");
    setTeamName("");
    setShortCode("");
    setGlAccount("");
    setNotes("");
  }

  return (
    <div className="space-y-4">
      <FormField label="Team Name" htmlFor="teamName">
        <Input
          id="teamName"
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
          placeholder="e.g. Robotics Team Alpha"
        />
      </FormField>

      <FormField label="Short Code" htmlFor="shortCode" helpText="Optional team abbreviation">
        <Input
          id="shortCode"
          value={shortCode}
          onChange={(event) => setShortCode(event.target.value)}
          placeholder="e.g. RTA"
        />
      </FormField>

      <FormField label="GL Account" htmlFor="glAccount" helpText="Optional GL account number">
        <Input
          id="glAccount"
          value={glAccount}
          onChange={(event) => setGlAccount(event.target.value)}
          placeholder="e.g. 61-296-7920-099-978-0000"
        />
      </FormField>

      <FormField label="Notes" htmlFor="notes">
        <Textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Any additional details about the team..."
          rows={3}
        />
      </FormField>

      <Button variant="secondary" onClick={submit}>Submit Request</Button>

      {message ? (
        <Alert variant={isSuccess ? "success" : "error"}>{message}</Alert>
      ) : null}
    </div>
  );
}
