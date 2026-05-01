import { describe, it, expect, beforeEach, vi } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createUser,
  createTeam,
  createMembership,
  createRequest,
  createReceipt,
} from "../helpers/factory";
import { callRoute } from "../helpers/call-route";

vi.mock("@/lib/storage", () => ({
  readStoredObject: vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46])),
}));

const { GET } = await import("@/app/api/receipts/[receiptId]/download/route");

describe("GET /api/receipts/[receiptId]/download", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("returns file with correct content-type → 200", async () => {
    const user = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({ userId: user.id, teamId: team.id, roleInTeam: "PARENT_MENTOR" });
    const req = await createRequest({ teamId: team.id, createdById: user.id });
    const receipt = await createReceipt({ requestId: req.id, fileName: "test.pdf" });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const response = await callRoute(GET, {}, { receiptId: receipt.id });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("test.pdf");
  });

  it("team member can download → 200", async () => {
    const user = await createUser({ role: "USER" });
    const teammate = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({ userId: user.id, teamId: team.id, roleInTeam: "PARENT_MENTOR" });
    await createMembership({ userId: teammate.id, teamId: team.id, roleInTeam: "PARENT_MENTOR" });
    const req = await createRequest({ teamId: team.id, createdById: user.id });
    const receipt = await createReceipt({ requestId: req.id });

    setMockUser({ id: teammate.id, email: teammate.email, role: "USER" });

    const response = await callRoute(GET, {}, { receiptId: receipt.id });
    expect(response.status).toBe(200);
  });

  it("non-member → 403", async () => {
    const user = await createUser({ role: "USER" });
    const outsider = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({ userId: user.id, teamId: team.id, roleInTeam: "PARENT_MENTOR" });
    const req = await createRequest({ teamId: team.id, createdById: user.id });
    const receipt = await createReceipt({ requestId: req.id });

    setMockUser({ id: outsider.id, email: outsider.email, role: "USER" });

    const response = await callRoute(GET, {}, { receiptId: receipt.id });
    expect(response.status).toBe(403);
  });

  it("nonexistent receipt → 404", async () => {
    const user = await createUser({ role: "USER" });
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const response = await callRoute(GET, {}, { receiptId: "nonexistent" });
    expect(response.status).toBe(404);
  });

  it("unauthenticated → 401", async () => {
    const response = await callRoute(GET, {}, { receiptId: "any" });
    expect(response.status).toBe(401);
  });
});
