import type { NotificationEvent, NotificationPayload } from "@/lib/notifications/events";
import { db } from "@/lib/db";

export async function sendNotification(
  event: NotificationEvent,
  payload: NotificationPayload
) {
  const users = await db.user.findMany({
    where: { email: { in: payload.recipients } },
    select: { id: true },
  });

  if (users.length === 0) return;

  await db.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      event,
      message: payload.message,
      requestId: payload.requestId,
    })),
  });
}
