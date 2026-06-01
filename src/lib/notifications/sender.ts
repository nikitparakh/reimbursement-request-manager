import { inArray } from "drizzle-orm";
import type { NotificationEvent, NotificationPayload } from "@/lib/notifications/events";
import { db } from "@/lib/db";
import { users, notifications } from "@/db/schema";

export async function sendNotification(
  event: NotificationEvent,
  payload: NotificationPayload
) {
  const recipients = await db.query.users.findMany({
    where: inArray(users.email, payload.recipients),
    columns: { id: true },
  });

  if (recipients.length === 0) return;

  await db.insert(notifications).values(
    recipients.map((user) => ({
      userId: user.id,
      event,
      message: payload.message,
      requestId: payload.requestId,
    }))
  );
}
