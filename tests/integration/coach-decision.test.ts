import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { POST } from "@/app/api/requests/[requestId]/coach-decision/route";
import { db } from "@/lib/db";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createUser,
  createTeam,
  createMembership,
  createRequest,
  createScopedRole,
  createScopedRoleForTeam,
} from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

describe("POST /api/requests/[requestId]/coach-decision", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("unauthenticated → 401", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "SUBMITTED",
    });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );

    expect(status).toBe(401);
  });

  it("membership-only coach approves SUBMITTED → 200, status=COACH_APPROVED", async () => {
    const coach = await createUser({ role: "USER" });
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: coach.id,
      teamId: team.id,
      roleInTeam: "COACH",
    });
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      coachId: coach.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const { status, data } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );

    expect(status).toBe(200);
    expect((data as any).status).toBe("COACH_APPROVED");
  });

  it("deprecated scoped coach rows without a team membership do not grant coach access", async () => {
    const coach = await createUser({ role: "USER" });
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    await createScopedRoleForTeam({ userId: coach.id, teamId: team.id, role: "COACH" });
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      coachId: coach.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );

    expect(status).toBe(404);
  });

  it("coach rejects with comment → 200, status=COACH_REJECTED", async () => {
    const coach = await createUser({ role: "USER" });
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: coach.id,
      teamId: team.id,
      roleInTeam: "COACH",
    });
    await createScopedRoleForTeam({ userId: coach.id, teamId: team.id, role: "COACH" });
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      coachId: coach.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const { status, data } = await callRouteJSON(
      POST,
      {
        method: "POST",
        body: { decision: "REJECT", comment: "Needs more detail" },
      },
      { requestId: req.id }
    );

    expect(status).toBe(200);
    expect((data as any).status).toBe("COACH_REJECTED");
  });

  it("reject without comment → 400", async () => {
    const coach = await createUser({ role: "USER" });
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: coach.id,
      teamId: team.id,
      roleInTeam: "COACH",
    });
    await createScopedRoleForTeam({ userId: coach.id, teamId: team.id, role: "COACH" });
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "REJECT" } },
      { requestId: req.id }
    );
    expect(status).toBe(400);
  });

  it("admin can also decide → 200", async () => {
    const admin = await createUser({ role: "SUPER_ADMIN" });
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });

    const { status, data } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );
    expect(status).toBe(200);
    expect((data as any).status).toBe("COACH_APPROVED");
  });

  it("user → 403", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );
    expect(status).toBe(403);
  });

  it("coach not on this team → 404", async () => {
    const coach = await createUser({ role: "USER" });
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    const otherTeam = await createTeam();
    // Coach is member of otherTeam, not the request's team
    await createMembership({
      userId: coach.id,
      teamId: otherTeam.id,
      roleInTeam: "COACH",
    });
    await createScopedRoleForTeam({ userId: coach.id, teamId: otherTeam.id, role: "COACH" });
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );
    expect(status).toBe(404);
  });

  it("non-SUBMITTED request → throws (assertTransition)", async () => {
    const coach = await createUser({ role: "USER" });
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: coach.id,
      teamId: team.id,
      roleInTeam: "COACH",
    });
    await createScopedRoleForTeam({ userId: coach.id, teamId: team.id, role: "COACH" });
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "DRAFT",
    });

    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    await expect(
      callRouteJSON(
        POST,
        { method: "POST", body: { decision: "APPROVE" } },
        { requestId: req.id }
      )
    ).rejects.toThrow("Invalid status transition");
  });

  it("nonexistent → 404", async () => {
    const coach = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: coach.id,
      teamId: team.id,
      roleInTeam: "COACH",
    });
    await createScopedRoleForTeam({ userId: coach.id, teamId: team.id, role: "COACH" });
    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: "nonexistent" }
    );
    expect(status).toBe(404);
  });

  it("creates ApprovalAction + AuditLog", async () => {
    const coach = await createUser({ role: "USER" });
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: coach.id,
      teamId: team.id,
      roleInTeam: "COACH",
    });
    await createScopedRoleForTeam({ userId: coach.id, teamId: team.id, role: "COACH" });
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      coachId: coach.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: coach.id, email: coach.email, role: "USER" });
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

  it("notifies district-scoped school admins when approval advances to admin review", async () => {
    const coach = await createUser({ role: "USER" });
    const user = await createUser({ role: "USER" });
    const districtAdmin = await createUser({ role: "USER" });
    const team = await createTeam();
    const school = await db.school.findUniqueOrThrow({ where: { id: team.schoolId } });
    await createMembership({
      userId: coach.id,
      teamId: team.id,
      roleInTeam: "COACH",
    });
    await createScopedRoleForTeam({ userId: coach.id, teamId: team.id, role: "COACH" });
    await createScopedRole({
      userId: districtAdmin.id,
      role: "SCHOOL_ADMIN",
      districtId: school.districtId,
    });
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      coachId: coach.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );

    expect(status).toBe(200);
    expect(
      await db.notification.findFirst({
        where: {
          userId: districtAdmin.id,
          requestId: req.id,
          event: "COACH_APPROVED",
        },
      })
    ).toBeTruthy();
  });
});
