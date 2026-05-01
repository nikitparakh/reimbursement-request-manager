"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const editableRequestHeaderSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

type EditableRequestHeaderValues = z.infer<typeof editableRequestHeaderSchema>;

type EditableRequestHeaderProps = {
  requestId: string;
  initialTitle: string;
  initialDescription: string | null;
};

export function EditableRequestHeader({
  requestId,
  initialTitle,
  initialDescription,
}: EditableRequestHeaderProps) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef({
    title: initialTitle,
    description: initialDescription ?? "",
  });

  const form = useForm<EditableRequestHeaderValues>({
    resolver: zodResolver(editableRequestHeaderSchema),
    defaultValues: {
      title: initialTitle,
      description: initialDescription ?? "",
    },
    mode: "onChange",
  });

  const titleVal = useWatch({ control: form.control, name: "title" });
  const descriptionVal = useWatch({ control: form.control, name: "description" });

  useEffect(() => {
    const next = {
      title: initialTitle,
      description: initialDescription ?? "",
    };
    form.reset(next);
    lastSent.current = next;
  }, [initialTitle, initialDescription, form]);

  const save = useCallback(
    async (fields: { title: string; description: string }) => {
      try {
        const res = await fetch(`/api/requests/${requestId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            fieldErrors?: { title?: string; description?: string };
          };
          const msg = body.error ?? "Failed to save changes.";
          toast.error(msg);
          if (body.fieldErrors?.title) {
            form.setError("title", { type: "server", message: body.fieldErrors.title });
          }
          if (body.fieldErrors?.description) {
            form.setError("description", { type: "server", message: body.fieldErrors.description });
          }
        } else {
          lastSent.current = fields;
        }
      } catch {
        toast.error("Failed to save changes.");
      }
    },
    [form, requestId],
  );

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    const t = titleVal ?? "";
    const d = descriptionVal ?? "";
    if (t === lastSent.current.title && d === lastSent.current.description) {
      return;
    }

    saveTimeoutRef.current = setTimeout(() => {
      void (async () => {
        const ok = await form.trigger(["title", "description"]);
        if (!ok) return;
        const values = form.getValues();
        const desc = values.description ?? "";
        if (
          values.title === lastSent.current.title &&
          desc === lastSent.current.description
        ) {
          return;
        }
        await save({ title: values.title, description: desc });
      })();
    }, 500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [titleVal, descriptionVal, form, save]);

  return (
    <Form {...form}>
      <form className="space-y-3">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-xs text-muted-foreground">Title</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  className="text-xl font-semibold md:text-2xl"
                  placeholder="Request title"
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
            <FormItem className="space-y-1.5">
              <FormLabel className="text-xs text-muted-foreground">Description</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  rows={2}
                  className="min-h-[4.5rem] resize-y text-sm md:text-sm"
                  placeholder="Add a description..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
