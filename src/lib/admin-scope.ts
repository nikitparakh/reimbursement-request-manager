import type { Prisma } from "@prisma/client";
import type { AccessContext, ScopedRoleAssignment } from "@/lib/access";

function getAdminAssignments(context: AccessContext) {
  return context.scopedRoles.filter(
    (assignment) =>
      assignment.role === "SCHOOL_ADMIN" || assignment.role === "PROGRAM_ADMIN"
  );
}

function buildTeamCondition(assignment: ScopedRoleAssignment): Prisma.TeamWhereInput {
  const condition: Prisma.TeamWhereInput = {};

  if (assignment.teamId) {
    condition.id = assignment.teamId;
  }

  if (assignment.schoolId) {
    condition.schoolId = assignment.schoolId;
  } else if (assignment.districtId) {
    condition.school = { districtId: assignment.districtId };
  }

  if (assignment.programId) {
    condition.programId = assignment.programId;
  }

  return condition;
}

function buildRegistrationCondition(
  assignment: ScopedRoleAssignment
): Prisma.TeamRegistrationRequestWhereInput {
  const condition: Prisma.TeamRegistrationRequestWhereInput = {};

  if (assignment.districtId) {
    condition.districtId = assignment.districtId;
  }
  if (assignment.schoolId) {
    condition.schoolId = assignment.schoolId;
  }
  if (assignment.programId) {
    condition.programId = assignment.programId;
  }

  return condition;
}

function denyAllTeamWhere(): Prisma.TeamWhereInput {
  return { id: { in: [] } };
}

function denyAllTeamRegistrationWhere(): Prisma.TeamRegistrationRequestWhereInput {
  return { id: { in: [] } };
}

function denyAllReimbursementWhere(): Prisma.ReimbursementRequestWhereInput {
  return { id: { in: [] } };
}

export function buildManagedTeamWhere(context: AccessContext): Prisma.TeamWhereInput {
  if (context.isSuperAdmin) {
    return {};
  }

  const conditions = getAdminAssignments(context).map(buildTeamCondition);
  return conditions.length > 0 ? { OR: conditions } : denyAllTeamWhere();
}

export function buildManagedTeamRegistrationWhere(
  context: AccessContext
): Prisma.TeamRegistrationRequestWhereInput {
  if (context.isSuperAdmin) {
    return {};
  }

  const conditions = getAdminAssignments(context).map(buildRegistrationCondition);
  return conditions.length > 0 ? { OR: conditions } : denyAllTeamRegistrationWhere();
}

export function buildManagedReimbursementWhere(
  context: AccessContext
): Prisma.ReimbursementRequestWhereInput {
  if (context.isSuperAdmin) {
    return {};
  }

  const conditions: Prisma.ReimbursementRequestWhereInput[] = getAdminAssignments(context).map(
    (assignment) => ({
    team: buildTeamCondition(assignment),
    })
  );

  return conditions.length > 0 ? { OR: conditions } : denyAllReimbursementWhere();
}
