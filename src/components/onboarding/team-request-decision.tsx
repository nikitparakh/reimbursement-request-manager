"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

export function TeamRequestDecision({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [decided, setDecided] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleDecision(decision: "APPROVE" | "REJECT") {
    setMessage("");
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/team-requests/${requestId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage(body.error ?? "Decision failed.");
        setIsError(true);
        return;
      }
      setMessage(`Registration ${decision === "APPROVE" ? "approved" : "rejected"}.`);
      setIsError(false);
      setDecided(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <FormField label="Comment" htmlFor={`comment-${requestId}`}>
        <Textarea
          id={`comment-${requestId}`}
          value={comment}
          placeholder="Add a comment..."
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          disabled={decided}
        />
      </FormField>
      <div className="flex gap-2">
        <Button variant="success" size="sm" onClick={() => handleDecision("APPROVE")} loading={saving} disabled={decided || saving}>
          Approve
        </Button>
        <Button variant="danger" size="sm" onClick={() => handleDecision("REJECT")} loading={saving} disabled={decided || saving}>
          Reject
        </Button>
      </div>
      {message ? (
        <Alert variant={isError ? "error" : "success"}>{message}</Alert>
      ) : null}
    </div>
  );
}
