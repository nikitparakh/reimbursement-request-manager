import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { PATCH } from "@/app/api/admin/users/[id]/role/route";
import {
  POST as postUserScope,
  DELETE as deleteUserScope,
} from "@/app/api/admin/users/[id]/scopes/route";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createProgram,
  createSchool,
  createScopedRole,
  createUser,
} from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";
import { db } from "@/lib/db";

describe("PATCH /api/admin/users/[id]/role", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("super admin changes role to USER → 200", async () => {
    const admin = await createUser({ role: "SUPER_ADMIN" });
    const target = await createUser({ role: "USER" });
    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });

    const { status, data } = await callRouteJSON(PATCH, { method: "PATCH", body: { role: "USER" } }, { id: target.id });

    expect(status).toBe(200);
    expect((data as any).role).toBe("USER");
  });

  it("super admin changes role to SUPER_ADMIN → 200", async () => {
    const admin = await createUser({ role: "SUPER_ADMIN" });
    const target = await createUser({ role: "USER" });
    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });

    const { status, data } = await callRouteJSON(PATCH, { method: "PATCH", body: { role: "SUPER_ADMIN" } }, { id: target.id });

    expect(status).toBe(200);
    expect((data as any).role).toBe("SUPER_ADMIN");
  });

  it("user → 403", async () => {
    const user = await createUser({ role: "USER" });
    const target = await createUser({ role: "USER" });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      PATCH,
      { method: "PATCH", body: { role: "SUPER_ADMIN" } },
      { id: target.id }
    );
    expect(status).toBe(403);
  });

  it("coach → 403", async () => {
    const coach = await createUser({ role: "USER" });
    const target = await createUser({ role: "USER" });
    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const { status } = await callRouteJSON(
      PATCH,
      { method: "PATCH", body: { role: "SUPER_ADMIN" } },
      { id: target.id }
    );
    expect(status).toBe(403);
  });

  it("invalid role → 400", async () => {
    const admin = await createUser({ role: "SUPER_ADMIN" });
    const target = await createUser({ role: "USER" });
    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });

    const { status } = await callRouteJSON(
      PATCH,
      { method: "PATCH", body: { role: "SUPERADMIN" } },
      { id: target.id }
    );
    expect(status).toBe(400);
  });
});

describe("POST /api/admin/users/[id]/scopes", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("school admin assigns a program admin within a managed school → 201", async () => {
    const schoolAdmin = await createUser();
    const target = await createUser();
    const school = await createSchool();
    const program = await createProgram({ code: "FTC" });
    await createScopedRole({
      userId: schoolAdmin.id,
      role: "SCHOOL_ADMIN",
      districtId: school.districtId,
      schoolId: school.id,
    });

    setMockUser({ id: schoolAdmin.id, email: schoolAdmin.email, role: "USER" });

    const { status, data } = await callRouteJSON(
      postUserScope,
      {
        method: "POST",
        body: {
          role: "PROGRAM_ADMIN",
          schoolId: school.id,
          programId: program.id,
        },
      },
      { id: target.id }
    );

    expect(status).toBe(201);
    expect((data as { role: string }).role).toBe("PROGRAM_ADMIN");

    const scope = await db.userScopeRole.findFirst({
      where: { userId: target.id, role: "PROGRAM_ADMIN" },
    });
    expect(scope?.schoolId).toBe(school.id);
    expect(scope?.programId).toBe(program.id);
  });

  it("school admin cannot assign a program admin outside their school → 403", async () => {
    const schoolAdmin = await createUser();
    const target = await createUser();
    const managedSchool = await createSchool();
    const otherSchool = await createSchool();
    const program = await createProgram({ code: "FTC" });
    await createScopedRole({
      userId: schoolAdmin.id,
      role: "SCHOOL_ADMIN",
      districtId: managedSchool.districtId,
      schoolId: managedSchool.id,
    });

    setMockUser({ id: schoolAdmin.id, email: schoolAdmin.email, role: "USER" });

    const { status } = await callRouteJSON(
      postUserScope,
      {
        method: "POST",
        body: {
          role: "PROGRAM_ADMIN",
          schoolId: otherSchool.id,
          programId: program.id,
        },
      },
      { id: target.id }
    );

    expect(status).toBe(403);
  });

  it("prevents duplicate scoped role rows at the database layer", async () => {
    const target = await createUser();
    const school = await createSchool();
    const program = await createProgram({ code: "FTC" });

    await createScopedRole({
      userId: target.id,
      role: "PROGRAM_ADMIN",
      districtId: school.districtId,
      schoolId: school.id,
      programId: program.id,
    });

    await expect(
      createScopedRole({
        userId: target.id,
        role: "PROGRAM_ADMIN",
        districtId: school.districtId,
        schoolId: school.id,
        programId: program.id,
      })
    ).rejects.toThrow();
  });
});

describe("DELETE /api/admin/users/[id]/scopes", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("school admin removes a program admin assignment in their school → 200", async () => {
    const schoolAdmin = await createUser();
    const target = await createUser();
    const school = await createSchool();
    const program = await createProgram({ code: "FTC" });
    await createScopedRole({
      userId: schoolAdmin.id,
      role: "SCHOOL_ADMIN",
      districtId: school.districtId,
      schoolId: school.id,
    });
    const scope = await createScopedRole({
      userId: target.id,
      role: "PROGRAM_ADMIN",
      districtId: school.districtId,
      schoolId: school.id,
      programId: program.id,
    });

    setMockUser({ id: schoolAdmin.id, email: schoolAdmin.email, role: "USER" });

    const { status } = await callRouteJSON(
      deleteUserScope,
      {
        method: "DELETE",
        body: { scopeId: scope.id },
      },
      { id: target.id }
    );

    expect(status).toBe(200);
    expect(await db.userScopeRole.findUnique({ where: { id: scope.id } })).toBeNull();
  });
});
