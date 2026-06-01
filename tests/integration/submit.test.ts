import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { eq } from "drizzle-orm";
import { POST } from "@/app/api/requests/[requestId]/submit/route";
import { db } from "@/lib/db";
import { approvalActions, auditLogs } from "@/db/schema";
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

// Seed a request with one parsed receipt + a positive-total line item so it
// clears the submit content gate (≥1 receipt, ≥1 extraction, requestedTotal>0).
async function seedSubmittableContent(requestId: string) {
  const receipt = await createReceipt({ requestId });
  const extraction = await createExtraction({ receiptFileId: receipt.id });
  await createLineItem({
    receiptExtractionId: extraction.id,
    lineTotal: 50,
    position: 0,
  });
}

// Seed an approved COACH on the team so a plain member's submission has a
// review recipient. The submit route now blocks (409) a member submitting on a
// coachless team with no scoped admins — a silent dead-letter the audit closed
// — so the happy-path submit tests must give the team a coach to route to.
async function seedTeamCoach(teamId: string) {
  const coach = await createUser({ role: "USER" });
  await createMembership({
    userId: coach.id,
    teamId,
    roleInTeam: "COACH",
  });
  return coach;
}

describe("POST /api/requests/[requestId]/submit", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("user submits draft → 200, status=SUBMITTED", async () => {
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
    });
    await seedTeamCoach(team.id);
    await seedSubmittableContent(req.id);

    setMockUser({ id: user.id, email: user.email, role: "USER" });

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
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
    });
    await seedTeamCoach(team.id);
    await seedSubmittableContent(req.id);

    setMockUser({ id: user.id, email: user.email, role: "USER" });
    await callRouteJSON(POST, { method: "POST" }, { requestId: req.id });

    const approval = await db.query.approvalActions.findFirst({
      where: eq(approvalActions.requestId, req.id),
    });
    expect(approval).toBeTruthy();
    expect(approval!.action).toBe("SUBMIT");
    expect(approval!.actorId).toBe(user.id);
  });

  it("creates AuditLog entry", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
    });
    await seedTeamCoach(team.id);
    await seedSubmittableContent(req.id);

    setMockUser({ id: user.id, email: user.email, role: "USER" });
    await callRouteJSON(POST, { method: "POST" }, { requestId: req.id });

    const log = await db.query.auditLogs.findFirst({
      where: eq(auditLogs.requestId, req.id),
    });
    expect(log).toBeTruthy();
    expect(log!.eventType).toBe("REQUEST_STATUS_UPDATED");
  });

  it("non-creator → 404", async () => {
    const user = await createUser({ role: "USER" });
    const other = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
    });

    setMockUser({ id: other.id, email: other.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST" },
      { requestId: req.id }
    );
    expect(status).toBe(404);
  });

  it("already submitted → 409 (invalid transition)", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: user.id,
      status: "SUBMITTED",
    });
    await seedSubmittableContent(req.id);

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    // Re-submitting an already-SUBMITTED request now surfaces a friendly 409
    // instead of throwing an opaque 500 out of the route.
    const { status } = await callRouteJSON(
      POST,
      { method: "POST" },
      { requestId: req.id }
    );
    expect(status).toBe(409);
  });

  it("nonexistent → 404", async () => {
    const user = await createUser({ role: "USER" });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST" },
      { requestId: "nonexistent" }
    );
    expect(status).toBe(404);
  });
});
