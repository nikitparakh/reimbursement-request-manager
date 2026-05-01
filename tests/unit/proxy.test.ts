import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getToken } = vi.hoisted(() => ({
  getToken: vi.fn(),
}));

vi.mock("next-auth/jwt", () => ({
  getToken,
}));

import { proxy } from "@/proxy";

describe("proxy", () => {
  beforeEach(() => {
    getToken.mockReset();
    getToken.mockResolvedValue(null);
  });

  it("keeps the reimbursement policy public for anonymous visitors", async () => {
    const response = await proxy(new NextRequest("http://localhost:3000/policy"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
