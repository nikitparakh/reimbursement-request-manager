import { describe, it, expect, beforeEach, vi } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as onboard } from "@/app/api/onboarding/complete/route";
import { POST as createRequestRoute } from "@/app/api/requests/route";
import { POST as submitRoute } from "@/app/api/requests/[requestId]/submit/route";
import { POST as managerDecision } from "@/app/api/requests/[requestId]/manager-decision/route";
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
} from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

describe("Full Lifecycle: DRAFT → PAID", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("happy path: register → onboard → create → submit → manager approve → admin approve → paid", async () => {
    // 1. Register student
    const { data: regData } = await callRouteJSON(register, {
      method: "POST",
      body: {
        name: "Alice Student",
        email: "alice@test.com",
        password: "Password1",
      },
    });
    const studentId = (regData as any).user.id;

    // Create team and manager
    const team = await createTeam({ name: "Test Team" });
    const manager = await createUser({ role: "MANAGER", onboardingDone: true });
    await createMembership({
      userId: manager.id,
      teamId: team.id,
      roleInTeam: "MANAGER",
    });
    const admin = await createUser({ role: "ADMIN", onboardingDone: true });

    // 2. Onboard student
    setMockUser({
      id: studentId,
      email: "alice@test.com",
      role: "STUDENT",
    });
    const { status: onboardStatus } = await callRouteJSON(onboard, {
      method: "POST",
      body: { teamId: team.id, roleIntent: "STUDENT" },
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

    // 5. Manager approves
    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });
    const { status: mgrStatus, data: mgrData } = await callRouteJSON(
      managerDecision,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId }
    );
    expect(mgrStatus).toBe(200);
    expect((mgrData as any).status).toBe("MANAGER_APPROVED");

    // 6. Admin approves
    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });
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

  it("rejection path: submit → manager rejects", async () => {
    const student = await createUser({ role: "STUDENT" });
    const manager = await createUser({ role: "MANAGER" });
    const team = await createTeam();
    await createMembership({
      userId: student.id,
      teamId: team.id,
      roleInTeam: "STUDENT",
    });
    await createMembership({
      userId: manager.id,
      teamId: team.id,
      roleInTeam: "MANAGER",
    });
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      managerId: manager.id,
    });

    // Submit
    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });
    await callRouteJSON(submitRoute, { method: "POST" }, { requestId: req.id });

    // Manager rejects
    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });
    const { status, data } = await callRouteJSON(
      managerDecision,
      {
        method: "POST",
        body: { decision: "REJECT", comment: "Insufficient documentation" },
      },
      { requestId: req.id }
    );
    expect(status).toBe(200);
    expect((data as any).status).toBe("MANAGER_REJECTED");

    // Verify rejection ApprovalAction
    const approvals = await db.approvalAction.findMany({
      where: { requestId: req.id },
      orderBy: { createdAt: "asc" },
    });
    expect(approvals).toHaveLength(2);
    expect(approvals[1].action).toBe("REJECT");
    expect(approvals[1].comment).toBe("Insufficient documentation");
  });

  it("admin rejection path: submit → manager approve → admin rejects", async () => {
    const student = await createUser({ role: "STUDENT" });
    const manager = await createUser({ role: "MANAGER" });
    const admin = await createUser({ role: "ADMIN" });
    const team = await createTeam();
    await createMembership({
      userId: student.id,
      teamId: team.id,
      roleInTeam: "STUDENT",
    });
    await createMembership({
      userId: manager.id,
      teamId: team.id,
      roleInTeam: "MANAGER",
    });
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      managerId: manager.id,
    });

    // Submit
    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });
    await callRouteJSON(submitRoute, { method: "POST" }, { requestId: req.id });

    // Manager approves
    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });
    await callRouteJSON(
      managerDecision,
      { method: "POST", body: { decision: "APPROVE" } },
      { requestId: req.id }
    );

    // Admin rejects
    setMockUser({ id: admin.id, email: admin.email, role: "ADMIN" });
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
