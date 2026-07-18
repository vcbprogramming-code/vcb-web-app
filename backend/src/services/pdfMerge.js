import { PDFDocument } from 'pdf-lib';
import { query, queryOne } from '../config/db.js';
import { putObject, deleteObject, getObjectBuffer } from '../config/storage.js';
import { parseXlsxToSheets, renderSheetTablePdf } from './sheetPdf.js';

// Attachment content types we can fold into the single combined PDF.
const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const isPdf = (ct) => (ct || '').toLowerCase().includes('pdf');
const isImage = (ct) => IMAGE_TYPES.has((ct || '').toLowerCase());
// .xlsx → rendered to table page(s) and appended (not embeddable as-is)
const isXlsx = (ct, name) =>
  /spreadsheetml|officedocument\.spreadsheet/i.test(ct || '') || /\.xlsx$/i.test(name || '');

/**
 * Append an image (jpg/png) as one full A4 page, scaled to fit with a margin.
 */
async function addImagePage(outPdf, bytes, contentType) {
  const img = (contentType || '').toLowerCase().includes('png')
    ? await outPdf.embedPng(bytes)
    : await outPdf.embedJpg(bytes);
  // A4 portrait in points
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 36;
  const page = outPdf.addPage([pageW, pageH]);
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, {
    x: (pageW - w) / 2,
    y: (pageH - h) / 2,
    width: w,
    height: h,
  });
}

/**
 * Build ONE combined PDF for a document: the generated letter first, then each
 * PDF / image supplementary attachment (สิ่งที่ส่งมาด้วย) appended in upload
 * order. Word/Excel and other non-PDF/non-image files are skipped (and their
 * names returned so the caller can warn the user).
 *
 * Stored as a generated attachment with kind='combined_pdf'. Returns
 * { id, storage_key, file_name, skipped: [names] } — or null if there's no
 * base letter PDF yet.
 */
export async function generateCombinedPdf(documentId, uploadedBy = null) {
  const doc = await queryOne(
    'select id, doc_number, run_no, status from documents where id = $1',
    [documentId]
  );
  if (!doc) throw new Error('Document not found');

  // base letter: the approved (signed) version if it exists, else the original
  const base = await queryOne(
    `select storage_key from document_attachments
      where document_id = $1 and kind = 'generated_pdf'
      order by (version = 'approved') desc, created_at desc
      limit 1`,
    [documentId]
  );
  if (!base) return null; // no letter generated yet — nothing to combine

  // supplementary uploads, in upload order
  const { rows: uploads } = await query(
    `select file_name, content_type, storage_key
       from document_attachments
      where document_id = $1 and kind = 'upload'
      order by created_at`,
    [documentId]
  );

  const outPdf = await PDFDocument.create();
  const skipped = [];

  // 1) the letter itself
  const baseBytes = await getObjectBuffer(base.storage_key);
  const basePdf = await PDFDocument.load(baseBytes);
  const basePages = await outPdf.copyPages(basePdf, basePdf.getPageIndices());
  basePages.forEach((p) => outPdf.addPage(p));

  // 2) each attachment that is a PDF or an image
  for (const att of uploads) {
    try {
      if (isPdf(att.content_type)) {
        const bytes = await getObjectBuffer(att.storage_key);
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await outPdf.copyPages(src, src.getPageIndices());
        pages.forEach((p) => outPdf.addPage(p));
      } else if (isImage(att.content_type)) {
        const bytes = await getObjectBuffer(att.storage_key);
        await addImagePage(outPdf, bytes, att.content_type);
      } else if (isXlsx(att.content_type, att.file_name)) {
        // render the spreadsheet as table page(s), then append like a PDF
        const bytes = await getObjectBuffer(att.storage_key);
        const { sheets, truncated } = await parseXlsxToSheets(bytes);
        const sheetBytes = await renderSheetTablePdf(sheets, { title: att.file_name, truncated });
        const src = await PDFDocument.load(sheetBytes);
        const pages = await outPdf.copyPages(src, src.getPageIndices());
        pages.forEach((p) => outPdf.addPage(p));
      } else {
        skipped.push(att.file_name);
      }
    } catch {
      // a corrupt/unreadable attachment shouldn't kill the whole merge
      skipped.push(att.file_name);
    }
  }

  const merged = Buffer.from(await outPdf.save());
  const key = `documents/${doc.id}/combined-${doc.run_no}.pdf`;
  await putObject(key, merged, 'application/pdf');

  // replace any previous combined file
  const old = await query(
    `select id, storage_key from document_attachments
      where document_id = $1 and kind = 'combined_pdf'`,
    [documentId]
  );
  for (const o of old.rows) {
    // don't delete the object we just wrote (combined key is deterministic, so an
    // old combined row shares the same key) — that would orphan the fresh file → 404
    if (o.storage_key !== key) await deleteObject(o.storage_key).catch(() => {});
    await query('delete from document_attachments where id = $1', [o.id]);
  }

  const row = await queryOne(
    `insert into document_attachments
       (document_id, kind, version, file_name, content_type, size_bytes, storage_key, uploaded_by)
     values ($1,'combined_pdf',null,$2,'application/pdf',$3,$4,$5)
     returning id, storage_key, file_name, created_at`,
    [doc.id, `${doc.doc_number.replace(/\//g, '-')}-รวมเอกสาร.pdf`, merged.length, key, uploadedBy]
  );
  return { ...row, skipped };
}

/**
 * Auto-rebuild the combined "one file" PDF when there's something to combine —
 * at least one PDF/image supplementary attachment. Fire-and-forget (never blocks
 * the request); no-op when there are no inline attachments. Re-run it after the
 * letter changes (edit, approval) so the merged file reflects the latest letter.
 */
export async function autoCombine(documentId, uploadedBy = null) {
  try {
    const hasInline = await queryOne(
      `select 1 from document_attachments
        where document_id = $1 and kind = 'upload'
          and (content_type ilike 'application/pdf%' or content_type ilike 'image/%'
               or content_type ilike '%spreadsheetml%' or file_name ilike '%.xlsx')
        limit 1`,
      [documentId]
    );
    if (!hasInline) return;
    await generateCombinedPdf(documentId, uploadedBy);
  } catch (e) {
    console.error('auto-combine failed:', e.message);
  }
}
