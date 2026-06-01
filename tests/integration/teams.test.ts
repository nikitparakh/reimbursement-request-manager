import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import {
  GET as getTeams,
  POST as postTeam,
} from "@/app/api/teams/route";
import { DELETE as deleteMembership } from "@/app/api/admin/teams/[teamId]/members/[membershipId]/route";
import { POST as postRegistrationRequest } from "@/app/api/teams/registration-requests/route";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { programs, districts, teamMemberships, userScopeRoles } from "@/db/schema";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createDistrict,
  createUser,
  createTeam,
  createProgram,
  createSchool,
  createMembership,
  createScopedRoleForTeam,
} from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

describe("GET /api/teams", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("returns filtered active teams for a selected school/program → 200", async () => {
    const user = await createUser({ role: "USER" });
    const school = await createSchool();
    const otherSchool = await createSchool();
    const program = await createProgram({ code: "FTC" });
    const otherProgram = await createProgram({ code: "FRC" });
    await createTeam({
      name: "Active Team",
      schoolId: school.id,
      programId: program.id,
    });
    await createTeam({
      name: "Inactive Team",
      schoolId: school.id,
      programId: program.id,
      active: false,
    });
    await createTeam({
      name: "Wrong Program",
      schoolId: school.id,
      programId: otherProgram.id,
    });
    await createTeam({
      name: "Wrong School",
      schoolId: otherSchool.id,
      programId: program.id,
    });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(getTeams as any, {
      url: `http://localhost:3000/test?schoolId=${school.id}&programId=${program.id}`,
    });
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect((data as any[])).toHaveLength(1);
    expect((data as any[])[0].name).toBe("Active Team");
  });

  it("requires school/program filters for non-admin users", async () => {
    const user = await createUser({ role: "USER" });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(getTeams);
    expect(status).toBe(400);
    expect((data as { error: string }).error).toContain("school");
  });

  it("allows super admins to list active teams without filters", async () => {
    const admin = await createUser({ role: "SUPER_ADMIN" });
    await createTeam({ name: "Active Team" });
    await createTeam({ name: "Inactive Team", active: false });
    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });

    const { status, data } = await callRouteJSON(getTeams);
    expect(status).toBe(200);
    expect((data as any[])).toHaveLength(1);
    expect((data as any[])[0].name).toBe("Active Team");
  });

  it("requires authentication → 401", async () => {
    await createTeam({ name: "Active Team" });

    const { status } = await callRouteJSON(getTeams);
    expect(status).toBe(401);
  });
});

describe("POST /api/teams", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("admin creates team → 201", async () => {
    const admin = await createUser({ role: "SUPER_ADMIN" });
    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });
    const school = await createSchool();
    const program = await createProgram({ code: "FTC" });
    await db.update(programs).set({ name: `Program ${program.id}` }).where(eq(programs.id, program.id));

    const { status, data } = await callRouteJSON(postTeam, {
      method: "POST",
      body: { name: "New Team", shortCode: "NT1", schoolId: school.id, programId: program.id },
    });
    expect(status).toBe(201);
    expect((data as any).name).toBe("New Team");
  });

  it("requires explicit school/program context → 400", async () => {
    const admin = await createUser({ role: "SUPER_ADMIN" });
    await createSchool();
    await createProgram({ code: "FTC" });
    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });

    const { status } = await callRouteJSON(postTeam, {
      method: "POST",
      body: { name: "Contextless Team" },
    });

    expect(status).toBe(400);
  });

  it("user → 403", async () => {
    const user = await createUser({ role: "USER" });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(postTeam, {
      method: "POST",
      body: { name: "New Team" },
    });
    expect(status).toBe(403);
  });

  it("coach → 403", async () => {
    const coach = await createUser({ role: "USER" });
    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const { status } = await callRouteJSON(postTeam, {
      method: "POST",
      body: { name: "New Team" },
    });
    expect(status).toBe(403);
  });

  it("unauthenticated → 403", async () => {
    const { status } = await callRouteJSON(postTeam, {
      method: "POST",
      body: { name: "New Team" },
    });
    expect(status).toBe(403);
  });

  it("missing name → 400", async () => {
    const admin = await createUser({ role: "SUPER_ADMIN" });
    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });

    const { status } = await callRouteJSON(postTeam, {
      method: "POST",
      body: { shortCode: "NT" },
    });
    expect(status).toBe(400);
  });
});

describe("POST /api/teams/registration-requests", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("authenticated user requests team → 201", async () => {
    const user = await createUser();
    setMockUser({ id: user.id, email: user.email, role: "USER" });
    const school = await createSchool();
    const program = await createProgram({ code: "FTC" });
    const district = await db.query.districts.findFirst({ where: eq(districts.id, school.districtId) });
    if (!district) throw new Error("District not found");

    const { status, data } = await callRouteJSON(postRegistrationRequest, {
      method: "POST",
      body: {
        districtId: district.id,
        schoolId: school.id,
        programId: program.id,
        teamName: "My New Team",
      },
    });
    expect(status).toBe(201);
    expect((data as any).status).toBe("PENDING");
    expect((data as any).teamName).toBe("My New Team");
  });

  it("rejects mismatched district and school selections → 400", async () => {
    const user = await createUser();
    const school = await createSchool();
    const otherDistrict = await createDistrict();
    const program = await createProgram({ code: "FTC" });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(postRegistrationRequest, {
      method: "POST",
      body: {
        districtId: otherDistrict.id,
        schoolId: school.id,
        programId: program.id,
        teamName: "Mismatched Team",
      },
    });

    expect(status).toBe(400);
  });

  it("unauthenticated → 401", async () => {
    const { status } = await callRouteJSON(postRegistrationRequest, {
      method: "POST",
      body: { teamName: "My New Team" },
    });
    expect(status).toBe(401);
  });

  it("missing teamName → 400", async () => {
    const user = await createUser();
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(postRegistrationRequest, {
      method: "POST",
      body: {},
    });
    expect(status).toBe(400);
  });
});

describe("DELETE /api/admin/teams/[teamId]/members/[membershipId]", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("removes the matching team scoped role with the membership", async () => {
    const admin = await createUser({ role: "SUPER_ADMIN" });
    const member = await createUser({ role: "USER" });
    const team = await createTeam();
    const membership = await createMembership({
      userId: member.id,
      teamId: team.id,
      roleInTeam: "COACH",
    });
    const scopedRole = await createScopedRoleForTeam({
      userId: member.id,
      teamId: team.id,
      role: "COACH",
    });

    // A team must always retain at least one coach, so seed a second coach that
    // survives the removal (otherwise the last-coach guard returns 409).
    const otherCoach = await createUser({ role: "USER" });
    await createMembership({
      userId: otherCoach.id,
      teamId: team.id,
      roleInTeam: "COACH",
    });
    await createScopedRoleForTeam({
      userId: otherCoach.id,
      teamId: team.id,
      role: "COACH",
    });

    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });

    const { status, data } = await callRouteJSON(
      deleteMembership,
      { method: "DELETE" },
      { teamId: team.id, membershipId: membership.id }
    );

    expect(status).toBe(200);
    expect((data as any).ok).toBe(true);
    expect(
      await db.query.teamMemberships.findFirst({ where: eq(teamMemberships.id, membership.id) })
    ).toBeUndefined();
    expect(
      await db.query.userScopeRoles.findFirst({ where: eq(userScopeRoles.id, scopedRole.id) })
    ).toBeUndefined();
  });
});
