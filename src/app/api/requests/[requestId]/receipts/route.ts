import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { uploadReceiptFile } from "@/lib/storage";
import { enqueueReceiptParseJob } from "@/lib/jobs/enqueue-parse";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;
  const reimbursementRequest = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
  });

  if (!reimbursementRequest || reimbursementRequest.createdById !== userId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (reimbursementRequest.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Receipts can only be added while request is draft" },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const created = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await uploadReceiptFile({
      fileName: file.name,
      mimeType: file.type,
      body: bytes,
    });

    const receipt = await db.receiptFile.create({
      data: {
        requestId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        storageUrl: stored.url,
        parseStatus: "QUEUED",
      },
    });
    created.push(receipt);
    void enqueueReceiptParseJob(receipt.id);
  }

  return NextResponse.json({ receipts: created }, { status: 201 });
}
