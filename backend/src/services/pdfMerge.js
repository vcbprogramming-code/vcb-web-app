import { PDFDocument } from 'pdf-lib';
import zlib from 'node:zlib';
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

// The largest picture we will try to lay onto a page. Anything beyond this is a
// scanner artefact or a crafted file, not a site photo.
const MAX_IMAGE_PIXELS = 80_000_000; // ~80 MP

/**
 * Decide whether an image is safe to hand to pdf-lib.
 *
 * A TRUNCATED PNG — valid signature and IHDR, but the pixel data cut short —
 * makes pdf-lib's decoder spin forever. It never throws, so try/catch cannot
 * save us, and because the loop is synchronous it blocks Node's event loop:
 * one damaged attachment takes the whole API down for every user until someone
 * restarts the process. That is exactly how production died on 2 Aug 2026.
 *
 * So the file is validated up front: walk the chunk table, require IEND, and
 * actually inflate the pixel data. Costs ~1ms and turns a fatal hang into a
 * skipped attachment the user is told about.
 *
 * @returns {string|null} null when safe, otherwise the reason it was rejected.
 */
export function imageRejectReason(bytes, contentType) {
  const ct = (contentType || '').toLowerCase();
  if (!Buffer.isBuffer(bytes) || bytes.length < 24) return 'ไฟล์ภาพว่างหรือเล็กผิดปกติ';

  if (ct.includes('png')) {
    if (bytes.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return 'ไม่ใช่ไฟล์ PNG ที่ถูกต้อง';
    const idat = [];
    let off = 8;
    let sawIhdr = false;
    let sawIend = false;
    let width = 0;
    let height = 0;
    while (off + 8 <= bytes.length) {
      const len = bytes.readUInt32BE(off);
      const type = bytes.slice(off + 4, off + 8).toString('latin1');
      const end = off + 12 + len; // length + type + data + CRC
      // a length that runs past the end of the file means the file is truncated
      if (len > bytes.length || end > bytes.length) return 'ไฟล์ภาพไม่สมบูรณ์ (ข้อมูลขาดหาย)';
      if (type === 'IHDR') {
        sawIhdr = true;
        width = bytes.readUInt32BE(off + 8);
        height = bytes.readUInt32BE(off + 12);
      } else if (type === 'IDAT') {
        idat.push(bytes.slice(off + 8, off + 8 + len));
      } else if (type === 'IEND') { sawIend = true; break; }
      off = end;
    }
    if (!sawIhdr || !sawIend) return 'ไฟล์ภาพไม่สมบูรณ์ (โครงสร้างไม่ครบ)';
    if (!width || !height) return 'ไฟล์ภาพไม่ระบุขนาด';
    if (width * height > MAX_IMAGE_PIXELS) return 'ไฟล์ภาพมีความละเอียดสูงเกินกำหนด';
    if (!idat.length) return 'ไฟล์ภาพไม่มีข้อมูลภาพ';
    try { zlib.inflateSync(Buffer.concat(idat)); } catch { return 'ไฟล์ภาพเสียหาย (ข้อมูลภาพอ่านไม่ได้)'; }
    return null;
  }

  // JPEG: must start with SOI and end with EOI, or the decoder can run off the end
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 'ไม่ใช่ไฟล์ JPEG ที่ถูกต้อง';
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    return 'ไฟล์ภาพไม่สมบูรณ์ (ข้อมูลขาดหาย)';
  }
  return null;
}

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

  // base letter: prefer the approved (signed) version ONLY when the document is
  // actually approved. A rejected/returned doc still has an old approved PDF on
  // file — combining that would show a signed letter for a doc that was rejected.
  const preferApproved = doc.status === 'approved';
  let base = null;
  if (!preferApproved) {
    base = await queryOne(
      `select storage_key from document_attachments
        where document_id = $1 and kind = 'generated_pdf' and version <> 'approved'
        order by created_at desc limit 1`,
      [documentId]
    );
  }
  if (!base) {
    base = await queryOne(
      `select storage_key from document_attachments
        where document_id = $1 and kind = 'generated_pdf'
        order by (version = 'approved') desc, created_at desc limit 1`,
      [documentId]
    );
  }
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
        // never hand an unverified image to the decoder — see imageRejectReason
        const bad = imageRejectReason(bytes, att.content_type);
        if (bad) {
          console.error(`ข้ามไฟล์ภาพ "${att.file_name}": ${bad}`);
          skipped.push(att.file_name);
          continue;
        }
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

  // Upsert, don't plain-insert. autoCombine runs fire-and-forget after an upload,
  // so a user pressing "รวมไฟล์" while that background job is still in flight used
  // to lose the race against document_attachments_one_combined_idx and get a 500 —
  // even though the merged file itself was written correctly. Both jobs produce the
  // same bytes at the same deterministic key, so the last writer simply wins.
  const row = await queryOne(
    `insert into document_attachments
       (document_id, kind, version, file_name, content_type, size_bytes, storage_key, uploaded_by)
     values ($1,'combined_pdf',null,$2,'application/pdf',$3,$4,$5)
     on conflict (document_id) where kind = 'combined_pdf'
     do update set file_name = excluded.file_name,
                   content_type = excluded.content_type,
                   size_bytes = excluded.size_bytes,
                   storage_key = excluded.storage_key,
                   uploaded_by = excluded.uploaded_by
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
    const res = await generateCombinedPdf(documentId, uploadedBy);
    // A PDF that pdf-lib can't parse (damaged, password-protected) is dropped from
    // the merge. That used to be invisible: the user got a "รวมเอกสาร" file quietly
    // missing an attachment, and the approver reviewed an incomplete package.
    // Record it so the document's timeline says so.
    if (res?.skipped?.length) {
      await query(
        `insert into audit_log (document_id, actor_id, actor_label, action, detail)
         values ($1,$2,null,'combine_skipped',$3)`,
        [documentId, uploadedBy || null, JSON.stringify({ files: res.skipped })]
      ).catch((e) => console.error('combine_skipped audit failed:', e.message));
    }
  } catch (e) {
    console.error('auto-combine failed:', e.message);
  }
}
