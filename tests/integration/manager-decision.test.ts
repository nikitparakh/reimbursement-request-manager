import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { POST } from "@/app/api/requests/[requestId]/manager-decision/route";
import { db } from "@/lib/db";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createUser,
  createTeam,
  createMembership,
  createRequest,
} from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

describe("POST /api/requests/[requestId]/manager-decision", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("manager approves SUBMITTED → 200, status=MANAGER_APPROVED", async () => {
    const manager = await createUser({ role: "MANAGER" });
    const student = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    await createMembership({
      userId: manager.id,
      teamId: team.id,
      roleInTeam: "MANAGER",
    });
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      managerId: manager.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });

    const { status, data } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );

    expect(status).toBe(200);
    expect((data as any).status).toBe("MANAGER_APPROVED");
  });

  it("manager rejects with comment → 200, status=MANAGER_REJECTED", async () => {
    const manager = await createUser({ role: "MANAGER" });
    const student = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    await createMembership({
      userId: manager.id,
      teamId: team.id,
      roleInTeam: "MANAGER",
    });
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      managerId: manager.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });

    const { status, data } = await callRouteJSON(
      POST,
      {
        method: "POST",
        body: { decision: "REJECT", comment: "Needs more detail" },
      },
      { requestId: req.id }
    );

    expect(status).toBe(200);
    expect((data as any).status).toBe("MANAGER_REJECTED");
  });

  it("reject without comment → 400", async () => {
    const manager = await createUser({ role: "MANAGER" });
    const student = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    await createMembership({
      userId: manager.id,
      teamId: team.id,
      roleInTeam: "MANAGER",
    });
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "REJECT" } },
      { requestId: req.id }
    );
    expect(status).toBe(400);
  });

  it("admin can also decide → 200", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const student = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });

    const { status, data } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );
    expect(status).toBe(200);
    expect((data as any).status).toBe("MANAGER_APPROVED");
  });

  it("student → 403", async () => {
    const student = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );
    expect(status).toBe(403);
  });

  it("manager not on this team → 403", async () => {
    const manager = await createUser({ role: "MANAGER" });
    const student = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const otherTeam = await createTeam();
    // Manager is member of otherTeam, not the request's team
    await createMembership({
      userId: manager.id,
      teamId: otherTeam.id,
      roleInTeam: "MANAGER",
    });
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );
    expect(status).toBe(403);
  });

  it("non-SUBMITTED request → throws (assertTransition)", async () => {
    const manager = await createUser({ role: "MANAGER" });
    const student = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    await createMembership({
      userId: manager.id,
      teamId: team.id,
      roleInTeam: "MANAGER",
    });
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      status: "DRAFT",
    });

    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });

    await expect(
      callRouteJSON(
        POST,
        { method: "POST", body: { decision: "APPROVE" } },
        { requestId: req.id }
      )
    ).rejects.toThrow("Invalid status transition");
  });

  it("nonexistent → 404", async () => {
    const manager = await createUser({ role: "MANAGER" });
    const team = await createTeam();
    await createMembership({
      userId: manager.id,
      teamId: team.id,
      roleInTeam: "MANAGER",
    });
    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: "nonexistent" }
    );
    expect(status).toBe(404);
  });

  it("creates ApprovalAction + AuditLog", async () => {
    const manager = await createUser({ role: "MANAGER" });
    const student = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    await createMembership({
      userId: manager.id,
      teamId: team.id,
      roleInTeam: "MANAGER",
    });
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      managerId: manager.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });
    await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );

    const approval = await db.approvalAction.findFirst({
      where: { requestId: req.id },
    });
    expect(approval!.action).toBe("APPROVE");

    const log = await db.auditLog.findFirst({
      where: { requestId: req.id },
    });
    expect(log!.eventType).toBe("REQUEST_STATUS_UPDATED");
  });
});
