import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { cleanupLegacyTeamScopedRoles } from "../../prisma/seed-cleanup";
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
    const school = await db.school.findUniqueOrThrow({
      where: { id: team.schoolId },
    });

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
      await db.userScopeRole.count({
        where: { role: { in: ["COACH", "PARENT_MENTOR"] } },
      }),
    ).toBe(0);
    expect(
      await db.teamMembership.count({
        where: {
          userId: parentMentor.id,
          teamId: team.id,
          roleInTeam: "PARENT_MENTOR",
          approved: true,
        },
      }),
    ).toBe(1);
    expect(
      await db.teamMembership.count({
        where: {
          userId: coach.id,
          teamId: team.id,
          roleInTeam: "COACH",
          approved: true,
        },
      }),
    ).toBe(1);
    expect(
      await db.userScopeRole.count({
        where: {
          userId: programAdmin.id,
          role: "PROGRAM_ADMIN",
        },
      }),
    ).toBe(1);
  });
});
