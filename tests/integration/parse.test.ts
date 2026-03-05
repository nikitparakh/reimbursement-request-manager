import { describe, it, expect, beforeEach, vi } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createUser,
  createTeam,
  createMembership,
  createRequest,
  createReceipt,
} from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

vi.mock("@/lib/jobs/process-receipt", () => ({
  processReceipt: vi.fn(async () => {}),
  recomputeRequestTotal: vi.fn(async () => {}),
}));

const { POST } = await import("@/app/api/requests/[requestId]/parse/route");

describe("POST /api/requests/[requestId]/parse", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
    vi.clearAllMocks();
  });

  it("processes QUEUED receipts → 200", async () => {
    const user = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    await createMembership({ userId: user.id, teamId: team.id, roleInTeam: "STUDENT" });
    const req = await createRequest({ teamId: team.id, createdById: user.id });
    await createReceipt({ requestId: req.id, parseStatus: "QUEUED" });
    await createReceipt({ requestId: req.id, parseStatus: "QUEUED" });

    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status, data } = await callRouteJSON(POST, { method: "POST" }, { requestId: req.id });
    expect(status).toBe(200);
    expect((data as { queued: number }).queued).toBe(2);
  });

  it("processes FAILED receipts (retry) → 200", async () => {
    const user = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    await createMembership({ userId: user.id, teamId: team.id, roleInTeam: "STUDENT" });
    const req = await createRequest({ teamId: team.id, createdById: user.id });
    await createReceipt({ requestId: req.id, parseStatus: "FAILED" });

    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status, data } = await callRouteJSON(POST, { method: "POST" }, { requestId: req.id });
    expect(status).toBe(200);
    expect((data as { queued: number }).queued).toBe(1);
  });

  it("returns queued=0 when no parseable receipts", async () => {
    const user = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    await createMembership({ userId: user.id, teamId: team.id, roleInTeam: "STUDENT" });
    const req = await createRequest({ teamId: team.id, createdById: user.id });
    await createReceipt({ requestId: req.id, parseStatus: "DONE" });

    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status, data } = await callRouteJSON(POST, { method: "POST" }, { requestId: req.id });
    expect(status).toBe(200);
    expect((data as { queued: number }).queued).toBe(0);
  });

  it("unauthenticated → 401", async () => {
    const { status } = await callRouteJSON(POST, { method: "POST" }, { requestId: "any" });
    expect(status).toBe(401);
  });

  it("non-owner → 404", async () => {
    const user = await createUser({ role: "STUDENT" });
    const other = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({ teamId: team.id, createdById: user.id });

    setMockUser({ id: other.id, email: other.email, role: "STUDENT" });

    const { status } = await callRouteJSON(POST, { method: "POST" }, { requestId: req.id });
    expect(status).toBe(404);
  });
});
