import { beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { schools, teamMemberships, userScopeRoles } from "@/db/schema";
import { cleanupLegacyTeamScopedRoles } from "../../scripts/seed-cleanup";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createMembership,
  createScopedRole,
  createScopedRoleForTeam,
  createTeam,
  createUser,
} from "../helpers/factory";

describe("seed cleanup", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("removes legacy team scoped roles while preserving memberships and admin scopes", async () => {
    const team = await createTeam();
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, team.schoolId),
    });
    if (!school) throw new Error("School not found");

    const parentMentor = await createUser();
    const coach = await createUser();
    const programAdmin = await createUser();

    await createMembership({
      userId: parentMentor.id,
      teamId: team.id,
      roleInTeam: "PARENT_MENTOR",
    });
    await createMembership({
      userId: coach.id,
      teamId: team.id,
      roleInTeam: "COACH",
    });

    await createScopedRoleForTeam({
      userId: parentMentor.id,
      teamId: team.id,
      role: "PARENT_MENTOR",
    });
    await createScopedRoleForTeam({
      userId: coach.id,
      teamId: team.id,
      role: "COACH",
    });
    await createScopedRole({
      userId: programAdmin.id,
      role: "PROGRAM_ADMIN",
      districtId: school.districtId,
      schoolId: school.id,
      programId: team.programId,
    });

    const result = await cleanupLegacyTeamScopedRoles(db);

    expect(result.count).toBe(2);
    expect(
      await db.$count(
        userScopeRoles,
        inArray(userScopeRoles.role, ["COACH", "PARENT_MENTOR"]),
      ),
    ).toBe(0);
    expect(
      await db.$count(
        teamMemberships,
        and(
          eq(teamMemberships.userId, parentMentor.id),
          eq(teamMemberships.teamId, team.id),
          eq(teamMemberships.roleInTeam, "PARENT_MENTOR"),
          eq(teamMemberships.approved, true),
        ),
      ),
    ).toBe(1);
    expect(
      await db.$count(
        teamMemberships,
        and(
          eq(teamMemberships.userId, coach.id),
          eq(teamMemberships.teamId, team.id),
          eq(teamMemberships.roleInTeam, "COACH"),
          eq(teamMemberships.approved, true),
        ),
      ),
    ).toBe(1);
    expect(
      await db.$count(
        userScopeRoles,
        and(
          eq(userScopeRoles.userId, programAdmin.id),
          eq(userScopeRoles.role, "PROGRAM_ADMIN"),
        ),
      ),
    ).toBe(1);
  });
});
