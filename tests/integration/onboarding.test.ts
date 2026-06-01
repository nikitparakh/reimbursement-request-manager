import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { POST } from "@/app/api/onboarding/complete/route";
import { db } from "@/lib/db";
import { schools, users, userScopeRoles } from "@/db/schema";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createUser,
  createTeam,
  createMembership,
  createScopedRoleForTeam,
} from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

describe("POST /api/onboarding/complete", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("rejects unauthenticated → 401", async () => {
    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: { teamId: "x", roleIntent: "STUDENT" },
    });
    expect(status).toBe(401);
  });

  it("joins team as parent mentor → 200 without creating scoped access rows", async () => {
    const user = await createUser();
    const team = await createTeam();
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, team.schoolId),
    });
    if (!school) throw new Error("School not found");
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(POST, {
      method: "POST",
      body: {
        districtId: school.districtId,
        schoolId: team.schoolId,
        programId: team.programId,
        teamId: team.id,
        roleIntent: "PARENT_MENTOR",
      },
    });

    expect(status).toBe(200);
    expect((data as any).membership.teamId).toBe(team.id);
    expect((data as any).membership.roleInTeam).toBe("PARENT_MENTOR");
    expect((data as any).scopedRole).toBeUndefined();

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    expect(updated!.role).toBe("USER");
    expect(updated!.onboardingDone).toBe(true);
    expect(
      await db.$count(userScopeRoles, eq(userScopeRoles.userId, user.id))
    ).toBe(0);
  });

  it("joins team as coach → 200 without creating scoped access rows", async () => {
    const user = await createUser();
    const team = await createTeam();
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, team.schoolId),
    });
    if (!school) throw new Error("School not found");
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(POST, {
      method: "POST",
      body: {
        districtId: school.districtId,
        schoolId: team.schoolId,
        programId: team.programId,
        teamId: team.id,
        roleIntent: "COACH",
      },
    });

    expect(status).toBe(200);
    expect((data as any).membership.roleInTeam).toBe("COACH");
    expect((data as any).scopedRole).toBeUndefined();

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    expect(updated!.role).toBe("USER");
    expect(
      await db.$count(userScopeRoles, eq(userScopeRoles.userId, user.id))
    ).toBe(0);
  });

  it("rejects replay after onboarding is already complete → 409", async () => {
    const user = await createUser({ onboardingDone: true });
    const team = await createTeam();
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, team.schoolId),
    });
    if (!school) throw new Error("School not found");
    await createMembership({
      userId: user.id,
      teamId: team.id,
      roleInTeam: "PARENT_MENTOR",
    });
    await createScopedRoleForTeam({
      userId: user.id,
      teamId: team.id,
      role: "PARENT_MENTOR",
    });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const beforeCount = await db.$count(
      userScopeRoles,
      and(
        eq(userScopeRoles.userId, user.id),
        eq(userScopeRoles.teamId, team.id),
        eq(userScopeRoles.role, "PARENT_MENTOR")
      )
    );

    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: {
        districtId: school.districtId,
        schoolId: team.schoolId,
        programId: team.programId,
        teamId: team.id,
        roleIntent: "PARENT_MENTOR",
      },
    });

    const afterCount = await db.$count(
      userScopeRoles,
      and(
        eq(userScopeRoles.userId, user.id),
        eq(userScopeRoles.teamId, team.id),
        eq(userScopeRoles.role, "PARENT_MENTOR")
      )
    );

    expect(status).toBe(409);
    expect(afterCount).toBe(beforeCount);
  });

  it("rejects nonexistent team → 400", async () => {
    const user = await createUser();
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: {
        districtId: "nonexistent-id",
        schoolId: "nonexistent-id",
        programId: "nonexistent-id",
        teamId: "nonexistent-id",
        roleIntent: "PARENT_MENTOR",
      },
    });
    expect(status).toBe(400);
  });

  it("rejects inactive team → 400", async () => {
    const user = await createUser();
    const team = await createTeam({ active: false });
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, team.schoolId),
    });
    if (!school) throw new Error("School not found");
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: {
        districtId: school.districtId,
        schoolId: team.schoolId,
        programId: team.programId,
        teamId: team.id,
        roleIntent: "PARENT_MENTOR",
      },
    });
    expect(status).toBe(400);
  });

  it("rejects missing teamId → 400", async () => {
    const user = await createUser();
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: { roleIntent: "PARENT_MENTOR" },
    });
    expect(status).toBe(400);
  });

  it("rejects invalid roleIntent → 400", async () => {
    const user = await createUser();
    const team = await createTeam();
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, team.schoolId),
    });
    if (!school) throw new Error("School not found");
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: {
        districtId: school.districtId,
        schoolId: team.schoolId,
        programId: team.programId,
        teamId: team.id,
        roleIntent: "ADMIN",
      },
    });
    expect(status).toBe(400);
  });
});
