import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import {
  departmentForDocCode,
  allocateDocNumber,
  formatDocNumber,
  peekNextRunNo,
} from '../services/docNumber.js';
import crypto from 'node:crypto';
import {
  presignedPutUrl,
  presignedGetUrl,
  putObject,
  deleteObject,
} from '../config/storage.js';
import { generateOriginalPdf } from '../services/pdfDoc.js';
import { createApprovalChain, sendApprovalRequest } from '../services/approval.js';

const router = Router();
router.use(requireAuth);

// Columns returned for a document row in the register, joined with project.
const LIST_SELECT = `
  d.id, d.doc_number, d.doc_code, d.department, d.run_no,
  d.subject, d.recipient, d.remarks, d.date_received, d.status, d.source,
  d.sender_email, d.created_at,
  p.id   as project_id,
  p.code as project_code,
  p.color as project_color,
  t.id   as doc_type_id,
  t.name as doc_type_name
`;

const LIST_FROM = `
  from documents d
  join projects p on p.id = d.project_id
  left join document_types t on t.id = d.doc_type_id
`;

/**
 * GET /api/documents
 * Filters: ?projectId= &status= &docTypeId= &from= &to= &search= &page= &pageSize=
 * Returns { data, total, page, pageSize }.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { projectId, status, docTypeId, from, to, search } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));

    const where = [];
    const params = [];
    const add = (clause, value) => {
      params.push(value);
      where.push(clause.replace('$$', `$${params.length}`));
    };

    if (projectId) add('d.project_id = $$', projectId);
    if (status) add('d.status = $$', status);
    if (docTypeId) add('d.doc_type_id = $$', docTypeId);
    if (from) add('d.date_received >= $$', from);
    if (to) add('d.date_received <= $$', to);
    if (search) {
      // match subject, doc number, recipient, remarks
      params.push(`%${search}%`);
      const i = params.length;
      where.push(
        `(d.subject ilike $${i} or d.doc_number ilike $${i}
          or d.recipient ilike $${i} or d.remarks ilike $${i})`
      );
    }

    const whereSql = where.length ? `where ${where.join(' and ')}` : '';

    const countRow = await queryOne(
      `select count(*)::int as total ${LIST_FROM} ${whereSql}`,
      params
    );

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

/**
 * GET /api/documents/next-number?projectId=&docCode=
 * Preview the doc number that a new document WOULD get (not reserved yet).
 */
router.get(
  '/next-number',
  asyncHandler(async (req, res) => {
    const { projectId, docCode } = req.query;
    if (!projectId || !docCode) {
      throw new ApiError(400, 'projectId and docCode are required');
    }
    const project = await queryOne(
      `select id, doc_prefix from projects where id = $1`,
      [projectId]
    );
    if (!project) throw new ApiError(404, 'Project not found');

    const department = await departmentForDocCode(docCode);
    const runNo = await peekNextRunNo(pool, projectId);
    const docNumber = formatDocNumber({
      prefix: project.doc_prefix,
      department,
      docCode,
      runNo,
    });
    res.json({ data: { runNo, department, docNumber } });
  })
);

/**
 * GET /api/documents/stats — summary for the E-Memo dashboard:
 * totals, breakdown by status, by project, recent docs, and pending docs.
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const byStatus = await query(
      `select status, count(*)::int as count from documents group by status`
    );
    const total = byStatus.rows.reduce((s, r) => s + r.count, 0);

    const byProject = await query(
      `select p.code, p.color, count(d.*)::int as count
         from projects p
         left join documents d on d.project_id = p.id
        group by p.id, p.code, p.color
        order by count desc, p.sort_order`
    );

    const recent = await query(
      `select d.id, d.doc_number, d.subject, d.status, d.date_received,
              p.code as project_code, p.color as project_color
         from documents d join projects p on p.id = d.project_id
        order by d.created_at desc
        limit 5`
    );

    const pending = await query(
      `select d.id, d.doc_number, d.subject, d.date_received,
              p.code as project_code, p.color as project_color
         from documents d join projects p on p.id = d.project_id
        where d.status = 'pending'
        order by d.date_received asc
        limit 5`
    );

    // count documents received this month
    const thisMonth = await queryOne(
      `select count(*)::int as count from documents
        where date_trunc('month', date_received) = date_trunc('month', current_date)`
    );

    const statusMap = Object.fromEntries(byStatus.rows.map((r) => [r.status, r.count]));

    res.json({
      data: {
        total,
        thisMonth: thisMonth.count,
        byStatus: statusMap,
        byProject: byProject.rows,
        recent: recent.rows,
        pending: pending.rows,
      },
    });
  })
);

/** GET /api/documents/:id — full document detail (incl. attachments + steps). */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await queryOne(
      `select ${LIST_SELECT}, d.body, d.work_unit, d.enclosures ${LIST_FROM} where d.id = $1`,
      [req.params.id]
    );
    if (!doc) throw new ApiError(404, 'Document not found');

    const { rows: attachments } = await query(
      `select id, kind, version, file_name, content_type, size_bytes, created_at
         from document_attachments where document_id = $1 order by created_at`,
      [req.params.id]
    );
    const { rows: steps } = await query(
      `select id, step_no, approver_name, approver_email, action, comment, acted_at
         from approval_steps where document_id = $1 order by step_no`,
      [req.params.id]
    );
    const { rows: audit } = await query(
      `select action, actor_label, detail, created_at
         from audit_log where document_id = $1 order by created_at`,
      [req.params.id]
    );
    res.json({ data: { ...doc, attachments, approval_steps: steps, audit } });
  })
);

const createSchema = z.object({
  projectId: z.string().uuid(),
  docCode: z.string().min(1).max(10),
  subject: z.string().min(1),
  recipient: z.string().optional(),
  body: z.string().optional(),
  remarks: z.string().optional(),
  docTypeId: z.string().uuid().optional().nullable(),
  dateReceived: z.string().optional(), // ISO date; defaults to today
  workUnit: z.string().optional(),     // ชื่อหน่วยงาน e.g. "บางเตย"
  enclosures: z
    .array(z.object({ name: z.string(), qty: z.number().optional(), unit: z.string().optional() }))
    .optional(), // สิ่งที่ส่งมาด้วย
});

/**
 * POST /api/documents
 * Creates a document, allocating the next per-project run number atomically.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    }
    const input = parsed.data;

    const client = await pool.connect();
    try {
      await client.query('begin');

      const project = await client
        .query('select id, doc_prefix, code from projects where id = $1', [input.projectId])
        .then((r) => r.rows[0]);
      if (!project) throw new ApiError(404, 'Project not found');

      const { runNo, docNumber, department } = await allocateDocNumber(client, {
        project,
        docCode: input.docCode,
      });

      const { rows } = await client.query(
        `insert into documents
           (project_id, doc_code, department, run_no, doc_number,
            doc_type_id, subject, recipient, body, remarks,
            date_received, work_unit, enclosures, source, status, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                 coalesce($11::date, current_date), $12, $13::jsonb, 'manual', 'pending', $14)
         returning id, doc_number, run_no, department, status, date_received`,
        [
          project.id,
          input.docCode,
          department,
          runNo,
          docNumber,
          input.docTypeId || null,
          input.subject,
          input.recipient || null,
          input.body || null,
          input.remarks || null,
          input.dateReceived || null,
          input.workUnit || null,
          JSON.stringify(input.enclosures || []),
          req.profile.id,
        ]
      );
      const doc = rows[0];

      await client.query(
        `insert into audit_log (document_id, actor_id, actor_label, action, detail)
         values ($1, $2, $3, 'created', $4)`,
        [
          doc.id,
          req.profile.id,
          req.profile.full_name || req.profile.email,
          JSON.stringify({ doc_number: doc.doc_number }),
        ]
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

// ===========================================================================
// Attachments (S3)
// ===========================================================================

/** Ensure a document exists or 404. */
async function getDocOr404(id) {
  const doc = await queryOne('select * from documents where id = $1', [id]);
  if (!doc) throw new ApiError(404, 'Document not found');
  return doc;
}

const uploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

/**
 * POST /api/documents/:id/attachments/upload-url
 * Returns a presigned PUT url the browser uses to upload directly to S3,
 * plus the storage key to confirm with afterwards.
 */
router.post(
  '/:id/attachments/upload-url',
  asyncHandler(async (req, res) => {
    await getDocOr404(req.params.id);
    const parsed = uploadUrlSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());

    const { fileName, contentType } = parsed.data;
    const safeName = fileName.replace(/[^\w.\-ก-๙ ]/g, '_');
    const key = `documents/${req.params.id}/${crypto.randomUUID()}-${safeName}`;
    const url = await presignedPutUrl(key, contentType);
    res.json({ data: { uploadUrl: url, storageKey: key } });
  })
);

const confirmSchema = z.object({
  storageKey: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

/**
 * POST /api/documents/:id/attachments
 * Record an uploaded file (after the browser PUT to the presigned url).
 */
router.post(
  '/:id/attachments',
  asyncHandler(async (req, res) => {
    await getDocOr404(req.params.id);
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const { storageKey, fileName, contentType, sizeBytes } = parsed.data;

    const row = await queryOne(
      `insert into document_attachments
         (document_id, kind, file_name, content_type, size_bytes, storage_key, uploaded_by)
       values ($1,'upload',$2,$3,$4,$5,$6)
       returning id, file_name, content_type, size_bytes, created_at`,
      [req.params.id, fileName, contentType || null, sizeBytes || null, storageKey, req.profile.id]
    );
    res.status(201).json({ data: row });
  })
);

/** GET /api/documents/:id/attachments/:attId/url — presigned view/download url. */
router.get(
  '/:id/attachments/:attId/url',
  asyncHandler(async (req, res) => {
    const att = await queryOne(
      'select storage_key from document_attachments where id = $1 and document_id = $2',
      [req.params.attId, req.params.id]
    );
    if (!att) throw new ApiError(404, 'Attachment not found');
    const url = await presignedGetUrl(att.storage_key, 3600);
    res.json({ data: { url } });
  })
);

/** DELETE /api/documents/:id/attachments/:attId */
router.delete(
  '/:id/attachments/:attId',
  asyncHandler(async (req, res) => {
    const att = await queryOne(
      'select storage_key from document_attachments where id = $1 and document_id = $2',
      [req.params.attId, req.params.id]
    );
    if (!att) throw new ApiError(404, 'Attachment not found');
    await deleteObject(att.storage_key).catch(() => {});
    await query('delete from document_attachments where id = $1', [req.params.attId]);
    res.json({ data: { deleted: true } });
  })
);

// ===========================================================================
// Letterhead PDF generation
// ===========================================================================

/**
 * POST /api/documents/:id/generate-pdf
 * Builds the official A4 letter from the doc + project letterhead config,
 * stores it in S3, and records it as a 'generated_pdf' attachment.
 */
router.post(
  '/:id/generate-pdf',
  asyncHandler(async (req, res) => {
    await getDocOr404(req.params.id);
    const row = await generateOriginalPdf(req.params.id, req.profile.id);
    const url = await presignedGetUrl(row.storage_key, 3600);
    res.status(201).json({ data: { ...row, url } });
  })
);

// ===========================================================================
// Submit for approval (build the chain + email step 1)
// ===========================================================================

const submitSchema = z.object({
  approvers: z
    .array(z.object({ name: z.string().optional(), email: z.string().email() }))
    .min(1),
});

/**
 * POST /api/documents/:id/submit
 * Creates the sequential approval chain and emails the first approver a
 * tokenised link. Sets the document to 'pending'.
 */
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

    // email outside the transaction
    await sendApprovalRequest({ step: firstStep, doc }).catch((e) =>
      console.error('approval email failed:', e.message)
    );

    res.json({ data: { status: 'pending', firstApprover: firstStep.approver_email } });
  })
);

export default router;
