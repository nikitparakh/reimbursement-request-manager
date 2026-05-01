"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().max(1000).optional(),
  teamId: z.string().min(1, "Select a team"),
});

type TeamOption = { id: string; name: string };
type RequestFormValues = z.infer<typeof formSchema>;

export function RequestForm({ teams }: { teams: TeamOption[] }) {
  const [requestId, setRequestId] = useState("");
  const form = useForm<RequestFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      teamId: teams[0]?.id ?? "",
    },
  });

  async function onSubmit(values: RequestFormValues) {
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as {
        error?: unknown;
        id?: string;
      };
      if (!response.ok) {
        const msg =
          typeof payload.error === "string"
            ? payload.error
            : "Failed to create request";
        toast.error(msg);
        return;
      }
      if (payload.id) {
        setRequestId(payload.id);
        toast.success("Draft created", {
          description: "Upload receipts from the request page.",
        });
      }
    } catch {
      toast.error("Failed to create request");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Competition Travel Expenses"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe what this reimbursement is for..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="teamId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={teams.length === 0}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a team" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating..." : "Create Draft"}
        </Button>

        {requestId ? (
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/user/requests/${requestId}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Open request to upload receipts
            </Link>
          </p>
        ) : null}
      </form>
    </Form>
  );
}
