import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { pool, query, queryOne } from '../config/db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { hasPermission } from '../config/permissions.js';
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
import { generateOriginalPdf, generateApprovedPdf, regenerateOriginalWithAudit } from '../services/pdfDoc.js';
import { generateCombinedPdf, autoCombine } from '../services/pdfMerge.js';
import { createApprovalChain, sendApprovalRequest, applyApprovalAction } from '../services/approval.js';
import { sendCcNotification, extractCcEmails, sendAuthorNotification, sendConsultRequest } from '../services/email.js';

const router = Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxUploadBytes } });

/**
 * Fix a multipart filename that arrived UTF-8 but was decoded as latin1 by the
 * multipart parser (busboy/multer default) — this is why Thai names showed up as
 * mojibake ("CVE-à¸..."). Re-decode latin1→utf8. If the result contains the
 * replacement char (i.e. it was NOT double-encoded), keep the original.
 */
function decodeFilename(name) {
  if (!name) return name;
  try {
    const fixed = Buffer.from(name, 'latin1').toString('utf8');
    return fixed.includes('�') ? name : fixed;
  } catch { return name; }
}

/**
 * Load a document and ensure the caller may MUTATE it: the creator or an admin.
 * Everyone can read (list/detail stay open), but edit/cancel/submit/attach are
 * owner-or-admin only. Returns the document row.
 */
async function loadDocForMutation(req) {
  const doc = await queryOne('select * from documents where id = $1', [req.params.id]);
  if (!doc) throw new ApiError(404, 'Document not found');
  const isOwner = doc.created_by && doc.created_by === req.profile.id;
  const isAdmin = req.profile.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, 'ไม่มีสิทธิ์จัดการเอกสารนี้ (เฉพาะผู้สร้างหรือผู้ดูแลระบบ)');
  }
  return doc;
}

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

/**
 * Load a user's document-visibility scopes (#8). Returns null when the user has
 * NO scopes or is an admin — meaning "can see everything" (backwards compatible).
 * Otherwise returns { projectIds:[], docCodes:[] } — an empty dimension means
 * "not restricted on that dimension".
 */
async function loadVisibility(profile) {
  if (!profile || profile.role === 'admin') return null;
  const { rows } = await query(
    'select scope_type, scope_value from document_visibility where profile_id = $1',
    [profile.id]
  );
  if (rows.length === 0) return null;
  return {
    projectIds: rows.filter((r) => r.scope_type === 'project').map((r) => r.scope_value),
    docCodes: rows.filter((r) => r.scope_type === 'doc_code').map((r) => r.scope_value),
  };
}

/** True if `vis` (from loadVisibility) permits a doc with this project/code. */
function visibilityAllows(vis, projectId, docCode) {
  if (!vis) return true;
  const projOk = !vis.projectIds.length || vis.projectIds.includes(projectId);
  const codeOk = !vis.docCodes.length || vis.docCodes.includes(docCode);
  return projOk && codeOk;
}

/** Throw 403 if this scoped user may not access the given document (#8).
 *  `doc` must carry project_id and doc_code. */
async function assertDocVisible(profile, doc) {
  const vis = await loadVisibility(profile);
  if (!visibilityAllows(vis, doc.project_id, doc.doc_code)) {
    throw new ApiError(403, 'ไม่มีสิทธิ์เข้าถึงเอกสารนี้');
  }
}

/** Gate for opening/downloading a single document. An assigned pending approver
 *  can ALWAYS reach the doc they must act on (even if ememo.view is off or the
 *  doc is outside their visibility scope) — otherwise the approval stalls.
 *  Everyone else needs ememo.view + passing visibility. `doc` needs id/project_id/
 *  doc_code. */
async function assertCanView(profile, doc) {
  const approver = await queryOne(
    `select 1 from approval_steps
      where document_id = $1 and action = 'pending' and lower(approver_email) = lower($2)
      limit 1`,
    [doc.id, profile.email || '']
  );
  if (approver) return;
  if (!hasPermission(profile, 'ememo', 'view')) throw new ApiError(403, 'ไม่มีสิทธิ์ดูเอกสาร');
  await assertDocVisible(profile, doc);
}

/** Build the WHERE clause + params from register filters (shared by list/export).
 *  `visibility` (from loadVisibility) further restricts rows to allowed scopes. */
function buildWhere(q, visibility = null) {
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
  // per-user visibility scoping (#8)
  if (visibility) {
    if (visibility.projectIds.length) add('d.project_id = any($$::uuid[])', visibility.projectIds);
    if (visibility.docCodes.length) add('d.doc_code = any($$::text[])', visibility.docCodes);
  }
  return { whereSql: where.length ? `where ${where.join(' and ')}` : '', params };
}

// ── list / export / next-number / stats / detail ────────────────────────────

router.get(
  '/',
  requirePermission('ememo', 'view'),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const visibility = await loadVisibility(req.profile);
    const { whereSql, params } = buildWhere(req.query, visibility);

    const countRow = await queryOne(`select count(*)::int as total ${LIST_FROM} ${whereSql}`, params);
    const offset = (page - 1) * pageSize;
    // #2: flag rows whose CURRENT pending step awaits the logged-in user, and float
    // them to the very top of the register so a reviewer sees them first (server-side
    // sort works across pagination — the alert banner used to only link one doc).
    const email = (req.profile?.email || '').toLowerCase();
    const listParams = [...params, email];
    const meIdx = listParams.length;
    const awaitingExpr = `exists (
      select 1 from approval_steps s
       where s.document_id = d.id and s.action = 'pending' and s.action_token is not null
         and lower(s.approver_email) = $${meIdx}
         and s.step_no = (select min(s2.step_no) from approval_steps s2
                            where s2.document_id = s.document_id and s2.action = 'pending')
    )`;
    const { rows } = await query(
      `select ${LIST_SELECT}, ${awaitingExpr} as is_awaiting_me ${LIST_FROM} ${whereSql}
        order by is_awaiting_me desc,
                 d.date_received desc, d.created_at desc
        limit ${pageSize} offset ${offset}`,
      listParams
    );
    res.json({ data: rows, total: countRow.total, page, pageSize });
  })
);

/** GET /api/documents/export — the register (same filters) as .xlsx */
router.get(
  '/export',
  requirePermission('ememo', 'view'),
  asyncHandler(async (req, res) => {
    const visibility = await loadVisibility(req.profile);
    const { whereSql, params } = buildWhere(req.query, visibility);
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

/** GET /api/documents/approvers — active accounts, for the approver picker.
 *  Defined BEFORE '/:id' so "approvers" isn't parsed as a document id.
 *  Gated on ememo.submit so the full staff directory isn't exposed to every
 *  logged-in account (admins pass automatically). */
router.get(
  '/approvers',
  requirePermission('ememo', 'submit'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `select full_name, email from profiles where is_active = true order by full_name`
    );
    res.json({ data: rows });
  })
);

/** GET /api/documents/companies — active companies for the create-form picker. */
router.get(
  '/companies',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `select id, name, name_en, address, phone, telex, fax, logo_url, is_default
         from companies where is_active = true order by is_default desc, sort_order, name`
    );
    res.json({ data: rows });
  })
);

/** GET /api/documents/companies/:id/logo — stream a company's logo image. */
router.get(
  '/companies/:id/logo',
  asyncHandler(async (req, res) => {
    const c = await queryOne('select logo_url from companies where id = $1', [req.params.id]);
    if (!c?.logo_url) throw new ApiError(404, 'ไม่มีโลโก้');
    const obj = await openDownloadStream(c.logo_url);
    if (!obj) throw new ApiError(404, 'ไม่พบไฟล์โลโก้');
    res.setHeader('Content-Type', obj.contentType || 'image/png');
    obj.stream.on('error', () => res.destroy());
    obj.stream.pipe(res);
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
  requirePermission('ememo', 'view'),
  asyncHandler(async (req, res) => {
    // per-user visibility (#8): scoped users must not see other projects'/codes'
    // doc numbers, subjects or counts on the dashboard.
    const vis = await loadVisibility(req.profile);
    const vp = [];
    const vparts = [];
    if (vis) {
      if (vis.projectIds.length) { vp.push(vis.projectIds); vparts.push(`d.project_id = any($${vp.length}::uuid[])`); }
      if (vis.docCodes.length) { vp.push(vis.docCodes); vparts.push(`d.doc_code = any($${vp.length}::text[])`); }
    }
    const vAnd = vparts.length ? ' and ' + vparts.join(' and ') : '';
    const vWhere = vparts.length ? ' where ' + vparts.join(' and ') : '';
    const [byStatus, byProject, recent, pending, thisMonth] = await Promise.all([
      query(`select d.status, count(*)::int as count from documents d${vWhere} group by d.status`, vp),
      query(`select p.code, p.color, count(d.*)::int as count
               from projects p left join documents d on d.project_id = p.id${vAnd}
              group by p.id, p.code, p.color order by count desc, p.sort_order`, vp),
      query(`select d.id, d.doc_number, d.subject, d.status, d.date_received,
                    p.code as project_code, p.color as project_color
               from documents d join projects p on p.id = d.project_id${vWhere}
              order by d.created_at desc limit 5`, vp),
      query(`select d.id, d.doc_number, d.subject, d.date_received,
                    p.code as project_code, p.color as project_color
               from documents d join projects p on p.id = d.project_id
              where d.status = 'pending'${vAnd} order by d.date_received asc limit 5`, vp),
      queryOne(`select count(*)::int as count from documents d
                 where date_trunc('month', date_received) = date_trunc('month', current_date)${vAnd}`, vp),
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

/**
 * GET /api/documents/awaiting-me — documents whose CURRENT pending step is
 * assigned to the logged-in user (by email). Powers the home/register alert (#8)
 * so a reviewer sees "N ฉบับรอคุณอนุมัติ" without going through email.
 * Defined BEFORE '/:id' so "awaiting-me" isn't parsed as a document id.
 */
router.get(
  '/awaiting-me',
  requirePermission('ememo', 'view'),
  asyncHandler(async (req, res) => {
    const email = (req.profile.email || '').toLowerCase();
    if (!email) return res.json({ data: { count: 0, items: [] } });
    // the current pending step = the earliest pending step of a pending doc.
    const { rows } = await query(
      `select d.id, d.doc_number, d.subject, d.date_received,
              pr.code as project_code, pr.color as project_color
         from approval_steps s
         join documents d on d.id = s.document_id and d.status = 'pending'
         left join projects pr on pr.id = d.project_id
        where s.action = 'pending' and s.action_token is not null
          and lower(s.approver_email) = $1
          and s.step_no = (
            select min(s2.step_no) from approval_steps s2
             where s2.document_id = s.document_id and s2.action = 'pending'
          )
        order by d.date_received asc`,
      [email]
    );
    res.json({ data: { count: rows.length, items: rows } });
  })
);

/**
 * GET /api/documents/search?q= — typeahead for the "อ้างถึง" picker (#3). Returns
 * up to 15 documents whose number or subject matches, so the clerk selects a real
 * in-system document instead of typing a free-text reference. Before '/:id'.
 */
router.get(
  '/search',
  requirePermission('ememo', 'view'),
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 1) return res.json({ data: [] });
    const like = `%${q}%`;
    const params = [like];
    const scope = [];
    // per-user visibility (#8): a scoped user must not see other projects'/codes' docs
    const vis = await loadVisibility(req.profile);
    if (vis) {
      if (vis.projectIds.length) { params.push(vis.projectIds); scope.push(`d.project_id = any($${params.length}::uuid[])`); }
      if (vis.docCodes.length) { params.push(vis.docCodes); scope.push(`d.doc_code = any($${params.length}::text[])`); }
    }
    const { rows } = await query(
      `select d.id, d.doc_number, d.subject, d.date_received,
              pr.code as project_code, pr.color as project_color
         from documents d
         left join projects pr on pr.id = d.project_id
        where d.status <> 'cancelled'
          and (d.doc_number ilike $1 or d.subject ilike $1)
          ${scope.length ? 'and ' + scope.join(' and ') : ''}
        order by d.date_received desc
        limit 15`,
      params
    );
    res.json({ data: rows });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await queryOne(
      `select ${LIST_SELECT}, d.body, d.work_unit, d.enclosures, d.reference, d.reference_doc_id, d.cc_recipients,
              d.signer_name, d.signer_title, d.created_by, d.company_id, d.verify_token, pr.full_name as preparer_name,
              lh.manager_email, lh.signatory_name as manager_name
         ${LIST_FROM}
         left join profiles pr on pr.id = d.created_by
         left join project_letterhead lh on lh.project_id = d.project_id
        where d.id = $1`,
      [req.params.id]
    );
    if (!doc) throw new ApiError(404, 'Document not found');
    // enforce ememo.view + per-user visibility, but never lock out an assigned approver
    await assertCanView(req.profile, doc);
    const { rows: attachments } = await query(
      `select id, kind, version, file_name, content_type, size_bytes, created_at
         from document_attachments where document_id = $1 order by created_at`, [req.params.id]);
    const { rows: steps } = await query(
      `select id, step_no, approver_name, approver_email, action, comment, acted_at
         from approval_steps where document_id = $1 order by step_no`, [req.params.id]);
    const { rows: audit } = await query(
      `select action, actor_label, detail, created_at
         from audit_log where document_id = $1 order by created_at`, [req.params.id]);
    // conversation thread: messages + each message's file attachments
    const { rows: messages } = await query(
      `select m.id, m.body, m.author_label, m.created_at, m.kind, m.consult_email,
              pr.full_name as author_name,
              coalesce(
                (select json_agg(json_build_object('id', a.id, 'file_name', a.file_name, 'content_type', a.content_type) order by a.created_at)
                   from document_attachments a where a.message_id = m.id), '[]'
              ) as attachments
         from document_messages m
         left join profiles pr on pr.id = m.author_id
        where m.document_id = $1
        order by m.created_at`, [req.params.id]);

    // resolve a "อ้างถึง" reference to an in-system document so the UI can link
    // to it (#3). Prefer the explicitly-chosen document (reference_doc_id, the new
    // enforced picker); fall back to the old free-text regex for legacy rows.
    let referenceDoc = null;
    if (doc.reference_doc_id) {
      referenceDoc = await queryOne(
        'select id, doc_number from documents where id = $1 limit 1', [doc.reference_doc_id]);
    } else if (doc.reference) {
      const m = String(doc.reference).match(/[^\s]+\/[^\s]+\/[^\s]+\/\d+/);
      if (m) {
        referenceDoc = await queryOne(
          'select id, doc_number from documents where doc_number = $1 limit 1', [m[0]]);
      }
    }

    res.json({ data: { ...doc, attachments, approval_steps: steps, audit, messages, reference_doc: referenceDoc } });
  })
);

// ── conversation messages (2-way communication) ──────────────────────────────

const messageSchema = z.object({ body: z.string().trim().min(1) });

/** POST /api/documents/:id/messages — post a text message to the thread. */
router.post(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const doc = await getDocOr404(req.params.id);
    await assertDocVisible(req.profile, doc);
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const row = await queryOne(
      `insert into document_messages (document_id, author_id, author_label, body)
       values ($1,$2,$3,$4) returning id, body, author_label, created_at`,
      [doc.id, req.profile.id, req.profile.full_name || req.profile.email, parsed.data.body.trim()]
    );
    res.status(201).json({ data: { ...row, author_name: req.profile.full_name || null, attachments: [] } });
  })
);

/** POST /api/documents/:id/messages/:msgId/attachments — attach a file to a message. */
router.post(
  '/:id/messages/:msgId/attachments',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    await assertDocVisible(req.profile, await getDocOr404(req.params.id));
    const msg = await queryOne('select id from document_messages where id = $1 and document_id = $2', [req.params.msgId, req.params.id]);
    if (!msg) throw new ApiError(404, 'Message not found');
    if (!req.file) throw new ApiError(400, 'No file uploaded (field "file")');
    const fileName = decodeFilename(req.file.originalname);
    const safeName = fileName.replace(/[^\w.\-ก-๙ ]/g, '_');
    const key = `documents/${req.params.id}/msg/${crypto.randomUUID()}-${safeName}`;
    await putObject(key, req.file.buffer, req.file.mimetype);
    const row = await queryOne(
      `insert into document_attachments (document_id, message_id, kind, file_name, content_type, size_bytes, storage_key, uploaded_by)
       values ($1,$2,'message',$3,$4,$5,$6,$7) returning id, file_name, content_type, created_at`,
      [req.params.id, req.params.msgId, fileName, req.file.mimetype || null, req.file.size ?? null, key, req.profile.id]
    );
    res.status(201).json({ data: row });
  })
);

const consultSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  question: z.string().trim().optional(),
});

/**
 * POST /api/documents/:id/consult — ask an in-system user for an OPINION on this
 * document (not an approval). Records a 'consult' note in the thread and emails
 * the person a login-gated link to view + comment. The approval status is
 * unchanged — the current approver still decides.
 */
router.post(
  '/:id/consult',
  asyncHandler(async (req, res) => {
    const doc = await getDocOr404(req.params.id);
    await assertDocVisible(req.profile, doc);
    const parsed = consultSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const { email, name, question } = parsed.data;

    // the person asked must be an active account (they log in to reply)
    const target = await queryOne(
      'select full_name, email from profiles where lower(email) = lower($1) and is_active = true',
      [email]
    );
    if (!target) throw new ApiError(404, 'ไม่พบบัญชีผู้ใช้ที่ใช้งานอยู่สำหรับอีเมลนี้');

    const askerName = req.profile.full_name || req.profile.email;
    const targetName = target.full_name || target.email;
    const body = `ขอความเห็นจาก ${targetName}${question ? ` — ${question}` : ''}`;
    const row = await queryOne(
      `insert into document_messages (document_id, author_id, author_label, body, kind, consult_email)
       values ($1,$2,$3,$4,'consult',$5)
       returning id, body, author_label, kind, consult_email, created_at`,
      [doc.id, req.profile.id, askerName, body, target.email]
    );

    await sendConsultRequest({
      toEmail: target.email, toName: target.full_name, doc, askerName, question,
    }).catch((e) => console.error('consult email failed:', e.message));

    res.status(201).json({ data: { ...row, author_name: req.profile.full_name || null, attachments: [] } });
  })
);

// ── create / edit / cancel ──────────────────────────────────────────────────

const createSchema = z.object({
  projectId: z.string().uuid(),
  companyId: z.string().uuid().optional().nullable(),
  docCode: z.string().min(1).max(10),
  subject: z.string().min(1),
  recipient: z.string().optional(),
  reference: z.string().optional(),
  referenceDocId: z.string().uuid().optional().nullable(),
  cc: z.string().optional(),
  signerName: z.string().optional(),
  signerTitle: z.string().optional(),
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
  requirePermission('ememo', 'create'),
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
           (project_id, company_id, doc_code, department, run_no, doc_number, doc_type_id, subject,
            recipient, reference, reference_doc_id, cc_recipients, signer_name, signer_title, author_signature_url,
            body, remarks, date_received, work_unit, enclosures, source, status, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,coalesce($18::date,current_date),$19,$20::jsonb,'manual','draft',$21)
         returning id, doc_number, run_no, department, status, date_received`,
        [project.id, input.companyId || null, input.docCode, department, runNo, docNumber, input.docTypeId || null, input.subject,
         input.recipient || null, input.reference || null, input.referenceDocId || null, input.cc || null,
         input.signerName || null, input.signerTitle || null, input.authorSignatureUrl || null,
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
  referenceDocId: z.string().uuid().optional().nullable(),
  cc: z.string().optional().nullable(),
  signerName: z.string().optional().nullable(),
  signerTitle: z.string().optional().nullable(),
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
    const doc = await loadDocForMutation(req);
    if (!['draft', 'pending', 'returned'].includes(doc.status)) {
      throw new ApiError(409, 'แก้ไขได้เฉพาะเอกสารที่ยังไม่อนุมัติ/ปิดเรื่อง');
    }
    const f = parsed.data;
    const sets = [];
    const vals = [];
    // Track before→after per field so the audit trail can show what changed.
    // `label` is the Thai field name; `oldVal` reads from the pre-update row.
    const changes = [];
    const enclText = (e) => (Array.isArray(e) ? e.map((x, i) => `${i + 1}. ${x.name || ''}${x.qty != null ? ` (${x.qty} ${x.unit || 'ชุด'})` : ''}`).join(', ') : '');
    const dateText = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
    const add = (col, val, cast = '', label = null, oldVal = undefined, format = (v) => (v == null || v === '' ? '' : String(v))) => {
      vals.push(val);
      sets.push(`${col} = $${vals.length}${cast}`);
      if (label) {
        const before = format(oldVal);
        const after = format(val);
        if (before !== after) changes.push({ label, from: before, to: after });
      }
    };
    if (f.subject !== undefined) add('subject', f.subject, '', 'เรื่อง', doc.subject);
    if (f.recipient !== undefined) add('recipient', f.recipient || null, '', 'เรียน', doc.recipient);
    if (f.reference !== undefined) add('reference', f.reference || null, '', 'อ้างถึง', doc.reference);
    if (f.referenceDocId !== undefined) add('reference_doc_id', f.referenceDocId || null); // link change — not human-meaningful in the trail
    if (f.cc !== undefined) add('cc_recipients', f.cc || null, '', 'สำเนาเรียน', doc.cc_recipients);
    if (f.signerName !== undefined) add('signer_name', f.signerName || null, '', 'ผู้ลงนาม', doc.signer_name);
    if (f.signerTitle !== undefined) add('signer_title', f.signerTitle || null, '', 'ตำแหน่งผู้ลงนาม', doc.signer_title);
    if (f.body !== undefined) add('body', f.body || null, '', 'เนื้อความ', doc.body);
    if (f.remarks !== undefined) add('remarks', f.remarks || null, '', 'หมายเหตุ', doc.remarks);
    if (f.workUnit !== undefined) add('work_unit', f.workUnit || null, '', 'หน่วยงาน', doc.work_unit);
    if (f.docTypeId !== undefined) add('doc_type_id', f.docTypeId || null); // id change — not human-meaningful in the trail
    if (f.dateReceived !== undefined) add('date_received', f.dateReceived || null, '::date', 'วันที่รับ', doc.date_received, dateText);
    if (f.enclosures !== undefined) add('enclosures', JSON.stringify(f.enclosures), '::jsonb', 'สิ่งที่ส่งมาด้วย', doc.enclosures, enclText);
    if (!sets.length) throw new ApiError(400, 'No fields to update');
    vals.push(req.params.id);
    await query(`update documents set ${sets.join(', ')} where id = $${vals.length}`, vals);
    await query(
      `insert into audit_log (document_id, actor_id, actor_label, action, detail) values ($1,$2,$3,'edited',$4)`,
      [req.params.id, req.profile.id, req.profile.full_name || req.profile.email, JSON.stringify({ changes })]
    );
    // Regenerate the letter PDF so it reflects the edit (otherwise the preview/print
    // and any approver keep seeing the pre-edit content). Best-effort: the edit is
    // already saved, so a PDF failure must not fail the request.
    try {
      await generateOriginalPdf(req.params.id, req.profile.id);
      await autoCombine(req.params.id, req.profile.id);
    } catch (e) {
      console.error('regenerate-after-edit failed:', e.message);
    }
    // return the full detail
    const detail = await queryOne(`select ${LIST_SELECT}, d.body, d.work_unit, d.enclosures, d.reference, d.cc_recipients,
              d.signer_name, d.signer_title, d.created_by, pr.full_name as preparer_name
         ${LIST_FROM}
         left join profiles pr on pr.id = d.created_by
        where d.id = $1`, [req.params.id]);
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
    const doc = await loadDocForMutation(req);
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
    const doc = await loadDocForMutation(req);
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
    await loadDocForMutation(req);
    if (!req.file) throw new ApiError(400, 'No file uploaded (field "file")');
    const fileName = decodeFilename(req.file.originalname);
    const safeName = fileName.replace(/[^\w.\-ก-๙ ]/g, '_');
    const key = `documents/${req.params.id}/${crypto.randomUUID()}-${safeName}`;
    await putObject(key, req.file.buffer, req.file.mimetype);
    const row = await queryOne(
      `insert into document_attachments (document_id, kind, file_name, content_type, size_bytes, storage_key, uploaded_by)
       values ($1,'upload',$2,$3,$4,$5,$6) returning id, file_name, content_type, size_bytes, created_at`,
      [req.params.id, fileName, req.file.mimetype || null, req.file.size ?? null, key, req.profile.id]
    );
    autoCombine(req.params.id, req.profile.id); // background: fold the new file into the combined PDF
    res.status(201).json({ data: row });
  })
);

/** GET /api/documents/:id/attachments/:attId/download — stream bytes (inline). */
router.get(
  '/:id/attachments/:attId/download',
  asyncHandler(async (req, res) => {
    const doc = await queryOne('select id, project_id, doc_code from documents where id = $1', [req.params.id]);
    if (!doc) throw new ApiError(404, 'Document not found');
    await assertCanView(req.profile, doc);
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
    await loadDocForMutation(req);
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
    await loadDocForMutation(req);
    const row = await generateOriginalPdf(req.params.id, req.profile.id);
    autoCombine(req.params.id, req.profile.id); // background: refresh combined file
    res.status(201).json({ data: { id: row.id, file_name: row.file_name, version: 'original', created_at: row.created_at } });
  })
);

/**
 * POST /api/documents/:id/combine — build ONE combined PDF: the letter followed
 * by every PDF/image attachment (สิ่งที่ส่งมาด้วย). Returns the new attachment
 * meta + any skipped (non-PDF/image) file names so the UI can warn.
 */
router.post(
  '/:id/combine',
  asyncHandler(async (req, res) => {
    await loadDocForMutation(req);
    const row = await generateCombinedPdf(req.params.id, req.profile.id);
    if (!row) throw new ApiError(409, 'ยังไม่มีไฟล์หนังสือ — กรุณาสร้างไฟล์หนังสือก่อน');
    res.status(201).json({
      data: { id: row.id, file_name: row.file_name, kind: 'combined_pdf', created_at: row.created_at, skipped: row.skipped },
    });
  })
);

/**
 * GET /api/documents/:id/my-approval — is the logged-in user the current pending
 * approver for this document? Returns { canApprove, step } so the detail page can
 * show approve/return/reject controls only to the right person.
 */
router.get(
  '/:id/my-approval',
  asyncHandler(async (req, res) => {
    const step = await queryOne(
      `select id, step_no, approver_name, approver_email
         from approval_steps
        where document_id = $1 and action = 'pending' and action_token is not null
        order by step_no limit 1`,
      [req.params.id]
    );
    const canApprove = Boolean(step) && step.approver_email
      && step.approver_email.toLowerCase() === (req.profile.email || '').toLowerCase();
    // tell the UI whether this approver has a saved signature, so it can warn
    // before an approval that would otherwise stamp a blank signature.
    let hasSignature = false;
    if (canApprove) {
      const sig = await queryOne('select signature_url from profiles where id = $1', [req.profile.id]);
      hasSignature = Boolean(sig?.signature_url);
    }
    res.json({ data: { canApprove, step: canApprove ? step : null, hasSignature } });
  })
);

const approveSchema = z.object({
  action: z.enum(['approved', 'rejected', 'returned']),
  comment: z.string().optional(),
});

/**
 * POST /api/documents/:id/approve — the logged-in user acts on the current
 * pending step, IF their email matches that step's approver. This is the
 * in-app (login-gated) replacement for the public /approve/:token flow.
 * Authorization is being the assigned approver of the current step — NOT the
 * "submit your own memos" permission, which is a different capability.
 */
router.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const parsed = approveSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    // A reject/return must carry a reason (client enforces it too; this backs it
    // up for direct API calls so the audit/verify trail is never blank).
    if ((parsed.data.action === 'rejected' || parsed.data.action === 'returned') && !parsed.data.comment?.trim()) {
      throw new ApiError(400, 'กรุณาระบุเหตุผลสำหรับการไม่อนุมัติหรือส่งกลับแก้ไข');
    }

    const step = await queryOne(
      `select id, approver_email from approval_steps
        where document_id = $1 and action = 'pending' and action_token is not null
        order by step_no limit 1`,
      [req.params.id]
    );
    if (!step) throw new ApiError(409, 'เอกสารนี้ไม่มีขั้นที่รออนุมัติอยู่');
    if ((step.approver_email || '').toLowerCase() !== (req.profile.email || '').toLowerCase()) {
      throw new ApiError(403, 'คุณไม่ใช่ผู้อนุมัติของขั้นนี้');
    }

    // use the approver's saved profile signature (if they have one) on the doc
    const sig = await queryOne('select signature_url from profiles where id = $1', [req.profile.id]);

    const client = await pool.connect();
    let result;
    try {
      await client.query('begin');
      result = await applyApprovalAction(client, {
        stepId: step.id,
        action: parsed.data.action,
        comment: parsed.data.comment,
        signatureUrl: sig?.signature_url || null,
      });
      if (result.error) {
        await client.query('rollback');
        throw new ApiError(409, result.error === 'already_actioned' ? 'รายการนี้ถูกดำเนินการไปแล้ว' : 'ไม่สามารถดำเนินการได้');
      }
      await client.query('commit');
    } catch (err) {
      if (!(err instanceof ApiError)) await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    // side effects (same as the email flow): next approver email, PDFs, notify author
    if (result.nextStep) {
      await sendApprovalRequest({ step: result.nextStep, doc: result.document }).catch((e) => console.error('next-approver email failed:', e.message));
    }
    if (result.finalized) {
      await generateApprovedPdf(result.document.id).catch((e) => console.error('approved-pdf failed:', e.message));
      // rebuild the combined "one file" so it merges the SIGNED letter, not the original
      await autoCombine(result.document.id);
    } else if (parsed.data.action === 'returned' || parsed.data.action === 'rejected') {
      await regenerateOriginalWithAudit(result.document.id).catch((e) => console.error('audit-pdf failed:', e.message));
      await autoCombine(result.document.id);
    }
    if (result.finalized || parsed.data.action === 'returned' || parsed.data.action === 'rejected') {
      const author = await queryOne(
        `select pr.full_name, pr.email from documents d join profiles pr on pr.id = d.created_by where d.id = $1`,
        [result.document.id]
      ).catch(() => null);
      if (author?.email) {
        await sendAuthorNotification({
          toEmail: author.email, authorName: author.full_name, doc: result.document,
          outcome: result.finalized ? 'approved' : parsed.data.action,
          actorName: req.profile.full_name || req.profile.email, comment: parsed.data.comment,
        }).catch((e) => console.error('author notification failed:', e.message));
      }
    }

    res.json({ data: { action: parsed.data.action, documentStatus: result.document.status, finalized: Boolean(result.finalized), advanced: Boolean(result.nextStep) } });
  })
);

const submitSchema = z.object({
  approvers: z.array(z.object({ name: z.string().optional(), email: z.string().email() })).min(1),
});

router.post(
  '/:id/submit',
  requirePermission('ememo', 'submit'),
  asyncHandler(async (req, res) => {
    const doc = await loadDocForMutation(req);
    // approved/rejected/cancelled documents are done — never re-submittable
    if (!['draft', 'returned', 'pending'].includes(doc.status)) {
      throw new ApiError(409, 'ส่งอนุมัติได้เฉพาะเอกสารที่ยังไม่อนุมัติเท่านั้น');
    }
    // a pending doc that already has a live approval chain must not be re-submitted
    // (that would wipe an in-flight chain on a double-click / stray re-send)
    if (doc.status === 'pending') {
      const live = await queryOne(
        `select id from approval_steps where document_id = $1 and action = 'pending' limit 1`,
        [doc.id]
      );
      if (live) {
        throw new ApiError(409, 'เอกสารนี้อยู่ระหว่างรออนุมัติแล้ว');
      }
    }
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());

    // Every approver must have an ACTIVE account: the approval email links to the
    // login-gated in-app page, so an approver without an account gets a dead link
    // and the document stalls. Reject early with the offending addresses.
    const emails = [...new Set(parsed.data.approvers.map((a) => a.email.toLowerCase()))];
    const { rows: accts } = await query(
      `select lower(email) as email from profiles where is_active = true and lower(email) = any($1::text[])`,
      [emails]
    );
    const known = new Set(accts.map((r) => r.email));
    const missing = emails.filter((e) => !known.has(e));
    if (missing.length) {
      throw new ApiError(400, `ผู้อนุมัติต่อไปนี้ยังไม่มีบัญชีที่ใช้งานได้ในระบบ จึงจะอนุมัติผ่านลิงก์ไม่ได้: ${missing.join(', ')} — กรุณาสร้างบัญชีให้ก่อน หรือเลือกผู้อนุมัติที่มีบัญชี`);
    }

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
    // Track whether the approver was actually notified. On failure, record it in
    // the document's history (visible in the detail timeline) and tell the caller,
    // so "submitted" doesn't silently hide that no email went out.
    let emailSent = true;
    await sendApprovalRequest({ step: firstStep, doc }).catch((e) => { emailSent = false; console.error('approval email failed:', e.message); });
    if (!emailSent) {
      await query(
        `insert into audit_log (document_id, actor_id, actor_label, action, detail) values ($1,$2,$3,'email_failed',$4)`,
        [doc.id, req.profile.id, req.profile.full_name || req.profile.email, JSON.stringify({ to: firstStep.approver_email })]
      ).catch(() => {});
    }

    // CC "for your information / please advise" — send a copy to any email in the
    // สำเนาเรียน field. CC recipients are consulted, NOT in the approval chain.
    const ccEmails = extractCcEmails(doc.cc_recipients);
    if (ccEmails.length) {
      await sendCcNotification({
        toEmails: ccEmails,
        doc,
        actorName: req.profile.full_name || req.profile.email,
      }).catch((e) => console.error('cc notification failed:', e.message));
    }

    res.json({ data: { status: 'pending', firstApprover: firstStep.approver_email, ccNotified: ccEmails.length, emailSent } });
  })
);

export default router;
