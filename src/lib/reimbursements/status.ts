import type { RequestStatus } from "@prisma/client";

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
    throw new Error(`Invalid status transition: ${from} -> ${to}`);
  }
}
