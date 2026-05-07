import { describe, expect, it } from "vitest";
import type {
  GlobalRole,
  ScopedRole,
  TeamMembershipRole,
} from "@prisma/client";
import { buildAccessContext } from "@/lib/access";
import {
  getNavigationLinks,
  getRequestDetailHref,
} from "@/lib/navigation";

function scopedRole(
  role: ScopedRole,
  overrides: {
    districtId?: string | null;
    schoolId?: string | null;
    programId?: string | null;
    teamId?: string | null;
  } = {}
) {
  return {
    role,
    districtId: overrides.districtId ?? null,
    schoolId: overrides.schoolId ?? null,
    programId: overrides.programId ?? null,
    teamId: overrides.teamId ?? null,
  };
}

function membership(
  roleInTeam: TeamMembershipRole,
  overrides: {
    teamId?: string;
  } = {}
) {
  return {
    roleInTeam,
    teamId: overrides.teamId ?? "team-1",
  };
}

function accessContext(
  globalRole: GlobalRole,
  scopedRoles: ReturnType<typeof scopedRole>[],
  teamMemberships: ReturnType<typeof membership>[] = []
) {
  return buildAccessContext({
    userId: "user-1",
    globalRole,
    scopedRoles,
    teamMemberships,
  });
}

describe("navigation helpers", () => {
  it("builds admin links for school admins", () => {
    const context = accessContext("USER", [
      scopedRole("SCHOOL_ADMIN", {
        districtId: "district-1",
        schoolId: "school-1",
      }),
    ]);

    expect(getNavigationLinks(context)).toEqual([
      { href: "/admin/inbox", label: "Admin Inbox", prefetch: false },
      { href: "/admin/requests", label: "Reimbursements", prefetch: false },
      { href: "/admin/teams", label: "Manage Teams", prefetch: false },
      { href: "/admin/team-requests", label: "Team Registrations", prefetch: false },
      { href: "/admin/users", label: "Manage Users", prefetch: false },
    ]);
    expect(getRequestDetailHref(context, "req-1")).toBe("/admin/requests/req-1");
  });

  it("omits user management for program admins but keeps admin request links", () => {
    const context = accessContext("USER", [
      scopedRole("PROGRAM_ADMIN", {
        districtId: "district-1",
        schoolId: "school-1",
        programId: "program-1",
      }),
    ]);

    expect(getNavigationLinks(context)).toEqual([
      { href: "/admin/inbox", label: "Admin Inbox", prefetch: false },
      { href: "/admin/requests", label: "Reimbursements", prefetch: false },
      { href: "/admin/teams", label: "Manage Teams", prefetch: false },
      { href: "/admin/team-requests", label: "Team Registrations", prefetch: false },
    ]);
    expect(getRequestDetailHref(context, "req-1")).toBe("/admin/requests/req-1");
  });

  it("does not show Profile for pure admins who never get reimbursed", () => {
    const superAdmin = accessContext("SUPER_ADMIN", []);
    expect(getNavigationLinks(superAdmin).some((link) => link.href === "/profile")).toBe(false);

    const programAdmin = accessContext("USER", [
      scopedRole("PROGRAM_ADMIN", {
        districtId: "district-1",
        schoolId: "school-1",
        programId: "program-1",
      }),
    ]);
    expect(getNavigationLinks(programAdmin).some((link) => link.href === "/profile")).toBe(false);
  });

  it("shows Profile for an admin who is also a parent/mentor on a team", () => {
    const context = accessContext(
      "USER",
      [scopedRole("SCHOOL_ADMIN", { districtId: "district-1", schoolId: "school-1" })],
      [membership("PARENT_MENTOR", { teamId: "team-1" })],
    );

    expect(getNavigationLinks(context).some((link) => link.href === "/profile")).toBe(true);
  });

  it("deduplicates coach and parent links while keeping member navigation", () => {
    const context = accessContext("USER", [], [
      membership("COACH", { teamId: "team-1" }),
      membership("PARENT_MENTOR", { teamId: "team-1" }),
    ]);

    expect(getNavigationLinks(context)).toEqual([
      { href: "/coach/team-overview", label: "Team Overview" },
      { href: "/coach/team-reimbursements", label: "Team Reimbursements" },
      { href: "/team", label: "My Team" },
      { href: "/user/requests/new", label: "New Request" },
      { href: "/user/requests", label: "My Requests" },
      { href: "/profile", label: "Profile" },
    ]);
    expect(getRequestDetailHref(context, "req-1")).toBe("/user/requests/req-1");
  });
});
