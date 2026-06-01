import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import {
  GET as getRequests,
  POST as postRequest,
} from "@/app/api/requests/route";
import {
  GET as getRequest,
  DELETE as deleteRequest,
} from "@/app/api/requests/[requestId]/route";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createUser,
  createTeam,
  createMembership,
  createRequest,
} from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

describe("POST /api/requests", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("team member creates draft → 201", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: user.id,
      teamId: team.id,
      roleInTeam: "PARENT_MENTOR",
    });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(postRequest, {
      method: "POST",
      body: { title: "New Request", teamId: team.id },
    });

    expect(status).toBe(201);
    expect((data as any).status).toBe("DRAFT");
    expect((data as any).title).toBe("New Request");
  });

  it("auto-assigns team coach", async () => {
    const user = await createUser({ role: "USER" });
    const coach = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: user.id,
      teamId: team.id,
      roleInTeam: "PARENT_MENTOR",
    });
    await createMembership({
      userId: coach.id,
      teamId: team.id,
      roleInTeam: "COACH",
    });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { data } = await callRouteJSON(postRequest, {
      method: "POST",
      body: { title: "Request", teamId: team.id },
    });

    expect((data as any).coachId).toBe(coach.id);
  });

  it("unauthenticated → 401", async () => {
    const { status } = await callRouteJSON(postRequest, {
      method: "POST",
      body: { title: "Request", teamId: "x" },
    });
    expect(status).toBe(401);
  });

  it("non-member → 403", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(postRequest, {
      method: "POST",
      body: { title: "Request", teamId: team.id },
    });
    expect(status).toBe(403);
  });

  it("missing title → 400", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: user.id,
      teamId: team.id,
      roleInTeam: "PARENT_MENTOR",
    });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(postRequest, {
      method: "POST",
      body: { teamId: team.id },
    });
    expect(status).toBe(400);
  });
});

describe("GET /api/requests", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("returns own requests → 200", async () => {
    const user = await createUser({ role: "USER" });
    const other = await createUser({ role: "USER" });
    const team = await createTeam();
    await createRequest({ teamId: team.id, createdById: user.id });
    await createRequest({ teamId: team.id, createdById: user.id });
    await createRequest({ teamId: team.id, createdById: other.id });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(getRequests);
    expect(status).toBe(200);
    expect((data as any[]).length).toBe(2);
  });

  it("unauthenticated → 401", async () => {
    const { status } = await callRouteJSON(getRequests);
    expect(status).toBe(401);
  });
});

describe("GET /api/requests/[requestId]", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("creator views → 200", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
    });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(
      getRequest,
      {},
      { requestId: req.id }
    );
    expect(status).toBe(200);
    expect((data as any).id).toBe(req.id);
  });

  it("team member (non-creator, non-coach) cannot view → 404", async () => {
    const user = await createUser({ role: "USER" });
    const teammate = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: teammate.id,
      teamId: team.id,
      roleInTeam: "PARENT_MENTOR",
    });
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
    });

    setMockUser({ id: teammate.id, email: teammate.email, role: "USER" });

    const { status } = await callRouteJSON(
      getRequest,
      {},
      { requestId: req.id }
    );
    // IDOR fix: a bare PARENT_MENTOR may not read another member's request, and
    // existence is not leaked (404, not 403).
    expect(status).toBe(404);
  });

  it("non-team-member → 404", async () => {
    const user = await createUser({ role: "USER" });
    const outsider = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
    });

    setMockUser({ id: outsider.id, email: outsider.email, role: "USER" });

    const { status } = await callRouteJSON(
      getRequest,
      {},
      { requestId: req.id }
    );
    expect(status).toBe(404);
  });

  it("nonexistent → 404", async () => {
    const user = await createUser({ role: "USER" });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      getRequest,
      {},
      { requestId: "nonexistent" }
    );
    expect(status).toBe(404);
  });
});

describe("DELETE /api/requests/[requestId]", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("creator deletes draft → 200", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
    });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(
      deleteRequest,
      { method: "DELETE" },
      { requestId: req.id }
    );
    expect(status).toBe(200);
    expect((data as any).deleted).toBe(true);
  });

  it("outsider → 404", async () => {
    const user = await createUser({ role: "USER" });
    const other = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
    });

    setMockUser({ id: other.id, email: other.email, role: "USER" });

    const { status } = await callRouteJSON(
      deleteRequest,
      { method: "DELETE" },
      { requestId: req.id }
    );
    expect(status).toBe(404);
  });

  it("non-draft (SUBMITTED) → 400", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      deleteRequest,
      { method: "DELETE" },
      { requestId: req.id }
    );
    expect(status).toBe(400);
  });

  it("nonexistent → 404", async () => {
    const user = await createUser({ role: "USER" });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      deleteRequest,
      { method: "DELETE" },
      { requestId: "nonexistent" }
    );
    expect(status).toBe(404);
  });
});
