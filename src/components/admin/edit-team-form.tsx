"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
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

const editTeamSchema = z.object({
  name: z.string().trim().min(1, "Team name is required"),
  shortCode: z.string().max(12),
  glAccount: z.string().max(30),
});

type EditTeamFormValues = z.infer<typeof editTeamSchema>;

type EditTeamFormProps = {
  teamId: string;
  currentName: string;
  currentShortCode: string | null;
  currentGlAccount: string | null;
};

export function EditTeamForm({
  teamId,
  currentName,
  currentShortCode,
  currentGlAccount,
}: EditTeamFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const form = useForm<EditTeamFormValues>({
    resolver: zodResolver(editTeamSchema),
    defaultValues: {
      name: currentName,
      shortCode: currentShortCode ?? "",
      glAccount: currentGlAccount ?? "",
    },
  });

  useEffect(() => {
    if (editing) {
      form.reset({
        name: currentName,
        shortCode: currentShortCode ?? "",
        glAccount: currentGlAccount ?? "",
      });
    }
  }, [editing, currentName, currentShortCode, currentGlAccount, form]);

  async function onSubmit(values: EditTeamFormValues) {
    const res = await fetch(`/api/admin/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        shortCode: values.shortCode.trim() || null,
        glAccount: values.glAccount.trim() || null,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: { fieldErrors?: { name?: string[] }; message?: string };
    };

    if (!res.ok) {
      const msg =
        data.error?.fieldErrors?.name?.[0] ??
        data.error?.message ??
        "Failed to update team";
      toast.error(msg);
      return;
    }

    toast.success("Team updated");
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <Button variant="secondary" size="sm" type="button" onClick={() => setEditing(true)}>
        Edit
      </Button>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team name</FormLabel>
              <FormControl>
                <Input className="w-48" autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="shortCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Short code</FormLabel>
              <FormControl>
                <Input className="w-32" maxLength={12} autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="glAccount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GL account</FormLabel>
              <FormControl>
                <Input
                  className="w-56"
                  placeholder="e.g. 61-296-7920-099-978-0000"
                  maxLength={30}
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="default" size="sm" loading={form.formState.isSubmitting}>
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditing(false);
            form.reset({
              name: currentName,
              shortCode: currentShortCode ?? "",
              glAccount: currentGlAccount ?? "",
            });
          }}
        >
          Cancel
        </Button>
      </form>
    </Form>
  );
}
