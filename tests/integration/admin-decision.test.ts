import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { POST } from "@/app/api/requests/[requestId]/admin-decision/route";
import { db } from "@/lib/db";
import { cleanDatabase } from "../helpers/db-clean";
import { createUser, createTeam, createRequest } from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

describe("POST /api/requests/[requestId]/admin-decision", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("admin approves COACH_APPROVED → 200, status=ADMIN_APPROVED", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const user = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "COACH_APPROVED",
    });

    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });

    const { status, data } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );

    expect(status).toBe(200);
    expect((data as any).status).toBe("ADMIN_APPROVED");
  });

  it("admin rejects with comment → 200, status=ADMIN_REJECTED", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const user = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "COACH_APPROVED",
    });

    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });

    const { status, data } = await callRouteJSON(
      POST,
      {
        method: "POST",
        body: { decision: "REJECT", comment: "Budget exceeded" },
      },
      { requestId: req.id }
    );

    expect(status).toBe(200);
    expect((data as any).status).toBe("ADMIN_REJECTED");
  });

  it("reject without comment → 400", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const user = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "COACH_APPROVED",
    });

    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "REJECT" } },
      { requestId: req.id }
    );
    expect(status).toBe(400);
  });

  it("admin marks ADMIN_APPROVED as PAID → 200", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const user = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "ADMIN_APPROVED",
    });

    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });

    const { status, data } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "MARK_PAID" } },
      { requestId: req.id }
    );

    expect(status).toBe(200);
    expect((data as any).status).toBe("PAID");
  });

  it("user → 403", async () => {
    const user = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "COACH_APPROVED",
    });

    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );
    expect(status).toBe(403);
  });

  it("coach → 403", async () => {
    const coach = await createUser({ role: "COACH" });
    const user = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "COACH_APPROVED",
    });

    setMockUser({ id: coach.id, email: coach.email, role: "COACH" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );
    expect(status).toBe(403);
  });

  it("wrong starting status → throws (assertTransition)", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const user = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "DRAFT",
    });

    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });

    await expect(
      callRouteJSON(
        POST,
        { method: "POST", body: { decision: "APPROVE" } },
        { requestId: req.id }
      )
    ).rejects.toThrow("Invalid status transition");
  });

  it("nonexistent → 404", async () => {
    const admin = await createUser({ role: "ADMIN" });
    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: "nonexistent" }
    );
    expect(status).toBe(404);
  });

  it("creates ApprovalAction + AuditLog", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const user = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "COACH_APPROVED",
    });

    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });
    await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );

    const approval = await db.approvalAction.findFirst({
      where: { requestId: req.id },
    });
    expect(approval!.action).toBe("APPROVE");
    expect(approval!.actorId).toBe(admin.id);

    const log = await db.auditLog.findFirst({
      where: { requestId: req.id },
    });
    expect(log!.eventType).toBe("REQUEST_STATUS_UPDATED");
  });
});
