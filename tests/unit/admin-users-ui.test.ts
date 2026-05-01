import { describe, expect, it } from "vitest";
import { getRoleFilterOptions } from "@/lib/admin-users-ui";

describe("admin users UI helpers", () => {
  it("hides super admin filtering from scoped user managers", () => {
    expect(getRoleFilterOptions(false)).toEqual([
      { value: "", label: "All Roles" },
      { value: "USER", label: "User" },
    ]);
  });

  it("shows super admin filtering to global role managers", () => {
    expect(getRoleFilterOptions(true)).toEqual([
      { value: "", label: "All Roles" },
      { value: "SUPER_ADMIN", label: "Super Admin" },
      { value: "USER", label: "User" },
    ]);
  });
});
