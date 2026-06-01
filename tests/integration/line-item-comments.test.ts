import { beforeEach, describe, expect, it } from "vitest";
import "../helpers/auth-mock";
import { clearMockSession, setMockUser } from "../helpers/auth-mock";
import { POST } from "@/app/api/requests/[requestId]/line-items/comments/route";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schools } from "@/db/schema";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createExtraction,
  createLineItem,
  createMembership,
  createReceipt,
  createRequest,
  createScopedRole,
  createScopedRoleForTeam,
  createTeam,
  createUser,
} from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

describe("POST /api/requests/[requestId]/line-items/comments", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("coach with USER global role comments on a SUBMITTED request → 201", async () => {
    const coach = await createUser({ role: "USER" });
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: coach.id,
      teamId: team.id,
      roleInTeam: "COACH",
    });
    await createScopedRoleForTeam({
      userId: coach.id,
      teamId: team.id,
      role: "COACH",
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

    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const { status, data } = await callRouteJSON(
      POST,
      {
        method: "POST",
        body: { lineItemId: item.id, text: "Please confirm quantity." },
      },
      { requestId: req.id }
    );

    expect(status).toBe(201);
    expect((data as { text: string }).text).toBe("Please confirm quantity.");
  });

  it("school admin comments on a COACH_APPROVED request within scope → 201", async () => {
    const admin = await createUser();
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, team.schoolId),
    });
    if (!school) throw new Error("School not found");
    await createScopedRole({
      userId: admin.id,
      role: "SCHOOL_ADMIN",
      districtId: school.districtId,
      schoolId: team.schoolId,
    });
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

    const { status, data } = await callRouteJSON(
      POST,
      {
        method: "POST",
        body: { lineItemId: item.id, text: "Adjusted total looks good." },
      },
      { requestId: req.id }
    );

    expect(status).toBe(201);
    expect((data as { text: string }).text).toBe("Adjusted total looks good.");
  });
});
