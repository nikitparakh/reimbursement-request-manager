"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field-group";
import { Input } from "@/components/ui/input";

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

export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const [form, setForm] = useState({
    mailingAddressLine1: initialProfile.mailingAddressLine1 ?? "",
    mailingAddressLine2: initialProfile.mailingAddressLine2 ?? "",
    mailingCity: initialProfile.mailingCity ?? "",
    mailingState: initialProfile.mailingState ?? "",
    mailingPostalCode: initialProfile.mailingPostalCode ?? "",
    zelleType: initialProfile.zelleType ?? "",
    zelleValue: initialProfile.zelleValue ?? "",
  });
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string | { formErrors?: string[] };
        };
        const errorText =
          typeof payload.error === "string"
            ? payload.error
            : payload.error?.formErrors?.[0] ?? "Unable to save profile.";
        setMessage(errorText);
        setIsError(true);
        setSaving(false);
        return;
      }

      setMessage("Profile updated.");
      setIsError(false);
    } catch {
      setMessage("Unable to save profile.");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message ? <Alert variant={isError ? "error" : "success"}>{message}</Alert> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <FieldGroup label="Address line 1" htmlFor="mailingAddressLine1">
          <Input
            id="mailingAddressLine1"
            value={form.mailingAddressLine1}
            onChange={(event) => setField("mailingAddressLine1", event.target.value)}
          />
        </FieldGroup>

        <FieldGroup label="Address line 2" htmlFor="mailingAddressLine2">
          <Input
            id="mailingAddressLine2"
            value={form.mailingAddressLine2}
            onChange={(event) => setField("mailingAddressLine2", event.target.value)}
          />
        </FieldGroup>

        <FieldGroup label="City" htmlFor="mailingCity">
          <Input
            id="mailingCity"
            value={form.mailingCity}
            onChange={(event) => setField("mailingCity", event.target.value)}
          />
        </FieldGroup>

        <FieldGroup label="State / Province" htmlFor="mailingState">
          <Input
            id="mailingState"
            value={form.mailingState}
            onChange={(event) => setField("mailingState", event.target.value)}
          />
        </FieldGroup>

        <FieldGroup label="Postal code" htmlFor="mailingPostalCode">
          <Input
            id="mailingPostalCode"
            value={form.mailingPostalCode}
            onChange={(event) => setField("mailingPostalCode", event.target.value)}
          />
        </FieldGroup>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FieldGroup label="Zelle type" htmlFor="zelleType">
          <select
            id="zelleType"
            value={form.zelleType}
            onChange={(event) => setField("zelleType", event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select one</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
          </select>
        </FieldGroup>

        <FieldGroup
          label="Zelle destination"
          htmlFor="zelleValue"
          hint="Provide the email address or phone number that should receive reimbursement."
        >
          <Input
            id="zelleValue"
            value={form.zelleValue}
            onChange={(event) => setField("zelleValue", event.target.value)}
          />
        </FieldGroup>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Policy accepted{" "}
        {initialProfile.policyAcceptedAt
          ? `on ${initialProfile.policyAcceptedAt.toLocaleDateString()}`
          : "during registration"}
        {initialProfile.policyVersion ? ` · version ${initialProfile.policyVersion}` : ""}
      </div>

      <Button type="submit" loading={saving}>
        Save profile
      </Button>
    </form>
  );
}
