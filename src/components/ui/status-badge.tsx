import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type StatusBadgeProps = {
  status: string
  className?: string
}

type StatusConfig = {
  variant: "default" | "secondary" | "outline" | "destructive" | "ghost" | "link"
  className?: string
  label?: string
  pulse?: boolean
}

/** Known workflow / role statuses from legacy Badge color mapping. */
const STATUS_VARIANTS: Record<string, StatusConfig> = {
  DRAFT: {
    variant: "outline",
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  SUBMITTED: {
    variant: "outline",
    className:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  COACH_APPROVED: {
    variant: "outline",
    className:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  COACH_REJECTED: {
    variant: "outline",
    className:
      "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  },
  ADMIN_APPROVED: {
    variant: "outline",
    className:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  ADMIN_REJECTED: {
    variant: "outline",
    className:
      "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  },
  PAID: {
    variant: "outline",
    className:
      "border-indigo-200 bg-indigo-100 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  },
  QUEUED: {
    variant: "outline",
    className:
      "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    pulse: true,
  },
  PROCESSING: {
    variant: "outline",
    className:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    pulse: true,
  },
  DONE: {
    variant: "outline",
    className:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  FAILED: {
    variant: "outline",
    className:
      "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  },
  PENDING: {
    variant: "outline",
    className:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  APPROVED: {
    variant: "outline",
    className:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  REJECTED: {
    variant: "outline",
    className:
      "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  },
  APPROVE: {
    variant: "outline",
    className:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  REJECT: {
    variant: "outline",
    className:
      "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  },
  REOPEN: {
    variant: "outline",
    className:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  MARK_PAID: {
    variant: "outline",
    className:
      "border-indigo-200 bg-indigo-100 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  },
  SUPER_ADMIN: {
    variant: "default",
    className: "bg-slate-900 text-white hover:bg-slate-900/90 dark:bg-slate-100 dark:text-slate-900",
  },
  USER: {
    variant: "outline",
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  SCHOOL_ADMIN: {
    variant: "outline",
    className:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  PROGRAM_ADMIN: {
    variant: "outline",
    className:
      "border-cyan-200 bg-cyan-100 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
  },
  PARENT_MENTOR: {
    variant: "outline",
    className:
      "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  },
  STUDENT: {
    variant: "outline",
    className:
      "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  },
  COACH: {
    variant: "outline",
    className:
      "border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200",
  },
}

/** Display overrides for labels whose Title-Case form would mislead readers. */
const LABEL_OVERRIDES: Record<string, string> = {
  PARENT_MENTOR: "Parent / Mentor",
  STUDENT: "Parent / Mentor",
}

/** Enum-like statuses use Title Case from underscores; free-form strings are shown as-is. */
function formatLabel(status: string): string {
  if (LABEL_OVERRIDES[status]) return LABEL_OVERRIDES[status]
  if (!/^[A-Z0-9_]+$/.test(status)) return status
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const resolved = STATUS_VARIANTS[status] ?? { variant: "secondary" as const }
  const label = formatLabel(status)

  return (
    <Badge
      variant={resolved.variant}
      className={cn(
        resolved.pulse ? "animate-pulse" : undefined,
        resolved.className,
        className
      )}
    >
      {label}
    </Badge>
  )
}
