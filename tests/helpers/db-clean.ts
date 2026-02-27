import { db } from "@/lib/db";

export async function cleanDatabase() {
  // Delete in reverse dependency order to avoid FK violations
  await db.auditLog.deleteMany();
  await db.approvalAction.deleteMany();
  await db.receiptLineItem.deleteMany();
  await db.receiptExtraction.deleteMany();
  await db.receiptFile.deleteMany();
  await db.reimbursementRequest.deleteMany();
  await db.teamRegistrationRequest.deleteMany();
  await db.teamMembership.deleteMany();
  await db.team.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.verificationToken.deleteMany();
  await db.user.deleteMany();
}
