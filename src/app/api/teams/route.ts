import { NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { programs, schools, teams } from "@/db/schema";
import { requireSuperAdmin, requireUser } from "@/lib/rbac";

const listSchema = z.object({
  schoolId: z.string().min(1).optional(),
  programId: z.string().min(1).optional(),
});

const createSchema = z.object({
  schoolId: z.string().min(1),
  programId: z.string().min(1),
  name: z.string().min(2),
  shortCode: z.string().max(12).optional(),
  glAccount: z.string().max(30).optional(),
  fllDivision: z.enum(["DISCOVER", "EXPLORE", "CHALLENGE"]).optional(),
});

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = listSchema.safeParse({
    schoolId: new URL(request.url).searchParams.get("schoolId") ?? undefined,
    programId: new URL(request.url).searchParams.get("programId") ?? undefined,
  });
  if (!query.success) {
    return NextResponse.json({ error: query.error.flatten() }, { status: 400 });
  }

  const hasSchoolFilter = Boolean(query.data.schoolId);
  const hasProgramFilter = Boolean(query.data.programId);
  if (hasSchoolFilter !== hasProgramFilter) {
    return NextResponse.json(
      { error: "schoolId and programId must be provided together." },
      { status: 400 }
    );
  }
  if (!hasSchoolFilter && user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "schoolId and programId are required for this request." },
      { status: 400 }
    );
  }

  const teamsList = await db.query.teams.findMany({
    where: and(
      eq(teams.active, true),
      ...(query.data.schoolId ? [eq(teams.schoolId, query.data.schoolId)] : []),
      ...(query.data.programId ? [eq(teams.programId, query.data.programId)] : [])
    ),
    orderBy: asc(teams.name),
    columns: {
      id: true,
      schoolId: true,
      programId: true,
      name: true,
      shortCode: true,
      fllDivision: true,
    },
  });
  return NextResponse.json(teamsList);
}

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const [school, program] = await Promise.all([
    db.query.schools.findFirst({
      where: eq(schools.id, body.data.schoolId),
      columns: { id: true },
    }),
    db.query.programs.findFirst({
      where: eq(programs.id, body.data.programId),
      columns: { id: true, code: true },
    }),
  ]);

  if (!school || !program) {
    return NextResponse.json(
      { error: "Selected school or program is invalid." },
      { status: 400 }
    );
  }
  if (body.data.fllDivision && program.code !== "FLL") {
    return NextResponse.json(
      { error: "FLL division can only be set for FLL teams." },
      { status: 400 }
    );
  }

  const [team] = await db
    .insert(teams)
    .values({
      schoolId: school.id,
      programId: program.id,
      name: body.data.name,
      shortCode: body.data.shortCode,
      glAccount: body.data.glAccount,
      fllDivision: body.data.fllDivision,
    })
    .returning();
  return NextResponse.json(team, { status: 201 });
}
