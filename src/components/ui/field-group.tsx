import * as React from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type FieldGroupProps = {
  label?: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  className?: string
  children: React.ReactNode
}

export function FieldGroup({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FieldGroupProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor}>
          {label}
          {required ? (
            <span aria-hidden className="text-destructive">
              *
            </span>
          ) : null}
        </Label>
      ) : null}
      {children}
      {hint && !error ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
