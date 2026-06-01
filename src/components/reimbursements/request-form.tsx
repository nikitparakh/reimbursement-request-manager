"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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

const FALLBACK_ERROR = "Failed to create request";

/**
 * Surface server error payloads that may be a plain string or a zod
 * `flatten()` object ({ formErrors, fieldErrors }), instead of silently
 * dropping the object form to a generic message.
 */
function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error || FALLBACK_ERROR;
  if (error && typeof error === "object") {
    const flat = error as {
      formErrors?: unknown;
      fieldErrors?: Record<string, unknown>;
    };
    if (Array.isArray(flat.formErrors)) {
      const first = flat.formErrors.find((m): m is string => typeof m === "string");
      if (first) return first;
    }
    if (flat.fieldErrors && typeof flat.fieldErrors === "object") {
      for (const messages of Object.values(flat.fieldErrors)) {
        if (Array.isArray(messages)) {
          const first = messages.find((m): m is string => typeof m === "string");
          if (first) return first;
        }
      }
    }
  }
  return FALLBACK_ERROR;
}

export function RequestForm({ teams }: { teams: TeamOption[] }) {
  const router = useRouter();
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
        const msg = extractErrorMessage(payload.error);
        toast.error(msg);
        return;
      }
      if (payload.id) {
        toast.success("Draft created", {
          description: "Upload receipts and add line items below.",
        });
        // Navigate to the draft so the user can upload receipts. This also
        // unmounts the form, preventing a second submit from creating a
        // duplicate draft.
        router.push(`/user/requests/${payload.id}`);
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

        <Button type="submit" loading={form.formState.isSubmitting}>
          Create Draft
        </Button>
      </form>
    </Form>
  );
}
