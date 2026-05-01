"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
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

const ZELLE_NONE = "__none__";

const profileFormSchema = z
  .object({
    mailingAddressLine1: z.string().trim().max(120, "Must be at most 120 characters"),
    mailingAddressLine2: z.string().trim().max(120, "Must be at most 120 characters"),
    mailingCity: z.string().trim().max(80, "Must be at most 80 characters"),
    mailingState: z.string().trim().max(40, "Must be at most 40 characters"),
    mailingPostalCode: z.string().trim().max(20, "Must be at most 20 characters"),
    zelleType: z.union([z.literal(""), z.enum(["email", "phone"])]),
    zelleValue: z.string().trim().max(120, "Must be at most 120 characters"),
  })
  .superRefine((data, ctx) => {
    const hasType = data.zelleType !== "";
    const hasValue = data.zelleValue.trim().length > 0;
    if (hasType && !hasValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Zelle destination is required when a type is selected",
        path: ["zelleValue"],
      });
    } else if (!hasType && hasValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a Zelle type",
        path: ["zelleType"],
      });
    }
  });

type ProfileFormValues = z.infer<typeof profileFormSchema>;

type ProfileFormProps = {
  initialProfile: {
    mailingAddressLine1: string | null;
    mailingAddressLine2: string | null;
    mailingCity: string | null;
    mailingState: string | null;
    mailingPostalCode: string | null;
    zelleType: string | null;
    zelleValue: string | null;
    policyAcceptedAt: Date | null;
    policyVersion: string | null;
  };
};

function normalizeForApi(values: ProfileFormValues) {
  const trimField = (s: string) => {
    const t = s.trim();
    return t.length > 0 ? t : undefined;
  };
  const body: Record<string, unknown> = {
    mailingAddressLine1: trimField(values.mailingAddressLine1),
    mailingAddressLine2: trimField(values.mailingAddressLine2),
    mailingCity: trimField(values.mailingCity),
    mailingState: trimField(values.mailingState),
    mailingPostalCode: trimField(values.mailingPostalCode),
  };
  if (values.zelleType) {
    body.zelleType = values.zelleType;
    body.zelleValue = trimField(values.zelleValue) ?? null;
  } else {
    body.zelleType = null;
    body.zelleValue = null;
  }
  return body;
}

function readPatchError(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Unable to save profile.";
  const err = (payload as { error?: unknown }).error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && Array.isArray((err as { formErrors?: unknown }).formErrors)) {
    const fe = (err as { formErrors: string[] }).formErrors;
    if (typeof fe[0] === "string") return fe[0];
  }
  return "Unable to save profile.";
}

export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      mailingAddressLine1: initialProfile.mailingAddressLine1 ?? "",
      mailingAddressLine2: initialProfile.mailingAddressLine2 ?? "",
      mailingCity: initialProfile.mailingCity ?? "",
      mailingState: initialProfile.mailingState ?? "",
      mailingPostalCode: initialProfile.mailingPostalCode ?? "",
      zelleType:
        initialProfile.zelleType === "email" || initialProfile.zelleType === "phone"
          ? initialProfile.zelleType
          : "",
      zelleValue: initialProfile.zelleValue ?? "",
    },
  });

  async function onSubmit(values: ProfileFormValues) {
    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizeForApi(values)),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        toast.error(readPatchError(payload));
        return;
      }

      toast.success("Profile updated.");
    } catch {
      toast.error("Unable to save profile.");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="mailingAddressLine1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address line 1</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mailingAddressLine2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address line 2</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mailingCity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mailingState"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State / Province</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mailingPostalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal code</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="zelleType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zelle type</FormLabel>
                <Select
                  value={field.value === "" ? ZELLE_NONE : field.value}
                  onValueChange={(v) => field.onChange(v === ZELLE_NONE ? "" : v)}
                >
                  <FormControl>
                    <SelectTrigger aria-label="Zelle type" className="w-full">
                      <SelectValue placeholder="Select one" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={ZELLE_NONE}>Select one</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="zelleValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zelle destination</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>
                  Provide the email address or phone number that should receive reimbursement.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Card className="border-muted bg-muted/40 shadow-none">
          <CardContent className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <CalendarCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              Policy accepted{" "}
              {initialProfile.policyAcceptedAt
                ? `on ${initialProfile.policyAcceptedAt.toLocaleDateString()}`
                : "during registration"}
              {initialProfile.policyVersion ? ` · version ${initialProfile.policyVersion}` : ""}
            </span>
          </CardContent>
        </Card>

        <Button type="submit" loading={form.formState.isSubmitting}>
          Save profile
        </Button>
      </form>
    </Form>
  );
}
