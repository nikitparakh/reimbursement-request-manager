import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { receiptFiles } from "@/db/schema";
import { requireUser } from "@/lib/rbac";
import { recomputeRequestTotal } from "@/lib/jobs/process-receipt";
import { getRequestAccess } from "@/lib/reimbursements/request-access";
import { deleteStoredObject } from "@/lib/storage";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ requestId: string; receiptId: string }> }
) {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId, receiptId } = await params;
  const requestAccess = await getRequestAccess(userId, requestId);
  if (!requestAccess || !requestAccess.canView) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!requestAccess.canEditDraft) {
    return NextResponse.json(
      { error: "Receipts can only be deleted from draft requests" },
      { status: 400 }
    );
  }

  const receipt = await db.query.receiptFiles.findFirst({
    where: eq(receiptFiles.id, receiptId),
  });

  if (!receipt || receipt.requestId !== requestId) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  // Remove the backing blob first; if this throws we abort before deleting the
  // DB row, so the client never sees a phantom-removed-then-restored receipt.
  await deleteStoredObject(receipt.storageUrl).catch(() => {});

  await db.delete(receiptFiles).where(eq(receiptFiles.id, receiptId));

  // Recompute is best-effort: the row is already gone, so a failure here must
  // not 500 the caller (which would falsely re-show the deleted receipt). The
  // total self-heals on the next transition/edit.
  try {
    await recomputeRequestTotal(requestId);
  } catch {
    // ignore — total reconciles on the next write
  }

  return NextResponse.json({ deleted: true });
}
