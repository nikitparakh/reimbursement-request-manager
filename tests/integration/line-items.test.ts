import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import {
  POST,
  PUT,
  DELETE,
} from "@/app/api/requests/[requestId]/line-items/route";
import { db } from "@/lib/db";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createUser,
  createTeam,
  createMembership,
  createScopedRole,
  createRequest,
  createReceipt,
  createExtraction,
  createLineItem,
} from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

// Helper to set up a full request with receipt + extraction + line items
async function setupRequestWithLineItems() {
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
  const req = await createRequest({
    teamId: team.id,
    createdById: user.id,
    coachId: coach.id,
  });
  const receipt = await createReceipt({ requestId: req.id });
  const extraction = await createExtraction({ receiptFileId: receipt.id });
  const item1 = await createLineItem({
    receiptExtractionId: extraction.id,
    lineTotal: 25.0,
    position: 0,
  });
  const item2 = await createLineItem({
    receiptExtractionId: extraction.id,
    lineTotal: 15.5,
    position: 1,
  });

  return { user, coach, team, req, receipt, extraction, item1, item2 };
}

describe("POST /api/requests/[requestId]/line-items (create)", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("creator adds item → 201, requestedTotal recalculated", async () => {
    const { user, req, extraction } = await setupRequestWithLineItems();
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(
      POST,
      {
        method: "POST",
        body: {
          receiptExtractionId: extraction.id,
          description: "New Item",
          lineTotal: 10,
        },
      },
      { requestId: req.id }
    );

    expect(status).toBe(201);
    expect((data as any).description).toBe("New Item");

    // Verify total was recalculated (25 + 15.5 + 10 = 50.5)
    const updated = await db.reimbursementRequest.findUnique({
      where: { id: req.id },
    });
    expect(Number(updated!.requestedTotal)).toBe(50.5);
  });

  it("team coach adds item → 201", async () => {
    const { coach, req, extraction } = await setupRequestWithLineItems();
    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      {
        method: "POST",
        body: {
          receiptExtractionId: extraction.id,
          description: "Coach Item",
          lineTotal: 5,
        },
      },
      { requestId: req.id }
    );
    expect(status).toBe(201);
  });

  it("non-creator non-coach → 404", async () => {
    const { req, extraction } = await setupRequestWithLineItems();
    const outsider = await createUser({ role: "USER" });
    setMockUser({ id: outsider.id, email: outsider.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      {
        method: "POST",
        body: {
          receiptExtractionId: extraction.id,
          description: "Item",
          lineTotal: 5,
        },
      },
      { requestId: req.id }
    );
    expect(status).toBe(404);
  });

  it("non-draft → 400", async () => {
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
      status: "SUBMITTED",
    });
    const receipt = await createReceipt({ requestId: req.id });
    const extraction = await createExtraction({ receiptFileId: receipt.id });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      {
        method: "POST",
        body: {
          receiptExtractionId: extraction.id,
          description: "Item",
          lineTotal: 5,
        },
      },
      { requestId: req.id }
    );
    expect(status).toBe(400);
  });

  it("extraction from different request → 404", async () => {
    const { user, req } = await setupRequestWithLineItems();
    // Create a different request with its own extraction
    const team2 = await createTeam();
    const req2 = await createRequest({
      teamId: team2.id,
      createdById: user.id,
    });
    const receipt2 = await createReceipt({ requestId: req2.id });
    const extraction2 = await createExtraction({
      receiptFileId: receipt2.id,
    });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      {
        method: "POST",
        body: {
          receiptExtractionId: extraction2.id,
          description: "Wrong extraction",
          lineTotal: 5,
        },
      },
      { requestId: req.id }
    );
    expect(status).toBe(404);
  });
});

describe("PUT /api/requests/[requestId]/line-items (update)", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("creator updates → 200, requestedTotal recalculated", async () => {
    const { user, req, item1 } = await setupRequestWithLineItems();
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(
      PUT,
      {
        method: "PUT",
        body: {
          lineItemId: item1.id,
          description: "Updated",
          lineTotal: 100,
        },
      },
      { requestId: req.id }
    );

    expect(status).toBe(200);
    expect((data as any).description).toBe("Updated");

    // 100 + 15.5 = 115.5
    const updated = await db.reimbursementRequest.findUnique({
      where: { id: req.id },
    });
    expect(Number(updated!.requestedTotal)).toBe(115.5);
  });

  it("coach updates → 200", async () => {
    const { coach, req, item1 } = await setupRequestWithLineItems();
    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const { status } = await callRouteJSON(
      PUT,
      {
        method: "PUT",
        body: { lineItemId: item1.id, lineTotal: 50 },
      },
      { requestId: req.id }
    );
    expect(status).toBe(200);
  });

  it("another approved parent on the same team cannot edit someone else's draft → 400", async () => {
    const { team, req, item1 } = await setupRequestWithLineItems();
    const teammate = await createUser({ role: "USER" });
    await createMembership({
      userId: teammate.id,
      teamId: team.id,
      roleInTeam: "PARENT_MENTOR",
    });

    setMockUser({ id: teammate.id, email: teammate.email, role: "USER" });

    const { status } = await callRouteJSON(
      PUT,
      {
        method: "PUT",
        body: { lineItemId: item1.id, lineTotal: 50 },
      },
      { requestId: req.id }
    );

    expect(status).toBe(400);
  });

  it("school admin updates a COACH_APPROVED request within scope → 200", async () => {
    const admin = await createUser();
    const team = await createTeam();
    const school = await db.school.findUniqueOrThrow({
      where: { id: team.schoolId },
    });
    await createScopedRole({
      userId: admin.id,
      role: "SCHOOL_ADMIN",
      districtId: school.districtId,
      schoolId: team.schoolId,
    });
    const user = await createUser({ role: "USER" });
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "COACH_APPROVED",
    });
    const receipt = await createReceipt({ requestId: req.id });
    const extraction = await createExtraction({ receiptFileId: receipt.id });
    const item = await createLineItem({
      receiptExtractionId: extraction.id,
      lineTotal: 10,
    });

    setMockUser({ id: admin.id, email: admin.email, role: "USER" });

    const { status } = await callRouteJSON(
      PUT,
      {
        method: "PUT",
        body: { lineItemId: item.id, lineTotal: 50 },
      },
      { requestId: req.id }
    );

    expect(status).toBe(200);
  });

  it("program admin updates a SUBMITTED request within scope → 200", async () => {
    const admin = await createUser();
    const team = await createTeam();
    const school = await db.school.findUniqueOrThrow({
      where: { id: team.schoolId },
    });
    await createScopedRole({
      userId: admin.id,
      role: "PROGRAM_ADMIN",
      districtId: school.districtId,
      schoolId: team.schoolId,
      programId: team.programId,
    });
    const user = await createUser({ role: "USER" });
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "SUBMITTED",
    });
    const receipt = await createReceipt({ requestId: req.id });
    const extraction = await createExtraction({ receiptFileId: receipt.id });
    const item = await createLineItem({
      receiptExtractionId: extraction.id,
      lineTotal: 10,
    });

    setMockUser({ id: admin.id, email: admin.email, role: "USER" });

    const { status } = await callRouteJSON(
      PUT,
      {
        method: "PUT",
        body: { lineItemId: item.id, lineTotal: 50 },
      },
      { requestId: req.id }
    );

    expect(status).toBe(200);
  });

  it("non-draft → 400", async () => {
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
      status: "SUBMITTED",
    });
    const receipt = await createReceipt({ requestId: req.id });
    const extraction = await createExtraction({ receiptFileId: receipt.id });
    const item = await createLineItem({
      receiptExtractionId: extraction.id,
      lineTotal: 10,
    });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      PUT,
      {
        method: "PUT",
        body: { lineItemId: item.id, lineTotal: 50 },
      },
      { requestId: req.id }
    );
    expect(status).toBe(400);
  });

  it("line item from different request → 404", async () => {
    const { user, req } = await setupRequestWithLineItems();
    // Create item on different request
    const team2 = await createTeam();
    const req2 = await createRequest({
      teamId: team2.id,
      createdById: user.id,
    });
    const receipt2 = await createReceipt({ requestId: req2.id });
    const ext2 = await createExtraction({ receiptFileId: receipt2.id });
    const otherItem = await createLineItem({
      receiptExtractionId: ext2.id,
      lineTotal: 10,
    });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      PUT,
      {
        method: "PUT",
        body: { lineItemId: otherItem.id, lineTotal: 50 },
      },
      { requestId: req.id }
    );
    expect(status).toBe(404);
  });
});

describe("DELETE /api/requests/[requestId]/line-items", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("creator deletes → 200, requestedTotal recalculated", async () => {
    const { user, req, item1 } = await setupRequestWithLineItems();
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(
      DELETE,
      {
        method: "DELETE",
        body: { lineItemId: item1.id },
      },
      { requestId: req.id }
    );

    expect(status).toBe(200);
    expect((data as any).deleted).toBe(true);

    // Only item2 remains: 15.5
    const updated = await db.reimbursementRequest.findUnique({
      where: { id: req.id },
    });
    expect(Number(updated!.requestedTotal)).toBe(15.5);
  });

  it("coach deletes → 200", async () => {
    const { coach, req, item1 } = await setupRequestWithLineItems();
    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const { status } = await callRouteJSON(
      DELETE,
      {
        method: "DELETE",
        body: { lineItemId: item1.id },
      },
      { requestId: req.id }
    );
    expect(status).toBe(200);
  });

  it("non-draft → 400", async () => {
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
      status: "SUBMITTED",
    });
    const receipt = await createReceipt({ requestId: req.id });
    const extraction = await createExtraction({ receiptFileId: receipt.id });
    const item = await createLineItem({
      receiptExtractionId: extraction.id,
      lineTotal: 10,
    });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      DELETE,
      {
        method: "DELETE",
        body: { lineItemId: item.id },
      },
      { requestId: req.id }
    );
    expect(status).toBe(400);
  });
});
