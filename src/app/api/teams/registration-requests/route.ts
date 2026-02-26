import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";

const schema = z.object({
  teamName: z.string().min(2),
  shortCode: z.string().max(12).optional(),
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

  const created = await db.teamRegistrationRequest.create({
    data: {
      teamName: body.data.teamName,
      shortCode: body.data.shortCode,
      notes: body.data.notes,
      requestedById: userId,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
