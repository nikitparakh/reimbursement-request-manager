import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { db } from "@/lib/db";
import { reimbursementRequests } from "@/db/schema";
import { POST } from "@/app/api/requests/[requestId]/autofill/route";
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

describe("POST /api/requests/[requestId]/autofill", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("recalculates total from extractions → 200", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({ userId: user.id, teamId: team.id, roleInTeam: "PARENT_MENTOR" });
    const req = await createRequest({ teamId: team.id, createdById: user.id });
    const receipt = await createReceipt({ requestId: req.id });
    const extraction = await createExtraction({ receiptFileId: receipt.id });
    await createLineItem({ receiptExtractionId: extraction.id, lineTotal: 30, position: 0 });
    await createLineItem({ receiptExtractionId: extraction.id, lineTotal: 20.5, position: 1 });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(
      POST,
      { method: "POST" },
      { requestId: req.id }
    );

    expect(status).toBe(200);
    expect((data as { requestedTotal: number }).requestedTotal).toBe(50.5);
    expect((data as { extractionCount: number }).extractionCount).toBe(1);

    const updated = await db.query.reimbursementRequests.findFirst({
      where: eq(reimbursementRequests.id, req.id),
    });
    expect(updated!.requestedTotal).toBe(50.5);
  });

  it("returns 409 when parsing still in progress", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({ userId: user.id, teamId: team.id, roleInTeam: "PARENT_MENTOR" });
    const req = await createRequest({ teamId: team.id, createdById: user.id });
    await createReceipt({ requestId: req.id, parseStatus: "PROCESSING" });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST" },
      { requestId: req.id }
    );
    expect(status).toBe(409);
  });

  it("unauthenticated → 401", async () => {
    const { status } = await callRouteJSON(POST, { method: "POST" }, { requestId: "any" });
    expect(status).toBe(401);
  });

  it("non-owner → 404", async () => {
    const user = await createUser({ role: "USER" });
    const other = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({ teamId: team.id, createdById: user.id });

    setMockUser({ id: other.id, email: other.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST" },
      { requestId: req.id }
    );
    expect(status).toBe(404);
  });
});
