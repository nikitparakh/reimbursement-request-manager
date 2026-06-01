import { NextResponse } from "next/server";
import { z } from "zod";
import { and, count, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit/log";

const schema = z.object({
  role: z.enum(["USER", "SUPER_ADMIN"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let actorId = "";
  try {
    actorId = (await requireSuperAdmin()).id;
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { id } = await params;

  const target = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nextRole = body.data.role;
  const isDemotion = target.role === "SUPER_ADMIN" && nextRole !== "SUPER_ADMIN";

  if (isDemotion) {
    // Block a super-admin from demoting themselves.
    if (id === actorId) {
      return NextResponse.json(
        { error: "You cannot remove your own super-admin role." },
        { status: 409 }
      );
    }

    // Block demoting the last remaining super-admin, which would
    // irreversibly lock the org out of global administration.
    const [remaining] = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.role, "SUPER_ADMIN"), ne(users.id, id)));
    if (!remaining || remaining.value === 0) {
      return NextResponse.json(
        { error: "Cannot demote the last super-admin." },
        { status: 409 }
      );
    }
  }

  const [user] = await db
    .update(users)
    .set({ role: nextRole })
    .where(eq(users.id, id))
    .returning();

  if (user.role !== target.role) {
    await logAuditEvent({
      actorId,
      eventType: "USER_ROLE_CHANGED",
      message: `Role changed from ${target.role} to ${user.role}`,
      metadata: {
        targetUserId: id,
        previousRole: target.role,
        newRole: user.role,
      },
    });
  }

  return NextResponse.json({ id: user.id, role: user.role });
}
