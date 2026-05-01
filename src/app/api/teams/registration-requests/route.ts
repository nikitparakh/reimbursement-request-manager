import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";

const schema = z.object({
  districtId: z.string().min(1),
  schoolId: z.string().min(1),
  programId: z.string().min(1),
  teamName: z.string().min(2),
  shortCode: z.string().max(12).optional(),
  glAccount: z.string().max(30).optional(),
  fllDivision: z.enum(["DISCOVER", "EXPLORE", "CHALLENGE"]).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  let userId = "";
  try {
    const user = await requireUser();
    userId = user.id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const [school, program] = await Promise.all([
    db.school.findUnique({
      where: { id: body.data.schoolId },
      select: { id: true, districtId: true },
    }),
    db.program.findUnique({
      where: { id: body.data.programId },
      select: { id: true, code: true },
    }),
  ]);
  if (!school || !program) {
    return NextResponse.json(
      { error: "Selected school or program is invalid." },
      { status: 400 }
    );
  }
  if (school.districtId !== body.data.districtId) {
    return NextResponse.json(
      { error: "Selected school does not belong to the chosen district." },
      { status: 400 }
    );
  }
  if (body.data.fllDivision && program.code !== "FLL") {
    return NextResponse.json(
      { error: "FLL division can only be set for FLL team requests." },
      { status: 400 }
    );
  }

  const created = await db.teamRegistrationRequest.create({
    data: {
      districtId: body.data.districtId,
      schoolId: body.data.schoolId,
      programId: body.data.programId,
      teamName: body.data.teamName,
      shortCode: body.data.shortCode,
      glAccount: body.data.glAccount,
      fllDivision: body.data.fllDivision,
      notes: body.data.notes,
      requestedById: userId,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
