import { revalidateTag } from "next/cache";

export function managerInboxTag(teamId: string) {
  return `manager-inbox-${teamId}`;
}

export function adminInboxTag() {
  return "admin-inbox";
}

export function invalidateApprovalCaches(teamId: string) {
  revalidateTag(managerInboxTag(teamId), "max");
  revalidateTag(adminInboxTag(), "max");
}
