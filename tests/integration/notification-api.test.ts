import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import "../helpers/auth-mock";
import { setMockUser, clearMockSession } from "../helpers/auth-mock";
import { db } from "@/lib/db";
import { notifications } from "@/db/schema";
import { cleanDatabase } from "../helpers/db-clean";
import {
  createMembership,
  createProgram,
  createRequest,
  createScopedRole,
  createScopedRoleForTeam,
  createSchool,
  createTeam,
  createUser,
} from "../helpers/factory";
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
    await db.insert(notifications).values([
      { userId: user.id, event: "REQUEST_SUBMITTED", message: "Notif 1" },
      { userId: user.id, event: "COACH_APPROVED", message: "Notif 2", read: true },
    ]);

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(notificationsRoute.GET);

    expect(status).toBe(200);
    const typed = data as { notifications: unknown[]; unreadCount: number };
    expect(typed.notifications).toHaveLength(2);
    expect(typed.unreadCount).toBe(1);
  });

  it("returns empty for user with no notifications", async () => {
    const user = await createUser();
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(notificationsRoute.GET);

    expect(status).toBe(200);
    const typed = data as { notifications: unknown[]; unreadCount: number };
    expect(typed.notifications).toHaveLength(0);
    expect(typed.unreadCount).toBe(0);
  });

  it("returns request-specific hrefs for mixed-role users", async () => {
    const user = await createUser();
    const managedSchool = await createSchool();
    const memberSchool = await createSchool();
    const managedProgram = await createProgram({ code: "FTC" });
    const memberProgram = await createProgram({ code: "FRC" });
    const managedTeam = await createTeam({
      schoolId: managedSchool.id,
      programId: managedProgram.id,
      name: "Managed Team",
    });
    const memberTeam = await createTeam({
      schoolId: memberSchool.id,
      programId: memberProgram.id,
      name: "Member Team",
    });
    const managedRequestCreator = await createUser();
    const memberRequestCreator = await createUser();
    const managedRequest = await createRequest({
      teamId: managedTeam.id,
      createdById: managedRequestCreator.id,
      status: "SUBMITTED",
    });
    const memberRequest = await createRequest({
      teamId: memberTeam.id,
      createdById: memberRequestCreator.id,
      status: "DRAFT",
    });

    await createScopedRole({
      userId: user.id,
      role: "PROGRAM_ADMIN",
      districtId: managedSchool.districtId,
      schoolId: managedSchool.id,
      programId: managedProgram.id,
    });
    await createMembership({
      userId: user.id,
      teamId: memberTeam.id,
      roleInTeam: "PARENT_MENTOR",
    });
    await createScopedRoleForTeam({
      userId: user.id,
      teamId: memberTeam.id,
      role: "PARENT_MENTOR",
    });

    await db.insert(notifications).values([
      {
        userId: user.id,
        event: "COACH_APPROVED",
        message: "Managed scope request",
        requestId: managedRequest.id,
      },
      {
        userId: user.id,
        event: "REQUEST_SUBMITTED",
        message: "Member scope request",
        requestId: memberRequest.id,
      },
    ]);

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(notificationsRoute.GET);

    expect(status).toBe(200);
    const typed = data as {
      notifications: Array<{
        message: string;
        requestHref: string | null;
      }>;
      unreadCount: number;
    };
    expect(
      typed.notifications.find((notification) => notification.message === "Managed scope request")
        ?.requestHref
    ).toBe(`/admin/requests/${managedRequest.id}`);
    // A bare PARENT_MENTOR who neither owns the request nor coaches the team can
    // no longer view another member's request (IDOR fix), so the notification is
    // rendered non-clickable (null href) rather than deep-linking to a page that
    // would notFound().
    expect(
      typed.notifications.find((notification) => notification.message === "Member scope request")
        ?.requestHref
    ).toBeNull();
  });

  it("keeps submitted-request notifications on the user detail route for dual-role coach admins", async () => {
    const user = await createUser();
    const school = await createSchool();
    const program = await createProgram({ code: "FTC" });
    const team = await createTeam({
      schoolId: school.id,
      programId: program.id,
      name: "Dual Role Team",
    });
    const requester = await createUser();
    const request = await createRequest({
      teamId: team.id,
      createdById: requester.id,
      coachId: user.id,
      status: "SUBMITTED",
    });

    await createMembership({
      userId: user.id,
      teamId: team.id,
      roleInTeam: "COACH",
    });
    await createScopedRole({
      userId: user.id,
      role: "PROGRAM_ADMIN",
      districtId: school.districtId,
      schoolId: school.id,
      programId: program.id,
    });

    await db.insert(notifications).values({
      userId: user.id,
      event: "REQUEST_SUBMITTED",
      message: "Submitted request awaiting initial review",
      requestId: request.id,
    });

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(notificationsRoute.GET);

    expect(status).toBe(200);
    const typed = data as {
      notifications: Array<{
        message: string;
        requestHref: string | null;
      }>;
    };
    expect(
      typed.notifications.find(
        (notification) =>
          notification.message === "Submitted request awaiting initial review"
      )?.requestHref
    ).toBe(`/user/requests/${request.id}`);
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
    const [notif] = await db
      .insert(notifications)
      .values({ userId: user.id, event: "REQUEST_SUBMITTED", message: "Test" })
      .returning();

    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status, data } = await callRouteJSON(
      readRoute.PATCH,
      { method: "PATCH" },
      { id: notif.id }
    );

    expect(status).toBe(200);
    expect((data as { read: boolean }).read).toBe(true);

    const updated = await db.query.notifications.findFirst({
      where: eq(notifications.id, notif.id),
    });
    expect(updated!.read).toBe(true);
  });

  it("other user's notification → 404", async () => {
    const user = await createUser();
    const other = await createUser();
    const [notif] = await db
      .insert(notifications)
      .values({ userId: user.id, event: "REQUEST_SUBMITTED", message: "Private" })
      .returning();

    setMockUser({ id: other.id, email: other.email, role: "USER" });

    const { status } = await callRouteJSON(
      readRoute.PATCH,
      { method: "PATCH" },
      { id: notif.id }
    );
    expect(status).toBe(404);
  });

  it("nonexistent notification → 404", async () => {
    const user = await createUser();
    setMockUser({ id: user.id, email: user.email, role: "USER" });

    const { status } = await callRouteJSON(
      readRoute.PATCH,
      { method: "PATCH" },
      { id: "nonexistent" }
    );
    expect(status).toBe(404);
  });
});
