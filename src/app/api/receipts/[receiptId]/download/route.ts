import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { receiptFiles, teamMemberships } from "@/db/schema";
import { requireUser } from "@/lib/rbac";
import { readStoredObject } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { receiptId } = await params;
  const receipt = await db.query.receiptFiles.findFirst({
    where: eq(receiptFiles.id, receiptId),
    with: { request: { columns: { createdById: true, teamId: true } } },
  });

  if (!receipt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canView =
    receipt.request.createdById === userId ||
    (await db.query.teamMemberships.findFirst({
      where: and(
        eq(teamMemberships.userId, userId),
        eq(teamMemberships.teamId, receipt.request.teamId),
        eq(teamMemberships.approved, true)
      ),
    })) !== undefined;

  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bytes = await readStoredObject(receipt.storageUrl);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": receipt.mimeType,
      "Content-Disposition": `inline; filename="${receipt.fileName}"`,
    },
  });
}
