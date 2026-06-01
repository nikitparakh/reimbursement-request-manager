import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  teamMemberships as teamMembershipsTable,
  userScopeRoles,
  users,
  type GlobalRole,
  type ScopedRole,
  type TeamMembershipRole,
  type TeamMembershipRow,
  type UserScopeRoleRow,
} from "@/db/schema";
import { assertUserScopeBoundary } from "@/lib/user-scope-role";

export type ScopedRoleAssignment = Pick<
  UserScopeRoleRow,
  "role" | "districtId" | "schoolId" | "programId" | "teamId"
>;

export type AccessTarget = {
  districtId?: string | null;
  schoolId?: string | null;
  programId?: string | null;
  teamId?: string | null;
};

type TeamMembershipAssignment = Pick<TeamMembershipRow, "roleInTeam" | "teamId">;

export type AccessContext = {
  userId: string;
  globalRole: GlobalRole;
  scopedRoles: ScopedRoleAssignment[];
  teamMemberships: TeamMembershipAssignment[];
  scope: {
    districtIds: string[];
    schoolIds: string[];
    programIds: string[];
    teamIds: string[];
  };
  isSuperAdmin: boolean;
  isSchoolAdmin: boolean;
  isProgramAdmin: boolean;
  isAdmin: boolean;
  isCoach: boolean;
  isParentMentor: boolean;
  canManageUsers: boolean;
  canManageTeams: boolean;
  canManageTeamRequests: boolean;
  canManageReimbursements: boolean;
  canReviewReimbursements: boolean;
};

type BuildAccessContextInput = {
  userId: string;
  globalRole: GlobalRole;
  scopedRoles: ScopedRoleAssignment[];
  teamMemberships?: TeamMembershipAssignment[];
};

function uniqueDefined(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function assertScopedRoleAssignments(scopedRoles: ScopedRoleAssignment[]) {
  for (const assignment of scopedRoles) {
    assertUserScopeBoundary(assignment);
  }
}

function uniqueTeamIds(values: TeamMembershipAssignment[]) {
  return Array.from(new Set(values.map((value) => value.teamId)));
}

function hasApprovedTeamMembershipRole(
  teamMemberships: TeamMembershipAssignment[],
  roles: TeamMembershipRole[],
  target?: AccessTarget
) {
  if (target && !target.teamId) {
    return false;
  }

  return teamMemberships.some(
    (membership) =>
      roles.includes(membership.roleInTeam) &&
      (!target?.teamId || membership.teamId === target.teamId)
  );
}

const inflightAccessContextLoads = new Map<string, Promise<AccessContext>>();

function matchesScopedRoleAssignment(
  assignment: ScopedRoleAssignment,
  target: AccessTarget
) {
  // A program-scope with no district/school bound must NOT silently match teams
  // across every school/district. Program and district/school are independent
  // dimensions on a team, so a programId match is authoritative only when it is
  // also constrained to a school/district (or a specific team) the admin owns.
  // Treat a program-scope lacking any of those as insufficient for any action.
  if (
    assignment.programId &&
    !assignment.districtId &&
    !assignment.schoolId &&
    !assignment.teamId
  ) {
    return false;
  }

  if (assignment.districtId && target.districtId !== assignment.districtId) {
    return false;
  }
  if (assignment.schoolId && target.schoolId !== assignment.schoolId) {
    return false;
  }
  if (assignment.programId && target.programId !== assignment.programId) {
    return false;
  }
  if (assignment.teamId && target.teamId !== assignment.teamId) {
    return false;
  }
  return true;
}

export function buildAccessContext({
  userId,
  globalRole,
  scopedRoles,
  teamMemberships = [],
}: BuildAccessContextInput): AccessContext {
  assertScopedRoleAssignments(scopedRoles);
  const isSuperAdmin = globalRole === "SUPER_ADMIN";
  const isSchoolAdmin = scopedRoles.some(
    (assignment) => assignment.role === "SCHOOL_ADMIN"
  );
  const isProgramAdmin = scopedRoles.some(
    (assignment) => assignment.role === "PROGRAM_ADMIN"
  );
  const coachMemberships = teamMemberships.filter(
    (assignment) => assignment.roleInTeam === "COACH"
  );
  const parentMentorMemberships = teamMemberships.filter(
    (assignment) => assignment.roleInTeam === "PARENT_MENTOR"
  );
  const isCoach = coachMemberships.length > 0;
  const isParentMentor = parentMentorMemberships.length > 0;
  const isAdmin = isSuperAdmin || isSchoolAdmin || isProgramAdmin;

  return {
    userId,
    globalRole,
    scopedRoles,
    teamMemberships,
    scope: {
      districtIds: uniqueDefined(scopedRoles.map((assignment) => assignment.districtId)),
      schoolIds: uniqueDefined(scopedRoles.map((assignment) => assignment.schoolId)),
      programIds: uniqueDefined(scopedRoles.map((assignment) => assignment.programId)),
      teamIds: uniqueDefined([
        ...scopedRoles.map((assignment) => assignment.teamId),
        ...uniqueTeamIds(teamMemberships),
      ]),
    },
    isSuperAdmin,
    isSchoolAdmin,
    isProgramAdmin,
    isAdmin,
    isCoach,
    isParentMentor,
    canManageUsers: isSuperAdmin || isSchoolAdmin,
    canManageTeams: isAdmin,
    canManageTeamRequests: isAdmin,
    canManageReimbursements: isAdmin,
    canReviewReimbursements: isAdmin || isCoach,
  };
}

function hasScopedRole(
  context: AccessContext,
  roles: ScopedRole[],
  target?: AccessTarget
) {
  if (context.isSuperAdmin) {
    return true;
  }

  return context.scopedRoles.some((assignment) => {
    if (!roles.includes(assignment.role)) {
      return false;
    }

    return target ? matchesScopedRoleAssignment(assignment, target) : true;
  });
}

export function canManageUsers(context: AccessContext, target?: AccessTarget) {
  if (context.isSuperAdmin) {
    return true;
  }

  return hasScopedRole(context, ["SCHOOL_ADMIN"], target);
}

export function canManageTeams(context: AccessContext, target?: AccessTarget) {
  if (context.isSuperAdmin) {
    return true;
  }

  return hasScopedRole(context, ["SCHOOL_ADMIN", "PROGRAM_ADMIN"], target);
}

export function canManageTeamRequests(context: AccessContext, target?: AccessTarget) {
  return canManageTeams(context, target);
}

export function canManageReimbursements(
  context: AccessContext,
  target?: AccessTarget
) {
  return canManageTeams(context, target);
}

export function canAccessTeam(context: AccessContext, target: AccessTarget) {
  return (
    canManageTeams(context, target) ||
    hasApprovedTeamMembershipRole(
      context.teamMemberships,
      ["COACH", "PARENT_MENTOR"],
      target
    )
  );
}

async function loadAccessContext(userId: string) {
  const [user, scopedRoles, teamMemberships] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    }),
    db.query.userScopeRoles.findMany({
      where: eq(userScopeRoles.userId, userId),
      columns: {
        role: true,
        districtId: true,
        schoolId: true,
        programId: true,
        teamId: true,
      },
      orderBy: [asc(userScopeRoles.role), asc(userScopeRoles.createdAt)],
    }),
    db.query.teamMemberships.findMany({
      where: and(
        eq(teamMembershipsTable.userId, userId),
        eq(teamMembershipsTable.approved, true)
      ),
      columns: {
        roleInTeam: true,
        teamId: true,
      },
      orderBy: [
        asc(teamMembershipsTable.roleInTeam),
        asc(teamMembershipsTable.createdAt),
      ],
    }),
  ]);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return buildAccessContext({
    userId,
    globalRole: user.role,
    scopedRoles,
    teamMemberships,
  });
}

export async function getAccessContext(userId: string) {
  return loadAccessContext(userId);
}

export function getCachedAccessContext(userId: string) {
  const existingLoad = inflightAccessContextLoads.get(userId);
  if (existingLoad) {
    return existingLoad;
  }

  const loadPromise = loadAccessContext(userId).finally(() => {
    inflightAccessContextLoads.delete(userId);
  });

  inflightAccessContextLoads.set(userId, loadPromise);
  return loadPromise;
}
