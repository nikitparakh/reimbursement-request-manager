const colorMap: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-amber-100 text-amber-800",
  COACH_APPROVED: "bg-emerald-100 text-emerald-800",
  COACH_REJECTED: "bg-red-100 text-red-800",
  ADMIN_APPROVED: "bg-emerald-100 text-emerald-800",
  ADMIN_REJECTED: "bg-red-100 text-red-800",
  PAID: "bg-indigo-100 text-indigo-800",
  QUEUED: "bg-slate-100 text-slate-600",
  PROCESSING: "bg-amber-100 text-amber-800",
  DONE: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  APPROVE: "bg-emerald-100 text-emerald-800",
  REJECT: "bg-red-100 text-red-800",
  REOPEN: "bg-amber-100 text-amber-800",
  MARK_PAID: "bg-indigo-100 text-indigo-800",
  SUPER_ADMIN: "bg-slate-900 text-white",
  USER: "bg-slate-100 text-slate-700",
  SCHOOL_ADMIN: "bg-emerald-100 text-emerald-800",
  PROGRAM_ADMIN: "bg-cyan-100 text-cyan-800",
  PARENT_MENTOR: "bg-blue-100 text-blue-800",
  STUDENT: "bg-blue-100 text-blue-800",
  COACH: "bg-purple-100 text-purple-800",
};

const labelMap: Record<string, string> = {
  SUPER_ADMIN: "SUPER ADMIN",
  USER: "USER",
  SCHOOL_ADMIN: "SCHOOL ADMIN",
  PROGRAM_ADMIN: "PROGRAM ADMIN",
  PARENT_MENTOR: "PARENT / MENTOR",
  STUDENT: "PARENT/MENTOR",
  COACH: "COACH",
  COACH_APPROVED: "COACH APPROVED",
  COACH_REJECTED: "COACH REJECTED",
};

type BadgeProps = {
  status: string;
  className?: string;
};

const pulsingStatuses = new Set(["QUEUED", "PROCESSING"]);

export function Badge({ status, className = "" }: BadgeProps) {
  const colors = colorMap[status] ?? "bg-slate-100 text-slate-700";
  const pulse = pulsingStatuses.has(status) ? "animate-pulse" : "";
  const label = labelMap[status] ?? status.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors} ${pulse} ${className}`}
    >
      {label}
    </span>
  );
}
