import {
  CheckCircle2,
  Circle,
  Clock,
  MinusCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type DecisionAction = "APPROVE" | "REJECT" | "REOPEN" | "MARK_PAID" | "SUBMIT";
type RequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "COACH_APPROVED"
  | "COACH_REJECTED"
  | "ADMIN_APPROVED"
  | "ADMIN_REJECTED"
  | "PAID";

export type RequestProgressApproval = {
  id: string;
  action: DecisionAction;
  comment: string | null;
  createdAt: Date;
};

export type RequestStageKind =
  | "complete"
  | "current"
  | "upcoming"
  | "rejected"
  | "skipped";

export type RequestStageState =
  | { kind: "complete"; at: Date; comment?: string | null }
  | { kind: "current" }
  | { kind: "upcoming" }
  | { kind: "rejected"; at: Date; comment?: string | null }
  | { kind: "skipped" };

export type RequestStage = {
  id: "submit" | "coach" | "admin" | "payment";
  label: string;
  state: RequestStageState;
  pillLabel: Record<RequestStageKind, string>;
  detail: Record<RequestStageKind, string>;
};

type StageVisual = {
  Icon: LucideIcon;
  iconClass: string;
  badgeClass: string;
  connectorClass: string;
};

const VISUALS: Record<RequestStageKind, StageVisual> = {
  complete: {
    Icon: CheckCircle2,
    iconClass: "bg-emerald-50 text-emerald-600 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    connectorClass: "bg-emerald-200 dark:bg-emerald-900",
  },
  current: {
    Icon: Clock,
    iconClass: "bg-amber-50 text-amber-600 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    connectorClass: "bg-border",
  },
  upcoming: {
    Icon: Circle,
    iconClass: "bg-muted text-muted-foreground/60 ring-border",
    badgeClass: "text-muted-foreground",
    connectorClass: "bg-border",
  },
  rejected: {
    Icon: XCircle,
    iconClass: "bg-red-50 text-destructive ring-red-200 dark:bg-red-950 dark:ring-red-900",
    badgeClass:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    connectorClass: "bg-red-200 dark:bg-red-900",
  },
  skipped: {
    Icon: MinusCircle,
    iconClass: "bg-muted/60 text-muted-foreground/40 ring-border",
    badgeClass: "border-dashed text-muted-foreground",
    connectorClass: "bg-border",
  },
};

export function buildRequestStages({
  status,
  approvals,
}: {
  status: RequestStatus;
  approvals: RequestProgressApproval[];
}): RequestStage[] {
  const sorted = [...approvals].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  const lastSubmit = [...sorted].reverse().find((a) => a.action === "SUBMIT") ?? null;
  const cycle = lastSubmit
    ? sorted.filter(
        (a) => a.id !== lastSubmit.id && a.createdAt.getTime() >= lastSubmit.createdAt.getTime()
      )
    : sorted.filter((a) => a.action !== "SUBMIT");
  const decisions = cycle.filter((a) => a.action === "APPROVE" || a.action === "REJECT");
  const coachDecision = decisions[0] ?? null;
  const adminDecision = decisions[1] ?? null;
  const payment = cycle.find((a) => a.action === "MARK_PAID") ?? null;

  const submitState: RequestStageState = lastSubmit
    ? { kind: "complete", at: lastSubmit.createdAt }
    : status === "DRAFT"
      ? { kind: "current" }
      : { kind: "complete", at: sorted[0]?.createdAt ?? new Date() };

  const coachState: RequestStageState = (() => {
    if (status === "DRAFT") return { kind: "upcoming" };
    if (status === "SUBMITTED") return { kind: "current" };
    if (coachDecision?.action === "APPROVE") {
      return { kind: "complete", at: coachDecision.createdAt, comment: coachDecision.comment };
    }
    if (coachDecision?.action === "REJECT") {
      return { kind: "rejected", at: coachDecision.createdAt, comment: coachDecision.comment };
    }
    return { kind: "current" };
  })();

  const adminState: RequestStageState = (() => {
    if (status === "DRAFT" || status === "SUBMITTED") return { kind: "upcoming" };
    if (status === "COACH_REJECTED") return { kind: "skipped" };
    if (status === "COACH_APPROVED") return { kind: "current" };
    if (adminDecision?.action === "APPROVE") {
      return { kind: "complete", at: adminDecision.createdAt, comment: adminDecision.comment };
    }
    if (adminDecision?.action === "REJECT") {
      return { kind: "rejected", at: adminDecision.createdAt, comment: adminDecision.comment };
    }
    return { kind: "current" };
  })();

  const paymentState: RequestStageState = (() => {
    if (status === "DRAFT" || status === "SUBMITTED" || status === "COACH_APPROVED") {
      return { kind: "upcoming" };
    }
    if (status === "COACH_REJECTED" || status === "ADMIN_REJECTED") {
      return { kind: "skipped" };
    }
    if (status === "ADMIN_APPROVED") return { kind: "current" };
    if (status === "PAID") {
      return {
        kind: "complete",
        at: payment?.createdAt ?? sorted[sorted.length - 1]?.createdAt ?? new Date(),
        comment: payment?.comment,
      };
    }
    return { kind: "upcoming" };
  })();

  return [
    {
      id: "submit",
      label: "Submission",
      state: submitState,
      pillLabel: {
        complete: "Submitted",
        current: "Awaiting submission",
        upcoming: "Pending",
        rejected: "Withdrawn",
        skipped: "Skipped",
      },
      detail: {
        complete: "Sent for review by the requester.",
        current: "Draft is not yet submitted.",
        upcoming: "Draft is not yet submitted.",
        rejected: "The request was withdrawn.",
        skipped: "Stage was skipped.",
      },
    },
    {
      id: "coach",
      label: "Coach review",
      state: coachState,
      pillLabel: {
        complete: "Approved",
        current: "Awaiting coach",
        upcoming: "Pending coach",
        rejected: "Rejected",
        skipped: "Skipped",
      },
      detail: {
        complete: "Approved by the team coach.",
        current: "Currently with the team coach.",
        upcoming: "Will be reviewed by the team coach.",
        rejected: "Rejected by the team coach.",
        skipped: "Stage was skipped.",
      },
    },
    {
      id: "admin",
      label: "Admin review",
      state: adminState,
      pillLabel: {
        complete: "Approved",
        current: "Awaiting admin",
        upcoming: "Pending admin",
        rejected: "Rejected",
        skipped: "Skipped",
      },
      detail: {
        complete: "Approved by the reimbursement admin.",
        current: "Currently with the reimbursement admin.",
        upcoming: "Will be reviewed once the coach approves.",
        rejected: "Rejected by the reimbursement admin.",
        skipped: "Skipped because the request was rejected earlier.",
      },
    },
    {
      id: "payment",
      label: "Payment",
      state: paymentState,
      pillLabel: {
        complete: "Paid",
        current: "Awaiting payout",
        upcoming: "Pending payment",
        rejected: "Cancelled",
        skipped: "Cancelled",
      },
      detail: {
        complete: "Payment has been issued.",
        current: "Approved and queued for payout.",
        upcoming: "Will be issued after admin approval.",
        rejected: "No payment will be issued.",
        skipped: "No payment will be issued.",
      },
    },
  ];
}

export function RequestProgress({
  status,
  approvals,
}: {
  status: RequestStatus;
  approvals: RequestProgressApproval[];
}) {
  const stages = buildRequestStages({ status, approvals });

  return (
    <ol className="relative">
      {stages.map((stage, idx) => {
        const visual = VISUALS[stage.state.kind];
        const isLast = idx === stages.length - 1;
        const Icon = visual.Icon;
        const detailed =
          stage.state.kind === "complete" || stage.state.kind === "rejected"
            ? stage.state
            : null;

        return (
          <li key={stage.id} className={cn("relative flex gap-4", isLast ? "pb-0" : "pb-6")}>
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[19px] top-10 h-[calc(100%-1rem)] w-px",
                  visual.connectorClass
                )}
              />
            ) : null}

            <span
              aria-hidden
              className={cn(
                "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full ring-2",
                visual.iconClass
              )}
            >
              <Icon className="size-5" />
            </span>

            <div className="min-w-0 flex-1 pt-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">{stage.label}</h4>
                <Badge variant="outline" className={cn("font-medium", visual.badgeClass)}>
                  {stage.pillLabel[stage.state.kind]}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {stage.detail[stage.state.kind]}
                {detailed ? <> · {formatDateTime(detailed.at)}</> : null}
              </p>
              {detailed?.comment ? (
                <blockquote className="mt-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground">
                  {detailed.comment}
                </blockquote>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
