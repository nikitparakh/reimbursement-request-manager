import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageUsers, getAccessContext } from "@/lib/access";
import { db } from "@/lib/db";
import { programs, schools, userScopeRoles, users } from "@/db/schema";
import { requireUser } from "@/lib/rbac";
import { buildUserScopeRoleKey } from "@/lib/user-scope-role";

const createSchema = z.object({
  role: z.enum(["SCHOOL_ADMIN", "PROGRAM_ADMIN"]),
  schoolId: z.string(),
  programId: z.string().optional(),
});

const deleteSchema = z.object({
  scopeId: z.string(),
});

function canManageScopeRole(
  access: Awaited<ReturnType<typeof getAccessContext>>,
  role: "SCHOOL_ADMIN" | "PROGRAM_ADMIN",
  school: { id: string; districtId: string }
) {
  if (access.isSuperAdmin) {
    return true;
  }

  if (role !== "PROGRAM_ADMIN") {
    return false;
  }

  return canManageUsers(access, {
    districtId: school.districtId,
    schoolId: school.id,
  });
}

function serializeScope(scope: {
  id: string;
  role: string;
  schoolId: string | null;
  school?: { name: string } | null;
  programId: string | null;
  program?: { name: string } | null;
}) {
  return {
    id: scope.id,
    role: scope.role,
    schoolId: scope.schoolId,
    schoolName: scope.school?.name ?? null,
    programId: scope.programId,
    programName: scope.program?.name ?? null,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let actorId = "";
  try {
    actorId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const [access, school, program, targetUser] = await Promise.all([
    getAccessContext(actorId),
    db.query.schools.findFirst({
      where: eq(schools.id, body.data.schoolId),
      columns: { id: true, districtId: true, name: true },
    }),
    body.data.programId
      ? db.query.programs.findFirst({
          where: eq(programs.id, body.data.programId),
          columns: { id: true, name: true },
        })
      : Promise.resolve(null),
    db.query.users.findFirst({
      where: eq(users.id, id),
      columns: { id: true },
    }),
  ]);

  if (!school || !targetUser) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (body.data.role === "PROGRAM_ADMIN" && !program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }
  if (body.data.role === "PROGRAM_ADMIN" && !body.data.programId) {
    return NextResponse.json(
      { error: "Program admin assignments require a program" },
      { status: 400 }
    );
  }
  if (!canManageScopeRole(access, body.data.role, school)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scopeKey = buildUserScopeRoleKey({
    districtId: school.districtId,
    schoolId: school.id,
    programId: body.data.programId ?? null,
  });
  const findExistingScope = () =>
    db.query.userScopeRoles.findFirst({
      where: and(
        eq(userScopeRoles.userId, id),
        eq(userScopeRoles.role, body.data.role),
        eq(userScopeRoles.scopeKey, scopeKey)
      ),
      with: {
        school: { columns: { name: true } },
        program: { columns: { name: true } },
      },
    });
  const existing = await findExistingScope();
  if (existing) {
    return NextResponse.json(serializeScope(existing), { status: 200 });
  }

  try {
    const [created] = await db
      .insert(userScopeRoles)
      .values({
        userId: id,
        role: body.data.role,
        districtId: school.districtId,
        schoolId: school.id,
        programId: body.data.programId ?? null,
        scopeKey,
      })
      .returning();

    const scope = await db.query.userScopeRoles.findFirst({
      where: eq(userScopeRoles.id, created.id),
      with: {
        school: { columns: { name: true } },
        program: { columns: { name: true } },
      },
    });

    return NextResponse.json(serializeScope(scope ?? created), { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(error.message)
    ) {
      const existingAfterRace = await findExistingScope();

      if (existingAfterRace) {
        return NextResponse.json(serializeScope(existingAfterRace), {
          status: 200,
        });
      }
    }

    throw error;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let actorId = "";
  try {
    actorId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = deleteSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const [access, scope] = await Promise.all([
    getAccessContext(actorId),
    db.query.userScopeRoles.findFirst({
      where: eq(userScopeRoles.id, body.data.scopeId),
      with: {
        school: {
          columns: {
            id: true,
            districtId: true,
          },
        },
      },
    }),
  ]);

  if (!scope || scope.userId !== id || !scope.school) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (scope.role !== "SCHOOL_ADMIN" && scope.role !== "PROGRAM_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageScopeRole(access, scope.role, scope.school)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(userScopeRoles).where(eq(userScopeRoles.id, scope.id));

  return NextResponse.json({ deleted: true });
}
