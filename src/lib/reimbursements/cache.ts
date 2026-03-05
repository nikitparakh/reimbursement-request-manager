import { revalidateTag } from "next/cache";

export function coachInboxTag(teamId: string) {
  return `coach-inbox-${teamId}`;
}

export function adminInboxTag() {
  return "admin-inbox";
}

export function invalidateApprovalCaches(teamId: string) {
  revalidateTag(coachInboxTag(teamId), "max");
  revalidateTag(adminInboxTag(), "max");
}
