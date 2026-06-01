import type { RequestStatus } from "@/db/schema";

/**
 * Thrown when a status transition cannot be applied: either the requested
 * transition is not allowed by the state machine (invalid) or the request's
 * current status changed underneath us (stale/lost-update race). Callers should
 * map this to an HTTP 409 Conflict.
 */
export class TransitionConflictError extends Error {
  readonly code: "INVALID_TRANSITION" | "STALE_TRANSITION";
  constructor(
    code: "INVALID_TRANSITION" | "STALE_TRANSITION",
    message: string,
  ) {
    super(message);
    this.name = "TransitionConflictError";
    this.code = code;
  }
}

export function isTransitionConflict(error: unknown): error is TransitionConflictError {
  return error instanceof TransitionConflictError;
}

const transitions: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["COACH_APPROVED", "COACH_REJECTED"],
  COACH_APPROVED: ["ADMIN_APPROVED", "ADMIN_REJECTED"],
  COACH_REJECTED: ["DRAFT"],
  ADMIN_APPROVED: ["PAID"],
  ADMIN_REJECTED: ["DRAFT"],
  PAID: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus) {
  return transitions[from].includes(to);
}

export function assertTransition(from: RequestStatus, to: RequestStatus) {
  if (!canTransition(from, to)) {
    throw new TransitionConflictError(
      "INVALID_TRANSITION",
      `Invalid status transition: ${from} -> ${to}`,
    );
  }
}
