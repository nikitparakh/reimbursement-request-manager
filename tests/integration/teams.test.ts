import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import {
  GET as getTeams,
  POST as postTeam,
} from "@/app/api/teams/route";
import { POST as postRegistrationRequest } from "@/app/api/teams/registration-requests/route";
import { db } from "@/lib/db";
import { cleanDatabase } from "../helpers/db-clean";
import { createUser, createTeam } from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

describe("GET /api/teams", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("returns active teams → 200", async () => {
    await createTeam({ name: "Active Team" });
    await createTeam({ name: "Another Team" });

    const { status, data } = await callRouteJSON(getTeams);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect((data as any[]).length).toBe(2);
  });

  it("excludes inactive teams", async () => {
    await createTeam({ name: "Active" });
    await createTeam({ name: "Inactive", active: false });

    const { status, data } = await callRouteJSON(getTeams);
    expect(status).toBe(200);
    expect((data as any[]).length).toBe(1);
    expect((data as any[])[0].name).toBe("Active");
  });
});

describe("POST /api/teams", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("admin creates team → 201", async () => {
    const admin = await createUser({ role: "ADMIN" });
    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });

    const { status, data } = await callRouteJSON(postTeam, {
      method: "POST",
      body: { name: "New Team", shortCode: "NT" },
    });
    expect(status).toBe(201);
    expect((data as any).name).toBe("New Team");
  });

  it("student → 403", async () => {
    const student = await createUser({ role: "STUDENT" });
    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });

    const { status } = await callRouteJSON(postTeam, {
      method: "POST",
      body: { name: "New Team" },
    });
    expect(status).toBe(403);
  });

  it("manager → 403", async () => {
    const manager = await createUser({ role: "MANAGER" });
    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });

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
    const admin = await createUser({ role: "ADMIN" });
    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });

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
    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status, data } = await callRouteJSON(postRegistrationRequest, {
      method: "POST",
      body: { teamName: "My New Team" },
    });
    expect(status).toBe(201);
    expect((data as any).status).toBe("PENDING");
    expect((data as any).teamName).toBe("My New Team");
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
    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status } = await callRouteJSON(postRegistrationRequest, {
      method: "POST",
      body: {},
    });
    expect(status).toBe(400);
  });
});
