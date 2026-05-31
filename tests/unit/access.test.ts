import { describe, expect, it } from "vitest";
import type {
  GlobalRole,
  ScopedRole,
  TeamMembershipRole,
} from "@/db/schema";
import { buildAccessContext, canAccessTeam } from "@/lib/access";

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

describe("access helpers", () => {
  it("rejects scoped roles with no scope boundary", () => {
    expect(() => accessContext("USER", [scopedRole("SCHOOL_ADMIN")])).toThrow(
      "INVALID_SCOPED_ROLE_ASSIGNMENT"
    );
  });

  it("gives school admins full scoped admin powers", () => {
    const context = accessContext("USER", [
      scopedRole("SCHOOL_ADMIN", {
        districtId: "district-1",
        schoolId: "school-1",
      }),
    ], [membership("COACH", { teamId: "team-1" })]);

    expect(context.isAdmin).toBe(true);
    expect(context.isSchoolAdmin).toBe(true);
    expect(context.isCoach).toBe(true);
    expect(context.canManageUsers).toBe(true);
    expect(context.canManageTeams).toBe(true);
    expect(context.canManageTeamRequests).toBe(true);
    expect(context.canManageReimbursements).toBe(true);
    expect(context.canReviewReimbursements).toBe(true);
    expect(context.scope.districtIds).toEqual(["district-1"]);
    expect(context.scope.schoolIds).toEqual(["school-1"]);
    expect(context.scope.programIds).toEqual([]);
    expect(context.scope.teamIds).toEqual(["team-1"]);
  });

  it("limits program admins away from user management", () => {
    const context = accessContext("USER", [
      scopedRole("PROGRAM_ADMIN", {
        districtId: "district-1",
        schoolId: "school-1",
        programId: "program-1",
      }),
    ]);

    expect(context.isAdmin).toBe(true);
    expect(context.isProgramAdmin).toBe(true);
    expect(context.canManageUsers).toBe(false);
    expect(context.canManageTeams).toBe(true);
    expect(context.canManageTeamRequests).toBe(true);
    expect(context.canManageReimbursements).toBe(true);
    expect(context.canReviewReimbursements).toBe(true);
    expect(
      canAccessTeam(context, {
        districtId: "district-1",
        schoolId: "school-1",
        programId: "program-1",
      })
    ).toBe(true);
    expect(
      canAccessTeam(context, {
        districtId: "district-1",
        schoolId: "school-9",
        programId: "program-1",
      })
    ).toBe(false);
    expect(
      canAccessTeam(context, {
        districtId: "district-1",
        schoolId: "school-1",
        programId: "program-9",
      })
    ).toBe(false);
  });

  it("gives super admins global access regardless of scoped assignments", () => {
    const context = accessContext("SUPER_ADMIN", []);

    expect(context.isSuperAdmin).toBe(true);
    expect(context.isAdmin).toBe(true);
    expect(context.canManageUsers).toBe(true);
    expect(context.canManageTeams).toBe(true);
    expect(context.canManageTeamRequests).toBe(true);
    expect(context.canManageReimbursements).toBe(true);
    expect(canAccessTeam(context, { schoolId: "school-x", programId: "program-x" })).toBe(true);
  });

  it("treats approved team memberships as the source of truth for team roles", () => {
    const context = accessContext("USER", [], [
      membership("COACH", { teamId: "team-1" }),
      membership("PARENT_MENTOR", { teamId: "team-2" }),
    ]);

    expect(context.isCoach).toBe(true);
    expect(context.isParentMentor).toBe(true);
    expect(context.scope.teamIds).toEqual(["team-1", "team-2"]);
    expect(canAccessTeam(context, { teamId: "team-1" })).toBe(true);
    expect(canAccessTeam(context, { teamId: "team-2" })).toBe(true);
    expect(canAccessTeam(context, { teamId: "team-9" })).toBe(false);
  });

  it("does not grant coach access from deprecated scoped coach rows alone", () => {
    const context = accessContext("USER", [
      scopedRole("COACH", {
        districtId: "district-1",
        schoolId: "school-1",
        programId: "program-1",
        teamId: "team-1",
      }),
    ]);

    expect(context.isCoach).toBe(false);
    expect(context.canReviewReimbursements).toBe(false);
    expect(canAccessTeam(context, { teamId: "team-1" })).toBe(false);
  });
});
