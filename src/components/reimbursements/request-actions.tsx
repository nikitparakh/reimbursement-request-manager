"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ReceiptUploader } from "@/components/reimbursements/receipt-uploader";
import { EditableLineItems } from "@/components/reimbursements/editable-line-items";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { SerializedReceipt } from "@/lib/reimbursements/serialize-receipts";

type RequestActionsProps = {
  requestId: string;
  existingReceipts?: { id: string; fileName: string }[];
  hasExtractions: boolean;
  hasUnparsedReceipts?: boolean;
  receiptsWithExtractions?: SerializedReceipt[];
  redirectUrl?: string;
  submitToAdmin?: boolean;
  canSubmit?: boolean;
};

export function RequestActions({
  requestId,
  existingReceipts = [],
  hasExtractions,
  hasUnparsedReceipts = false,
  receiptsWithExtractions = [],
  redirectUrl = "/user/requests",
  submitToAdmin = false,
  canSubmit = true,
}: RequestActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const receiptEditorDeleteIds = receiptsWithExtractions
    .filter((receipt) => receipt.extraction)
    .map((receipt) => receipt.id);

  async function triggerParse() {
    setIsParsing(true);

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
          toast.error(body.error ?? "Failed to start parsing.");
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
              await new Promise((resolve) => setTimeout(resolve, 1000));
              break;
            }
            setIsParsing(false);
            router.refresh();
            return;
          }
        }

        if (retry < MAX_RETRIES) continue;

        setIsParsing(false);
        router.refresh();
        return;
      } catch {
        if (retry < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (retry + 1)));
          continue;
        }
        toast.error("Failed to parse receipts. Please try again.");
        setIsParsing(false);
        return;
      }
    }
  }

  async function submit() {
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
      toast.error(errorText);
      return;
    }
    toast.success(
      submitToAdmin ? "Submitted to admin successfully." : "Submitted to coach successfully.",
    );
    router.push(redirectUrl);
  }

  async function confirmDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Failed to delete request.");
        setIsDeleting(false);
        setDeleteOpen(false);
        return;
      }
      toast.success("Draft deleted.");
      router.push(redirectUrl);
    } catch {
      toast.error("Failed to delete request.");
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      <ReceiptUploader
        requestId={requestId}
        existingReceipts={existingReceipts}
        hideExistingReceiptDeleteIds={receiptEditorDeleteIds}
      />

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
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium text-foreground">Processing receipts...</p>
                <p className="text-xs text-muted-foreground">
                  This usually takes 15–60 seconds. The page will update automatically.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {hasExtractions && !hasUnparsedReceipts && canSubmit && (
        <Button onClick={() => void submit()}>
          {submitToAdmin ? "Submit to Admin" : "Submit to Coach"}
        </Button>
      )}

      {hasExtractions && !hasUnparsedReceipts && !canSubmit && (
        <p className="text-sm text-muted-foreground">
          Only the request creator can submit this draft.
        </p>
      )}

      <div className="border-t border-border pt-4">
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete Draft
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete draft</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. All uploaded receipts linked to this draft will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40"
                loading={isDeleting}
                disabled={isDeleting}
                onClick={() => void confirmDelete()}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
