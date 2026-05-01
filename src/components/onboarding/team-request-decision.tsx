"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

const teamRequestDecisionSchema = z.object({
  comment: z.string().max(500).optional(),
});

type TeamRequestDecisionValues = z.infer<typeof teamRequestDecisionSchema>;

export function TeamRequestDecision({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [decided, setDecided] = useState(false);

  const form = useForm<TeamRequestDecisionValues>({
    resolver: zodResolver(teamRequestDecisionSchema),
    defaultValues: { comment: "" },
  });

  async function executeDecision(decision: "APPROVE" | "REJECT", values: TeamRequestDecisionValues) {
    const response = await fetch(`/api/admin/team-requests/${requestId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        comment: values.comment?.trim() || undefined,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? "Decision failed.");
      return;
    }

    toast.success(`Registration ${decision === "APPROVE" ? "approved" : "rejected"}.`);
    setDecided(true);
    router.refresh();
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
                  disabled={decided}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            type="button"
            loading={form.formState.isSubmitting}
            disabled={decided}
            onClick={form.handleSubmit(async (values) => executeDecision("APPROVE", values))}
          >
            Approve
          </Button>
          <Button
            variant="destructive"
            size="sm"
            type="button"
            loading={form.formState.isSubmitting}
            disabled={decided}
            onClick={form.handleSubmit(async (values) => executeDecision("REJECT", values))}
          >
            Reject
          </Button>
        </div>
      </form>
    </Form>
  );
}
