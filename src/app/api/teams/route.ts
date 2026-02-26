import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

const createSchema = z.object({
  name: z.string().min(2),
  shortCode: z.string().max(12).optional(),
});

export async function GET() {
  const teams = await db.team.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(teams);
}

export async function POST(request: Request) {
  try {
    await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const team = await db.team.create({
    data: {
      name: body.data.name,
      shortCode: body.data.shortCode,
    },
  });
  return NextResponse.json(team, { status: 201 });
}
