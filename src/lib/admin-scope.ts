import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  reimbursementRequests,
  schools,
  teamRegistrationRequests,
  teams,
} from "@/db/schema";
import type { AccessContext, ScopedRoleAssignment } from "@/lib/access";

// A condition that matches no rows (deny-all for non-super-admins with no scope).
const MATCH_NONE: SQL = sql`0 = 1`;

function getAdminAssignments(context: AccessContext) {
  return context.scopedRoles.filter(
    (assignment) =>
      assignment.role === "SCHOOL_ADMIN" || assignment.role === "PROGRAM_ADMIN"
  );
}

/** Drizzle condition on the `teams` table for a single admin assignment. */
function buildTeamCondition(assignment: ScopedRoleAssignment): SQL | undefined {
  const parts: (SQL | undefined)[] = [];

  if (assignment.teamId) {
    parts.push(eq(teams.id, assignment.teamId));
  }

  if (assignment.schoolId) {
    parts.push(eq(teams.schoolId, assignment.schoolId));
  } else if (assignment.districtId) {
    parts.push(
      inArray(
        teams.schoolId,
        db
          .select({ id: schools.id })
          .from(schools)
          .where(eq(schools.districtId, assignment.districtId))
      )
    );
  }

  if (assignment.programId) {
    parts.push(eq(teams.programId, assignment.programId));
  }

  return and(...parts);
}

export function buildManagedTeamWhere(context: AccessContext): SQL | undefined {
  if (context.isSuperAdmin) return undefined;

  const conditions = getAdminAssignments(context)
    .map(buildTeamCondition)
    .filter((c): c is SQL => Boolean(c));
  return conditions.length > 0 ? or(...conditions) : MATCH_NONE;
}

export function buildManagedTeamRegistrationWhere(
  context: AccessContext
): SQL | undefined {
  if (context.isSuperAdmin) return undefined;

  const conditions = getAdminAssignments(context)
    .map((assignment) => {
      const parts: (SQL | undefined)[] = [];
      if (assignment.districtId) {
        parts.push(eq(teamRegistrationRequests.districtId, assignment.districtId));
      }
      if (assignment.schoolId) {
        parts.push(eq(teamRegistrationRequests.schoolId, assignment.schoolId));
      }
      if (assignment.programId) {
        parts.push(eq(teamRegistrationRequests.programId, assignment.programId));
      }
      return and(...parts);
    })
    .filter((c): c is SQL => Boolean(c));
  return conditions.length > 0 ? or(...conditions) : MATCH_NONE;
}

export function buildManagedReimbursementWhere(
  context: AccessContext
): SQL | undefined {
  if (context.isSuperAdmin) return undefined;

  const conditions = getAdminAssignments(context).map((assignment) => {
    const teamCondition = buildTeamCondition(assignment);
    const managedTeamIds = db.select({ id: teams.id }).from(teams);
    return inArray(
      reimbursementRequests.teamId,
      teamCondition ? managedTeamIds.where(teamCondition) : managedTeamIds
    );
  });
  return conditions.length > 0 ? or(...conditions) : MATCH_NONE;
}
