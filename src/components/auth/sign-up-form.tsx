"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

type SignUpFormProps = {
  role?: "STUDENT" | "ADMIN";
};

export function SignUpForm({ role = "STUDENT" }: SignUpFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    let response: Response;
    try {
      response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
    } catch {
      setMessage("Network error while creating account.");
      setIsSubmitting(false);
      return;
    }

    if (!response.ok) {
      setMessage(await getErrorMessage(response));
      setIsSubmitting(false);
      return;
    }

    const signInResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/onboarding",
    });

    setIsSubmitting(false);

    if (!signInResult || signInResult.error) {
      setMessage("Account created. Please sign in manually.");
      return;
    }

    window.location.href = signInResult.url ?? "/onboarding";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message ? <Alert variant="error">{message}</Alert> : null}

      <FormField label="Name" htmlFor="name">
        <Input
          id="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your full name"
        />
      </FormField>

      <FormField label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </FormField>

      <FormField
        label="Password"
        htmlFor="password"
        helpText="Must include at least one uppercase letter, one lowercase letter, and one number."
      >
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </FormField>

      <Button type="submit" loading={isSubmitting} className="w-full">
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>
    </form>
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
