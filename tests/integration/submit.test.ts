import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { POST } from "@/app/api/requests/[requestId]/submit/route";
import { db } from "@/lib/db";
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

  it("student submits draft → 200, status=SUBMITTED", async () => {
    const student = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    await createMembership({
      userId: student.id,
      teamId: team.id,
      roleInTeam: "STUDENT",
    });
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
    });

    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });

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
    const student = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
    });

    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });
    await callRouteJSON(POST, { method: "POST" }, { requestId: req.id });

    const approval = await db.approvalAction.findFirst({
      where: { requestId: req.id },
    });
    expect(approval).toBeTruthy();
    expect(approval!.action).toBe("SUBMIT");
    expect(approval!.actorId).toBe(student.id);
  });

  it("creates AuditLog entry", async () => {
    const student = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
    });

    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });
    await callRouteJSON(POST, { method: "POST" }, { requestId: req.id });

    const log = await db.auditLog.findFirst({
      where: { requestId: req.id },
    });
    expect(log).toBeTruthy();
    expect(log!.eventType).toBe("REQUEST_STATUS_UPDATED");
  });

  it("non-creator → 404", async () => {
    const student = await createUser({ role: "STUDENT" });
    const other = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
    });

    setMockUser({ id: other.id, email: other.email, role: "STUDENT" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST" },
      { requestId: req.id }
    );
    expect(status).toBe(404);
  });

  it("already submitted → throws (assertTransition)", async () => {
    const student = await createUser({ role: "STUDENT" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });

    await expect(
      callRouteJSON(POST, { method: "POST" }, { requestId: req.id })
    ).rejects.toThrow("Invalid status transition");
  });

  it("nonexistent → 404", async () => {
    const student = await createUser({ role: "STUDENT" });
    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST" },
      { requestId: "nonexistent" }
    );
    expect(status).toBe(404);
  });
});
