"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReceiptUploader } from "@/components/reimbursements/receipt-uploader";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function RequestActions({ requestId }: { requestId: string }) {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  async function readErrorMessage(response: Response) {
    const text = await response.text();
    if (!text) return "Request failed.";
    try {
      const payload = JSON.parse(text) as { error?: string };
      return payload.error ?? "Request failed.";
    } catch {
      return text;
    }
  }

  async function autofill() {
    const response = await fetch(`/api/requests/${requestId}/autofill`, { method: "POST" });
    if (!response.ok) {
      setMessage(await readErrorMessage(response));
      setIsError(true);
      return;
    }
    const payload = (await response.json()) as { requestedTotal: number; extractionCount: number };
    router.refresh();
    setMessage(
      `Auto-fill updated totals from ${payload.extractionCount} parsed receipt(s). New total: $${payload.requestedTotal.toFixed(2)}`
    );
    setIsError(false);
  }

  async function submit() {
    const response = await fetch(`/api/requests/${requestId}/submit`, { method: "POST" });
    if (!response.ok) {
      setMessage(await readErrorMessage(response));
      setIsError(true);
      return;
    }
    router.refresh();
    setMessage("Request submitted to manager.");
    setIsError(false);
  }

  return (
    <div className="space-y-6">
      <ReceiptUploader requestId={requestId} />
      <div className="flex gap-3">
        <Button variant="secondary" onClick={autofill}>
          Auto-fill Totals
        </Button>
        <Button onClick={submit}>
          Submit to Manager
        </Button>
      </div>
      {message ? (
        <Alert variant={isError ? "error" : "success"}>{message}</Alert>
      ) : null}
    </div>
  );
}
