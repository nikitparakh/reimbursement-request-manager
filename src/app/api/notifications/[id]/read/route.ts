import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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
  const notification = await db.notification.findUnique({ where: { id } });

  if (!notification || notification.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.notification.update({
    where: { id },
    data: { read: true },
  });

  return NextResponse.json(updated);
}
