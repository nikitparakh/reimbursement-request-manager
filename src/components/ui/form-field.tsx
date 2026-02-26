import { type ReactNode } from "react";

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  helpText?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({ label, htmlFor, helpText, error, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {helpText && !error ? (
        <p className="text-xs text-slate-500">{helpText}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
