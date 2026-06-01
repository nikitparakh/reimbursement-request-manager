import { inArray } from "drizzle-orm";
import { type DB } from "@/lib/db";
import { userScopeRoles } from "@/db/schema";

const LEGACY_TEAM_SCOPED_ROLES = ["COACH", "PARENT_MENTOR"] as const;

export async function cleanupLegacyTeamScopedRoles(db: DB) {
  const deleted = await db
    .delete(userScopeRoles)
    .where(inArray(userScopeRoles.role, [...LEGACY_TEAM_SCOPED_ROLES]))
    .returning({ id: userScopeRoles.id });
  return { count: deleted.length };
}
