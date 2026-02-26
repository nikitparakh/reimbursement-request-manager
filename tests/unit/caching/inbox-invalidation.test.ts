import { describe, expect, it } from "vitest";
import { adminInboxTag, managerInboxTag } from "@/lib/reimbursements/cache";

describe("cache tag naming", () => {
  it("produces stable manager and admin tags", () => {
    expect(managerInboxTag("team_123")).toBe("manager-inbox-team_123");
    expect(adminInboxTag()).toBe("admin-inbox");
  });
});
