import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUser: vi.fn(),
  findScopedRoles: vi.fn(),
  findMemberships: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: mocks.findUser,
      },
      userScopeRoles: {
        findMany: mocks.findScopedRoles,
      },
      teamMemberships: {
        findMany: mocks.findMemberships,
      },
    },
  },
}));

describe("getCachedAccessContext", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.findUser.mockReset();
    mocks.findScopedRoles.mockReset();
    mocks.findMemberships.mockReset();

    mocks.findUser.mockResolvedValue({ role: "USER" });
    mocks.findScopedRoles.mockResolvedValue([]);
    mocks.findMemberships.mockResolvedValue([]);
  });

  it("deduplicates repeated access resolution for the same user", async () => {
    const { getCachedAccessContext } = await import("@/lib/access");

    await Promise.all([
      getCachedAccessContext("user-1"),
      getCachedAccessContext("user-1"),
    ]);

    expect(mocks.findUser).toHaveBeenCalledTimes(1);
    expect(mocks.findScopedRoles).toHaveBeenCalledTimes(1);
    expect(mocks.findMemberships).toHaveBeenCalledTimes(1);
  });
});
