const colorMap: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-amber-100 text-amber-800",
  MANAGER_APPROVED: "bg-emerald-100 text-emerald-800",
  MANAGER_REJECTED: "bg-red-100 text-red-800",
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
  STUDENT: "bg-blue-100 text-blue-800",
  MANAGER: "bg-purple-100 text-purple-800",
};

const labelMap: Record<string, string> = {
  STUDENT: "PARENT/MENTOR",
  MANAGER: "COACH",
  MANAGER_APPROVED: "COACH APPROVED",
  MANAGER_REJECTED: "COACH REJECTED",
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
