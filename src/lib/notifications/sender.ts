import type { NotificationEvent, NotificationPayload } from "@/lib/notifications/events";

export async function sendNotification(
  event: NotificationEvent,
  payload: NotificationPayload
) {
  // Placeholder sender for MVP.
  // In production, replace with SES/SendGrid provider.
  console.info("[notification]", event, payload);
}
