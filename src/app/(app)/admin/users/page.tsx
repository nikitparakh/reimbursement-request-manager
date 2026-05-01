import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { canManageUsers, getCachedAccessContext } from "@/lib/access";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UsersTable } from "@/components/admin/users-table";
import type { ScopeOption } from "@/components/admin/user-scope-manager";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  const access = await getCachedAccessContext(session.user.id);
  if (!access.canManageUsers) unauthorized();

  const managedSchoolWhere = access.isSuperAdmin
    ? {}
    : {
        OR: access.scopedRoles
          .filter((scope) => scope.role === "SCHOOL_ADMIN")
          .map((scope) => {
            if (scope.schoolId) {
              return { id: scope.schoolId };
            }
            if (scope.districtId) {
              return { districtId: scope.districtId };
            }
            return null;
          })
          .filter((scope): scope is NonNullable<typeof scope> => Boolean(scope)),
      };

  const [managedSchools, programs] = await Promise.all([
    db.school.findMany({
      where: managedSchoolWhere,
      select: {
        id: true,
        name: true,
        districtId: true,
        district: { select: { name: true } },
      },
      orderBy: [{ district: { name: "asc" } }, { name: "asc" }],
    }),
    db.program.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const managedSchoolIds = managedSchools.map((school) => school.id);
  const managedDistrictIds = Array.from(
    new Set(managedSchools.map((school) => school.districtId))
  );

  const users = await db.user.findMany({
    where: access.isSuperAdmin
      ? undefined
      : {
          OR: [
            {
              memberships: {
                some: {
                  approved: true,
                  team: { schoolId: { in: managedSchoolIds } },
                },
              },
            },
            {
              scopedRoles: {
                some: {
                  OR: [
                    { schoolId: { in: managedSchoolIds } },
                    { districtId: { in: managedDistrictIds } },
                  ],
                },
              },
            },
          ],
        },
    include: {
      memberships: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        where: { approved: true },
      },
      scopedRoles: {
        include: {
          school: { select: { id: true, name: true } },
          program: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { createdAt: "asc" },
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
        badge={<Badge status={`${users.length} users`} />}
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
