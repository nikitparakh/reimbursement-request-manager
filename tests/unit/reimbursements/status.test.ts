import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "@/lib/reimbursements/status";

describe("request status transitions", () => {
  it("allows valid transitions", () => {
    expect(canTransition("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransition("SUBMITTED", "MANAGER_APPROVED")).toBe(true);
    expect(canTransition("MANAGER_APPROVED", "ADMIN_APPROVED")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("DRAFT", "ADMIN_APPROVED")).toBe(false);
    expect(() => assertTransition("DRAFT", "ADMIN_APPROVED")).toThrow(
      /Invalid status transition/
    );
  });
});
