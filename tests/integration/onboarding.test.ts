import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { POST } from "@/app/api/onboarding/complete/route";
import { db } from "@/lib/db";
import { cleanDatabase } from "../helpers/db-clean";
import { createUser, createTeam } from "../helpers/factory";
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

  it("joins team as STUDENT → 200", async () => {
    const user = await createUser();
    const team = await createTeam();
    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status, data } = await callRouteJSON(POST, {
      method: "POST",
      body: { teamId: team.id, roleIntent: "STUDENT" },
    });

    expect(status).toBe(200);
    expect((data as any).membership.teamId).toBe(team.id);
    expect((data as any).membership.roleInTeam).toBe("STUDENT");

    const updated = await db.user.findUnique({ where: { id: user.id } });
    expect(updated!.role).toBe("STUDENT");
    expect(updated!.onboardingDone).toBe(true);
  });

  it("joins team as COACH → 200", async () => {
    const user = await createUser();
    const team = await createTeam();
    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status, data } = await callRouteJSON(POST, {
      method: "POST",
      body: { teamId: team.id, roleIntent: "COACH" },
    });

    expect(status).toBe(200);
    expect((data as any).membership.roleInTeam).toBe("COACH");

    const updated = await db.user.findUnique({ where: { id: user.id } });
    expect(updated!.role).toBe("COACH");
  });

  it("rejects nonexistent team → 400", async () => {
    const user = await createUser();
    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: { teamId: "nonexistent-id", roleIntent: "STUDENT" },
    });
    expect(status).toBe(400);
  });

  it("rejects inactive team → 400", async () => {
    const user = await createUser();
    const team = await createTeam({ active: false });
    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: { teamId: team.id, roleIntent: "STUDENT" },
    });
    expect(status).toBe(400);
  });

  it("rejects missing teamId → 400", async () => {
    const user = await createUser();
    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: { roleIntent: "STUDENT" },
    });
    expect(status).toBe(400);
  });

  it("rejects invalid roleIntent → 400", async () => {
    const user = await createUser();
    const team = await createTeam();
    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: { teamId: team.id, roleIntent: "ADMIN" },
    });
    expect(status).toBe(400);
  });
});
