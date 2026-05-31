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

// Mock storage — file I/O is infrastructure, not business logic
vi.mock("@/lib/storage", () => ({
  uploadReceiptFile: vi.fn(async (input: { fileName: string }) => ({
    key: `receipts/mock-${input.fileName}`,
    url: `file:///fake/path/mock-${input.fileName}`,
  })),
  deleteStoredObject: vi.fn(async () => {}),
}));

// Import after mocks are set up
const { POST } = await import("@/app/api/requests/[requestId]/receipts/route");
const { DELETE } = await import(
  "@/app/api/requests/[requestId]/receipts/[receiptId]/route"
);

function makeFormData(files: Array<{ name: string; content: string }>) {
  const formData = new FormData();
  for (const f of files) {
    formData.append(
      "files",
      new File([f.content], f.name, { type: "application/pdf" })
    );
  }
  return formData;
}

describe("POST /api/requests/[requestId]/receipts", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("upload to draft → 201, parseStatus=QUEUED", async () => {
    const student = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: student.id,
      teamId: team.id,
      roleInTeam: "PARENT_MENTOR",
    });
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
    });

    setMockUser({ id: student.id, email: student.email, role: "USER" });

    const response = await callRoute(
      POST,
      {
        method: "POST",
        formData: makeFormData([{ name: "receipt.pdf", content: "pdf-content" }]),
      },
      { requestId: req.id }
    );

    expect(response.status).toBe(201);
    const data = await response.json() as any;
    expect(data.receipts).toHaveLength(1);
    expect(data.receipts[0].parseStatus).toBe("QUEUED");
    expect(data.receipts[0].fileName).toBe("receipt.pdf");
  });

  it("team coach can upload to another member's draft → 201", async () => {
    const student = await createUser({ role: "USER" });
    const coach = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: student.id,
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
      createdById: student.id,
      coachId: coach.id,
    });

    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const response = await callRoute(
      POST,
      {
        method: "POST",
        formData: makeFormData([{ name: "coach-receipt.pdf", content: "pdf-content" }]),
      },
      { requestId: req.id }
    );

    expect(response.status).toBe(201);
  });

  it("unauthenticated → 401", async () => {
    const response = await callRoute(
      POST,
      {
        method: "POST",
        formData: makeFormData([{ name: "r.pdf", content: "x" }]),
      },
      { requestId: "any" }
    );
    expect(response.status).toBe(401);
  });

  it("non-creator → 404", async () => {
    const student = await createUser({ role: "USER" });
    const other = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
    });

    setMockUser({ id: other.id, email: other.email, role: "USER" });

    const response = await callRoute(
      POST,
      {
        method: "POST",
        formData: makeFormData([{ name: "r.pdf", content: "x" }]),
      },
      { requestId: req.id }
    );
    expect(response.status).toBe(404);
  });

  it("non-draft → 400", async () => {
    const student = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
      status: "SUBMITTED",
    });

    setMockUser({ id: student.id, email: student.email, role: "USER" });

    const response = await callRoute(
      POST,
      {
        method: "POST",
        formData: makeFormData([{ name: "r.pdf", content: "x" }]),
      },
      { requestId: req.id }
    );
    expect(response.status).toBe(400);
  });

  it("no files → 400", async () => {
    const student = await createUser({ role: "USER" });
    const team = await createTeam();
    const req = await createRequest({
      teamId: team.id,
      createdById: student.id,
    });

    setMockUser({ id: student.id, email: student.email, role: "USER" });

    const response = await callRoute(
      POST,
      { method: "POST", formData: new FormData() },
      { requestId: req.id }
    );
    expect(response.status).toBe(400);
  });

  it("team coach can delete a receipt from another member's draft → 200", async () => {
    const student = await createUser({ role: "USER" });
    const coach = await createUser({ role: "USER" });
    const team = await createTeam();
    await createMembership({
      userId: student.id,
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
      createdById: student.id,
      coachId: coach.id,
    });
    const receipt = await createReceipt({ requestId: req.id });

    setMockUser({ id: coach.id, email: coach.email, role: "USER" });

    const response = await callRoute(
      DELETE,
      { method: "DELETE" },
      { requestId: req.id, receiptId: receipt.id }
    );

    expect(response.status).toBe(200);
  });
});
