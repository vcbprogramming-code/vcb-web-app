// PDF generation. PDFKit for making pages, pdf-lib for merging them.
//
// THE THAI FONT IS NOT OPTIONAL. PDFKit's built-in fonts (Helvetica and
// friends) have no Thai glyphs, and PDFKit does not error on a missing glyph —
// it writes nothing. Thai text silently vanishes and you get a blank-looking
// document with correct margins. Every document here is at least partly Thai,
// so registerFonts() runs before any text is drawn.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { PDFDocument as PdfLibDocument } from 'pdf-lib';

const here = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(here, '..', '..', 'assets', 'fonts');

const FONTS = {
  Sarabun: 'Sarabun-Regular.ttf',
  'Sarabun-Bold': 'Sarabun-Bold.ttf',
};

/** Throws at startup if the fonts are missing, rather than producing blank PDFs. */
export function assertFontsPresent() {
  const missing = Object.values(FONTS).filter((f) => !fs.existsSync(path.join(FONT_DIR, f)));
  if (missing.length) {
    throw new Error(
      `Thai fonts missing from ${FONT_DIR}: ${missing.join(', ')}. ` +
        'Without them Thai text is dropped from every PDF without an error. ' +
        'Download Sarabun from Google Fonts and place the .ttf files there.'
    );
  }
}

function registerFonts(doc) {
  for (const [name, file] of Object.entries(FONTS)) {
    doc.registerFont(name, path.join(FONT_DIR, file));
  }
  doc.font('Sarabun');
}

/**
 * Create a document with Thai fonts already registered and selected.
 *
 *   const doc = createDocument();
 *   doc.fontSize(16).text('รายงาน');
 *   const buf = await toBuffer(doc);
 */
export function createDocument(options = {}) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: { Producer: 'VCB Connect', ...(options.info || {}) },
    ...options,
  });
  registerFonts(doc);
  return doc;
}

/** Finish a document and collect it into a Buffer. */
export function toBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/** Merge PDFs, in order, into one. */
export async function mergePdfs(buffers) {
  const out = await PdfLibDocument.create();
  for (const buf of buffers) {
    const src = await PdfLibDocument.load(buf);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return Buffer.from(await out.save());
}

/**
 * Draw a simple table. Written here rather than pulled from a library because
 * the stack forbids UI kits and the table needs Thai-aware wrapping anyway.
 *
 * columns: [{ key, label, width, align }]
 */
export function drawTable(doc, columns, rows, opts = {}) {
  const startX = opts.x ?? doc.page.margins.left;
  const rowHeight = opts.rowHeight ?? 22;
  const fontSize = opts.fontSize ?? 10;
  let y = opts.y ?? doc.y;

  const header = () => {
    doc.font('Sarabun-Bold').fontSize(fontSize);
    let x = startX;
    for (const col of columns) {
      doc.text(col.label, x + 4, y + 6, { width: col.width - 8, align: col.align || 'left' });
      x += col.width;
    }
    const totalWidth = columns.reduce((s, c) => s + c.width, 0);
    doc
      .moveTo(startX, y + rowHeight)
      .lineTo(startX + totalWidth, y + rowHeight)
      .stroke();
    y += rowHeight;
    doc.font('Sarabun');
  };

  header();

  for (const row of rows) {
    // New page before the row is drawn, not after it overflows.
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      header();
    }
    let x = startX;
    for (const col of columns) {
      const value = row[col.key];
      doc.text(value == null ? '' : String(value), x + 4, y + 6, {
        width: col.width - 8,
        align: col.align || 'left',
        lineBreak: false,
      });
      x += col.width;
    }
    y += rowHeight;
  }

  doc.y = y;
  return y;
}
