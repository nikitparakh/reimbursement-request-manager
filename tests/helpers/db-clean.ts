import { getDb } from "@/lib/db";
import {
  approvalActions,
  auditLogs,
  districts,
  lineItemComments,
  notifications,
  programs,
  receiptExtractions,
  receiptFiles,
  receiptLineItems,
  reimbursementRequests,
  schools,
  teamMemberships,
  teamRegistrationRequests,
  teams,
  userScopeRoles,
  users,
} from "@/db/schema";

export async function cleanDatabase() {
  const db = getDb();
  // Delete in reverse dependency order to avoid FK violations
  await db.delete(notifications);
  await db.delete(auditLogs);
  await db.delete(approvalActions);
  await db.delete(lineItemComments);
  await db.delete(receiptLineItems);
  await db.delete(receiptExtractions);
  await db.delete(receiptFiles);
  await db.delete(reimbursementRequests);
  await db.delete(teamRegistrationRequests);
  await db.delete(userScopeRoles);
  await db.delete(teamMemberships);
  await db.delete(teams);
  await db.delete(schools);
  await db.delete(districts);
  await db.delete(programs);
  await db.delete(users);
}
