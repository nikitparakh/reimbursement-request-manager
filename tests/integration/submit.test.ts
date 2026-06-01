import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { eq } from "drizzle-orm";
import { POST } from "@/app/api/requests/[requestId]/submit/route";
import { db } from "@/lib/db";
import { approvalActions, auditLogs } from "@/db/schema";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createUser,
  createTeam,
  createMembership,
  createRequest,
} from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

describe("POST /api/requests/[requestId]/submit", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("user submits draft → 200, status=SUBMITTED", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: user.id,
      teamId: team.id,
      roleInTeam: "PARENT_MENTOR",
    });
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
    });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(
      POST,
      { method: "POST" },
      { requestId: req.id }
    );

    expect(status).toBe(200);
    expect((data as any).status).toBe("SUBMITTED");
    expect((data as any).submittedAt).toBeTruthy();
  });

  it("creates ApprovalAction with action=SUBMIT", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
    });

    setMockUser({ id: user.id, email: user.email, role: "USER" });
    await callRouteJSON(POST, { method: "POST" }, { requestId: req.id });

    const approval = await db.query.approvalActions.findFirst({
      where: eq(approvalActions.requestId, req.id),
    });
    expect(approval).toBeTruthy();
    expect(approval!.action).toBe("SUBMIT");
    expect(approval!.actorId).toBe(user.id);
  });

  it("creates AuditLog entry", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
    });

    setMockUser({ id: user.id, email: user.email, role: "USER" });
    await callRouteJSON(POST, { method: "POST" }, { requestId: req.id });

    const log = await db.query.auditLogs.findFirst({
      where: eq(auditLogs.requestId, req.id),
    });
    expect(log).toBeTruthy();
    expect(log!.eventType).toBe("REQUEST_STATUS_UPDATED");
  });

  it("non-creator → 404", async () => {
    const user = await createUser({ role: "USER" });
    const other = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
    });

    setMockUser({ id: other.id, email: other.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST" },
      { requestId: req.id }
    );
    expect(status).toBe(404);
  });

  it("already submitted → throws (assertTransition)", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    await expect(
      callRouteJSON(POST, { method: "POST" }, { requestId: req.id })
    ).rejects.toThrow("Invalid status transition");
  });

  it("nonexistent → 404", async () => {
    const user = await createUser({ role: "USER" });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST" },
      { requestId: "nonexistent" }
    );
    expect(status).toBe(404);
  });
});
