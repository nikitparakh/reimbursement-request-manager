import { describe, expect, it } from "vitest";
import { canTransition } from "@/lib/reimbursements/status";

describe("reimbursement workflow lifecycle", () => {
  it("supports student -> manager -> admin progression", () => {
    expect(canTransition("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransition("SUBMITTED", "MANAGER_APPROVED")).toBe(true);
    expect(canTransition("MANAGER_APPROVED", "ADMIN_APPROVED")).toBe(true);
    expect(canTransition("ADMIN_APPROVED", "PAID")).toBe(true);
  });
});
