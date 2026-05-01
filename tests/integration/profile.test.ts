import { beforeEach, describe, expect, it } from "vitest";
import "../helpers/auth-mock";
import { clearMockSession, setMockUser } from "../helpers/auth-mock";
import {
  GET,
  PATCH,
} from "@/app/api/me/profile/route";
import { db } from "@/lib/db";
import { cleanDatabase } from "../helpers/db-clean";
import { createUser } from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

describe("GET /api/me/profile", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("returns the authenticated user's profile → 200", async () => {
    const user = await createUser();
    await db.user.update({
      where: { id: user.id },
      data: {
        mailingAddressLine1: "123 Main St",
        mailingCity: "Novi",
        mailingState: "MI",
        mailingPostalCode: "48375",
        zelleType: "email",
        zelleValue: "user@test.com",
      },
    });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(GET);

    expect(status).toBe(200);
    expect((data as any).mailingAddressLine1).toBe("123 Main St");
    expect((data as any).zelleValue).toBe("user@test.com");
  });
});

describe("PATCH /api/me/profile", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("updates mailing address and zelle details → 200", async () => {
    const user = await createUser();
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(PATCH, {
      method: "PATCH",
      body: {
        mailingAddressLine1: "123 Main St",
        mailingAddressLine2: "Suite 5",
        mailingCity: "Novi",
        mailingState: "MI",
        mailingPostalCode: "48375",
        zelleType: "email",
        zelleValue: "payer@test.com",
      },
    });

    expect(status).toBe(200);
    expect((data as any).zelleType).toBe("email");

    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    expect(dbUser?.mailingCity).toBe("Novi");
    expect(dbUser?.zelleValue).toBe("payer@test.com");
  });

  it("requires authentication → 401", async () => {
    const { status } = await callRouteJSON(PATCH, {
      method: "PATCH",
      body: {
        mailingAddressLine1: "123 Main St",
      },
    });

    expect(status).toBe(401);
  });
});
