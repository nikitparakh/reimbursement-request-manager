export type UserScopeBoundaryInput = {
  districtId?: string | null;
  schoolId?: string | null;
  programId?: string | null;
  teamId?: string | null;
};

export function hasUserScopeBoundary(input: UserScopeBoundaryInput) {
  return Boolean(
    input.districtId || input.schoolId || input.programId || input.teamId
  );
}

export function assertUserScopeBoundary(input: UserScopeBoundaryInput) {
  if (!hasUserScopeBoundary(input)) {
    throw new Error("INVALID_SCOPED_ROLE_ASSIGNMENT");
  }
}

export function buildUserScopeRoleKey(input: UserScopeBoundaryInput) {
  assertUserScopeBoundary(input);

  return [
    `district:${input.districtId ?? "_"}`,
    `school:${input.schoolId ?? "_"}`,
    `program:${input.programId ?? "_"}`,
    `team:${input.teamId ?? "_"}`,
  ].join("|");
}
