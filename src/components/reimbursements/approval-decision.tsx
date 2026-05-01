"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FieldGroup } from "@/components/ui/field-group";
import { Alert } from "@/components/ui/alert";

type Decision = "APPROVE" | "REJECT" | "MARK_PAID";

export function ApprovalDecision({
  requestId,
  endpoint,
  allowMarkPaid = false,
  showApproveReject = true,
}: {
  requestId: string;
  endpoint: string;
  allowMarkPaid?: boolean;
  showApproveReject?: boolean;
}) {
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  async function handleDecision(decision: Decision) {
    setMessage("");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, comment }),
    });

    if (!response.ok) {
      setMessage("Decision failed.");
      setIsError(true);
      return;
    }
    setMessage(`Decision recorded: ${decision.replace("_", " ")}`);
    setIsError(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <FieldGroup label="Comment" htmlFor={`comment-${requestId}`} hint="Required for rejection">
        <Textarea
          id={`comment-${requestId}`}
          value={comment}
          placeholder="Add a comment..."
          onChange={(event) => setComment(event.target.value)}
          rows={2}
        />
      </FieldGroup>
      <div className="flex gap-2">
        {showApproveReject && (
          <>
            <Button variant="default" size="sm" onClick={() => handleDecision("APPROVE")}>
              Approve
            </Button>
            <Button variant="destructive" size="sm" onClick={() => handleDecision("REJECT")}>
              Reject
            </Button>
          </>
        )}
        {allowMarkPaid ? (
          <Button variant="default" size="sm" onClick={() => handleDecision("MARK_PAID")}>
            Mark Paid
          </Button>
        ) : null}
      </div>
      {message ? (
        <Alert variant={isError ? "error" : "success"}>{message}</Alert>
      ) : null}
    </div>
  );
}
