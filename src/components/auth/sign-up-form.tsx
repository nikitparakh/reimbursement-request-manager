"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { POLICY_PATH } from "@/lib/policy";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { registerFormSchema, type RegisterFormValues } from "./register-schema";
import { toAppRouterHref } from "./router-redirect-path";

export function SignUpForm() {
  const router = useRouter();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      policyAccepted: false,
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        toast.error(await getErrorMessage(response));
        return;
      }

      const signInResult = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl: "/onboarding",
      });

      if (!signInResult || signInResult.error) {
        toast.info("Account created. Please sign in manually.");
        return;
      }

      toast.success("Welcome! Your account is ready.");
      router.replace(toAppRouterHref(signInResult.url, "/onboarding"));
    } catch {
      toast.error("Network error while creating account.");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Your full name" autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormDescription>
                Must include at least one uppercase letter, one lowercase letter, and one number.
              </FormDescription>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="policyAccepted"
          render={({ field }) => (
            <FormItem className="rounded-md border border-border bg-muted/50 px-3 py-3">
              <div className="flex items-start gap-3">
                <FormControl>
                  <Checkbox
                    checked={field.value === true}
                    disabled={field.disabled}
                    onBlur={field.onBlur}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    ref={field.ref}
                  />
                </FormControl>
                <div className="space-y-1 leading-snug">
                  <FormLabel className="cursor-pointer font-normal text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    <span className="text-sm">
                      I agree to the{" "}
                      <Link
                        href={POLICY_PATH}
                        className="font-medium text-primary hover:text-primary/80"
                        target="_blank"
                        rel="noreferrer"
                      >
                        reimbursement policy
                      </Link>
                      .
                    </span>
                  </FormLabel>
                  <FormMessage />
                </div>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </Form>
  );
}

async function getErrorMessage(response: Response) {
  const fallback = "Unable to create account";
  const bodyText = await response.text();
  if (!bodyText) return fallback;

  try {
    const payload = JSON.parse(bodyText) as {
      error?: string | { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    };
    if (typeof payload.error === "string") return payload.error;
    if (payload.error?.formErrors?.[0]) return payload.error.formErrors[0];
    const firstFieldError = payload.error?.fieldErrors
      ? Object.values(payload.error.fieldErrors).flat().find(Boolean)
      : undefined;
    return firstFieldError ?? fallback;
  } catch {
    return fallback;
  }
}
