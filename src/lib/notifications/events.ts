export type NotificationEvent =
  | "REQUEST_SUBMITTED"
  | "MANAGER_APPROVED"
  | "MANAGER_REJECTED"
  | "ADMIN_APPROVED"
  | "ADMIN_REJECTED";

export type NotificationPayload = {
  requestId: string;
  actorEmail: string;
  recipients: string[];
  message: string;
};
