import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient | PrismaClient;

export async function logAuditEvent(
  input: {
    actorId?: string;
    requestId?: string;
    eventType: string;
    message: string;
    metadata?: Record<string, unknown>;
  },
  tx?: Tx
) {
  const client = tx ?? db;
  await client.auditLog.create({
    data: {
      actorId: input.actorId,
      requestId: input.requestId,
      eventType: input.eventType,
      message: input.message,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
