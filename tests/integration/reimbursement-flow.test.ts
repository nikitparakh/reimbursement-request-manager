import { describe, expect, it } from "vitest";
import { canTransition } from "@/lib/reimbursements/status";

describe("reimbursement workflow lifecycle", () => {
  it("supports user -> coach -> admin progression", () => {
    expect(canTransition("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransition("SUBMITTED", "COACH_APPROVED")).toBe(true);
    expect(canTransition("COACH_APPROVED", "ADMIN_APPROVED")).toBe(true);
    expect(canTransition("ADMIN_APPROVED", "PAID")).toBe(true);
  });
});
