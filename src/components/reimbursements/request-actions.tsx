"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReceiptUploader } from "@/components/reimbursements/receipt-uploader";
import { EditableLineItems } from "@/components/reimbursements/editable-line-items";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { SerializedReceipt } from "@/lib/reimbursements/serialize-receipts";

type RequestActionsProps = {
  requestId: string;
  existingReceipts?: { id: string; fileName: string }[];
  hasExtractions: boolean;
  hasUnparsedReceipts?: boolean;
  receiptsWithExtractions?: SerializedReceipt[];
  redirectUrl?: string;
};

export function RequestActions({
  requestId,
  existingReceipts = [],
  hasExtractions,
  hasUnparsedReceipts = false,
  receiptsWithExtractions = [],
  redirectUrl = "/user/requests",
}: RequestActionsProps) {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  async function triggerParse() {
    setIsParsing(true);
    setMessage("");

    const MAX_RETRIES = 2;

    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      try {
        const res = await fetch(`/api/requests/${requestId}/parse`, { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          if (retry < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * (retry + 1)));
            continue;
          }
          setMessage(body.error ?? "Failed to start parsing.");
          setIsError(true);
          setIsParsing(false);
          return;
        }

        // Poll for parsing completion — 60 attempts × 3s = 3 minutes timeout
        for (let attempt = 0; attempt < 60; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 3000));

          const statusRes = await fetch(`/api/requests/${requestId}`, { cache: "no-store" });
          if (!statusRes.ok) continue;

          const payload = (await statusRes.json()) as {
            receiptFiles?: Array<{ parseStatus: string }>;
          };
          const statuses = payload.receiptFiles?.map((f) => f.parseStatus) ?? [];
          const hasFailed = statuses.some((s) => s === "FAILED");
          const stillProcessing = statuses.some((s) => s === "QUEUED" || s === "PROCESSING");

          if (!stillProcessing) {
            if (hasFailed && retry < MAX_RETRIES) {
              // Retry: re-trigger parse for any that failed (server re-queues them)
              await new Promise((resolve) => setTimeout(resolve, 1000));
              break; // break inner poll loop → retry outer loop
            }
            setIsParsing(false);
            router.refresh();
            return;
          }
        }

        // If we broke out of the poll loop for a retry, continue outer loop
        if (retry < MAX_RETRIES) continue;

        // Final timeout — refresh anyway
        setIsParsing(false);
        router.refresh();
        return;
      } catch {
        if (retry < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (retry + 1)));
          continue;
        }
        setMessage("Failed to parse receipts. Please try again.");
        setIsError(true);
        setIsParsing(false);
        return;
      }
    }
  }

  async function submit() {
    setMessage("");
    const response = await fetch(`/api/requests/${requestId}/submit`, { method: "POST" });
    if (!response.ok) {
      const body = await response.text();
      let errorText = "Request failed.";
      if (body) {
        try {
          const payload = JSON.parse(body) as { error?: string };
          errorText = payload.error ?? errorText;
        } catch {
          errorText = body;
        }
      }
      setMessage(errorText);
      setIsError(true);
      return;
    }
    router.push(redirectUrl);
  }

  return (
    <div className="space-y-6">
      <ReceiptUploader requestId={requestId} existingReceipts={existingReceipts} />

      {hasExtractions && (
        <EditableLineItems requestId={requestId} receipts={receiptsWithExtractions} allowReceiptDeletion />
      )}

      {hasUnparsedReceipts && (
        <div className="space-y-3">
          <Button onClick={triggerParse} loading={isParsing} disabled={isParsing}>
            {isParsing
              ? "Generating..."
              : hasExtractions
                ? "Process New Receipts"
                : "Generate Reimbursement Request"}
          </Button>
          {isParsing && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <svg className="h-5 w-5 animate-spin text-amber-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">Processing receipts...</p>
                <p className="text-xs text-amber-600">This usually takes 15–60 seconds. The page will update automatically.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {hasExtractions && !hasUnparsedReceipts && (
        <Button onClick={submit}>
          Submit to Coach
        </Button>
      )}

      {message ? (
        <Alert variant={isError ? "error" : "success"}>{message}</Alert>
      ) : null}

      <div className="border-t border-slate-200 pt-4">
        {confirmingDelete ? (
          <div className="space-y-2">
            <p className="text-sm text-red-600 font-medium">
              Are you sure? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                loading={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    const res = await fetch(`/api/requests/${requestId}`, {
                      method: "DELETE",
                    });
                    if (!res.ok) {
                      const body = (await res.json().catch(() => ({}))) as {
                        error?: string;
                      };
                      setMessage(body.error ?? "Failed to delete request.");
                      setIsError(true);
                      setConfirmingDelete(false);
                      setIsDeleting(false);
                      return;
                    }
                    router.push(redirectUrl);
                  } catch {
                    setMessage("Failed to delete request.");
                    setIsError(true);
                    setConfirmingDelete(false);
                    setIsDeleting(false);
                  }
                }}
              >
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete Draft
          </Button>
        )}
      </div>
    </div>
  );
}
