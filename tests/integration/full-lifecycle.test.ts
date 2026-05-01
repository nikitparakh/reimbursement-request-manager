import { describe, it, expect, beforeEach, vi } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as onboard } from "@/app/api/onboarding/complete/route";
import { POST as createRequestRoute } from "@/app/api/requests/route";
import { POST as submitRoute } from "@/app/api/requests/[requestId]/submit/route";
import { POST as coachDecision } from "@/app/api/requests/[requestId]/coach-decision/route";
import { POST as adminDecision } from "@/app/api/requests/[requestId]/admin-decision/route";
import { db } from "@/lib/db";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createUser,
  createTeam,
  createMembership,
  createRequest,
  createReceipt,
  createExtraction,
  createLineItem,
  createScopedRole,
  createScopedRoleForTeam,
} from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

describe("Full Lifecycle: DRAFT → PAID", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("happy path: register → onboard → create → submit → coach approve → admin approve → paid", async () => {
    // 1. Register user
    const { data: regData } = await callRouteJSON(register, {
      method: "POST",
      body: {
        name: "Alice User",
        email: "alice@test.com",
        password: "Password1",
        policyAccepted: true,
      },
    });
    const userId = (regData as any).user.id;

    // Create team and coach
    const team = await createTeam({ name: "Test Team" });
    const coach = await createUser({ role: "USER", onboardingDone: true });
    await createMembership({
      userId: coach.id,
      teamId: team.id,
      roleInTeam: "COACH",
    });
    await createScopedRoleForTeam({ userId: coach.id, teamId: team.id, role: "COACH" });
    const admin = await createUser({ role: "SUPER_ADMIN", onboardingDone: true });

    const school = await db.school.findUniqueOrThrow({ where: { id: team.schoolId } });

    // 2. Onboard user
    setMockUser({
      id: userId,
      email: "alice@test.com",
      role: "USER",
    });
    const { status: onboardStatus } = await callRouteJSON(onboard, {
      method: "POST",
      body: {
        districtId: school.districtId,
        schoolId: team.schoolId,
        programId: team.programId,
        teamId: team.id,
        roleIntent: "PARENT_MENTOR",
      },
    });
    expect(onboardStatus).toBe(200);

    // 3. Create request
    const { status: createStatus, data: createData } = await callRouteJSON(
      createRequestRoute,
      {
        method: "POST",
        body: { title: "Lifecycle Request", teamId: team.id },
      }
    );
    expect(createStatus).toBe(201);
    const requestId = (createData as any).id;
    expect((createData as any).status).toBe("DRAFT");

    // Create receipt + extraction + line items via factory (receipt upload mocked separately)
    const receipt = await createReceipt({ requestId });
    const extraction = await createExtraction({
      receiptFileId: receipt.id,
      total: 100,
    });
    await createLineItem({
      receiptExtractionId: extraction.id,
      lineTotal: 75,
      position: 0,
    });
    await createLineItem({
      receiptExtractionId: extraction.id,
      lineTotal: 25,
      position: 1,
    });

    // 4. Submit
    const { status: submitStatus, data: submitData } = await callRouteJSON(
      submitRoute,
      { method: "POST" },
      { requestId }
    );
    expect(submitStatus).toBe(200);
    expect((submitData as any).status).toBe("SUBMITTED");

    // 5. Coach approves
    setMockUser({ id: coach.id, email: coach.email, role: "USER" });
    const { status: coachStatus, data: coachData } = await callRouteJSON(
      coachDecision,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId }
    );
    expect(coachStatus).toBe(200);
    expect((coachData as any).status).toBe("COACH_APPROVED");

    // 6. Admin approves
    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });
    const { status: adminStatus, data: adminData } = await callRouteJSON(
      adminDecision,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId }
    );
    expect(adminStatus).toBe(200);
    expect((adminData as any).status).toBe("ADMIN_APPROVED");

    // 7. Admin marks paid
    const { status: paidStatus, data: paidData } = await callRouteJSON(
      adminDecision,
      { method: "POST", body: { decision: "MARK_PAID" } },
      { requestId }
    );
    expect(paidStatus).toBe(200);
    expect((paidData as any).status).toBe("PAID");

    // 8. Verify 4 ApprovalActions
    const approvals = await db.approvalAction.findMany({
      where: { requestId },
      orderBy: { createdAt: "asc" },
    });
    expect(approvals).toHaveLength(4);
    expect(approvals.map((a) => a.action)).toEqual([
      "SUBMIT",
      "APPROVE",
      "APPROVE",
      "MARK_PAID",
    ]);

    // 9. Verify audit logs
    const logs = await db.auditLog.findMany({
      where: { requestId },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.length).toBeGreaterThanOrEqual(4);

    // Verify final total reflects line items (75 + 25 = 100)
    const finalReq = await db.reimbursementRequest.findUnique({
      where: { id: requestId },
    });
    expect(Number(finalReq!.requestedTotal)).toBe(100);
  });

  it("rejection path: submit → coach rejects", async () => {
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
    await createScopedRoleForTeam({ userId: coach.id, teamId: team.id, role: "COACH" });
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      coachId: coach.id,
    });

    // Submit
    setMockUser({ id: user.id, email: user.email, role: "USER" });
    await callRouteJSON(submitRoute, { method: "POST" }, { requestId: req.id });

    // Coach rejects
    setMockUser({ id: coach.id, email: coach.email, role: "USER" });
    const { status, data } = await callRouteJSON(
      coachDecision,
      {
        method: "POST",
        body: { decision: "REJECT", comment: "Insufficient documentation" },
      },
      { requestId: req.id }
    );
    expect(status).toBe(200);
    expect((data as any).status).toBe("COACH_REJECTED");

    // Verify rejection ApprovalAction
    const approvals = await db.approvalAction.findMany({
      where: { requestId: req.id },
      orderBy: { createdAt: "asc" },
    });
    expect(approvals).toHaveLength(2);
    expect(approvals[1].action).toBe("REJECT");
    expect(approvals[1].comment).toBe("Insufficient documentation");
  });

  it("school admin can complete the lifecycle inside a managed school", async () => {
    const user = await createUser({ role: "USER" });
    const coach = await createUser({ role: "USER" });
    const schoolAdmin = await createUser({ role: "USER" });
    const team = await createTeam();
    const school = await db.school.findUniqueOrThrow({
      where: { id: team.schoolId },
    });

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
    await createScopedRole({
      userId: schoolAdmin.id,
      role: "SCHOOL_ADMIN",
      districtId: school.districtId,
      schoolId: school.id,
    });

    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      coachId: coach.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: coach.id, email: coach.email, role: "USER" });
    const coachApproval = await callRouteJSON(
      coachDecision,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );
    expect(coachApproval.status).toBe(200);

    setMockUser({
      id: schoolAdmin.id,
      email: schoolAdmin.email,
      role: "USER",
    });
    const adminApproval = await callRouteJSON(
      adminDecision,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );
    expect(adminApproval.status).toBe(200);
    expect((adminApproval.data as any).status).toBe("ADMIN_APPROVED");

    const paid = await callRouteJSON(
      adminDecision,
      { method: "POST", body: { decision: "MARK_PAID" } },
      { requestId: req.id }
    );
    expect(paid.status).toBe(200);
    expect((paid.data as any).status).toBe("PAID");
  });

  it("admin rejection path: submit → coach approve → admin rejects", async () => {
    const user = await createUser({ role: "USER" });
    const coach = await createUser({ role: "USER" });
    const admin = await createUser({ role: "SUPER_ADMIN" });
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
    await createScopedRoleForTeam({ userId: coach.id, teamId: team.id, role: "COACH" });
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      coachId: coach.id,
    });

    // Submit
    setMockUser({ id: user.id, email: user.email, role: "USER" });
    await callRouteJSON(submitRoute, { method: "POST" }, { requestId: req.id });

    // Coach approves
    setMockUser({ id: coach.id, email: coach.email, role: "USER" });
    await callRouteJSON(
      coachDecision,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );

    // Admin rejects
    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });
    const { status, data } = await callRouteJSON(
      adminDecision,
      {
        method: "POST",
        body: { decision: "REJECT", comment: "Over budget" },
      },
      { requestId: req.id }
    );
    expect(status).toBe(200);
    expect((data as any).status).toBe("ADMIN_REJECTED");

    // Verify 3 ApprovalActions
    const approvals = await db.approvalAction.findMany({
      where: { requestId: req.id },
      orderBy: { createdAt: "asc" },
    });
    expect(approvals).toHaveLength(3);
    expect(approvals.map((a) => a.action)).toEqual([
      "SUBMIT",
      "APPROVE",
      "REJECT",
    ]);
  });
});
