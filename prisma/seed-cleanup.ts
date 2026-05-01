import type { PrismaClient } from "@prisma/client";

const LEGACY_TEAM_SCOPED_ROLES = ["COACH", "PARENT_MENTOR"] as const;

type PrismaUserScopeRoleClient = Pick<PrismaClient, "userScopeRole">;

export async function cleanupLegacyTeamScopedRoles(
  prisma: PrismaUserScopeRoleClient,
) {
  return prisma.userScopeRole.deleteMany({
    where: {
      role: {
        in: [...LEGACY_TEAM_SCOPED_ROLES],
      },
    },
  });
}
