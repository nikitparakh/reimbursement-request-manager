import PDFDocument from "pdfkit";
import type {
  ApprovalActionRow,
  ReceiptExtractionRow,
  ReceiptFileRow,
  ReceiptLineItemRow,
  ReimbursementRequestRow,
  TeamRow,
  UserRow,
} from "@/db/schema";
import { formatCurrency, formatDate } from "@/lib/format";

type FullRequest = ReimbursementRequestRow & {
  team: TeamRow;
  createdBy: UserRow;
  receiptFiles: (ReceiptFileRow & {
    extraction: (ReceiptExtractionRow & { lineItems: ReceiptLineItemRow[] }) | null;
  })[];
  approvals: (ApprovalActionRow & { actor: UserRow })[];
};

const M = 50;
const PAGE_W = 612;
const CONTENT_W = PAGE_W - M * 2;

function statusLabel(s: string) {
  return s.replace(/_/g, " ");
}

function hr(doc: PDFKit.PDFDocument) {
  doc.strokeColor("#cbd5e1").lineWidth(0.5)
    .moveTo(M, doc.y).lineTo(PAGE_W - M, doc.y).stroke();
}

function resetX(doc: PDFKit.PDFDocument) {
  doc.x = M;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - M) doc.addPage();
}

export async function generateRequestPdf(
  request: FullRequest,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: M });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    writeHeader(doc, request);
    writeSummary(doc, request);
    writeReceipts(doc, request);
    writeTimeline(doc, request);

    doc.end();
  });
}

function writeHeader(doc: PDFKit.PDFDocument, req: FullRequest) {
  doc.font("Helvetica-Bold").fontSize(22).fillColor("#0f172a")
    .text(req.title, M, M, { width: CONTENT_W });

  resetX(doc);
  const headerParts = [req.team.name];
  if (req.team.glAccount) headerParts.push(`GL: ${req.team.glAccount}`);
  headerParts.push(statusLabel(req.status));
  doc.font("Helvetica").fontSize(10).fillColor("#64748b")
    .text(headerParts.join("  ·  "), M, doc.y + 4, { width: CONTENT_W });

  doc.y += 14;
  hr(doc);
  doc.y += 10;
}

function writeSummary(doc: PDFKit.PDFDocument, req: FullRequest) {
  const col1 = M;
  const col2 = M + 170;
  const col3 = M + 340;

  const row1Y = doc.y;
  writeField(doc, col1, row1Y, "Requested Total", formatCurrency(Number(req.requestedTotal)), true);
  const a1 = doc.y;
  writeField(doc, col2, row1Y, "Submitter", req.createdBy.email, false);
  const a2 = doc.y;
  writeField(doc, col3, row1Y, "Status", statusLabel(req.status), false);
  doc.y = Math.max(a1, a2, doc.y) + 8;

  const row2Y = doc.y;
  writeField(doc, col1, row2Y, "Created", formatDate(req.createdAt), false);
  const b1 = doc.y;
  writeField(doc, col2, row2Y, "Submitted", formatDate(req.submittedAt), false);
  doc.y = Math.max(b1, doc.y) + 4;

  if (req.description) {
    resetX(doc);
    doc.font("Helvetica").fontSize(8).fillColor("#64748b")
      .text("Description", M, doc.y, { width: CONTENT_W });
    doc.font("Helvetica").fontSize(9).fillColor("#334155")
      .text(req.description, M, doc.y, { width: CONTENT_W });
    doc.y += 4;
  }

  hr(doc);
  doc.y += 12;
}

function writeField(
  doc: PDFKit.PDFDocument, x: number, startY: number,
  label: string, value: string, bold: boolean,
) {
  doc.font("Helvetica").fontSize(8).fillColor("#64748b")
    .text(label, x, startY, { width: 160 });
  const valFont = bold ? "Helvetica-Bold" : "Helvetica";
  const valSize = bold ? 14 : 10;
  doc.font(valFont).fontSize(valSize).fillColor("#0f172a")
    .text(value, x, startY + 10, { width: 160 });
}

function writeReceipts(doc: PDFKit.PDFDocument, req: FullRequest) {
  if (req.receiptFiles.length === 0) return;

  ensureSpace(doc, 60);
  resetX(doc);
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a")
    .text("Receipts & Line Items", M, doc.y, { width: CONTENT_W });
  doc.y += 8;

  for (const file of req.receiptFiles) {
    ensureSpace(doc, 60);
    resetX(doc);

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a")
      .text(file.fileName, M, doc.y, { width: CONTENT_W });

    const ext = file.extraction;
    if (!ext) {
      doc.font("Helvetica").fontSize(8).fillColor("#94a3b8")
        .text("No extraction data", M, doc.y, { width: CONTENT_W });
      doc.y += 12;
      continue;
    }

    const meta: string[] = [];
    if (ext.merchant) meta.push(ext.merchant);
    if (ext.receiptDate) meta.push(formatDate(ext.receiptDate));
    if (ext.documentType !== "OTHER") meta.push(ext.documentType);
    if (meta.length > 0) {
      doc.font("Helvetica").fontSize(8).fillColor("#64748b")
        .text(meta.join("  ·  "), M, doc.y, { width: CONTENT_W });
    }
    doc.y += 6;

    if (ext.lineItems.length > 0) {
      writeLineItemsTable(doc, ext.lineItems);
    }

    const totals: string[] = [];
    if (ext.subtotal !== null) totals.push(`Subtotal: ${formatCurrency(Number(ext.subtotal))}`);
    if (ext.tax !== null && Number(ext.tax) > 0) totals.push(`Tax: ${formatCurrency(Number(ext.tax))}`);
    if (ext.total !== null) totals.push(`Total: ${formatCurrency(Number(ext.total))}`);
    if (totals.length > 0) {
      resetX(doc);
      doc.font("Helvetica").fontSize(8).fillColor("#64748b")
        .text(totals.join("    "), M, doc.y, { width: CONTENT_W });
    }
    doc.y += 14;
  }

  hr(doc);
  doc.y += 12;
}

type LineItem = FullRequest["receiptFiles"][number]["extraction"] extends infer E
  ? E extends { lineItems: infer L } ? L : never : never;

const TBL = {
  desc: M,
  qty: M + 240,
  unit: M + 290,
  total: M + 360,
  cat: M + 430,
} as const;
const TBL_WIDTHS = {
  desc: 235,
  qty: 45,
  unit: 65,
  total: 65,
  cat: CONTENT_W - 430,
};

function writeLineItemsTable(doc: PDFKit.PDFDocument, items: LineItem) {
  ensureSpace(doc, 24);

  const headerY = doc.y;
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#64748b");
  doc.text("DESCRIPTION", TBL.desc, headerY, { width: TBL_WIDTHS.desc });
  doc.text("QTY", TBL.qty, headerY, { width: TBL_WIDTHS.qty });
  doc.text("UNIT PRICE", TBL.unit, headerY, { width: TBL_WIDTHS.unit });
  doc.text("LINE TOTAL", TBL.total, headerY, { width: TBL_WIDTHS.total });
  doc.text("CATEGORY", TBL.cat, headerY, { width: TBL_WIDTHS.cat });

  doc.y = headerY + 12;
  doc.strokeColor("#e2e8f0").lineWidth(0.3)
    .moveTo(M, doc.y).lineTo(PAGE_W - M, doc.y).stroke();
  doc.y += 4;

  for (const item of items) {
    ensureSpace(doc, 16);
    const rowY = doc.y;
    const excluded = item.excludedAt !== null;
    const color = excluded ? "#94a3b8" : "#1e293b";

    doc.font("Helvetica").fontSize(8).fillColor(color);

    const desc = excluded ? `${item.description} (excluded)` : item.description;
    doc.text(desc, TBL.desc, rowY, { width: TBL_WIDTHS.desc });
    const descBottom = doc.y;

    doc.text(item.quantity?.toString() ?? "", TBL.qty, rowY, { width: TBL_WIDTHS.qty });
    doc.text(item.unitPrice ? formatCurrency(Number(item.unitPrice)) : "", TBL.unit, rowY, { width: TBL_WIDTHS.unit });
    doc.text(item.lineTotal ? formatCurrency(Number(item.lineTotal)) : "", TBL.total, rowY, { width: TBL_WIDTHS.total });
    doc.text(item.category ?? "", TBL.cat, rowY, { width: TBL_WIDTHS.cat });

    doc.y = Math.max(descBottom, rowY + 12) + 2;
  }

  doc.y += 4;
  doc.fillColor("#0f172a");
  resetX(doc);
}

function writeTimeline(doc: PDFKit.PDFDocument, req: FullRequest) {
  if (req.approvals.length === 0) return;

  ensureSpace(doc, 50);
  resetX(doc);
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a")
    .text("Approval Timeline", M, doc.y, { width: CONTENT_W });
  doc.y += 8;

  for (const a of req.approvals) {
    ensureSpace(doc, 36);
    resetX(doc);

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a")
      .text(`${a.action}  —  ${a.actor.email}`, M, doc.y, { width: CONTENT_W });

    doc.font("Helvetica").fontSize(8).fillColor("#64748b")
      .text(formatDate(a.createdAt), M, doc.y, { width: CONTENT_W });

    if (a.comment) {
      doc.font("Helvetica-Oblique").fontSize(8).fillColor("#475569")
        .text(`"${a.comment}"`, M, doc.y, { width: CONTENT_W });
    }
    doc.y += 6;
  }
}

