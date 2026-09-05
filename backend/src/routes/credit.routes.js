import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { pool, query, queryOne } from '../config/db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { facilityView, authorizedUsedMap, dueBucket, overdueInterest, writeAudit, diff } from '../services/credit.js';

/**
 * การพับรวมวงเงินบนหน้าจอ — ธนาคารไม่ได้แยกวงเงินเหล่านี้ออกจากกัน
 *
 * เอกสารข้อกำหนดฟังก์ชัน §3.2: หนังสือค้ำประกันสามใบ (ค้ำสัญญา 5% · ค้ำ Advance
 * 15% · ค้ำประกันผลงาน) ใช้วงเงินก้อนเดียวกัน จึงรวมเป็นกล่อง BG กล่องเดียว
 * ส่วน L/G วัสดุ · DLC · P/N Post ใช้วงเงินร่วมกับ B/E (อาวัล) จึงพับเข้ากล่อง B/E
 *
 * ตัวเลขที่พับรวมคือสิ่งที่คนอ่านใช้ตัดสินใจ ถ้าแยกกล่องตามเลขประเภทจะได้กล่อง
 * ที่วงเงินคงเหลือดูมากกว่าความจริง เพราะเงินก้อนเดียวถูกนับเป็นหลายก้อน
 */
const BG_PARTS = [1, 2, 3];
const BE_FOLD_INTO = 6;
const BE_FOLDED = [5, 9, 10];
/** เลขประเภท → กล่องที่ควรไปรวมอยู่ */
const foldNo = (no) => {
  const n = Number(no);
  if (BG_PARTS.includes(n)) return 1;          // สามใบรวมเป็นกล่อง BG
  if (BE_FOLDED.includes(n)) return BE_FOLD_INTO;
  return n;
};

// Financial data — admin + executive only.
const router = Router();
// Gate on the configurable permission rather than on the role, so that granting
// a finance officer "วงเงินสินเชื่อ → ดูข้อมูล" in ตั้งค่า → ผู้ใช้ actually works.
// Role defaults still restrict this to admin/executive out of the box.
// Reading is view; anything that changes a figure is edit.
const canView = requirePermission('credit', 'view');
const canEdit = requirePermission('credit', 'edit');
router.use(requireAuth, (req, res, next) => (req.method === 'GET' ? canView : canEdit)(req, res, next));

const num = (v) => (v != null ? Number(v) : null);
// Format a pg `date` (parsed to LOCAL midnight) by its local calendar parts.
// toISOString() would shift the day on any +UTC server (e.g. Asia/Bangkok).
const dateStr = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
};
const ledgerOut = (l) => ({
  id: l.id, facility_id: l.facility_id, project_id: l.project_id, amount: Number(l.amount), status: l.status,
  start_date: l.start_date, due_date: l.due_date, settled_date: l.settled_date, ref: l.ref, source: l.source,
  doc_from: l.doc_from, doc_to: l.doc_to, interest_rate: num(l.interest_rate), note: l.note, request_id: l.request_id,
});
const requestOut = (r) => ({
  id: r.id, facility_id: r.facility_id, project_id: r.project_id, amount: Number(r.amount),
  start_date: r.start_date, due_date: r.due_date, ref: r.ref, note: r.note, status: r.status,
  decided_at: r.decided_at, decision_note: r.decision_note, ledger_id: r.ledger_id,
});
const cashPlanOut = (c) => ({
  id: c.id, project_id: c.project_id, month: c.month, period: c.period, income: Number(c.income),
  new_pn: Number(c.new_pn), deductions: Number(c.deductions), income_breakdown: c.income_breakdown,
  available: Number(c.available), note: c.note, paid_ids: c.paid_ids || [],
});

// ── facilities ──────────────────────────────────────────────────────────
router.get('/facilities', asyncHandler(async (req, res) => {
  const { projectId, type, search } = req.query;
  const where = []; const params = [];
  const add = (c, v) => { params.push(v); where.push(c.replace('$$', `$${params.length}`)); };
  if (projectId) add('project_id = $$', projectId);
  if (type) add('type = $$', type);
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const { rows } = await query(`select * from facilities ${whereSql} order by created_at`, params);
  const usedMap = await authorizedUsedMap(rows.map((r) => r.id));
  let views = rows.map((f) => facilityView(f, usedMap.get(f.id) || 0));
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    views = views.filter((v) => rx.test(v.facility_no || '') || rx.test(v.bank || '') || rx.test(v.company || ''));
  }
  res.json({ data: views });
}));

// Postgres raises on a malformed uuid, so a stray path segment must be turned
// away here rather than surfacing as a 500.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('id', (req, res, next, v) => (UUID.test(v) ? next() : next(new ApiError(404, 'Not found'))));

const facilitySchema = z.object({
  projectId: z.string().uuid(), company: z.string().optional().nullable(), bank: z.string().optional().nullable(),
  // ประเภทวงเงินอ้างทะเบียนจริง 10 ประเภท ไม่ใช่ข้อความอิสระอีกต่อไป
  facilityNo: z.number().int().min(1).max(10), limit: z.number().nonnegative(),
  usedBaseline: z.number().optional(), interestRate: z.number().optional().nullable(), feeRate: z.number().optional().nullable(),
  approvedDate: z.string().optional().nullable(), dueDate: z.string().optional().nullable(), notes: z.string().optional().nullable(),
});
router.post('/facilities', asyncHandler(async (req, res) => {
  const parsed = facilitySchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const d = parsed.data;
  if (!(await queryOne('select id from projects where id = $1', [d.projectId]))) throw new ApiError(404, 'Project not found');
  const ft = await queryOne('select * from facility_types where no = $1 and is_active', [d.facilityNo]);
  if (!ft) throw new ApiError(400, 'ไม่พบประเภทวงเงินนี้ในทะเบียน');
  // type เก็บป้ายสั้นไว้ให้รายงานเดิมอ่านได้ แต่ความจริงอยู่ที่ facility_no
  const row = await queryOne(
    `insert into facilities (project_id, company, bank, facility_no, type, "limit", used_baseline, interest_rate, fee_rate, approved_date, due_date, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
    [d.projectId, d.company || null, d.bank || null, d.facilityNo, ft.doc_kind, d.limit, d.usedBaseline || 0,
     d.interestRate ?? null, d.feeRate ?? null, d.approvedDate || null, d.dueDate || null, d.notes || null]
  );
  await writeAudit({ actor: req.profile, action: 'create', target: 'facility', targetId: row.id, note: ft.name_th });
  res.status(201).json({ data: facilityView(row, 0) });
}));
router.patch('/facilities/:id', asyncHandler(async (req, res) => {
  const parsed = facilitySchema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const before = await queryOne('select * from facilities where id = $1', [req.params.id]);
  if (!before) throw new ApiError(404, 'Facility not found');
  const d = parsed.data;
  const map = { company: 'company', bank: 'bank', facilityNo: 'facility_no', limit: '"limit"',
    interestRate: 'interest_rate', feeRate: 'fee_rate', approvedDate: 'approved_date', dueDate: 'due_date', notes: 'notes' };
  const sets = []; const vals = [];
  for (const [k, col] of Object.entries(map)) if (d[k] !== undefined) { vals.push(d[k] || null); sets.push(`${col} = $${vals.length}`); }
  if (!sets.length) throw new ApiError(400, 'No fields to update');
  vals.push(req.params.id);
  const after = await queryOne(`update facilities set ${sets.join(', ')} where id = $${vals.length} returning *`, vals);
  await writeAudit({ actor: req.profile, action: 'update', target: 'facility', targetId: req.params.id,
    changes: diff(before, after, ['limit', 'interest_rate', 'due_date', 'type', 'bank', 'facility_no', 'company', 'notes']) });
  const used = (await authorizedUsedMap([after.id])).get(after.id) || 0;
  res.json({ data: facilityView(after, used) });
}));
router.put('/facilities/:id/limit', asyncHandler(async (req, res) => {
  const parsed = z.object({ limit: z.number().nonnegative() }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const before = await queryOne('select * from facilities where id = $1', [req.params.id]);
  if (!before) throw new ApiError(404, 'Facility not found');
  const after = await queryOne('update facilities set "limit" = $1 where id = $2 returning *', [parsed.data.limit, req.params.id]);
  await writeAudit({ actor: req.profile, action: 'set-limit', target: 'limit', targetId: req.params.id,
    changes: { limit: { before: Number(before.limit), after: parsed.data.limit } } });
  const used = (await authorizedUsedMap([after.id])).get(after.id) || 0;
  res.json({ data: facilityView(after, used) });
}));

// ── ledger ────────────────────────────────────────────────────────────────
router.get('/ledger', asyncHandler(async (req, res) => {
  const { facilityId, projectId, status } = req.query;
  const where = []; const params = [];
  const add = (c, v) => { params.push(v); where.push(c.replace('$$', `$${params.length}`)); };
  if (facilityId) add('facility_id = $$', facilityId);
  if (projectId) add('project_id = $$', projectId);
  if (status) add('status = $$', status);
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const { rows } = await query(`select * from credit_ledger ${whereSql} order by start_date desc nulls last, created_at desc`, params);
  res.json({ data: rows.map(ledgerOut) });
}));
const ledgerSchema = z.object({
  facilityId: z.string().uuid(), amount: z.number().positive(), status: z.string().optional(),
  startDate: z.string().optional().nullable(), dueDate: z.string().optional().nullable(),
  ref: z.string().optional().nullable(), source: z.string().optional().nullable(),
  docFrom: z.string().optional().nullable(), docTo: z.string().optional().nullable(),
  interestRate: z.number().optional().nullable(), note: z.string().optional().nullable(),
});
router.post('/ledger', asyncHandler(async (req, res) => {
  const parsed = ledgerSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const d = parsed.data;
  const fac = await queryOne('select project_id from facilities where id = $1', [d.facilityId]);
  if (!fac) throw new ApiError(404, 'Facility not found');
  const row = await queryOne(
    `insert into credit_ledger (facility_id, project_id, amount, status, start_date, due_date, ref, source, doc_from, doc_to, interest_rate, note, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
    [d.facilityId, fac.project_id, d.amount, d.status || 'อนุมัติแล้ว', d.startDate || null, d.dueDate || null,
     d.ref || null, d.source || null, d.docFrom || null, d.docTo || null, d.interestRate ?? null, d.note || null, req.profile.id]
  );
  await writeAudit({ actor: req.profile, action: 'create', target: 'ledger', targetId: row.id, note: `${d.amount}` });
  res.status(201).json({ data: ledgerOut(row) });
}));
router.patch('/ledger/:id', asyncHandler(async (req, res) => {
  const parsed = ledgerSchema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const before = await queryOne('select * from credit_ledger where id = $1', [req.params.id]);
  if (!before) throw new ApiError(404, 'Ledger item not found');
  const d = parsed.data;
  const map = { amount: 'amount', status: 'status', startDate: 'start_date', dueDate: 'due_date', ref: 'ref', note: 'note', interestRate: 'interest_rate' };
  const sets = []; const vals = [];
  for (const [k, col] of Object.entries(map)) if (d[k] !== undefined) { vals.push(d[k] ?? null); sets.push(`${col} = $${vals.length}`); }
  if (!sets.length) throw new ApiError(400, 'No fields to update');
  vals.push(req.params.id);
  const after = await queryOne(`update credit_ledger set ${sets.join(', ')} where id = $${vals.length} returning *`, vals);
  await writeAudit({ actor: req.profile, action: 'update', target: 'ledger', targetId: req.params.id,
    changes: diff(before, after, ['amount', 'status', 'due_date', 'start_date', 'ref', 'note']) });
  res.json({ data: ledgerOut(after) });
}));
router.post('/ledger/:id/settle', asyncHandler(async (req, res) => {
  const before = await queryOne('select status from credit_ledger where id = $1', [req.params.id]);
  if (!before) throw new ApiError(404, 'Ledger item not found');
  if (before.status === 'ชำระแล้ว') throw new ApiError(409, 'รายการนี้บันทึกชำระแล้ว');
  const after = await queryOne(`update credit_ledger set status='ชำระแล้ว', settled_date=current_date where id=$1 returning *`, [req.params.id]);
  await writeAudit({ actor: req.profile, action: 'settle', target: 'ledger', targetId: req.params.id, changes: { status: { before: before.status, after: 'ชำระแล้ว' } } });
  res.json({ data: ledgerOut(after) });
}));
router.delete('/ledger/:id', asyncHandler(async (req, res) => {
  const before = await queryOne('select amount from credit_ledger where id = $1', [req.params.id]);
  if (!before) throw new ApiError(404, 'Ledger item not found');
  await query('delete from credit_ledger where id = $1', [req.params.id]);
  await writeAudit({ actor: req.profile, action: 'delete', target: 'ledger', targetId: req.params.id, note: `${before.amount}` });
  res.json({ data: { deleted: true } });
}));

// ── requests + approval ─────────────────────────────────────────────────
router.get('/requests', asyncHandler(async (req, res) => {
  const { rows } = req.query.status
    ? await query('select * from credit_requests where status = $1 order by created_at desc', [req.query.status])
    : await query('select * from credit_requests order by created_at desc');
  res.json({ data: rows.map(requestOut) });
}));
router.post('/requests', asyncHandler(async (req, res) => {
  const parsed = z.object({ facilityId: z.string().uuid(), amount: z.number().positive(),
    startDate: z.string().optional().nullable(), dueDate: z.string().optional().nullable(),
    ref: z.string().optional().nullable(), note: z.string().optional().nullable() }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const d = parsed.data;
  const fac = await queryOne('select project_id from facilities where id = $1', [d.facilityId]);
  if (!fac) throw new ApiError(404, 'Facility not found');
  const row = await queryOne(
    `insert into credit_requests (facility_id, project_id, amount, start_date, due_date, ref, note, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [d.facilityId, fac.project_id, d.amount, d.startDate || null, d.dueDate || null, d.ref || null, d.note || null, req.profile.id]
  );
  await writeAudit({ actor: req.profile, action: 'create', target: 'request', targetId: row.id, note: `${d.amount}` });
  res.status(201).json({ data: requestOut(row) });
}));
router.post('/requests/:id/decide', asyncHandler(async (req, res) => {
  const parsed = z.object({ decision: z.enum(['อนุมัติ', 'ไม่อนุมัติ']), note: z.string().optional().nullable() }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const client = await pool.connect();
  try {
    await client.query('begin');
    const r = (await client.query('select * from credit_requests where id = $1 for update', [req.params.id])).rows[0];
    if (!r) throw new ApiError(404, 'Request not found');
    if (r.status !== 'อยู่ระหว่างเสนออนุมัติ') throw new ApiError(409, 'คำขอนี้ถูกตัดสินไปแล้ว');
    let ledger = null;
    if (parsed.data.decision === 'อนุมัติ') {
      ledger = (await client.query(
        `insert into credit_ledger (facility_id, project_id, amount, status, start_date, due_date, ref, note, request_id, created_by)
         values ($1,$2,$3,'อนุมัติแล้ว',$4,$5,$6,$7,$8,$9) returning *`,
        [r.facility_id, r.project_id, r.amount, r.start_date, r.due_date, r.ref, r.note, r.id, req.profile.id]
      )).rows[0];
    }
    const updated = (await client.query(
      `update credit_requests set status=$1, decided_by=$2, decided_at=now(), decision_note=$3, ledger_id=$4 where id=$5 returning *`,
      [parsed.data.decision, req.profile.id, parsed.data.note || null, ledger?.id || null, r.id]
    )).rows[0];
    await client.query('commit');
    await writeAudit({ actor: req.profile, action: parsed.data.decision === 'อนุมัติ' ? 'approve' : 'reject',
      target: 'request', targetId: r.id, changes: { status: { before: 'อยู่ระหว่างเสนออนุมัติ', after: parsed.data.decision } }, note: parsed.data.note || null });
    res.json({ data: { request: requestOut(updated), ledger: ledger ? ledgerOut(ledger) : null } });
  } catch (err) {
    await client.query('rollback'); throw err;
  } finally {
    client.release();
  }
}));

// ── overview / overdue ──────────────────────────────────────────────────
/** GET /api/credit/facility-types — ทะเบียนประเภทวงเงิน สำหรับช่องเลือกและป้ายกำกับ */
router.get('/facility-types', asyncHandler(async (req, res) => {
  const { rows } = await query(
    'select no, code, name_th, name_en, kind, doc_kind from facility_types where is_active order by sort_order, no');
  // บอกด้วยว่าแต่ละประเภทไปรวมอยู่กล่องไหน หน้าจอจะได้ไม่ต้องรู้กฎการพับเอง
  res.json({ data: rows.map((r) => ({ ...r, foldsInto: foldNo(r.no) })) });
}));

router.get('/overview', asyncHandler(async (req, res) => {
  const [facilities, authorized, pending, approved] = await Promise.all([
    query('select * from facilities where is_active = true'),
    query(`select * from credit_ledger where status = 'อนุมัติแล้ว'`),
    query(`select amount from credit_requests where status = 'อยู่ระหว่างเสนออนุมัติ'`),
    queryOne(`select count(*)::int n from credit_requests where status = 'อนุมัติ'`),
  ]);
  const rateBy = Object.fromEntries(facilities.rows.map((f) => [f.id, f.interest_rate]));
  const usedBy = new Map();
  for (const i of authorized.rows) usedBy.set(i.facility_id, (usedBy.get(i.facility_id) || 0) + Number(i.amount));
  // จัดกลุ่มตามกล่องที่พับรวมแล้ว พร้อมเก็บรายละเอียดของแต่ละประเภทย่อยไว้ให้กาง
  // ดูได้ — ผู้ใช้ต้องเห็นว่ากล่อง BG ก้อนเดียวมาจากค้ำประกันสามใบอะไรบ้าง
  const types = Object.fromEntries((await query('select * from facility_types')).rows.map((t) => [t.no, t]));
  const byType = {};
  for (const f of facilities.rows) {
    const v = facilityView(f, usedBy.get(f.id) || 0);
    const boxNo = foldNo(f.facility_no);
    const box = types[boxNo];
    const key = box?.doc_kind || f.type || '(ไม่ระบุ)';
    const t = byType[key] || { type: key, no: boxNo, name: box?.name_th || key, limit: 0, used: 0, parts: [] };
    t.limit += v.limit; t.used += v.used;
    if (v.limit > 0 || v.used > 0) {
      const part = types[Number(f.facility_no)];
      t.parts.push({ no: Number(f.facility_no) || null, name: part?.name_th || f.type, limit: v.limit, used: v.used });
    }
    byType[key] = t;
  }
  const buckets = { overdue: { count: 0, amount: 0 }, thisMonth: { count: 0, amount: 0 }, nextMonth: { count: 0, amount: 0 }, later: { count: 0, amount: 0 } };
  let overdueInt = 0;
  for (const i of authorized.rows) {
    const b = dueBucket(i.due_date); buckets[b].count++; buckets[b].amount += Number(i.amount || 0);
    overdueInt += overdueInterest(i, rateBy[i.facility_id]);
  }
  res.json({ data: {
    byType: Object.values(byType).map((t) => ({ ...t, available: t.limit - t.used, pct: t.limit ? Math.round((t.used / t.limit) * 100) : 0 })),
    buckets, overdueInterest: Math.round(overdueInt),
    pendingCount: pending.rows.length, pendingAmount: pending.rows.reduce((s, r) => s + Number(r.amount || 0), 0), approvedCount: approved.n,
  } });
}));
router.get('/overdue', asyncHandler(async (req, res) => {
  const facilities = (await query('select id, interest_rate from facilities')).rows;
  const rateBy = Object.fromEntries(facilities.map((f) => [f.id, f.interest_rate]));
  const { rows } = await query(`select * from credit_ledger where status='อนุมัติแล้ว' and due_date < current_date`);
  res.json({ data: rows.map((i) => ({ ...ledgerOut(i), bucket: dueBucket(i.due_date), overdue_interest: Math.round(overdueInterest(i, rateBy[i.facility_id])) })) });
}));

// ── cash plan ───────────────────────────────────────────────────────────
router.get('/cash-plan', asyncHandler(async (req, res) => {
  const where = []; const params = [];
  const add = (c, v) => { params.push(v); where.push(c.replace('$$', `$${params.length}`)); };
  if (req.query.projectId) add('project_id = $$', req.query.projectId);
  if (req.query.month) add('month = $$', req.query.month);
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const { rows } = await query(`select * from cash_plans ${whereSql} order by month, period`, params);
  // attach paid_ids
  for (const r of rows) {
    const p = await query('select ledger_id from cash_plan_paid where cash_plan_id = $1', [r.id]);
    r.paid_ids = p.rows.map((x) => x.ledger_id);
  }
  res.json({ data: rows.map(cashPlanOut) });
}));
const cashPlanSchema = z.object({
  projectId: z.string().uuid(), month: z.string().regex(/^\d{4}-\d{2}$/), period: z.string().optional(),
  income: z.number().nonnegative().optional(), newPN: z.number().nonnegative().optional(),
  deductions: z.number().nonnegative().optional(),
  incomeBreakdown: z.string().optional().nullable(), available: z.number().optional(), note: z.string().optional().nullable(),
});
router.post('/cash-plan', asyncHandler(async (req, res) => {
  const parsed = cashPlanSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const d = parsed.data;
  const row = await queryOne(
    `insert into cash_plans (project_id, month, period, income, new_pn, deductions, income_breakdown, available, note, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [d.projectId, d.month, d.period || '1', d.income || 0, d.newPN || 0, d.deductions || 0, d.incomeBreakdown || null, d.available || 0, d.note || null, req.profile.id]
  );
  await writeAudit({ actor: req.profile, action: 'create', target: 'cashplan', targetId: row.id });
  res.status(201).json({ data: cashPlanOut({ ...row, paid_ids: [] }) });
}));
router.patch('/cash-plan/:id', asyncHandler(async (req, res) => {
  const parsed = cashPlanSchema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const d = parsed.data;
  const map = { month: 'month', period: 'period', income: 'income', newPN: 'new_pn', deductions: 'deductions', incomeBreakdown: 'income_breakdown', available: 'available', note: 'note' };
  const sets = []; const vals = [];
  for (const [k, col] of Object.entries(map)) if (d[k] !== undefined) { vals.push(d[k] ?? null); sets.push(`${col} = $${vals.length}`); }
  if (!sets.length) throw new ApiError(400, 'No fields to update');
  vals.push(req.params.id);
  const row = await queryOne(`update cash_plans set ${sets.join(', ')} where id = $${vals.length} returning *`, vals);
  if (!row) throw new ApiError(404, 'Cash plan row not found');
  await writeAudit({ actor: req.profile, action: 'update', target: 'cashplan', targetId: req.params.id });
  res.json({ data: cashPlanOut({ ...row, paid_ids: [] }) });
}));
router.delete('/cash-plan/:id', asyncHandler(async (req, res) => {
  await query('delete from cash_plans where id = $1', [req.params.id]);
  await writeAudit({ actor: req.profile, action: 'delete', target: 'cashplan', targetId: req.params.id });
  res.json({ data: { deleted: true } });
}));

// ── audit + export ──────────────────────────────────────────────────────
router.get('/audit', asyncHandler(async (req, res) => {
  const where = []; const params = [];
  const add = (c, v) => { params.push(v); where.push(c.replace('$$', `$${params.length}`)); };
  if (req.query.target) add('target = $$', req.query.target);
  if (req.query.targetId) add('target_id = $$', String(req.query.targetId));
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const { rows } = await query(`select * from credit_audit ${whereSql} order by created_at desc limit 200`, params);
  res.json({ data: rows.map((a) => ({ id: a.id, actor_label: a.actor_label, action: a.action, target: a.target, target_id: a.target_id, changes: a.changes, note: a.note, created_at: a.created_at })) });
}));
router.get('/export', asyncHandler(async (req, res) => {
  const where = []; const params = [];
  const add = (c, v) => { params.push(v); where.push(c.replace('$$', `$${params.length}`)); };
  if (req.query.projectId) add('f.project_id = $$', req.query.projectId);
  // กรองด้วยกล่องที่พับรวมแล้ว: เลือก "B/E" ต้องได้ทั้งอาวัล L/G วัสดุ DLC และ PN Post
  if (req.query.type) {
    const nos = (await query('select no from facility_types where doc_kind = $1', [req.query.type])).rows
      .map((r) => r.no)
      .flatMap((n) => (n === BE_FOLD_INTO ? [n, ...BE_FOLDED] : n === 1 ? BG_PARTS : [n]));
    if (nos.length) add('f.facility_no = any($$)', nos);
    else add('f.type = $$', req.query.type);
  }
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const facilities = (await query(`select f.*, p.name as project_name, p.code as project_code from facilities f join projects p on p.id=f.project_id ${whereSql} order by f.created_at`, params)).rows;
  const usedMap = await authorizedUsedMap(facilities.map((f) => f.id));

  const wb = new ExcelJS.Workbook();
  const fs = wb.addWorksheet('วงเงินสินเชื่อ');
  fs.addRow(['โครงการ', 'บริษัท', 'ธนาคาร', 'เลขที่วงเงิน', 'ประเภท', 'วงเงิน', 'ใช้ไป', 'คงเหลือ', 'ดอกเบี้ย%', 'ครบกำหนด']);
  for (const f of facilities) {
    const v = facilityView(f, usedMap.get(f.id) || 0);
    fs.addRow([f.project_name || f.project_code, f.company || '', f.bank || '', f.facility_no || '', f.type, v.limit, v.used, v.available, f.interest_rate ?? '', dateStr(f.due_date)]);
  }
  fs.getRow(1).font = { bold: true };
  const facIds = facilities.map((f) => f.id);
  const ledger = facIds.length ? (await query('select l.*, p.name as project_name from credit_ledger l join projects p on p.id=l.project_id where l.facility_id = any($1) order by l.start_date desc nulls last', [facIds])).rows : [];
  const ts = wb.addWorksheet('รายการสินเชื่อ');
  ts.addRow(['โครงการ', 'จำนวนเงิน', 'สถานะ', 'วันเริ่ม', 'ครบกำหนด', 'อ้างอิง', 'หมายเหตุ']);
  for (const l of ledger) ts.addRow([l.project_name, Number(l.amount), l.status, dateStr(l.start_date), dateStr(l.due_date), l.ref || '', l.note || '']);
  ts.getRow(1).font = { bold: true };
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="credit-facilities.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}));

export default router;
