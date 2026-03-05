import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications/sender";
import { cleanDatabase } from "../helpers/db-clean";
import { createUser, createTeam, createRequest } from "../helpers/factory";

describe("sendNotification", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("creates notification rows for each recipient", async () => {
    const user1 = await createUser({ email: "one@test.com" });
    const user2 = await createUser({ email: "two@test.com" });
    const team = await createTeam();
    const req = await createRequest({ teamId: team.id, createdById: user1.id });

    await sendNotification("REQUEST_SUBMITTED", {
      requestId: req.id,
      actorEmail: "actor@test.com",
      recipients: ["one@test.com", "two@test.com"],
      message: "A request was submitted",
    });

    const notifications = await db.notification.findMany({
      orderBy: { createdAt: "asc" },
    });

    expect(notifications).toHaveLength(2);
    expect(notifications[0].userId).toBe(user1.id);
    expect(notifications[1].userId).toBe(user2.id);
    expect(notifications[0].event).toBe("REQUEST_SUBMITTED");
    expect(notifications[0].message).toBe("A request was submitted");
    expect(notifications[0].read).toBe(false);
    expect(notifications[0].requestId).toBe(req.id);
  });

  it("does nothing when no recipients match", async () => {
    await sendNotification("COACH_APPROVED", {
      requestId: "nonexistent",
      actorEmail: "actor@test.com",
      recipients: ["nobody@test.com"],
      message: "Approved",
    });

    const count = await db.notification.count();
    expect(count).toBe(0);
  });

  it("handles mix of existing and non-existing recipients", async () => {
    const user = await createUser({ email: "exists@test.com" });
    const team = await createTeam();
    const req = await createRequest({ teamId: team.id, createdById: user.id });

    await sendNotification("ADMIN_APPROVED", {
      requestId: req.id,
      actorEmail: "admin@test.com",
      recipients: ["exists@test.com", "ghost@test.com"],
      message: "Final approval",
    });

    const notifications = await db.notification.findMany();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toBe("Final approval");
  });
});
