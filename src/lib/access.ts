import type {
  GlobalRole,
  ScopedRole,
  TeamMembership,
  TeamMembershipRole,
  UserScopeRole,
} from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { assertUserScopeBoundary } from "@/lib/user-scope-role";

export type ScopedRoleAssignment = Pick<
  UserScopeRole,
  "role" | "districtId" | "schoolId" | "programId" | "teamId"
>;

export type AccessTarget = {
  districtId?: string | null;
  schoolId?: string | null;
  programId?: string | null;
  teamId?: string | null;
};

export type TeamMembershipAssignment = Pick<TeamMembership, "roleInTeam" | "teamId">;

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

export function hasScopedRole(
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

export function canReviewReimbursements(
  context: AccessContext,
  target?: AccessTarget
) {
  return (
    canManageReimbursements(context, target) ||
    hasApprovedTeamMembershipRole(context.teamMemberships, ["COACH"], target)
  );
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
    db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
    db.userScopeRole.findMany({
      where: { userId },
      select: {
        role: true,
        districtId: true,
        schoolId: true,
        programId: true,
        teamId: true,
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    db.teamMembership.findMany({
      where: { userId, approved: true },
      select: {
        roleInTeam: true,
        teamId: true,
      },
      orderBy: [{ roleInTeam: "asc" }, { createdAt: "asc" }],
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

export async function requireAccessContext() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }

  return getAccessContext(session.user.id);
}
