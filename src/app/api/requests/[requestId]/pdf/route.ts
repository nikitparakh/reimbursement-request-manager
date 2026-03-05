import { NextResponse } from "next/server";
import { PDFDocument as PDFLibDocument } from "pdf-lib";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { readStoredObject } from "@/lib/storage";
import { generateRequestPdf } from "@/lib/pdf/generate-request-pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  let user: { id: string; role: string };
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;
  const request = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
    include: {
      team: true,
      createdBy: true,
      receiptFiles: {
        include: {
          extraction: {
            include: { lineItems: { orderBy: { position: "asc" } } },
          },
        },
      },
      approvals: { include: { actor: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isCreator = request.createdById === user.id;
  const isAdmin = user.role === "ADMIN";
  const isTeamMember =
    !isCreator &&
    !isAdmin &&
    (await db.teamMembership.findFirst({
      where: { userId: user.id, teamId: request.teamId, approved: true },
    })) !== null;

  if (!isCreator && !isAdmin && !isTeamMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const receiptBuffers = new Map<string, { buffer: Buffer; mimeType: string }>();
  await Promise.all(
    request.receiptFiles.map(async (f) => {
      try {
        const bytes = await readStoredObject(f.storageUrl);
        receiptBuffers.set(f.id, { buffer: Buffer.from(bytes), mimeType: f.mimeType });
      } catch (err) {
        console.error(`[PDF] Failed to read receipt ${f.id}:`, err);
      }
    }),
  );

  const reportPdf = await generateRequestPdf(request);
  const merged = await appendReceipts(reportPdf, request.receiptFiles, receiptBuffers);
  const safeTitle = request.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);

  return new NextResponse(Buffer.from(merged), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle}.pdf"`,
    },
  });
}

type ReceiptFile = { id: string; fileName: string; mimeType: string };

async function appendReceipts(
  reportBytes: Buffer,
  files: ReceiptFile[],
  buffers: Map<string, { buffer: Buffer; mimeType: string }>,
): Promise<Uint8Array> {
  const merged = await PDFLibDocument.load(reportBytes);

  for (const file of files) {
    const data = buffers.get(file.id);
    if (!data) continue;

    try {
      if (data.mimeType === "application/pdf") {
        const src = await PDFLibDocument.load(data.buffer);
        const pages = await merged.copyPages(src, src.getPageIndices());
        for (const page of pages) merged.addPage(page);
      } else if (data.mimeType === "image/jpeg" || data.mimeType === "image/jpg") {
        const img = await merged.embedJpg(data.buffer);
        const page = merged.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      } else if (data.mimeType === "image/png") {
        const img = await merged.embedPng(data.buffer);
        const page = merged.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
    } catch (err) {
      console.error(`[PDF] Failed to embed receipt ${file.id} (${file.mimeType}):`, err);
    }
  }

  return merged.save();
}
