import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { POST } from "@/app/api/admin/team-requests/[id]/decision/route";
import { db } from "@/lib/db";
import { teams } from "@/db/schema";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createUser,
  createTeamRegistrationRequest,
} from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

describe("POST /api/admin/team-requests/[id]/decision", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("admin approves → 200, creates team", async () => {
    const admin = await createUser({ role: "SUPER_ADMIN" });
    const requester = await createUser();
    const req = await createTeamRegistrationRequest({
      teamName: "Approved Team",
      requestedById: requester.id,
    });
    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });

    const { status, data } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { id: req.id }
    );

    expect(status).toBe(200);
    expect((data as any).request.status).toBe("APPROVED");
    expect((data as any).team.name).toBe("Approved Team");
  });

  it("admin rejects with comment → 200", async () => {
    const admin = await createUser({ role: "SUPER_ADMIN" });
    const requester = await createUser();
    const req = await createTeamRegistrationRequest({
      teamName: "Rejected Team",
      requestedById: requester.id,
    });
    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });

    const { status, data } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "REJECT", comment: "Not needed" } },
      { id: req.id }
    );

    expect(status).toBe(200);
    expect((data as any).status).toBe("REJECTED");
    expect((data as any).rejectionReason).toBe("Not needed");
  });

  it("user → 403", async () => {
    const user = await createUser({ role: "USER" });
    const requester = await createUser();
    const req = await createTeamRegistrationRequest({
      teamName: "Team",
      requestedById: requester.id,
    });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { id: req.id }
    );
    expect(status).toBe(403);
  });

  it("coach → 403", async () => {
    const coach = await createUser({ role: "USER" });
    const requester = await createUser();
    const req = await createTeamRegistrationRequest({
      teamName: "Team",
      requestedById: requester.id,
    });
    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { id: req.id }
    );
    expect(status).toBe(403);
  });

  it("nonexistent request → 404", async () => {
    const admin = await createUser({ role: "SUPER_ADMIN" });
    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });

    const { status } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { id: "nonexistent" }
    );
    expect(status).toBe(404);
  });

  it("approved team has correct name/shortCode in DB", async () => {
    const admin = await createUser({ role: "SUPER_ADMIN" });
    const requester = await createUser();
    const req = await createTeamRegistrationRequest({
      teamName: "DB Check Team",
      requestedById: requester.id,
      shortCode: "DBCT",
    });
    setMockUser({ id: admin.id, email: admin.email, role: "SUPER_ADMIN" });

    const { data } = await callRouteJSON(
      POST,
      { method: "POST", body: { decision: "APPROVE" } },
      { id: req.id }
    );

    const team = await db.query.teams.findFirst({
      where: eq(teams.id, (data as any).team.id),
    });
    expect(team!.name).toBe("DB Check Team");
    expect(team!.shortCode).toBe("DBCT");
  });
});
