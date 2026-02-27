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
  createRequest,
  createReceipt,
  createExtraction,
  createLineItem,
} from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

// Helper to set up a full request with receipt + extraction + line items
async function setupRequestWithLineItems() {
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

  return { student, manager, team, req, receipt, extraction, item1, item2 };
}

describe("POST /api/requests/[requestId]/line-items (create)", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("creator adds item → 201, requestedTotal recalculated", async () => {
    const { student, req, extraction } = await setupRequestWithLineItems();
    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });

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

  it("team manager adds item → 201", async () => {
    const { manager, req, extraction } = await setupRequestWithLineItems();
    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });

    const { status } = await callRouteJSON(
      POST,
      {
        method: "POST",
        body: {
          receiptExtractionId: extraction.id,
          description: "Manager Item",
          lineTotal: 5,
        },
      },
      { requestId: req.id }
    );
    expect(status).toBe(201);
  });

  it("non-creator non-manager → 404", async () => {
    const { req, extraction } = await setupRequestWithLineItems();
    const outsider = await createUser({ role: "STUDENT" });
    setMockUser({ id: outsider.id, email: outsider.email, role: "STUDENT" });

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
      status: "SUBMITTED",
    });
    const receipt = await createReceipt({ requestId: req.id });
    const extraction = await createExtraction({ receiptFileId: receipt.id });

    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });

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
    const { student, req } = await setupRequestWithLineItems();
    // Create a different request with its own extraction
    const team2 = await createTeam();
    const req2 = await createRequest({
      teamId: team2.id,
      createdById: student.id,
    });
    const receipt2 = await createReceipt({ requestId: req2.id });
    const extraction2 = await createExtraction({
      receiptFileId: receipt2.id,
    });

    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });

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
    const { student, req, item1 } = await setupRequestWithLineItems();
    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });

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

  it("manager updates → 200", async () => {
    const { manager, req, item1 } = await setupRequestWithLineItems();
    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });

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

  it("non-draft → 400", async () => {
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
      status: "SUBMITTED",
    });
    const receipt = await createReceipt({ requestId: req.id });
    const extraction = await createExtraction({ receiptFileId: receipt.id });
    const item = await createLineItem({
      receiptExtractionId: extraction.id,
      lineTotal: 10,
    });

    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });

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
    const { student, req } = await setupRequestWithLineItems();
    // Create item on different request
    const team2 = await createTeam();
    const req2 = await createRequest({
      teamId: team2.id,
      createdById: student.id,
    });
    const receipt2 = await createReceipt({ requestId: req2.id });
    const ext2 = await createExtraction({ receiptFileId: receipt2.id });
    const otherItem = await createLineItem({
      receiptExtractionId: ext2.id,
      lineTotal: 10,
    });

    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });

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
    const { student, req, item1 } = await setupRequestWithLineItems();
    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });

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

  it("manager deletes → 200", async () => {
    const { manager, req, item1 } = await setupRequestWithLineItems();
    setMockUser({ id: manager.id, email: manager.email, role: "MANAGER" });

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
      status: "SUBMITTED",
    });
    const receipt = await createReceipt({ requestId: req.id });
    const extraction = await createExtraction({ receiptFileId: receipt.id });
    const item = await createLineItem({
      receiptExtractionId: extraction.id,
      lineTotal: 10,
    });

    setMockUser({ id: student.id, email: student.email, role: "STUDENT" });

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
