"use client";

import { useState } from "react";

export function TeamRequestDecision({ requestId }: { requestId: string }) {
  const [decision, setDecision] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    const response = await fetch(`/api/admin/team-requests/${requestId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, comment }),
    });
    if (!response.ok) {
      setMessage("Decision failed.");
      return;
    }
    setMessage("Decision saved.");
  }

  return (
    <div>
      <select
        value={decision}
        onChange={(event) => setDecision(event.target.value as "APPROVE" | "REJECT")}
      >
        <option value="APPROVE">Approve</option>
        <option value="REJECT">Reject</option>
      </select>
      <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
      <button type="button" onClick={submit}>
        Save
      </button>
      {message ? <p>{message}</p> : null}
    </div>
  );
}
