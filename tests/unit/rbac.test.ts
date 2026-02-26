import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { requireRole, requireUser } from "@/lib/rbac";

describe("rbac helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an authenticated user", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);
    await expect(requireUser()).rejects.toThrow("UNAUTHORIZED");
  });

  it("enforces role checks", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "STUDENT", email: "s@example.com" },
    } as never);

    await expect(requireRole("ADMIN")).rejects.toThrow("FORBIDDEN");
  });
});
