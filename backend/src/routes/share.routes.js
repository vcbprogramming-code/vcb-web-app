import { Router } from 'express';
import { query, queryOne } from '../config/db.js';
import { openDownloadStream } from '../config/storage.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { resolveShareToken } from '../services/docShare.js';

/**
 * PUBLIC read-only view of ONE document, for a สำเนาเรียน (CC) recipient who has
 * no account. No requireAuth — the unguessable token in the emailed link IS the
 * authorisation, exactly like the QR verify page and the old approval links.
 *
 * Deliberately read-only and single-document: this router exposes no list, no
 * search, no mutation, and no route that takes a document id. Everything is
 * resolved from the token, so a recipient can never walk to another document.
 */
const router = Router();

/** Resolve :token → { share, doc } or throw the shared 404. */
async function load(req) {
  const share = await resolveShareToken(req.params.token);
  // unknown and expired look identical on purpose — a probe learns nothing
  if (!share) throw new ApiError(404, 'ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว — กรุณาติดต่อผู้ส่งเอกสาร');
  const doc = await queryOne(
    `select d.id, d.doc_number, d.subject, d.status, d.date_received, d.department,
            d.recipient, d.reference, d.created_at,
            p.code as project_code, p.name as project_name,
            t.name as doc_type_name, c.name as company_name,
            coalesce(nullif(pr.full_name,''), '') as preparer_name
       from documents d
       join projects p on p.id = d.project_id
       left join document_types t on t.id = d.doc_type_id
       left join companies c on c.id = d.company_id
       left join profiles pr on pr.id = d.created_by
      where d.id = $1`,
    [share.document_id]
  );
  if (!doc) throw new ApiError(404, 'ไม่พบเอกสาร');
  return { share, doc };
}

/**
 * The file the recipient should read: the signed letter once the document is
 * approved, otherwise the current letter — plus the merged "one file" version
 * when it exists (it carries the attachments too). Uploaded attachments are NOT
 * listed individually: a CC copy is เพื่อทราบ, and the merged letter already
 * contains everything that belongs in the record.
 */
async function readableFile(documentId, status) {
  const { rows } = await query(
    `select id, kind, version, file_name, content_type, storage_key
       from document_attachments
      where document_id = $1 and kind in ('combined_pdf','generated_pdf')
      order by created_at desc`,
    [documentId]
  );
  const combined = rows.find((r) => r.kind === 'combined_pdf');
  if (combined) return combined;
  if (status === 'approved') {
    const signed = rows.find((r) => r.kind === 'generated_pdf' && r.version === 'approved');
    if (signed) return signed;
  }
  return rows.find((r) => r.kind === 'generated_pdf') || null;
}

/** GET /api/share/:token — the document, its status and its approval trail. */
router.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const { share, doc } = await load(req);
    const { rows: steps } = await query(
      // no approver_email (PII) and no comment: reject reasons and internal
      // opinions are for the approval chain, not for everyone copied in.
      `select s.step_no, s.action, s.acted_at, s.is_signer,
              coalesce(nullif(pr.full_name,''), nullif(s.approver_name,''), '—') as approver_name
         from approval_steps s
         left join profiles pr on pr.id = s.approver_id
        where s.document_id = $1 order by s.step_no`,
      [doc.id]
    );
    const file = await readableFile(doc.id, doc.status);
    res.json({
      data: {
        document: doc,
        approval_steps: steps,
        // the viewer fetches bytes from /api/share/:token/file — no id needed
        has_file: Boolean(file),
        file_name: file?.file_name || null,
        shared_with: share.email,
      },
    });
  })
);

/** GET /api/share/:token/file — stream that one PDF inline (view/print/save). */
router.get(
  '/:token/file',
  asyncHandler(async (req, res) => {
    const { doc } = await load(req);
    const file = await readableFile(doc.id, doc.status);
    if (!file) throw new ApiError(404, 'ยังไม่มีไฟล์หนังสือสำหรับเอกสารฉบับนี้');
    const obj = await openDownloadStream(file.storage_key);
    if (!obj) throw new ApiError(404, 'File not found in storage');
    // always a generated PDF — never a user upload — so inline is safe here
    res.setHeader('Content-Type', 'application/pdf');
    if (obj.length != null) res.setHeader('Content-Length', obj.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.file_name || 'document.pdf')}`
    );
    obj.stream.on('error', () => res.destroy());
    obj.stream.pipe(res);
  })
);

export default router;
