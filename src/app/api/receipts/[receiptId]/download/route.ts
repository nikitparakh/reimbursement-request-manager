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

  // Only serve a content type from a known-safe allowlist; anything else (e.g.
  // an uploaded text/html or image/svg+xml) is downgraded to a generic binary
  // type so the browser can't render it inline as same-origin active content.
  const SAFE_CONTENT_TYPES = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
  ]);
  const contentType = SAFE_CONTENT_TYPES.has(receipt.mimeType)
    ? receipt.mimeType
    : "application/octet-stream";

  // RFC 5987-encode the filename, and keep an ASCII-only fallback for older
  // clients. Strip control chars / quotes from the fallback defensively.
  const asciiFallback = receipt.fileName.replace(/["\\\r\n]/g, "_");
  const encodedFilename = encodeURIComponent(receipt.fileName);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
