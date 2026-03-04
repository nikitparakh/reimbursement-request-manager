import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { transitionRequestStatus } from "@/lib/reimbursements/workflow";
import { cleanDatabase } from "../../helpers/db-clean";
import {
  createUser,
  createTeam,
  createMembership,
  createRequest,
  createReceipt,
  createExtraction,
  createLineItem,
} from "../../helpers/factory";

describe("transitionRequestStatus", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("transitions DRAFT → SUBMITTED", async () => {
    const student = await createUser();
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      status: "DRAFT",
    });

    const updated = await transitionRequestStatus({
      requestId: req.id,
      actorId: student.id,
      nextStatus: "SUBMITTED",
      action: "SUBMIT",
    });

    expect(updated.status).toBe("SUBMITTED");
    expect(updated.submittedAt).not.toBeNull();
  });

  it("creates an ApprovalAction record", async () => {
    const student = await createUser();
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      status: "DRAFT",
    });

    await transitionRequestStatus({
      requestId: req.id,
      actorId: student.id,
      nextStatus: "SUBMITTED",
      action: "SUBMIT",
      comment: "Ready for review",
    });

    const actions = await db.approvalAction.findMany({
      where: { requestId: req.id },
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("SUBMIT");
    expect(actions[0].comment).toBe("Ready for review");
  });

  it("writes an audit log entry", async () => {
    const student = await createUser();
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      status: "DRAFT",
    });

    await transitionRequestStatus({
      requestId: req.id,
      actorId: student.id,
      nextStatus: "SUBMITTED",
      action: "SUBMIT",
    });

    const logs = await db.auditLog.findMany({
      where: { requestId: req.id },
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs.some((l) => l.eventType === "REQUEST_STATUS_UPDATED")).toBe(true);
  });

  it("recalculates requestedTotal from extractions", async () => {
    const student = await createUser();
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      status: "DRAFT",
    });
    const receipt = await createReceipt({ requestId: req.id });
    const extraction = await createExtraction({ receiptFileId: receipt.id });
    await createLineItem({
      receiptExtractionId: extraction.id,
      lineTotal: 25.0,
      position: 0,
    });
    await createLineItem({
      receiptExtractionId: extraction.id,
      lineTotal: 15.5,
      position: 1,
    });

    const updated = await transitionRequestStatus({
      requestId: req.id,
      actorId: student.id,
      nextStatus: "SUBMITTED",
      action: "SUBMIT",
    });

    expect(Number(updated.requestedTotal)).toBe(40.5);
  });

  it("rejects invalid transition", async () => {
    const student = await createUser();
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      status: "DRAFT",
    });

    await expect(
      transitionRequestStatus({
        requestId: req.id,
        actorId: student.id,
        nextStatus: "ADMIN_APPROVED",
        action: "APPROVE",
      })
    ).rejects.toThrow(/Invalid status transition/);
  });
});
