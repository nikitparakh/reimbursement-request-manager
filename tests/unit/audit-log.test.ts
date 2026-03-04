import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit/log";
import { cleanDatabase } from "../helpers/db-clean";
import { createUser } from "../helpers/factory";

describe("logAuditEvent", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("creates an audit log entry with all fields", async () => {
    const user = await createUser();

    await logAuditEvent({
      actorId: user.id,
      eventType: "TEST_EVENT",
      message: "Something happened",
      metadata: { key: "value" },
    });

    const logs = await db.auditLog.findMany({
      where: { eventType: "TEST_EVENT" },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].actorId).toBe(user.id);
    expect(logs[0].message).toBe("Something happened");
    expect(logs[0].metadata).toEqual({ key: "value" });
  });

  it("works without optional fields", async () => {
    await logAuditEvent({
      eventType: "ANONYMOUS_EVENT",
      message: "No actor",
    });

    const logs = await db.auditLog.findMany({
      where: { eventType: "ANONYMOUS_EVENT" },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].actorId).toBeNull();
    expect(logs[0].requestId).toBeNull();
  });

  it("uses transaction client when provided", async () => {
    const user = await createUser();

    await db.$transaction(async (tx) => {
      await logAuditEvent(
        {
          actorId: user.id,
          eventType: "TX_EVENT",
          message: "Inside transaction",
        },
        tx
      );
    });

    const logs = await db.auditLog.findMany({
      where: { eventType: "TX_EVENT" },
    });
    expect(logs).toHaveLength(1);
  });
});
