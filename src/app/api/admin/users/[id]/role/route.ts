import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/rbac";

const schema = z.object({
  role: z.enum(["USER", "SUPER_ADMIN"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const [user] = await db
    .update(users)
    .set({ role: body.data.role })
    .where(eq(users.id, id))
    .returning();

  return NextResponse.json({ id: user.id, role: user.role });
}
