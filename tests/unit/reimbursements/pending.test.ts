import { describe, expect, it } from "vitest";

import { getPendingReviewStatuses } from "@/lib/reimbursements/pending";

describe("getPendingReviewStatuses", () => {
  it("returns SUBMITTED only for a pure coach", () => {
    expect(
      getPendingReviewStatuses({ canManageReimbursements: false, isCoach: true }),
    ).toEqual(["SUBMITTED"]);
  });

  it("returns SUBMITTED + COACH_APPROVED for an admin", () => {
    expect(
      getPendingReviewStatuses({ canManageReimbursements: true, isCoach: false }),
    ).toEqual(["SUBMITTED", "COACH_APPROVED"]);
  });

  it("returns SUBMITTED + COACH_APPROVED for a coach who is also an admin", () => {
    expect(
      getPendingReviewStatuses({ canManageReimbursements: true, isCoach: true }),
    ).toEqual(["SUBMITTED", "COACH_APPROVED"]);
  });

  it("returns an empty list for users with no review responsibility", () => {
    expect(
      getPendingReviewStatuses({ canManageReimbursements: false, isCoach: false }),
    ).toEqual([]);
  });
});
