"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const createTeamSchema = z.object({
  schoolId: z.string().min(1, "Select a school"),
  programId: z.string().min(1, "Select a program"),
  name: z.string().trim().min(1, "Team name is required"),
  shortCode: z.string().max(12).optional(),
  glAccount: z.string().max(30).optional(),
});

type CreateTeamFormValues = z.infer<typeof createTeamSchema>;

type CreateTeamFormProps = {
  schools: Array<{
    id: string;
    name: string;
    districtName: string;
  }>;
  programs: Array<{
    id: string;
    name: string;
    code: string;
  }>;
};

export function CreateTeamForm({ schools, programs }: CreateTeamFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<CreateTeamFormValues>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      schoolId: schools[0]?.id ?? "",
      programId: programs[0]?.id ?? "",
      name: "",
      shortCode: "",
      glAccount: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      schoolId: schools[0]?.id ?? "",
      programId: programs[0]?.id ?? "",
      name: "",
      shortCode: "",
      glAccount: "",
    });
  }, [open, schools, programs, form]);

  async function onSubmit(values: CreateTeamFormValues) {
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: values.schoolId,
        programId: values.programId,
        name: values.name,
        shortCode: values.shortCode?.trim() || undefined,
        glAccount: values.glAccount?.trim() || undefined,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: unknown;
    };

    if (!res.ok) {
      const err = data.error as
        | { fieldErrors?: Record<string, string[]>; message?: string }
        | string
        | undefined;
      const msg =
        typeof err === "object" && err && "fieldErrors" in err
          ? (err.fieldErrors?.name?.[0] ??
            err.fieldErrors?.schoolId?.[0] ??
            err.fieldErrors?.programId?.[0] ??
            (typeof err === "object" && "message" in err ? err.message : undefined))
          : typeof err === "string"
            ? err
            : "Failed to create team";
      toast.error(msg ?? "Failed to create team");
      return;
    }

    toast.success("Team created");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" type="button">
          <Plus className="mr-2 size-4" aria-hidden />
          Create Team
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>Add a team for the selected school and program.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4"
            id="create-team-dialog-form"
          >
            <FormField
              control={form.control}
              name="schoolId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={schools.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger id="create-team-school">
                        <SelectValue placeholder="School" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {schools.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.districtName} · {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="programId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={programs.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger id="create-team-program">
                        <SelectValue placeholder="Program" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {programs.map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.code} · {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team name</FormLabel>
                  <FormControl>
                    <Input
                      id="create-team-name"
                      placeholder="e.g. Team 503"
                      autoComplete="off"
                      {...field}
                    />
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
                    <Input
                      id="create-team-short-code"
                      placeholder="e.g. FF503"
                      maxLength={12}
                      autoComplete="off"
                      {...field}
                    />
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
                      id="create-team-gl-account"
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
          </form>
        </Form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
              form.reset();
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-team-dialog-form"
            variant="default"
            loading={form.formState.isSubmitting}
            disabled={!schools.length || !programs.length}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
