import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { db } from "@/lib/db";
import { cleanDatabase } from "../helpers/db-clean";
import { createUser } from "../helpers/factory";
import { callRouteJSON } from "../helpers/call-route";

const notificationsRoute = await import("@/app/api/notifications/route");
const readRoute = await import("@/app/api/notifications/[id]/read/route");

describe("GET /api/notifications", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("returns user notifications and unread count", async () => {
    const user = await createUser();
    await db.notification.createMany({
      data: [
        { userId: user.id, event: "REQUEST_SUBMITTED", message: "Notif 1" },
        { userId: user.id, event: "COACH_APPROVED", message: "Notif 2", read: true },
      ],
    });

    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status, data } = await callRouteJSON(notificationsRoute.GET);

    expect(status).toBe(200);
    const typed = data as { notifications: unknown[]; unreadCount: number };
    expect(typed.notifications).toHaveLength(2);
    expect(typed.unreadCount).toBe(1);
  });

  it("returns empty for user with no notifications", async () => {
    const user = await createUser();
    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status, data } = await callRouteJSON(notificationsRoute.GET);

    expect(status).toBe(200);
    const typed = data as { notifications: unknown[]; unreadCount: number };
    expect(typed.notifications).toHaveLength(0);
    expect(typed.unreadCount).toBe(0);
  });

  it("unauthenticated → 401", async () => {
    const { status } = await callRouteJSON(notificationsRoute.GET);
    expect(status).toBe(401);
  });
});

describe("PATCH /api/notifications/[id]/read", () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearMockSession();
  });

  it("marks notification as read → 200", async () => {
    const user = await createUser();
    const notif = await db.notification.create({
      data: { userId: user.id, event: "REQUEST_SUBMITTED", message: "Test" },
    });

    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status, data } = await callRouteJSON(
      readRoute.PATCH,
      { method: "PATCH" },
      { id: notif.id }
    );

    expect(status).toBe(200);
    expect((data as { read: boolean }).read).toBe(true);

    const updated = await db.notification.findUnique({ where: { id: notif.id } });
    expect(updated!.read).toBe(true);
  });

  it("other user's notification → 404", async () => {
    const user = await createUser();
    const other = await createUser();
    const notif = await db.notification.create({
      data: { userId: user.id, event: "REQUEST_SUBMITTED", message: "Private" },
    });

    setMockUser({ id: other.id, email: other.email, role: "STUDENT" });

    const { status } = await callRouteJSON(
      readRoute.PATCH,
      { method: "PATCH" },
      { id: notif.id }
    );
    expect(status).toBe(404);
  });

  it("nonexistent notification → 404", async () => {
    const user = await createUser();
    setMockUser({ id: user.id, email: user.email, role: "STUDENT" });

    const { status } = await callRouteJSON(
      readRoute.PATCH,
      { method: "PATCH" },
      { id: "nonexistent" }
    );
    expect(status).toBe(404);
  });
});
