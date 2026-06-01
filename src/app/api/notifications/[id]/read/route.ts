import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/rbac";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const notification = await db.query.notifications.findFirst({
    where: eq(notifications.id, id),
  });

  if (!notification || notification.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // IDOR guard: scope the write to the caller's own notification so a user can
  // only ever mark THEIR OWN notification read, even under a concurrent change.
  const [updated] = await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();

  return NextResponse.json(updated);
}
