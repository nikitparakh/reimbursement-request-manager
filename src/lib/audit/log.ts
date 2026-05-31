import { db } from "@/lib/db";
import { auditLogs } from "@/db/schema";

export async function logAuditEvent(input: {
  actorId?: string;
  requestId?: string;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    actorId: input.actorId,
    requestId: input.requestId,
    eventType: input.eventType,
    message: input.message,
    metadata: input.metadata ?? null,
  });
}
