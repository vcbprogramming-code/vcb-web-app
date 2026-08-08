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
import { putObject, deleteObject, openDownloadStream, getObjectBuffer } from '../config/storage.js';
import { generateOriginalPdf, generateApprovedPdf, regenerateOriginalWithAudit } from '../services/pdfDoc.js';
import { generateCombinedPdf, autoCombine } from '../services/pdfMerge.js';
import { parseXlsxToSheets } from '../services/sheetPdf.js';
import { createApprovalChain, sendApprovalRequest, applyApprovalAction } from '../services/approval.js';
import { sendCcNotification, extractCcEmails, sendAuthorNotification, sendConsultRequest } from '../services/email.js';

const router = Router();
router.use(requireAuth);

/**
 * An id in the path that isn't a UUID reaches Postgres as a bad cast and comes
 * back as a bare 500 — which is what a truncated or mistyped document link
 * produced. It's simply not found, so say so, once, for every :id route.
 * (Literal routes like /export and /next-number are declared before /:id and
 * match first, so they never reach this.)
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
for (const name of ['id', 'attId', 'msgId']) {
  router.param(name, (req, res, next, value) =>
    next(UUID_RE.test(value) ? undefined : new ApiError(404, 'ไม่พบเอกสาร')));
}

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
 * Build an ASCII-safe slug for a storage (S3) key. Supabase Storage rejects keys
 * containing non-ASCII (e.g. Thai) or spaces with "Invalid key", so the object
 * key must be sanitised — the human-readable original name is preserved
 * separately in document_attachments.file_name for display/download.
 */
function storageSafeName(name) {
  const raw = name || 'file';
  const dot = raw.lastIndexOf('.');
  const ext = dot > 0 ? raw.slice(dot).replace(/[^A-Za-z0-9.]/g, '').slice(0, 12) : '';
  const base = (dot > 0 ? raw.slice(0, dot) : raw)
    .replace(/[^A-Za-z0-9._-]+/g, '_') // drop Thai/spaces/other → underscore
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 40);
  return (base || 'file') + ext;
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

/** True if `vis` (from loadVisibility) permits a doc with this project/code.
 *  Scopes are a UNION, not an intersection: a user granted project P *and*
 *  doc_code X may see docs in P OR docs coded X. AND-combining them (the old
 *  behaviour) hid docs the user was explicitly granted. */
function visibilityAllows(vis, projectId, docCode) {
  if (!vis) return true;
  if (vis.projectIds.length && vis.projectIds.includes(projectId)) return true;
  if (vis.docCodes.length && vis.docCodes.includes(docCode)) return true;
  return false;
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
      where document_id = $1 and action = 'pending' and action_token is not null
        and lower(approver_email) = lower($2)
      limit 1`,
    [doc.id, profile.email || '']
  );
  // only the CURRENTLY-active approver (their step is issued a token) bypasses view
  // scope — a later approver in the chain shouldn't see the doc before it's their turn (#C7)
  if (approver) return;
  if (!hasPermission(profile, 'ememo', 'view')) throw new ApiError(403, 'ไม่มีสิทธิ์ดูเอกสาร');
  await assertDocVisible(profile, doc);
}

/** Build the WHERE clause + params from register filters (shared by list/export).
 *  `visibility` (from loadVisibility) further restricts rows to allowed scopes. */
function buildWhere(q, visibility = null) {
  const where = [];
  const params = [];
  // a repeated query param (?projectId=a&projectId=b) arrives as an array; binding
  // that where a scalar is expected makes Postgres reject the cast → 500. Coerce to
  // the first value so a malformed URL can't crash the register. (#C3)
  const one = (v) => (Array.isArray(v) ? v[0] : v);
  const add = (clause, value) => { params.push(value); where.push(clause.replace('$$', `$${params.length}`)); };
  // A hand-edited or stale URL used to reach Postgres as a bad ::uuid / ::date cast
  // and come back as a 500. Validate the shape here and answer 400 instead.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const YMD = /^\d{4}-\d{2}-\d{2}$/;
  const uuidArg = (v, label) => {
    const s = one(v);
    if (!UUID.test(String(s))) throw new ApiError(400, `ตัวกรอง${label}ไม่ถูกต้อง — กรุณาล้างตัวกรองแล้วลองใหม่`);
    return s;
  };
  const dateArg = (v, label) => {
    const s = String(one(v));
    // shape AND real calendar date — "2026-13-99" matches the pattern but blows up
    // the ::date cast.
    const d = YMD.test(s) ? new Date(`${s}T00:00:00Z`) : null;
    if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
      throw new ApiError(400, `${label}ไม่ถูกต้อง (ต้องเป็นวันที่จริงในรูปแบบ YYYY-MM-DD)`);
    }
    return s;
  };
  // A status outside the known set reaches Postgres as a bad cast and came back
  // as a 500 — the same trap as the uuid/date filters above, and just as easy to
  // hit from a stale bookmark or a hand-edited URL.
  const statusArg = (v) => {
    const s = String(one(v));
    if (!Object.hasOwn(STATUS_TH, s)) {
      throw new ApiError(400, 'ตัวกรองสถานะไม่ถูกต้อง — กรุณาล้างตัวกรองแล้วลองใหม่');
    }
    return s;
  };
  if (q.projectId) add('d.project_id = $$', uuidArg(q.projectId, 'โครงการ'));
  if (q.status) add('d.status = $$', statusArg(q.status));
  if (q.docTypeId) add('d.doc_type_id = $$', uuidArg(q.docTypeId, 'ประเภทเอกสาร'));
  if (q.from) add('d.date_received >= $$', dateArg(q.from, 'วันที่เริ่มต้น'));
  if (q.to) add('d.date_received <= $$', dateArg(q.to, 'วันที่สิ้นสุด'));
  if (q.search) {
    params.push(`%${one(q.search)}%`);
    const i = params.length;
    where.push(`(d.subject ilike $${i} or d.doc_number ilike $${i} or d.recipient ilike $${i} or d.remarks ilike $${i})`);
  }
  // per-user visibility scoping (#8) — UNION of granted scopes (project OR code),
  // matching visibilityAllows(). AND-ing them hid explicitly-granted docs.
  if (visibility) {
    const scope = [];
    if (visibility.projectIds.length) { params.push(visibility.projectIds); scope.push(`d.project_id = any($${params.length}::uuid[])`); }
    if (visibility.docCodes.length) { params.push(visibility.docCodes); scope.push(`d.doc_code = any($${params.length}::text[])`); }
    if (scope.length) where.push(`(${scope.join(' or ')})`);
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

    // Flag rows whose CURRENT pending step awaits the logged-in user. Used for the
    // per-row marker and for the "รออนุมัติ N" filter.
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
    // ?awaiting=me narrows the register to the reviewer's own queue. This replaces
    // the old "float awaiting rows to the top" sort, which silently pushed a
    // just-created document off page 1 for anyone with a full approval queue —
    // the "เอกสารที่เพิ่งบันทึกหายไป" report. Counting has to apply the same filter.
    const onlyAwaiting = (Array.isArray(req.query.awaiting) ? req.query.awaiting[0] : req.query.awaiting) === 'me';
    const awaitingSql = onlyAwaiting ? `${whereSql ? 'and' : 'where'} ${awaitingExpr}` : '';

    const countRow = await queryOne(
      `select count(*)::int as total ${LIST_FROM} ${whereSql} ${awaitingSql}`,
      onlyAwaiting ? listParams : params
    );
    const offset = (page - 1) * pageSize;
    // Newest ENTERED first. Ordering by date_received (the letter's own date) hid a
    // back-dated memo below newer ones the moment it was saved; created_at is what
    // makes "the document I just saved" the first row, every time.
    const { rows } = await query(
      `select ${LIST_SELECT}, ${awaitingExpr} as is_awaiting_me ${LIST_FROM} ${whereSql} ${awaitingSql}
        order by d.created_at desc, d.date_received desc, d.doc_number desc
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
  requirePermission('ememo', 'view'), // #C8: don't expose the company directory to accounts with no E-Memo access
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
  requirePermission('ememo', 'view'), // #C8
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
  requirePermission('ememo', 'view'), // #C8: running-number lookup is document data, not public to any login
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
    // UNION of granted scopes (project OR doc_code), matching visibilityAllows() and
    // buildWhere() — AND-ing them hid docs the user was explicitly granted. (#C1)
    const vAnd = vparts.length ? ` and (${vparts.join(' or ')})` : '';
    const vWhere = vparts.length ? ` where (${vparts.join(' or ')})` : '';
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
          ${scope.length ? `and (${scope.join(' or ')})` : ''}
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
              d.signer_name, d.signer_title, d.created_by, d.company_id, d.verify_token, d.draft_approvers,
              pr.full_name as preparer_name,
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
      // storage_key is surfaced so the UI can show WHERE each file is kept —
      // required by the acceptance criteria ("แสดงตำแหน่งการจัดเก็บไฟล์อย่างชัดเจน").
      `select id, kind, version, file_name, content_type, size_bytes, created_at, storage_key
         from document_attachments where document_id = $1 order by created_at`, [req.params.id]);
    const { rows: steps } = await query(
      `select id, step_no, approver_name, approver_email, action, comment, acted_at,
              is_signer, (signature_url is not null) as has_signature
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
    await assertCanView(req.profile, doc); // #7: need view perm (or be a pending approver), not just visibility
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
    await assertCanView(req.profile, await getDocOr404(req.params.id)); // #7
    const msg = await queryOne('select id from document_messages where id = $1 and document_id = $2', [req.params.msgId, req.params.id]);
    if (!msg) throw new ApiError(404, 'Message not found');
    if (!req.file) throw new ApiError(400, 'No file uploaded (field "file")');
    const fileName = decodeFilename(req.file.originalname);
    const safeName = storageSafeName(fileName);
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
    await assertCanView(req.profile, doc); // #7
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

// YYYY-MM-DD, a real calendar date. Guards against `new Date(bad).toISOString()`
// throwing RangeError → 500, and against Postgres rejecting a bad date cast. (#C2)
const ymdField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)')
  .refine((s) => { const d = new Date(`${s}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; }, 'วันที่ไม่ถูกต้อง');

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
  dateReceived: ymdField.optional(),
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
      // A stale "อ้างถึง" pick (document since deleted) hit the FK and surfaced as a
      // 500 — answer 400 with something the user can act on.
      if (input.referenceDocId) {
        const ref = await client.query('select 1 from documents where id = $1', [input.referenceDocId]);
        if (!ref.rowCount) throw new ApiError(400, 'ไม่พบเอกสารที่อ้างถึง — กรุณาเลือกเอกสารอ้างถึงใหม่');
      }
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
  dateReceived: ymdField.optional(),
  workUnit: z.string().optional().nullable(),
  enclosures: z.array(z.object({ name: z.string(), qty: z.number().optional(), unit: z.string().optional() })).optional(),
});

/** PATCH /api/documents/:id — edit content while draft/pending/returned/rejected.
 *  A rejected doc can be corrected and re-submitted for review (#11). */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const parsed = editSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const doc = await loadDocForMutation(req);
    if (!['draft', 'pending', 'returned', 'rejected'].includes(doc.status)) {
      throw new ApiError(409, 'แก้ไขได้เฉพาะเอกสารที่ยังไม่อนุมัติ/ปิดเรื่อง');
    }
    // #5: once ANY approver in the chain has acted (approved/signed), the content
    // they endorsed must not change under them. Edits only while nobody has acted.
    if (doc.status === 'pending') {
      const acted = await queryOne(
        "select 1 from approval_steps where document_id = $1 and action <> 'pending' limit 1",
        [doc.id]
      );
      if (acted) throw new ApiError(409, 'มีผู้อนุมัติในสายทางแล้ว ไม่สามารถแก้ไขเนื้อหาได้ (ให้ตีกลับเพื่อแก้ไข)');
    }
    const f = parsed.data;
    // same guard as create — a stale "อ้างถึง" pick must not become a 500
    if (f.referenceDocId) {
      const ref = await queryOne('select 1 from documents where id = $1', [f.referenceDocId]);
      if (!ref) throw new ApiError(400, 'ไม่พบเอกสารที่อ้างถึง — กรุณาเลือกเอกสารอ้างถึงใหม่');
    }
    const sets = [];
    const vals = [];
    // Track before→after per field so the audit trail can show what changed.
    // `label` is the Thai field name; `oldVal` reads from the pre-update row.
    const changes = [];
    const enclText = (e) => (Array.isArray(e) ? e.map((x, i) => `${i + 1}. ${x.name || ''}${x.qty != null ? ` (${x.qty} ${x.unit || 'ชุด'})` : ''}`).join(', ') : '');
    const dateText = (d) => { if (!d) return ''; const dt = new Date(d); return Number.isNaN(dt.getTime()) ? String(d) : dt.toISOString().slice(0, 10); };
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
    const doc = await loadDocForMutation(req);
    // The combined "one file" is rebuilt on every upload, so allowing an
    // attachment after approval silently changes an already-approved record.
    // PATCH already refuses; attachments must match.
    if (doc.status === 'approved' || doc.status === 'cancelled') {
      throw new ApiError(409, 'เอกสารที่อนุมัติหรือยกเลิกแล้ว แนบไฟล์เพิ่มไม่ได้');
    }
    if (!req.file) throw new ApiError(400, 'No file uploaded (field "file")');
    const fileName = decodeFilename(req.file.originalname);
    const safeName = storageSafeName(fileName);
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
    const ctype = obj.contentType || att.content_type || 'application/octet-stream';
    res.setHeader('Content-Type', ctype);
    if (obj.length != null) res.setHeader('Content-Length', obj.length);
    // Only formats the viewer previews in place are served inline. An SVG (or any
    // markup type) rendered inline executes its own script in THIS origin, so
    // everything else is forced to download instead. `nosniff` doesn't help when
    // the declared type is the dangerous one.
    const inlineSafe = ctype === 'application/pdf' || /^image\/(png|jpeg|jpg|gif|webp|bmp)$/i.test(ctype);
    const disp = inlineSafe ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disp}; filename*=UTF-8''${encodeURIComponent(att.file_name || 'file')}`);
    obj.stream.on('error', () => res.destroy());
    obj.stream.pipe(res);
  })
);

/** GET /api/documents/:id/attachments/:attId/sheet — parse an .xlsx attachment
 *  into rows so the client can preview it as a table. The file never leaves our
 *  system (parsed server-side with the bundled exceljs), so confidential
 *  spreadsheets aren't sent to any third-party viewer. Output is capped. */
router.get(
  '/:id/attachments/:attId/sheet',
  asyncHandler(async (req, res) => {
    const doc = await queryOne('select id, project_id, doc_code from documents where id = $1', [req.params.id]);
    if (!doc) throw new ApiError(404, 'Document not found');
    await assertCanView(req.profile, doc);
    const att = await queryOne(
      'select storage_key, file_name, content_type from document_attachments where id = $1 and document_id = $2',
      [req.params.attId, req.params.id]);
    if (!att) throw new ApiError(404, 'Attachment not found');
    const isXlsx = /spreadsheetml|officedocument\.spreadsheet/i.test(att.content_type || '')
      || /\.xlsx$/i.test(att.file_name || '');
    if (!isXlsx) throw new ApiError(400, 'ไฟล์นี้แสดงเป็นตารางไม่ได้ (รองรับเฉพาะ .xlsx)');

    const buf = await getObjectBuffer(att.storage_key);
    let parsed;
    try {
      parsed = await parseXlsxToSheets(buf);
    } catch {
      throw new ApiError(422, 'เปิดไฟล์ Excel นี้ไม่สำเร็จ — ไฟล์อาจเสียหาย กรุณาดาวน์โหลดเพื่อเปิดด้วยโปรแกรม');
    }
    res.json({ data: parsed });
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
    // Regenerate the SIGNED letter after EVERY approval (not just the final one)
    // so each approver's signature shows immediately — the next approver then sees
    // that the previous person already signed (#9). generateApprovedPdf only stamps
    // the steps approved so far, so mid-chain it's a partially-signed letter.
    if (result.finalized || parsed.data.action === 'approved') {
      await generateApprovedPdf(result.document.id).catch((e) => console.error('approved-pdf failed:', e.message));
      // rebuild the combined "one file" so it merges the SIGNED letter, not the original
      await autoCombine(result.document.id);
    } else if (parsed.data.action === 'returned' || parsed.data.action === 'rejected') {
      await regenerateOriginalWithAudit(result.document.id).catch((e) => console.error('audit-pdf failed:', e.message));
      await autoCombine(result.document.id);
    }
    // Close the loop for the "สำเนาเรียน" recipients: they were told the document
    // was under review, so they must also be told it finished. Without this a CC
    // recipient never learns the outcome.
    if (result.finalized) {
      const ccEmails = extractCcEmails(result.document.cc_recipients);
      if (ccEmails.length) {
        await sendCcNotification({
          toEmails: ccEmails,
          doc: result.document,
          actorName: req.profile.full_name || req.profile.email,
          stage: 'approved',
        }).catch((e) => console.error('cc approved notification failed:', e.message));
      }
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
  // approvers[0] with isSigner:true = the ผู้จัดการโครงการ/ผู้ลงนาม (first to approve;
  // signature stamped under "ขอแสดงความนับถือ"). The rest are the higher approvers.
  approvers: z.array(z.object({
    name: z.string().optional(),
    email: z.string().email(),
    isSigner: z.boolean().optional(),
  })).min(1),
  // reason the creator is re-submitting a rejected/returned doc for review (#11) —
  // logged to the thread + audit so reviewers see what changed since last time.
  resubmitNote: z.string().optional(),
});

const draftApproversSchema = z.object({
  pm: z.object({ name: z.string().optional().nullable(), email: z.string().email() }).nullable().optional(),
  execs: z.array(z.object({ name: z.string().optional().nullable(), email: z.string().email() })).max(20).optional(),
});

/**
 * PUT /api/documents/:id/draft-approvers — park the approvers chosen while the
 * document is still a draft.
 *
 * The real chain is only written at submit time, so "บันทึกเป็นฉบับร่าง" used to
 * discard the approver list the user had just picked; they came back to send it
 * and found the form empty. This stores the intent only — nothing approves off
 * it, and submit still builds approval_steps from what is posted then.
 */
router.put(
  '/:id/draft-approvers',
  asyncHandler(async (req, res) => {
    const doc = await loadDocForMutation(req);
    const parsed = draftApproversSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    // only meaningful before/between chains — never overwrite while one is live
    if (doc.status === 'pending' || doc.status === 'approved') {
      throw new ApiError(409, 'เอกสารนี้อยู่ในสายอนุมัติแล้ว');
    }
    const value = {
      pm: parsed.data.pm?.email ? { name: parsed.data.pm.name || null, email: parsed.data.pm.email } : null,
      execs: (parsed.data.execs || []).filter((a) => a.email).map((a) => ({ name: a.name || null, email: a.email })),
    };
    const empty = !value.pm && !value.execs.length;
    await query('update documents set draft_approvers = $2::jsonb where id = $1', [
      doc.id,
      empty ? null : JSON.stringify(value),
    ]);
    res.json({ data: empty ? null : value });
  })
);

router.post(
  '/:id/submit',
  requirePermission('ememo', 'submit'),
  asyncHandler(async (req, res) => {
    const doc = await loadDocForMutation(req);
    // approved/cancelled documents are done. A REJECTED doc may be corrected and
    // re-submitted for review (#11) — it re-enters the chain like a returned one.
    if (!['draft', 'returned', 'rejected', 'pending'].includes(doc.status)) {
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

    // Re-submitting a rejected/returned doc requires a reason (#11) so reviewers
    // know what changed — enforced here so a direct API call can't skip it either.
    const isResubmit = doc.status === 'returned' || doc.status === 'rejected';
    if (isResubmit && !parsed.data.resubmitNote?.trim()) {
      throw new ApiError(400, 'กรุณาระบุเหตุผลที่ส่งเอกสารกลับเข้าพิจารณาอีกครั้ง');
    }

    // A document must be reviewed by somebody other than its author. When the author
    // is also the ผู้ลงนาม, createApprovalChain auto-approves that step — so a chain
    // consisting ONLY of the author would jump straight to 'approved' with nobody
    // having read it, while the wizard promised "เว้นว่างไว้ = ฉบับร่าง".
    const first = parsed.data.approvers[0];
    const authorIsSoleApprover =
      parsed.data.approvers.length === 1 &&
      first?.isSigner &&
      first.email.toLowerCase() === (req.profile.email || '').toLowerCase();
    if (authorIsSoleApprover) {
      throw new ApiError(400, 'ท่านเป็นผู้ลงนามของเอกสารนี้เอง — กรุณาเลือกผู้อนุมัติที่สูงกว่าอย่างน้อย 1 คน มิฉะนั้นเอกสารจะถูกอนุมัติโดยไม่ผ่านการตรวจสอบจากผู้อื่น (หรือกดบันทึกเป็นฉบับร่างไว้ก่อน)');
    }

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
    let chain;
    try {
      await client.query('begin');
      chain = await createApprovalChain(client, {
        documentId: doc.id,
        approvers: parsed.data.approvers,
        actorLabel: req.profile.full_name || req.profile.email,
        actorId: req.profile.id,
      });
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      // two concurrent submits (double-click) race on approval_steps' unique
      // (document_id, step_no) — the loser hits 23505. The winner already built the
      // chain, so tell the loser it's already pending instead of a raw 500. (#C4)
      if (err?.code === '23505') throw new ApiError(409, 'เอกสารนี้อยู่ระหว่างรออนุมัติแล้ว');
      throw err;
    } finally {
      client.release();
    }
    const firstStep = chain.firstStep;

    // The parked draft list has served its purpose — approval_steps is now the
    // truth. Leaving it would prefill a stale list if the doc comes back rejected.
    await query('update documents set draft_approvers = null where id = $1', [doc.id]).catch(() => {});

    // Log the resubmission reason to the thread + audit so reviewers see what changed (#11).
    if (isResubmit && parsed.data.resubmitNote?.trim()) {
      const note = parsed.data.resubmitNote.trim();
      await query(
        `insert into document_messages (document_id, author_id, author_label, body, kind)
         values ($1,$2,$3,$4,'note')`,
        [doc.id, req.profile.id, req.profile.full_name || req.profile.email, `ส่งพิจารณาอีกครั้ง: ${note}`]
      ).catch((e) => console.error('resubmit note message failed:', e.message));
      await query(
        `insert into audit_log (document_id, actor_id, actor_label, action, detail) values ($1,$2,$3,'resent',$4)`,
        [doc.id, req.profile.id, req.profile.full_name || req.profile.email, { note }]
      ).catch((e) => console.error('resubmit audit failed:', e.message));
    }

    // Produce the signed PDF now when either the chain fully approved on submit
    // (creator IS the signer, no higher approvers), OR the PM/signer step was
    // auto-approved but execs remain — the next exec must see the PM's signature (#6).
    if (chain.finalized || chain.signerAutoApproved) {
      await generateApprovedPdf(doc.id).catch((e) => console.error('approved-pdf failed:', e.message));
      await autoCombine(doc.id);
    }

    // Track whether the approver was actually notified. On failure, record it in
    // the document's history (visible in the detail timeline) and tell the caller,
    // so "submitted" doesn't silently hide that no email went out.
    let emailSent = true;
    if (firstStep) {
      await sendApprovalRequest({ step: firstStep, doc }).catch((e) => { emailSent = false; console.error('approval email failed:', e.message); });
      if (!emailSent) {
        await query(
          `insert into audit_log (document_id, actor_id, actor_label, action, detail) values ($1,$2,$3,'email_failed',$4)`,
          [doc.id, req.profile.id, req.profile.full_name || req.profile.email, JSON.stringify({ to: firstStep.approver_email })]
        ).catch(() => {});
      }
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

    res.json({ data: { status: chain.finalized ? 'approved' : 'pending', firstApprover: firstStep?.approver_email || null, ccNotified: ccEmails.length, emailSent, finalized: chain.finalized } });
  })
);

export default router;
