import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { receiptFiles } from "@/db/schema";
import { requireUser } from "@/lib/rbac";
import { uploadReceiptFile, deleteStoredObject } from "@/lib/storage";
import { getRequestAccess } from "@/lib/reimbursements/request-access";

// Server-side allowlist of accepted receipt types. Enforced by both MIME type
// and file extension so a forged Content-Type can't smuggle an unexpected blob.
const ALLOWED_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
};

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per file
const MAX_FILES_PER_REQUEST = 20;

function fileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

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
  const requestAccess = await getRequestAccess(userId, requestId);

  if (!requestAccess || !requestAccess.canView) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (!requestAccess.canEditDraft) {
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

  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { error: `You can upload at most ${MAX_FILES_PER_REQUEST} receipts at a time` },
      { status: 400 }
    );
  }

  // Validate every file up front so we never partially commit a mixed batch.
  for (const file of files) {
    const allowedExtensions = ALLOWED_TYPES[file.type];
    if (!allowedExtensions) {
      return NextResponse.json(
        { error: "Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP, HEIC" },
        { status: 400 }
      );
    }
    if (!allowedExtensions.includes(fileExtension(file.name))) {
      return NextResponse.json(
        { error: "File extension does not match its type" },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File is too large (max 15 MB per receipt)" },
        { status: 400 }
      );
    }
  }

  const created = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Guard against a truncated/streamed File whose declared size lied.
    if (bytes.byteLength > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File is too large (max 15 MB per receipt)" },
        { status: 400 }
      );
    }

    const stored = await uploadReceiptFile({
      fileName: file.name,
      mimeType: file.type,
      body: bytes,
    });

    try {
      const [receipt] = await db
        .insert(receiptFiles)
        .values({
          requestId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          storageUrl: stored.url,
          parseStatus: "QUEUED",
        })
        .returning();
      created.push(receipt);
    } catch {
      // The blob landed in R2 but the DB row failed — delete the orphan so we
      // never leak storage, then surface a friendly error.
      await deleteStoredObject(stored.url).catch(() => {});
      return NextResponse.json(
        { error: "Failed to save receipt. Please try again." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ receipts: created }, { status: 201 });
}
