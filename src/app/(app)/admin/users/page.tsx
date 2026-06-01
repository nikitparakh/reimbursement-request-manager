import { unauthorized } from "next/navigation";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { auth } from "@/auth";
import { canManageUsers, getCachedAccessContext } from "@/lib/access";
import { db } from "@/lib/db";
import {
  schools,
  teamMemberships,
  teams,
  userScopeRoles,
  users as usersTable,
} from "@/db/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { UsersTable } from "@/components/admin/users-table";
import type { ScopeOption } from "@/components/admin/user-scope-manager";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  const access = await getCachedAccessContext(session.user.id);
  if (!access.canManageUsers) unauthorized();

  // School scope filter: super admins see all schools; otherwise restrict to
  // schools the admin manages (by explicit schoolId or by owning the district).
  const schoolScopeConditions = access.isSuperAdmin
    ? []
    : access.scopedRoles
        .filter((scope) => scope.role === "SCHOOL_ADMIN")
        .map((scope) => {
          if (scope.schoolId) {
            return eq(schools.id, scope.schoolId);
          }
          if (scope.districtId) {
            return eq(schools.districtId, scope.districtId);
          }
          return null;
        })
        .filter((cond): cond is NonNullable<typeof cond> => Boolean(cond));

  // Non-super-admins with no school scope conditions must match no schools.
  const managedSchoolWhere = access.isSuperAdmin
    ? undefined
    : schoolScopeConditions.length > 0
      ? or(...schoolScopeConditions)
      : inArray(schools.id, []);

  const [managedSchools, programs] = await Promise.all([
    db.query.schools.findMany({
      where: managedSchoolWhere,
      columns: {
        id: true,
        name: true,
        districtId: true,
      },
      with: {
        district: { columns: { name: true } },
      },
      orderBy: (school, { asc }) => [asc(school.name)],
    }),
    db.query.programs.findMany({
      columns: { id: true, name: true, code: true },
      orderBy: (program, { asc }) => asc(program.code),
    }),
  ]);

  // Sort by district name then school name to match the previous ordering.
  managedSchools.sort((a, b) => {
    const districtCompare = (a.district?.name ?? "").localeCompare(
      b.district?.name ?? ""
    );
    if (districtCompare !== 0) return districtCompare;
    return a.name.localeCompare(b.name);
  });

  const managedSchoolIds = managedSchools.map((school) => school.id);
  const managedDistrictIds = Array.from(
    new Set(managedSchools.map((school) => school.districtId))
  );

  // Resolve the set of users to display. For non-super-admins the original
  // Prisma query matched users who either have an approved membership on a team
  // in a managed school, OR a scoped role in a managed school/district. D1's
  // relational query API can't express nested relation filters, so resolve the
  // matching user ids with explicit lookups first.
  let userIds: string[] | undefined;
  if (!access.isSuperAdmin) {
    const [membershipUserRows, scopeUserRows] = await Promise.all([
      managedSchoolIds.length > 0
        ? db
            .select({ userId: teamMemberships.userId })
            .from(teamMemberships)
            .innerJoin(teams, eq(teamMemberships.teamId, teams.id))
            .where(
              and(
                eq(teamMemberships.approved, true),
                inArray(teams.schoolId, managedSchoolIds)
              )
            )
        : Promise.resolve([] as { userId: string }[]),
      managedSchoolIds.length > 0 || managedDistrictIds.length > 0
        ? db
            .select({ userId: userScopeRoles.userId })
            .from(userScopeRoles)
            .where(
              or(
                managedSchoolIds.length > 0
                  ? inArray(userScopeRoles.schoolId, managedSchoolIds)
                  : undefined,
                managedDistrictIds.length > 0
                  ? inArray(userScopeRoles.districtId, managedDistrictIds)
                  : undefined
              )
            )
        : Promise.resolve([] as { userId: string }[]),
    ]);

    userIds = Array.from(
      new Set([
        ...membershipUserRows.map((row) => row.userId),
        ...scopeUserRows.map((row) => row.userId),
      ])
    );
  }

  const users =
    !access.isSuperAdmin && userIds && userIds.length === 0
      ? []
      : await db.query.users.findMany({
          where:
            access.isSuperAdmin || !userIds
              ? undefined
              : inArray(usersTable.id, userIds),
          with: {
            memberships: {
              where: eq(teamMemberships.approved, true),
              with: {
                team: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            scopedRoles: {
              with: {
                school: { columns: { id: true, name: true } },
                program: { columns: { id: true, name: true } },
                team: { columns: { id: true, name: true } },
              },
              orderBy: (scope, { asc }) => [asc(scope.role), asc(scope.createdAt)],
            },
          },
          orderBy: (user, { asc }) => asc(user.createdAt),
        });

  const scopeOptions: ScopeOption[] = managedSchools.flatMap((school) => {
    const programOptions = programs.map((program) => ({
      key: `PROGRAM_ADMIN:${school.id}:${program.id}`,
      role: "PROGRAM_ADMIN" as const,
      schoolId: school.id,
      programId: program.id,
      label: `Program Admin · ${school.name} · ${program.name}`,
    }));

    if (!access.isSuperAdmin) {
      return programOptions;
    }

    return [
      {
        key: `SCHOOL_ADMIN:${school.id}`,
        role: "SCHOOL_ADMIN" as const,
        schoolId: school.id,
        label: `School Admin · ${school.name}`,
      },
      ...programOptions,
    ];
  });

  const userRows = users.map((u) => ({
    id: u.id,
    name: u.name ?? "",
    email: u.email,
    globalRole: u.role,
    scopedRoles: u.scopedRoles
      .filter(
        (scope) =>
          scope.role === "SCHOOL_ADMIN" || scope.role === "PROGRAM_ADMIN"
      )
      .map((scope) => ({
        id: scope.id,
        label:
          scope.role === "SCHOOL_ADMIN"
            ? `School Admin · ${scope.school?.name ?? "Unknown school"}`
            : `Program Admin · ${scope.school?.name ?? "Unknown school"} · ${scope.program?.name ?? "Unknown program"}`,
      })),
    managedScopes: u.scopedRoles.flatMap((scope) => {
      if (scope.role !== "SCHOOL_ADMIN" && scope.role !== "PROGRAM_ADMIN") {
        return [];
      }

      if (scope.role === "SCHOOL_ADMIN" && !access.isSuperAdmin) {
        return [];
      }

      if (
        scope.role === "PROGRAM_ADMIN" &&
        !canManageUsers(access, {
          districtId: scope.districtId ?? undefined,
          schoolId: scope.schoolId ?? undefined,
        })
      ) {
        return [];
      }

      return [
        {
          id: scope.id,
          role: scope.role,
          label:
            scope.role === "SCHOOL_ADMIN"
              ? `School Admin · ${scope.school?.name ?? "Unknown school"}`
              : `Program Admin · ${scope.school?.name ?? "Unknown school"} · ${scope.program?.name ?? "Unknown program"}`,
        },
      ];
    }),
    memberships: u.memberships.map((m) => ({
      id: m.id,
      teamName: m.team.name,
      roleInTeam: m.roleInTeam,
    })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Users"
        badge={<StatusBadge status={`${users.length} users`} />}
        description={
          access.isSuperAdmin
            ? "Manage global roles, scoped admin access, and team memberships."
            : "Manage scoped admin access and team memberships in your school scope."
        }
      />

      <Card>
        <CardContent>
          <UsersTable
            users={userRows}
            canEditGlobalRoles={access.isSuperAdmin}
            canManageScopes={access.canManageUsers}
            scopeOptions={scopeOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
