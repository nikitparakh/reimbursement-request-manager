import { describe, expect, it } from "vitest";
import { adminInboxTag, coachInboxTag } from "@/lib/reimbursements/cache";

describe("cache tag naming", () => {
  it("produces stable coach and admin tags", () => {
    expect(coachInboxTag("team_123")).toBe("coach-inbox-team_123");
    expect(adminInboxTag()).toBe("admin-inbox");
  });
});
