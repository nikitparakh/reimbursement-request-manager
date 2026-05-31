import { and, eq, exists, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, userScopeRoles } from "@/db/schema";

type AdminReviewTarget = {
  districtId: string;
  schoolId: string;
  programId: string;
};

export function buildAdminReviewRecipientWhere(target: AdminReviewTarget): SQL {
  // Correlated EXISTS subqueries replace Prisma's `scopedRoles.some` relation
  // filters: a user matches if they are a SUPER_ADMIN, or have a matching
  // SCHOOL_ADMIN / PROGRAM_ADMIN scoped role for the target scope.
  const schoolAdminExists = db
    .select({ one: userScopeRoles.id })
    .from(userScopeRoles)
    .where(
      and(
        eq(userScopeRoles.userId, users.id),
        eq(userScopeRoles.role, "SCHOOL_ADMIN"),
        or(
          eq(userScopeRoles.schoolId, target.schoolId),
          and(
            eq(userScopeRoles.districtId, target.districtId),
            isNull(userScopeRoles.schoolId)
          )
        )
      )
    );

  const programAdminExists = db
    .select({ one: userScopeRoles.id })
    .from(userScopeRoles)
    .where(
      and(
        eq(userScopeRoles.userId, users.id),
        eq(userScopeRoles.role, "PROGRAM_ADMIN"),
        eq(userScopeRoles.schoolId, target.schoolId),
        eq(userScopeRoles.programId, target.programId)
      )
    );

  return or(
    eq(users.role, "SUPER_ADMIN"),
    exists(schoolAdminExists),
    exists(programAdminExists)
  ) as SQL;
}

export async function getAdminReviewRecipientEmails(target: AdminReviewTarget) {
  const admins = await db
    .select({ email: users.email })
    .from(users)
    .where(buildAdminReviewRecipientWhere(target));

  return Array.from(
    new Set(admins.map((admin) => admin.email).filter((email): email is string => Boolean(email)))
  );
}
