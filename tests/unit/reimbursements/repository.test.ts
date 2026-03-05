import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  createRequestDraft,
  getRequestWithDetails,
  findTeamCoach,
} from "@/lib/reimbursements/repository";
import { cleanDatabase } from "../../helpers/db-clean";
import { createUser, createTeam, createMembership } from "../../helpers/factory";

describe("reimbursements/repository", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("createRequestDraft", () => {
    it("creates a draft with zero total and DRAFT status", async () => {
      const user = await createUser();
      const team = await createTeam();

      const req = await createRequestDraft({
        title: "Test Draft",
        description: "A test description",
        teamId: team.id,
        createdById: user.id,
      });

      expect(req.title).toBe("Test Draft");
      expect(req.status).toBe("DRAFT");
      expect(Number(req.requestedTotal)).toBe(0);

      const fromDb = await db.reimbursementRequest.findUnique({
        where: { id: req.id },
      });
      expect(fromDb).not.toBeNull();
    });

    it("assigns coachId when provided", async () => {
      const user = await createUser();
      const coach = await createUser({ role: "COACH" });
      const team = await createTeam();

      const req = await createRequestDraft({
        title: "With Coach",
        teamId: team.id,
        createdById: user.id,
        coachId: coach.id,
      });

      expect(req.coachId).toBe(coach.id);
    });
  });

  describe("getRequestWithDetails", () => {
    it("returns request with team, receipts, and approvals", async () => {
      const user = await createUser();
      const team = await createTeam();
      const req = await createRequestDraft({
        title: "Detail Test",
        teamId: team.id,
        createdById: user.id,
      });

      const details = await getRequestWithDetails(req.id);
      expect(details).not.toBeNull();
      expect(details!.team.name).toBe(team.name);
      expect(details!.receiptFiles).toEqual([]);
      expect(details!.approvals).toEqual([]);
    });

    it("returns null for non-existent request", async () => {
      const details = await getRequestWithDetails("nonexistent-id");
      expect(details).toBeNull();
    });
  });

  describe("findTeamCoach", () => {
    it("returns approved COACH membership", async () => {
      const coach = await createUser({ role: "COACH" });
      const team = await createTeam();
      await createMembership({
        userId: coach.id,
        teamId: team.id,
        roleInTeam: "COACH",
        approved: true,
      });

      const found = await findTeamCoach(team.id);
      expect(found).not.toBeNull();
      expect(found!.userId).toBe(coach.id);
    });

    it("returns null when no coach exists", async () => {
      const team = await createTeam();
      const found = await findTeamCoach(team.id);
      expect(found).toBeNull();
    });

    it("ignores unapproved coaches", async () => {
      const coach = await createUser({ role: "COACH" });
      const team = await createTeam();
      await createMembership({
        userId: coach.id,
        teamId: team.id,
        roleInTeam: "COACH",
        approved: false,
      });

      const found = await findTeamCoach(team.id);
      expect(found).toBeNull();
    });
  });
});
