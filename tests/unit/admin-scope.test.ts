import { describe, expect, it } from "vitest";
import type { GlobalRole, ScopedRole } from "@prisma/client";
import { buildAccessContext } from "@/lib/access";
import {
  buildManagedReimbursementWhere,
  buildManagedTeamRegistrationWhere,
  buildManagedTeamWhere,
} from "@/lib/admin-scope";

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

function accessContext(globalRole: GlobalRole, scopedRoles: ReturnType<typeof scopedRole>[]) {
  return buildAccessContext({
    userId: "user-1",
    globalRole,
    scopedRoles,
  });
}

describe("admin scope helpers", () => {
  it("gives super admins unscoped filters", () => {
    const context = accessContext("SUPER_ADMIN", []);

    expect(buildManagedTeamWhere(context)).toEqual({});
    expect(buildManagedTeamRegistrationWhere(context)).toEqual({});
    expect(buildManagedReimbursementWhere(context)).toEqual({});
  });

  it("builds school-admin filters from school scope", () => {
    const context = accessContext("USER", [
      scopedRole("SCHOOL_ADMIN", {
        districtId: "district-1",
        schoolId: "school-1",
      }),
    ]);

    expect(buildManagedTeamWhere(context)).toEqual({
      OR: [{ schoolId: "school-1" }],
    });
    expect(buildManagedTeamRegistrationWhere(context)).toEqual({
      OR: [{ districtId: "district-1", schoolId: "school-1" }],
    });
    expect(buildManagedReimbursementWhere(context)).toEqual({
      OR: [{ team: { schoolId: "school-1" } }],
    });
  });

  it("keeps program-admin filters scoped to the assigned school-program pair", () => {
    const context = accessContext("USER", [
      scopedRole("PROGRAM_ADMIN", {
        districtId: "district-1",
        schoolId: "school-1",
        programId: "program-1",
      }),
    ]);

    expect(buildManagedTeamWhere(context)).toEqual({
      OR: [{ schoolId: "school-1", programId: "program-1" }],
    });
    expect(buildManagedTeamRegistrationWhere(context)).toEqual({
      OR: [
        {
          districtId: "district-1",
          schoolId: "school-1",
          programId: "program-1",
        },
      ],
    });
    expect(buildManagedReimbursementWhere(context)).toEqual({
      OR: [{ team: { schoolId: "school-1", programId: "program-1" } }],
    });
  });
});
