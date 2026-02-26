import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

const schema = z.object({
  role: z.enum(["STUDENT", "MANAGER", "ADMIN"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const user = await db.user.update({
    where: { id },
    data: { role: body.data.role },
  });

  return NextResponse.json({ id: user.id, role: user.role });
}
