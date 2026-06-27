import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { pool, query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import {
  departmentForDocCode,
  allocateDocNumber,
  formatDocNumber,
  peekNextRunNo,
} from '../services/docNumber.js';
import { putObject, deleteObject, openDownloadStream } from '../config/storage.js';
import { generateOriginalPdf } from '../services/pdfDoc.js';
import { createApprovalChain, sendApprovalRequest } from '../services/approval.js';

const router = Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxUploadBytes } });

/** POST /api/documents/signature — upload an author signature image, return its
 *  storage key (used at document-create time, before the doc exists). */
router.post(
  '/signature',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'No file uploaded (field "file")');
    if (!String(req.file.mimetype || '').startsWith('image/')) {
      throw new ApiError(400, 'ไฟล์ลายเซ็นต้องเป็นรูปภาพ');
    }
    const key = `signatures/author/${crypto.randomUUID()}`;
    await putObject(key, req.file.buffer, req.file.mimetype);
    res.status(201).json({ data: { key } });
  })
);

const LIST_SELECT = `
  d.id, d.doc_number, d.doc_code, d.department, d.run_no,
  d.subject, d.recipient, d.remarks, d.date_received, d.status, d.source,
  d.sender_email, d.created_at,
  p.id as project_id, p.code as project_code, p.color as project_color,
  t.id as doc_type_id, t.name as doc_type_name
`;
const LIST_FROM = `
  from documents d
  join projects p on p.id = d.project_id
  left join document_types t on t.id = d.doc_type_id
`;

const STATUS_TH = {
  draft: 'ฉบับร่าง', pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ', returned: 'ตีกลับ', cancelled: 'ยกเลิก',
};

/** Build the WHERE clause + params from register filters (shared by list/export). */
function buildWhere(q) {
  const where = [];
  const params = [];
  const add = (clause, value) => { params.push(value); where.push(clause.replace('$$', `$${params.length}`)); };
  if (q.projectId) add('d.project_id = $$', q.projectId);
  if (q.status) add('d.status = $$', q.status);
  if (q.docTypeId) add('d.doc_type_id = $$', q.docTypeId);
  if (q.from) add('d.date_received >= $$', q.from);
  if (q.to) add('d.date_received <= $$', q.to);
  if (q.search) {
    params.push(`%${q.search}%`);
    const i = params.length;
    where.push(`(d.subject ilike $${i} or d.doc_number ilike $${i} or d.recipient ilike $${i} or d.remarks ilike $${i})`);
  }
  return { whereSql: where.length ? `where ${where.join(' and ')}` : '', params };
}

// ── list / export / next-number / stats / detail ────────────────────────────

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const { whereSql, params } = buildWhere(req.query);

    const countRow = await queryOne(`select count(*)::int as total ${LIST_FROM} ${whereSql}`, params);
    const offset = (page - 1) * pageSize;
    const { rows } = await query(
      `select ${LIST_SELECT} ${LIST_FROM} ${whereSql}
        order by d.date_received desc, d.created_at desc
        limit ${pageSize} offset ${offset}`,
      params
    );
    res.json({ data: rows, total: countRow.total, page, pageSize });
  })
);

/** GET /api/documents/export — the register (same filters) as .xlsx */
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const { whereSql, params } = buildWhere(req.query);
    const { rows } = await query(
      `select d.doc_number, d.date_received, d.subject, d.recipient, d.remarks, d.status,
              p.code as project_code, t.name as doc_type_name
       ${LIST_FROM} ${whereSql} order by d.date_received desc, d.created_at desc`,
      params
    );
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('ทะเบียนเอกสาร');
    ws.addRow(['เลขที่', 'วันที่รับ', 'โครงการ', 'เรื่อง', 'เรียน', 'ประเภท', 'สถานะ', 'หมายเหตุ']);
    for (const d of rows) {
      ws.addRow([
        d.doc_number,
        d.date_received ? new Date(d.date_received).toISOString().slice(0, 10) : '',
        d.project_code || '', d.subject || '', d.recipient || '',
        d.doc_type_name || '', STATUS_TH[d.status] || d.status, d.remarks || '',
      ]);
    }
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => { c.width = 18; });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="documents-register.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  })
);

router.get(
  '/next-number',
  asyncHandler(async (req, res) => {
    const { projectId, docCode } = req.query;
    if (!projectId || !docCode) throw new ApiError(400, 'projectId and docCode are required');
    const project = await queryOne('select id, doc_prefix from projects where id = $1', [projectId]);
    if (!project) throw new ApiError(404, 'Project not found');
    const department = await departmentForDocCode(docCode);
    const runNo = await peekNextRunNo(pool, projectId);
    const docNumber = formatDocNumber({ prefix: project.doc_prefix, department, docCode, runNo });
    res.json({ data: { runNo, department, docNumber } });
  })
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [byStatus, byProject, recent, pending, thisMonth] = await Promise.all([
      query('select status, count(*)::int as count from documents group by status'),
      query(`select p.code, p.color, count(d.*)::int as count
               from projects p left join documents d on d.project_id = p.id
              group by p.id, p.code, p.color order by count desc, p.sort_order`),
      query(`select d.id, d.doc_number, d.subject, d.status, d.date_received,
                    p.code as project_code, p.color as project_color
               from documents d join projects p on p.id = d.project_id
              order by d.created_at desc limit 5`),
      query(`select d.id, d.doc_number, d.subject, d.date_received,
                    p.code as project_code, p.color as project_color
               from documents d join projects p on p.id = d.project_id
              where d.status = 'pending' order by d.date_received asc limit 5`),
      queryOne(`select count(*)::int as count from documents
                 where date_trunc('month', date_received) = date_trunc('month', current_date)`),
    ]);
    const total = byStatus.rows.reduce((s, r) => s + r.count, 0);
    const statusMap = Object.fromEntries(byStatus.rows.map((r) => [r.status, r.count]));
    res.json({
      data: {
        total, thisMonth: thisMonth.count, byStatus: statusMap,
        byProject: byProject.rows, recent: recent.rows, pending: pending.rows,
      },
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await queryOne(
      `select ${LIST_SELECT}, d.body, d.work_unit, d.enclosures, d.reference, d.cc_recipients ${LIST_FROM} where d.id = $1`,
      [req.params.id]
    );
    if (!doc) throw new ApiError(404, 'Document not found');
    const { rows: attachments } = await query(
      `select id, kind, version, file_name, content_type, size_bytes, created_at
         from document_attachments where document_id = $1 order by created_at`, [req.params.id]);
    const { rows: steps } = await query(
      `select id, step_no, approver_name, approver_email, action, comment, acted_at
         from approval_steps where document_id = $1 order by step_no`, [req.params.id]);
    const { rows: audit } = await query(
      `select action, actor_label, detail, created_at
         from audit_log where document_id = $1 order by created_at`, [req.params.id]);
    res.json({ data: { ...doc, attachments, approval_steps: steps, audit } });
  })
);

// ── create / edit / cancel ──────────────────────────────────────────────────

const createSchema = z.object({
  projectId: z.string().uuid(),
  docCode: z.string().min(1).max(10),
  subject: z.string().min(1),
  recipient: z.string().optional(),
  reference: z.string().optional(),
  cc: z.string().optional(),
  authorSignatureUrl: z.string().optional(),
  body: z.string().optional(),
  remarks: z.string().optional(),
  docTypeId: z.string().uuid().optional().nullable(),
  dateReceived: z.string().optional(),
  workUnit: z.string().optional(),
  enclosures: z.array(z.object({ name: z.string(), qty: z.number().optional(), unit: z.string().optional() })).optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const input = parsed.data;

    const client = await pool.connect();
    try {
      await client.query('begin');
      const project = await client.query('select id, doc_prefix, code from projects where id = $1', [input.projectId]).then((r) => r.rows[0]);
      if (!project) throw new ApiError(404, 'Project not found');
      const { runNo, docNumber, department } = await allocateDocNumber(client, { project, docCode: input.docCode });
      const { rows } = await client.query(
        `insert into documents
           (project_id, doc_code, department, run_no, doc_number, doc_type_id, subject,
            recipient, reference, cc_recipients, author_signature_url, body, remarks, date_received, work_unit, enclosures, source, status, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,coalesce($14::date,current_date),$15,$16::jsonb,'manual','pending',$17)
         returning id, doc_number, run_no, department, status, date_received`,
        [project.id, input.docCode, department, runNo, docNumber, input.docTypeId || null, input.subject,
         input.recipient || null, input.reference || null, input.cc || null, input.authorSignatureUrl || null,
         input.body || null, input.remarks || null,
         input.dateReceived || null, input.workUnit || null, JSON.stringify(input.enclosures || []), req.profile.id]
      );
      const doc = rows[0];
      await client.query(
        `insert into audit_log (document_id, actor_id, actor_label, action, detail) values ($1,$2,$3,'created',$4)`,
        [doc.id, req.profile.id, req.profile.full_name || req.profile.email, JSON.stringify({ doc_number: doc.doc_number })]
      );
      await client.query('commit');
      res.status(201).json({ data: doc });
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  })
);

const editSchema = z.object({
  subject: z.string().min(1).optional(),
  recipient: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  cc: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  docTypeId: z.string().uuid().optional().nullable(),
  dateReceived: z.string().optional(),
  workUnit: z.string().optional().nullable(),
  enclosures: z.array(z.object({ name: z.string(), qty: z.number().optional(), unit: z.string().optional() })).optional(),
});

/** PATCH /api/documents/:id — edit content while draft/pending/returned. */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const parsed = editSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const doc = await queryOne('select id, status from documents where id = $1', [req.params.id]);
    if (!doc) throw new ApiError(404, 'Document not found');
    if (!['draft', 'pending', 'returned'].includes(doc.status)) {
      throw new ApiError(409, 'แก้ไขได้เฉพาะเอกสารที่ยังไม่อนุมัติ/ปิดเรื่อง');
    }
    const f = parsed.data;
    const sets = [];
    const vals = [];
    const add = (col, val, cast = '') => { vals.push(val); sets.push(`${col} = $${vals.length}${cast}`); };
    if (f.subject !== undefined) add('subject', f.subject);
    if (f.recipient !== undefined) add('recipient', f.recipient || null);
    if (f.reference !== undefined) add('reference', f.reference || null);
    if (f.cc !== undefined) add('cc_recipients', f.cc || null);
    if (f.body !== undefined) add('body', f.body || null);
    if (f.remarks !== undefined) add('remarks', f.remarks || null);
    if (f.workUnit !== undefined) add('work_unit', f.workUnit || null);
    if (f.docTypeId !== undefined) add('doc_type_id', f.docTypeId || null);
    if (f.dateReceived !== undefined) add('date_received', f.dateReceived || null, '::date');
    if (f.enclosures !== undefined) add('enclosures', JSON.stringify(f.enclosures), '::jsonb');
    if (!sets.length) throw new ApiError(400, 'No fields to update');
    vals.push(req.params.id);
    await query(`update documents set ${sets.join(', ')} where id = $${vals.length}`, vals);
    await query(
      `insert into audit_log (document_id, actor_id, actor_label, action, detail) values ($1,$2,$3,'edited',$4)`,
      [req.params.id, req.profile.id, req.profile.full_name || req.profile.email, JSON.stringify({ fields: sets.length })]
    );
    // return the full detail
    const detail = await queryOne(`select ${LIST_SELECT}, d.body, d.work_unit, d.enclosures, d.reference, d.cc_recipients ${LIST_FROM} where d.id = $1`, [req.params.id]);
    const { rows: attachments } = await query(`select id, kind, version, file_name, content_type, size_bytes, created_at from document_attachments where document_id = $1 order by created_at`, [req.params.id]);
    const { rows: steps } = await query(`select id, step_no, approver_name, approver_email, action, comment, acted_at from approval_steps where document_id = $1 order by step_no`, [req.params.id]);
    const { rows: audit } = await query(`select action, actor_label, detail, created_at from audit_log where document_id = $1 order by created_at`, [req.params.id]);
    res.json({ data: { ...detail, attachments, approval_steps: steps, audit } });
  })
);

/** POST /api/documents/:id/cancel — soft-cancel. */
router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const doc = await queryOne('select id, status from documents where id = $1', [req.params.id]);
    if (!doc) throw new ApiError(404, 'Document not found');
    if (doc.status === 'approved') throw new ApiError(409, 'เอกสารที่อนุมัติแล้วยกเลิกไม่ได้');
    if (doc.status === 'cancelled') return res.json({ data: { cancelled: true } });
    await query(`update documents set status = 'cancelled' where id = $1`, [req.params.id]);
    await query(`update approval_steps set action_token = null where document_id = $1`, [req.params.id]);
    await query(
      `insert into audit_log (document_id, actor_id, actor_label, action, detail) values ($1,$2,$3,'cancelled',$4)`,
      [req.params.id, req.profile.id, req.profile.full_name || req.profile.email, JSON.stringify({ reason: req.body?.reason || null })]
    );
    res.json({ data: { cancelled: true } });
  })
);

/** POST /api/documents/:id/resend-approval — re-email the current pending approver. */
router.post(
  '/:id/resend-approval',
  asyncHandler(async (req, res) => {
    const doc = await queryOne('select id, doc_number, subject from documents where id = $1', [req.params.id]);
    if (!doc) throw new ApiError(404, 'Document not found');
    const step = await queryOne(
      `select id, step_no, approver_name, approver_email, action_token
         from approval_steps where document_id = $1 and action = 'pending' and action_token is not null
         order by step_no limit 1`, [req.params.id]);
    if (!step) throw new ApiError(409, 'ไม่มีขั้นที่รออนุมัติอยู่');
    await sendApprovalRequest({ step, doc }).catch((e) => console.error('resend failed:', e.message));
    res.json({ data: { resent: true, to: step.approver_email } });
  })
);

// ── attachments (multipart upload + stream download, backed by S3) ───────────

async function getDocOr404(id) {
  const doc = await queryOne('select * from documents where id = $1', [id]);
  if (!doc) throw new ApiError(404, 'Document not found');
  return doc;
}

/** POST /api/documents/:id/attachments — multipart upload (field `file`). */
router.post(
  '/:id/attachments',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    await getDocOr404(req.params.id);
    if (!req.file) throw new ApiError(400, 'No file uploaded (field "file")');
    const safeName = req.file.originalname.replace(/[^\w.\-ก-๙ ]/g, '_');
    const key = `documents/${req.params.id}/${crypto.randomUUID()}-${safeName}`;
    await putObject(key, req.file.buffer, req.file.mimetype);
    const row = await queryOne(
      `insert into document_attachments (document_id, kind, file_name, content_type, size_bytes, storage_key, uploaded_by)
       values ($1,'upload',$2,$3,$4,$5,$6) returning id, file_name, content_type, size_bytes, created_at`,
      [req.params.id, req.file.originalname, req.file.mimetype || null, req.file.size ?? null, key, req.profile.id]
    );
    res.status(201).json({ data: row });
  })
);

/** GET /api/documents/:id/attachments/:attId/download — stream bytes (inline). */
router.get(
  '/:id/attachments/:attId/download',
  asyncHandler(async (req, res) => {
    const att = await queryOne(
      'select storage_key, file_name, content_type from document_attachments where id = $1 and document_id = $2',
      [req.params.attId, req.params.id]);
    if (!att) throw new ApiError(404, 'Attachment not found');
    const obj = await openDownloadStream(att.storage_key);
    if (!obj) throw new ApiError(404, 'File not found in storage');
    res.setHeader('Content-Type', obj.contentType || att.content_type || 'application/octet-stream');
    if (obj.length != null) res.setHeader('Content-Length', obj.length);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(att.file_name || 'file')}`);
    obj.stream.on('error', () => res.destroy());
    obj.stream.pipe(res);
  })
);

router.delete(
  '/:id/attachments/:attId',
  asyncHandler(async (req, res) => {
    const att = await queryOne('select storage_key from document_attachments where id = $1 and document_id = $2', [req.params.attId, req.params.id]);
    if (!att) throw new ApiError(404, 'Attachment not found');
    await deleteObject(att.storage_key).catch(() => {});
    await query('delete from document_attachments where id = $1', [req.params.attId]);
    res.json({ data: { deleted: true } });
  })
);

// ── generate PDF / submit ───────────────────────────────────────────────────

/** POST /api/documents/:id/generate-pdf — build the letter, return attachment meta. */
router.post(
  '/:id/generate-pdf',
  asyncHandler(async (req, res) => {
    await getDocOr404(req.params.id);
    const row = await generateOriginalPdf(req.params.id, req.profile.id);
    res.status(201).json({ data: { id: row.id, file_name: row.file_name, version: 'original', created_at: row.created_at } });
  })
);

const submitSchema = z.object({
  approvers: z.array(z.object({ name: z.string().optional(), email: z.string().email() })).min(1),
});

router.post(
  '/:id/submit',
  asyncHandler(async (req, res) => {
    const doc = await getDocOr404(req.params.id);
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());

    const client = await pool.connect();
    let firstStep;
    try {
      await client.query('begin');
      firstStep = await createApprovalChain(client, {
        documentId: doc.id,
        approvers: parsed.data.approvers,
        actorLabel: req.profile.full_name || req.profile.email,
        actorId: req.profile.id,
      });
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
    await sendApprovalRequest({ step: firstStep, doc }).catch((e) => console.error('approval email failed:', e.message));
    res.json({ data: { status: 'pending', firstApprover: firstStep.approver_email } });
  })
);

export default router;
