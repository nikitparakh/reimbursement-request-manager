export type NotificationEvent =
  | "REQUEST_SUBMITTED"
  | "COACH_APPROVED"
  | "COACH_REJECTED"
  | "ADMIN_APPROVED"
  | "ADMIN_REJECTED"
  | "MARKED_PAID";

export type NotificationPayload = {
  requestId: string;
  actorEmail: string;
  recipients: string[];
  message: string;
};
