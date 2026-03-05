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

  it("admin changes role to COACH → 200", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const target = await createUser({ role: "STUDENT" });
    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });

    const { status, data } = await callRouteJSON(
      PATCH,
      { method: "PATCH", body: { role: "COACH" } },
      { id: target.id }
    );

    expect(status).toBe(200);
    expect((data as any).role).toBe("COACH");
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

  it("user → 403", async () => {
    const user = await createUser({ role: "STUDENT" });
    const target = await createUser({ role: "STUDENT" });
    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status } = await callRouteJSON(
      PATCH,
      { method: "PATCH", body: { role: "ADMIN" } },
      { id: target.id }
    );
    expect(status).toBe(403);
  });

  it("coach → 403", async () => {
    const coach = await createUser({ role: "COACH" });
    const target = await createUser({ role: "STUDENT" });
    setMockUser({ id: coach.id, email: coach.email, role: "COACH" });

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
