import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/register/route";
import { db } from "@/lib/db";
import { cleanDatabase } from "../helpers/db-clean";
import { callRouteJSON } from "../helpers/call-route";

describe("POST /api/auth/register", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  const validBody = {
    name: "Alice Test",
    email: "alice@test.com",
    password: "Password1",
  };

  it("registers a valid user → 201", async () => {
    const { status, data } = await callRouteJSON(POST, {
      method: "POST",
      body: validBody,
    });
    expect(status).toBe(201);
    expect(data).toHaveProperty("user");
    expect((data as any).user.email).toBe("alice@test.com");
    expect((data as any).user.name).toBe("Alice Test");
    expect((data as any).user.id).toBeDefined();
  });

  it("rejects duplicate email → 409", async () => {
    await callRouteJSON(POST, { method: "POST", body: validBody });
    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: validBody,
    });
    expect(status).toBe(409);
  });

  it("rejects missing name → 400", async () => {
    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: { email: "a@test.com", password: "Password1" },
    });
    expect(status).toBe(400);
  });

  it("rejects invalid email → 400", async () => {
    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: { name: "Alice", email: "not-an-email", password: "Password1" },
    });
    expect(status).toBe(400);
  });

  it("rejects password too short → 400", async () => {
    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: { name: "Alice", email: "a@test.com", password: "Pass1" },
    });
    expect(status).toBe(400);
  });

  it("rejects password missing uppercase → 400", async () => {
    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: { name: "Alice", email: "a@test.com", password: "password1" },
    });
    expect(status).toBe(400);
  });

  it("rejects password missing lowercase → 400", async () => {
    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: { name: "Alice", email: "a@test.com", password: "PASSWORD1" },
    });
    expect(status).toBe(400);
  });

  it("rejects password missing digit → 400", async () => {
    const { status } = await callRouteJSON(POST, {
      method: "POST",
      body: { name: "Alice", email: "a@test.com", password: "Passwords" },
    });
    expect(status).toBe(400);
  });

  it("creates user with role=STUDENT and onboardingDone=false", async () => {
    const { data } = await callRouteJSON(POST, {
      method: "POST",
      body: validBody,
    });
    const dbUser = await db.user.findUnique({
      where: { id: (data as any).user.id },
    });
    expect(dbUser!.role).toBe("STUDENT");
    expect(dbUser!.onboardingDone).toBe(false);
  });
});
