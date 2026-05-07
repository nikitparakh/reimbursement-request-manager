import type { RequestStatus } from "@prisma/client";

import type { AccessContext } from "@/lib/access";

export const PENDING_REVIEW_FILTER = "pending" as const;
export type PendingReviewFilter = typeof PENDING_REVIEW_FILTER;

/**
 * Returns the request statuses that the given user can still act on
 * during the review workflow. Used to keep the "Pending review" badge
 * on /coach/team-reimbursements consistent with the "Pending Review"
 * stat tile on /coach/team-overview (and the equivalent admin pages).
 *
 * - Pure coach: only SUBMITTED — once they approve, the request moves
 *   to COACH_APPROVED and is no longer in their queue.
 * - Admin (with or without coach role): SUBMITTED + COACH_APPROVED —
 *   admins can also intervene at the initial review stage.
 */
export function getPendingReviewStatuses(
  access: Pick<AccessContext, "canManageReimbursements" | "isCoach">,
): RequestStatus[] {
  if (access.canManageReimbursements) {
    return ["SUBMITTED", "COACH_APPROVED"];
  }
  if (access.isCoach) {
    return ["SUBMITTED"];
  }
  return [];
}
