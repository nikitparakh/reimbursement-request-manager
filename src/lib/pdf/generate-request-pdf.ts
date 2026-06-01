import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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

const PAGE_W = 612;
const PAGE_H = 792;
const M = 50;
const CONTENT_W = PAGE_W - M * 2;

// slate palette
const C = {
  slate900: hex("#0f172a"),
  slate800: hex("#1e293b"),
  slate700: hex("#334155"),
  slate600: hex("#475569"),
  slate500: hex("#64748b"),
  slate400: hex("#94a3b8"),
  slate300: hex("#cbd5e1"),
  slate200: hex("#e2e8f0"),
};

function hex(value: string) {
  const n = parseInt(value.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ");
}

// Keep text within what the WinAnsi-encoded standard fonts can represent so a
// stray Unicode character in receipt data never throws mid-render.
function sanitize(text: string) {
  return text.replace(
    /[^\t\n\r\x20-\x7E\xA0-\xFF–—‘’“”•…]/g,
    "?"
  );
}

type Fonts = { reg: PDFFont; bold: PDFFont; oblique: PDFFont };

/**
 * Minimal top-down layout engine over pdf-lib (origin is bottom-left, so we
 * track `y` as distance from the top and convert when drawing).
 */
class Builder {
  page: PDFPage;
  y = M;
  constructor(
    readonly doc: PDFDocument,
    readonly fonts: Fonts
  ) {
    this.page = doc.addPage([PAGE_W, PAGE_H]);
  }

  ensure(needed: number) {
    if (this.y + needed > PAGE_H - M) {
      this.page = this.doc.addPage([PAGE_W, PAGE_H]);
      this.y = M;
    }
  }

  private wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
    const lines: string[] = [];
    for (const rawLine of sanitize(text).split("\n")) {
      let current = "";
      for (const word of rawLine.split(/\s+/)) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
          current = candidate;
        } else {
          lines.push(current);
          current = word;
        }
      }
      lines.push(current);
    }
    return lines;
  }

  /** Draw text with its top at `topY` (from page top); returns height consumed. */
  drawAt(
    x: number,
    topY: number,
    text: string,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; width?: number }
  ): number {
    const font = opts.font ?? this.fonts.reg;
    const size = opts.size ?? 10;
    const color = opts.color ?? C.slate900;
    const width = opts.width ?? CONTENT_W;
    const lineHeight = size * 1.2;
    const lines = this.wrap(text, font, size, width);
    lines.forEach((line, i) => {
      this.page.drawText(line, {
        x,
        y: PAGE_H - topY - size - i * lineHeight,
        size,
        font,
        color,
      });
    });
    return lines.length * lineHeight;
  }

  /** Draw at the current cursor and advance it. */
  flow(
    text: string,
    opts: { x?: number; font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; width?: number } = {}
  ) {
    const consumed = this.drawAt(opts.x ?? M, this.y, text, opts);
    this.y += consumed;
  }

  hr(color = C.slate300, thickness = 0.5) {
    this.page.drawLine({
      start: { x: M, y: PAGE_H - this.y },
      end: { x: PAGE_W - M, y: PAGE_H - this.y },
      thickness,
      color,
    });
  }
}

export async function generateRequestPdf(request: FullRequest): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    reg: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    oblique: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const b = new Builder(doc, fonts);

  writeHeader(b, request);
  writeSummary(b, request);
  writeReceipts(b, request);
  writeTimeline(b, request);

  return Buffer.from(await doc.save());
}

function writeHeader(b: Builder, req: FullRequest) {
  b.flow(req.title, { font: b.fonts.bold, size: 22, color: C.slate900, width: CONTENT_W });
  b.y += 2;

  const headerParts = [req.team.name];
  if (req.team.glAccount) headerParts.push(`GL: ${req.team.glAccount}`);
  headerParts.push(statusLabel(req.status));
  b.flow(headerParts.join("  ·  "), { size: 10, color: C.slate500 });

  b.y += 10;
  b.hr();
  b.y += 10;
}

function writeSummary(b: Builder, req: FullRequest) {
  const col1 = M;
  const col2 = M + 170;
  const col3 = M + 340;

  const row1Y = b.y;
  const h1 = writeField(b, col1, row1Y, "Requested Total", formatCurrency(Number(req.requestedTotal)), true);
  const h2 = writeField(b, col2, row1Y, "Submitter", req.createdBy.email, false);
  const h3 = writeField(b, col3, row1Y, "Status", statusLabel(req.status), false);
  b.y = row1Y + Math.max(h1, h2, h3) + 8;

  const row2Y = b.y;
  const h4 = writeField(b, col1, row2Y, "Created", formatDate(req.createdAt), false);
  const h5 = writeField(b, col2, row2Y, "Submitted", formatDate(req.submittedAt), false);
  b.y = row2Y + Math.max(h4, h5) + 6;

  if (req.description) {
    b.flow("Description", { size: 8, color: C.slate500 });
    b.y += 1;
    b.flow(req.description, { size: 9, color: C.slate700 });
    b.y += 4;
  }

  b.hr();
  b.y += 12;
}

/** Draws a label + value at a fixed column; returns the column's total height. */
function writeField(
  b: Builder,
  x: number,
  topY: number,
  label: string,
  value: string,
  bold: boolean
): number {
  b.drawAt(x, topY, label, { size: 8, color: C.slate500, width: 160 });
  const valFont = bold ? b.fonts.bold : b.fonts.reg;
  const valSize = bold ? 14 : 10;
  const valH = b.drawAt(x, topY + 12, value, { font: valFont, size: valSize, color: C.slate900, width: 160 });
  return 12 + valH;
}

const TBL = { desc: M, qty: M + 240, unit: M + 290, total: M + 360, cat: M + 430 } as const;
const TBL_W = { desc: 235, qty: 45, unit: 65, total: 65, cat: CONTENT_W - 430 };

function writeReceipts(b: Builder, req: FullRequest) {
  if (req.receiptFiles.length === 0) return;

  b.ensure(60);
  b.flow("Receipts & Line Items", { font: b.fonts.bold, size: 14, color: C.slate900 });
  b.y += 8;

  for (const file of req.receiptFiles) {
    b.ensure(60);
    b.flow(file.fileName, { font: b.fonts.bold, size: 10, color: C.slate900 });

    const ext = file.extraction;
    if (!ext) {
      b.flow("No extraction data", { size: 8, color: C.slate400 });
      b.y += 6;
      continue;
    }

    const meta: string[] = [];
    if (ext.merchant) meta.push(ext.merchant);
    if (ext.receiptDate) meta.push(formatDate(ext.receiptDate));
    if (ext.documentType !== "OTHER") meta.push(ext.documentType);
    if (meta.length > 0) {
      b.flow(meta.join("  ·  "), { size: 8, color: C.slate500 });
    }
    b.y += 4;

    if (ext.lineItems.length > 0) {
      writeLineItemsTable(b, ext.lineItems);
    }

    const totals: string[] = [];
    if (ext.subtotal !== null) totals.push(`Subtotal: ${formatCurrency(Number(ext.subtotal))}`);
    if (ext.tax !== null && Number(ext.tax) > 0) totals.push(`Tax: ${formatCurrency(Number(ext.tax))}`);
    if (ext.total !== null) totals.push(`Total: ${formatCurrency(Number(ext.total))}`);
    if (totals.length > 0) {
      b.flow(totals.join("    "), { size: 8, color: C.slate500 });
    }
    b.y += 12;
  }

  b.hr();
  b.y += 12;
}

function writeLineItemsTable(b: Builder, items: ReceiptLineItemRow[]) {
  b.ensure(24);

  const headerY = b.y;
  b.drawAt(TBL.desc, headerY, "DESCRIPTION", { font: b.fonts.bold, size: 7, color: C.slate500, width: TBL_W.desc });
  b.drawAt(TBL.qty, headerY, "QTY", { font: b.fonts.bold, size: 7, color: C.slate500, width: TBL_W.qty });
  b.drawAt(TBL.unit, headerY, "UNIT PRICE", { font: b.fonts.bold, size: 7, color: C.slate500, width: TBL_W.unit });
  b.drawAt(TBL.total, headerY, "LINE TOTAL", { font: b.fonts.bold, size: 7, color: C.slate500, width: TBL_W.total });
  b.drawAt(TBL.cat, headerY, "CATEGORY", { font: b.fonts.bold, size: 7, color: C.slate500, width: TBL_W.cat });

  b.y = headerY + 12;
  b.hr(C.slate200, 0.3);
  b.y += 4;

  for (const item of items) {
    b.ensure(16);
    const rowY = b.y;
    const excluded = item.excludedAt !== null;
    const color = excluded ? C.slate400 : C.slate800;

    const desc = excluded ? `${item.description} (excluded)` : item.description;
    const descH = b.drawAt(TBL.desc, rowY, desc, { size: 8, color, width: TBL_W.desc });
    b.drawAt(TBL.qty, rowY, item.quantity?.toString() ?? "", { size: 8, color, width: TBL_W.qty });
    b.drawAt(TBL.unit, rowY, item.unitPrice ? formatCurrency(Number(item.unitPrice)) : "", { size: 8, color, width: TBL_W.unit });
    b.drawAt(TBL.total, rowY, item.lineTotal ? formatCurrency(Number(item.lineTotal)) : "", { size: 8, color, width: TBL_W.total });
    b.drawAt(TBL.cat, rowY, item.category ?? "", { size: 8, color, width: TBL_W.cat });

    b.y = rowY + Math.max(descH, 12) + 2;
  }

  b.y += 4;
}

function writeTimeline(b: Builder, req: FullRequest) {
  if (req.approvals.length === 0) return;

  b.ensure(50);
  b.flow("Approval Timeline", { font: b.fonts.bold, size: 14, color: C.slate900 });
  b.y += 8;

  for (const a of req.approvals) {
    b.ensure(36);
    b.flow(`${a.action}  —  ${a.actor.email}`, { font: b.fonts.bold, size: 9, color: C.slate900 });
    b.flow(formatDate(a.createdAt), { size: 8, color: C.slate500 });
    if (a.comment) {
      b.flow(`“${a.comment}”`, { font: b.fonts.oblique, size: 8, color: C.slate600 });
    }
    b.y += 6;
  }
}
