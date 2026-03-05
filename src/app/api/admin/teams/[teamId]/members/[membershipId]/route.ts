import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ teamId: string; membershipId: string }> },
) {
  try {
    await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { teamId, membershipId } = await params;

  const membership = await db.teamMembership.findFirst({
    where: { id: membershipId, teamId },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "Membership not found" },
      { status: 404 },
    );
  }

  await db.teamMembership.delete({ where: { id: membershipId } });

  return NextResponse.json({ ok: true });
}
