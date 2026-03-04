import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  createRequestDraft,
  getRequestWithDetails,
  findTeamManager,
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

    it("assigns managerId when provided", async () => {
      const user = await createUser();
      const mgr = await createUser({ role: "MANAGER" });
      const team = await createTeam();

      const req = await createRequestDraft({
        title: "With Manager",
        teamId: team.id,
        createdById: user.id,
        managerId: mgr.id,
      });

      expect(req.managerId).toBe(mgr.id);
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

  describe("findTeamManager", () => {
    it("returns approved MANAGER membership", async () => {
      const mgr = await createUser({ role: "MANAGER" });
      const team = await createTeam();
      await createMembership({
        userId: mgr.id,
        teamId: team.id,
        roleInTeam: "MANAGER",
        approved: true,
      });

      const found = await findTeamManager(team.id);
      expect(found).not.toBeNull();
      expect(found!.userId).toBe(mgr.id);
    });

    it("returns null when no manager exists", async () => {
      const team = await createTeam();
      const found = await findTeamManager(team.id);
      expect(found).toBeNull();
    });

    it("ignores unapproved managers", async () => {
      const mgr = await createUser({ role: "MANAGER" });
      const team = await createTeam();
      await createMembership({
        userId: mgr.id,
        teamId: team.id,
        roleInTeam: "MANAGER",
        approved: false,
      });

      const found = await findTeamManager(team.id);
      expect(found).toBeNull();
    });
  });
});
