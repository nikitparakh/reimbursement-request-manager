"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

type DecisionPayload = "APPROVE" | "REJECT" | "MARK_PAID";

const approvalDecisionSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    comment: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "REJECT" && !(data.comment ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["comment"],
        message: "Rejection requires a comment.",
      });
    }
  });

type ApprovalDecisionFormValues = z.infer<typeof approvalDecisionSchema>;

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
  const router = useRouter();
  const [markPaidBusy, setMarkPaidBusy] = useState(false);
  const [decided, setDecided] = useState(false);
  const [decisionResult, setDecisionResult] = useState<string | null>(null);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);

  const form = useForm<ApprovalDecisionFormValues>({
    resolver: zodResolver(approvalDecisionSchema),
    defaultValues: { decision: "APPROVE", comment: "" },
  });

  const busy = form.formState.isSubmitting || markPaidBusy;

  async function postDecision(decision: DecisionPayload, comment: string) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        comment: comment.trim() === "" ? undefined : comment.trim(),
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      const msg = body.error ?? "Decision failed.";
      const commentMsg =
        decision === "REJECT" &&
        (typeof msg === "string" &&
          (msg.toLowerCase().includes("rejection comment") ||
            msg.toLowerCase().includes("comment is required")));

      if (commentMsg) {
        form.setError("comment", { type: "server", message: msg });
      } else {
        toast.error(msg);
      }
      return;
    }

    form.clearErrors("comment");
    setDecided(true);
    const resultLabel =
      decision === "APPROVE"
        ? "Request approved."
        : decision === "REJECT"
          ? "Request rejected."
          : "Request marked as paid.";
    setDecisionResult(resultLabel);
    toast.success("Decision recorded.");
    router.refresh();
  }

  async function onSubmit(values: ApprovalDecisionFormValues) {
    await postDecision(values.decision, values.comment ?? "");
  }

  function confirmReject() {
    setRejectConfirmOpen(false);
    form.setValue("decision", "REJECT");
    void form.handleSubmit(onSubmit)();
  }

  async function handleMarkPaid() {
    const comment = form.getValues("comment") ?? "";
    setMarkPaidBusy(true);
    try {
      await postDecision("MARK_PAID", comment);
    } finally {
      setMarkPaidBusy(false);
    }
  }

  return (
    <Form {...form}>
      <form className="space-y-3">
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Comment</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  id={`comment-${requestId}`}
                  placeholder="Add a comment..."
                  rows={2}
                  disabled={busy || decided}
                />
              </FormControl>
              <FormDescription>
                Optional for approval; required for rejection.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          {showApproveReject && (
            <>
              <Button
                variant="default"
                size="sm"
                type="button"
                loading={busy}
                disabled={busy || decided}
                onClick={() => {
                  form.setValue("decision", "APPROVE");
                  void form.handleSubmit(onSubmit)();
                }}
              >
                Approve
              </Button>
              <Button
                variant="destructive"
                size="sm"
                type="button"
                className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40"
                loading={busy}
                disabled={busy || decided}
                onClick={() => {
                  form.setValue("decision", "REJECT");
                  void form.trigger().then((valid) => {
                    if (valid) setRejectConfirmOpen(true);
                  });
                }}
              >
                Reject
              </Button>
            </>
          )}
          {allowMarkPaid ? (
            <Button
              variant="default"
              size="sm"
              type="button"
              loading={markPaidBusy}
              disabled={form.formState.isSubmitting || markPaidBusy || decided}
              onClick={() => void handleMarkPaid()}
            >
              Mark Paid
            </Button>
          ) : null}
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {decisionResult ?? ""}
        </p>
      </form>
      <AlertDialog open={rejectConfirmOpen} onOpenChange={setRejectConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this request?</AlertDialogTitle>
            <AlertDialogDescription>
              The requester will be notified and the request will be sent back.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40"
              loading={busy}
              disabled={busy}
              onClick={confirmReject}
            >
              Reject
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
