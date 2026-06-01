import { and, eq, inArray, or } from "drizzle-orm";
import type { NotificationEvent, NotificationPayload } from "@/lib/notifications/events";
import { db } from "@/lib/db";
import { users, notifications } from "@/db/schema";

/**
 * Inserts an in-app notification for each recipient.
 *
 * Contract:
 * - This function is allowed to throw (e.g. a transient DB failure). It is NOT
 *   atomic with the state-machine transition that precedes it, so EVERY caller
 *   MUST wrap the call in try/catch and treat a failure as non-fatal — a notify
 *   failure must never 500 an already-committed transition.
 * - `payload.recipients` may contain either user emails OR user ids. Recipients
 *   are resolved by email first, and any unmatched entry is then resolved by id,
 *   so a recipient with no recorded email is still reachable by id (callers pass
 *   a userId fallback when the email is absent).
 * - Duplicate UNREAD notifications for the same (userId, requestId, event) are
 *   suppressed so resubmit / re-approval cycles do not pile up redundant rows.
 */
export async function sendNotification(
  event: NotificationEvent,
  payload: NotificationPayload
) {
  const wanted = Array.from(
    new Set(payload.recipients.filter((value): value is string => Boolean(value)))
  );

  if (wanted.length === 0) {
    console.warn(
      `sendNotification: no recipients provided for event ${event} (request ${payload.requestId})`
    );
    return;
  }

  // Resolve recipients by email OR id so an emailless user is still reachable by
  // the userId fallback callers pass in.
  const recipients = await db.query.users.findMany({
    where: or(inArray(users.email, wanted), inArray(users.id, wanted)),
    columns: { id: true },
  });

  const userIds = Array.from(new Set(recipients.map((user) => user.id)));

  if (userIds.length === 0) {
    console.warn(
      `sendNotification: no matching users for event ${event} (request ${payload.requestId})`
    );
    return;
  }

  // Dedup at insert time: skip any recipient who already has an unread
  // notification for this (userId, requestId, event). No schema unique index is
  // required — we check-then-insert.
  const existing = payload.requestId
    ? await db.query.notifications.findMany({
        where: and(
          inArray(notifications.userId, userIds),
          eq(notifications.requestId, payload.requestId),
          eq(notifications.event, event),
          eq(notifications.read, false)
        ),
        columns: { userId: true },
      })
    : [];

  const alreadyNotified = new Set(existing.map((row) => row.userId));
  const targets = userIds.filter((id) => !alreadyNotified.has(id));

  if (targets.length === 0) return;

  await db.insert(notifications).values(
    targets.map((userId) => ({
      userId,
      event,
      message: payload.message,
      requestId: payload.requestId,
    }))
  );
}
