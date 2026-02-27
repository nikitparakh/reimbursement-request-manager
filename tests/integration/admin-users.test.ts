import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { PATCH } from "@/app/api/admin/users/[id]/role/route";
import { cleanDatabase } from "../helpers/db-clean";
import { createUser } from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

describe("PATCH /api/admin/users/[id]/role", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("admin changes role to MANAGER → 200", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const target = await createUser({ role: "STUDENT" });
    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });

    const { status, data } = await callRouteJSON(
      PATCH,
      { method: "PATCH", body: { role: "MANAGER" } },
      { id: target.id }
    );

    expect(status).toBe(200);
    expect((data as any).role).toBe("MANAGER");
  });

  it("admin changes role to ADMIN → 200", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const target = await createUser({ role: "STUDENT" });
    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });

    const { status, data } = await callRouteJSON(
      PATCH,
      { method: "PATCH", body: { role: "ADMIN" } },
      { id: target.id }
    );

    expect(status).toBe(200);
    expect((data as any).role).toBe("ADMIN");
  });

  it("student → 403", async () => {
    const student = await createUser({ role: "STUDENT" });
    const target = await createUser({ role: "STUDENT" });
    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });

    const { status } = await callRouteJSON(
      PATCH,
      { method: "PATCH", body: { role: "ADMIN" } },
      { id: target.id }
    );
    expect(status).toBe(403);
  });

  it("manager → 403", async () => {
    const manager = await createUser({ role: "MANAGER" });
    const target = await createUser({ role: "STUDENT" });
    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });

    const { status } = await callRouteJSON(
      PATCH,
      { method: "PATCH", body: { role: "ADMIN" } },
      { id: target.id }
    );
    expect(status).toBe(403);
  });

  it("invalid role → 400", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const target = await createUser({ role: "STUDENT" });
    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });

    const { status } = await callRouteJSON(
      PATCH,
      { method: "PATCH", body: { role: "SUPERADMIN" } },
      { id: target.id }
    );
    expect(status).toBe(400);
  });
});
