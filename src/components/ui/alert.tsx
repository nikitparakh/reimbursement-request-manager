import { type ReactNode } from "react";

const alertVariants = {
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  error: "bg-red-50 text-red-800 border-red-200",
  info: "bg-indigo-50 text-indigo-800 border-indigo-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
} as const;

type AlertProps = {
  variant: keyof typeof alertVariants;
  children: ReactNode;
  className?: string;
};

export function Alert({ variant, children, className = "" }: AlertProps) {
  return (
    <div className={`rounded-md border p-4 text-sm ${alertVariants[variant]} ${className}`}>
      {children}
    </div>
  );
}
