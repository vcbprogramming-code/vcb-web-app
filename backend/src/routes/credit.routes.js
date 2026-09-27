import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { pool, query, queryOne } from '../config/db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { facilityView, authorizedUsedMap, dueBucket, overdueInterestInfo, ratePct, writeAudit, diff, AUTHORIZED_STATUSES, isOutstanding, isDueWithin7 } from '../services/credit.js';

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
  beneficiary: l.beneficiary, counterparty: l.counterparty, purpose: l.purpose,
  cost_category: l.cost_category, ref_doc_from: l.ref_doc_from, ref_doc_to: l.ref_doc_to, term_days: l.term_days,
  // วันที่บันทึกรายการ — คอลัมน์ "วันที่" ของตารางรายการสินเชื่อ คนละอย่างกับ
  // วันเริ่มของตราสาร (start_date) ซึ่งอาจเป็นวันในอนาคต
  created_at: l.created_at, updated_at: l.updated_at,
});
const requestOut = (r) => ({
  id: r.id, facility_id: r.facility_id, project_id: r.project_id, amount: Number(r.amount),
  start_date: r.start_date, due_date: r.due_date, ref: r.ref, note: r.note, status: r.status,
  decided_at: r.decided_at, decision_note: r.decision_note, ledger_id: r.ledger_id,
  beneficiary: r.beneficiary, purpose: r.purpose, cost_category: r.cost_category, term_days: r.term_days,
  ref_doc_no: r.ref_doc_no, ref_doc_from: r.ref_doc_from, ref_doc_to: r.ref_doc_to,
  attach_source: r.attach_source, attach_from: r.attach_from, attach_to: r.attach_to,
});
const cashPlanOut = (c) => ({
  id: c.id, project_id: c.project_id, month: c.month, period: c.period, income: Number(c.income),
  new_pn: Number(c.new_pn), deductions: Number(c.deductions), income_breakdown: c.income_breakdown,
  available: Number(c.available), note: c.note, kind: c.kind || 'plan', paid_ids: c.paid_ids || [],
});

/**
 * ตัวกรองประเภทวงเงินแบบ "กลุ่ม" — kinds=LG หรือ kinds=AVAL,LGM,DLC,PNPOST
 *
 * การ์ด BG กับ B/E บนหน้าภาพรวมเป็นก้อนเงินเดียวที่มาจากหลายประเภท กดการ์ดแล้ว
 * ต้องได้ทุกประเภทในก้อนนั้น ไม่ใช่ประเภทเดียว (jumpBG/jumpBE ของระบบจริง)
 * กรองที่ตระกูล (kind) ไม่ใช่ป้ายบนเอกสาร (doc_kind) เพราะ L/G วัสดุ กับ BG
 * ใช้ป้ายคนละตัวแต่ต้องอยู่คนละก้อน
 */
const kindList = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

// ── facilities ──────────────────────────────────────────────────────────
router.get('/facilities', asyncHandler(async (req, res) => {
  const { projectId, type, search, company, facilityNo, kinds } = req.query;
  const where = []; const params = [];
  const add = (c, v) => { params.push(v); where.push(c.replace('$$', `$${params.length}`)); };
  if (projectId) add('project_id = $$', projectId);
  if (type) add('type = $$', type);
  if (company) add('company = $$', company);
  if (facilityNo) add('facility_no = $$', Number(facilityNo));
  if (kindList(kinds).length) add('facility_no in (select no from facility_types where kind = any($$))', kindList(kinds));
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
  // อัตราดอกเบี้ยตามหนังสือธนาคาร เป็นประโยค ไม่ใช่ตัวเลข ("MLR ต่อปี")
  interestNote: z.string().max(200).optional().nullable(),
  approvedDate: z.string().optional().nullable(), dueDate: z.string().optional().nullable(), notes: z.string().optional().nullable(),
  // ปักยอดใช้ไปเอง — null คือกลับไปคำนวณจากรายการ (setUsedOverride ของระบบจริง)
  usedOverride: z.number().nonnegative().nullable().optional(),
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
    `insert into facilities (project_id, company, bank, facility_no, type, "limit", used_baseline, interest_rate, fee_rate, approved_date, due_date, notes, interest_note)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
    [d.projectId, d.company || null, d.bank || null, d.facilityNo, ft.doc_kind, d.limit, d.usedBaseline || 0,
     d.interestRate ?? null, d.feeRate ?? null, d.approvedDate || null, d.dueDate || null, d.notes || null,
     d.interestNote || null]
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
    interestRate: 'interest_rate', feeRate: 'fee_rate', approvedDate: 'approved_date', dueDate: 'due_date', notes: 'notes',
    interestNote: 'interest_note' };
  const sets = []; const vals = [];
  for (const [k, col] of Object.entries(map)) if (d[k] !== undefined) { vals.push(d[k] || null); sets.push(`${col} = $${vals.length}`); }
  // ศูนย์เป็นค่าที่ปักได้จริง (ธนาคารแจ้งว่าไม่มียอดใช้) จึงแยกออกจาก `|| null` ด้านบน
  if (d.usedOverride !== undefined) { vals.push(d.usedOverride); sets.push(`used_override = $${vals.length}`); }
  if (!sets.length) throw new ApiError(400, 'No fields to update');
  vals.push(req.params.id);
  const after = await queryOne(`update facilities set ${sets.join(', ')} where id = $${vals.length} returning *`, vals);
  const changes = diff(before, after, ['limit', 'interest_rate', 'interest_note', 'due_date', 'type', 'bank', 'facility_no', 'company', 'notes']);
  if (changes) await writeAudit({ actor: req.profile, action: 'update', target: 'facility', targetId: req.params.id, changes });
  if (d.usedOverride !== undefined && String(before.used_override ?? '') !== String(after.used_override ?? '')) {
    await writeAudit({ actor: req.profile, action: after.used_override == null ? 'usedclear' : 'usedoverride',
      target: 'facility', targetId: req.params.id,
      changes: { used_override: { before: before.used_override == null ? null : Number(before.used_override),
        after: after.used_override == null ? null : Number(after.used_override) } } });
  }
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
  const { facilityId, projectId, status, costCategory, company, due, kinds, search } = req.query;
  const where = []; const params = [];
  const add = (c, v) => { params.push(v); where.push(c.replace('$$', `$${params.length}`)); };
  if (facilityId) add('facility_id = $$', facilityId);
  if (projectId) add('project_id = $$', projectId);
  // สถานะรับได้หลายค่าคั่นด้วยจุลภาค — ตัวกรอง "รออนุมัติ (ใหม่/เสนอ)" ของระบบ
  // จริงส่งสองสถานะมาพร้อมกัน ("คำขอใหม่,อยู่ระหว่างเสนออนุมัติ")
  if (status) {
    const list = String(status).split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length > 1) add('status = any($$)', list);
    else add('status = $$', list[0] ?? status);
  }
  if (costCategory) add('cost_category = $$', costCategory);
  if (kindList(kinds).length) add('facility_id in (select id from facilities where facility_no in (select no from facility_types where kind = any($$)))', kindList(kinds));
  // ค้นหาเดียวกับช่องบนหน้าจอ: เลขที่เอกสาร · รายละเอียด · ผู้รับผลประโยชน์
  if (search) add(`(coalesce(ref,'') || ' ' || coalesce(counterparty,'') || ' ' || coalesce(beneficiary,'') || ' ' || coalesce(note,'')) ilike '%' || $$ || '%'`, String(search));
  // บริษัทอยู่ที่ตัววงเงิน ไม่ได้อยู่ที่รายการ — กรองผ่านวงเงินที่สังกัด
  if (company) add('facility_id in (select id from facilities where company = $$)', company);
  // "ครบใน 7 วัน" นับแยกอิสระจากกลุ่มเดือนนี้/เดือนหน้าตามข้อกำหนด §5
  // รายการหนึ่งจึงอยู่ได้ทั้งสองกลุ่มพร้อมกัน
  if (due === 'due7') where.push('due_date between current_date and current_date + 7');
  else if (due === 'overdue') where.push('due_date < current_date');
  else if (due === 'thisMonth') where.push("date_trunc('month', due_date) = date_trunc('month', current_date)");
  else if (due === 'nextMonth') where.push("date_trunc('month', due_date) = date_trunc('month', current_date + interval '1 month')");
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const { rows } = await query(`select * from credit_ledger ${whereSql} order by start_date desc nulls last, created_at desc`, params);
  res.json({ data: rows.map(ledgerOut) });
}));
/** วันครบกำหนดจากวันเริ่ม + จำนวนวัน — ฟอร์มของระบบจริงกรอกจำนวนวันแล้วได้วันที่ */
const dueFromTerm = (startDate, days) => {
  if (!startDate || !days) return null;
  const [Y, M, D] = String(startDate).slice(0, 10).split('-').map(Number);
  const d = new Date(Y, M - 1, D + Number(days));
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

// ยอดติดลบ = ปลด/คืนวงเงิน ตามที่ฟอร์มของระบบจริงเขียนกำกับไว้ — ตอนธนาคาร
// ปลดหนังสือค้ำประกัน ยอดใช้ไปต้องลดลง การห้ามค่าลบไปเลยทำให้ทำแบบนั้นไม่ได้
// สิ่งที่ต้องกันคือ "ปลดเกินกว่าที่เคยใช้" ซึ่งดูจากยอดรวมของวงเงินก้อนนั้น
const ledgerSchema = z.object({
  facilityId: z.string().uuid(),
  amount: z.number().refine((n) => n !== 0, 'จำนวนเงินต้องไม่เป็นศูนย์'),
  status: z.string().optional(),
  startDate: z.string().optional().nullable(), dueDate: z.string().optional().nullable(),
  ref: z.string().optional().nullable(), source: z.string().optional().nullable(),
  docFrom: z.string().optional().nullable(), docTo: z.string().optional().nullable(),
  interestRate: z.number().optional().nullable(), note: z.string().optional().nullable(),
  beneficiary: z.string().optional().nullable(), counterparty: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(), costCategory: z.string().optional().nullable(),
  refDocFrom: z.string().optional().nullable(), refDocTo: z.string().optional().nullable(),
  termDays: z.number().int().optional().nullable(),
});

/**
 * ปลดวงเงินได้ไม่เกินที่เคยใช้ไป — ไม่งั้นยอดคงเหลือจะโตเกินที่ธนาคารให้
 *
 * "ที่ใช้ไป" ต้องรวมยอดตั้งต้นของวงเงินด้วย วงเงินที่ย้ายมาจากระบบเดิมส่วนใหญ่
 * มียอดใช้อยู่แล้วโดยไม่มีรายการสักแถว ถ้านับแค่ผลรวมรายการ การปลดหนังสือ
 * ค้ำประกันใบแรกของวงเงินพวกนั้นจะถูกปฏิเสธทั้งที่ถูกต้อง
 *
 * ระบบจริงไม่ปฏิเสธ แต่ตัดยอดที่ศูนย์ — ซึ่งทำให้ยอดปลดส่วนเกินไปกลืนการเบิก
 * ครั้งถัดไปแบบมองไม่เห็น เราจึงยังปฏิเสธส่วนที่เกิน
 */
async function assertNotOverReleased(facilityId, delta, excludeId) {
  const cur = await queryOne(
    `select coalesce((select used_baseline from facilities where id = $1), 0)::float8
          + coalesce(sum(amount), 0)::float8 used
       from credit_ledger
      where facility_id = $1 and status = any($2) and ($3::uuid is null or id <> $3)`,
    [facilityId, AUTHORIZED_STATUSES, excludeId || null]);
  if (Number(cur.used) + delta < -0.005) {
    throw new ApiError(400, `ปลดวงเงินเกินกว่าที่ใช้ไปจริง (ตอนนี้ใช้อยู่ ${Number(cur.used).toLocaleString('th-TH')} บาท)`);
  }
}
router.post('/ledger', asyncHandler(async (req, res) => {
  const parsed = ledgerSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const d = parsed.data;
  const fac = await queryOne('select project_id from facilities where id = $1', [d.facilityId]);
  if (!fac) throw new ApiError(404, 'Facility not found');
  if (d.amount < 0) await assertNotOverReleased(d.facilityId, d.amount, null);
  const due = d.dueDate || dueFromTerm(d.startDate, d.termDays);
  const row = await queryOne(
    `insert into credit_ledger (facility_id, project_id, amount, status, start_date, due_date, ref, source, doc_from, doc_to, interest_rate, note, created_by,
                                beneficiary, counterparty, purpose, cost_category, ref_doc_from, ref_doc_to, term_days)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) returning *`,
    [d.facilityId, fac.project_id, d.amount, d.status || 'อนุมัติแล้ว', d.startDate || null, due,
     d.ref || null, d.source || null, d.docFrom || null, d.docTo || null, d.interestRate ?? null, d.note || null, req.profile.id,
     d.beneficiary || null, d.counterparty || null, d.purpose || null, d.costCategory || null,
     d.refDocFrom || null, d.refDocTo || null, d.termDays ?? null]
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
  // แก้ยอดเป็นค่าลบได้ (ปลดวงเงิน) แต่ต้องไม่ทำให้ยอดใช้ไปของวงเงินนั้นติดลบ
  if (d.amount !== undefined && d.amount < 0) {
    await assertNotOverReleased(before.facility_id, d.amount, before.id);
  }
  const map = { amount: 'amount', status: 'status', startDate: 'start_date', dueDate: 'due_date', ref: 'ref', note: 'note', interestRate: 'interest_rate',
    beneficiary: 'beneficiary', counterparty: 'counterparty', purpose: 'purpose', costCategory: 'cost_category',
    refDocFrom: 'ref_doc_from', refDocTo: 'ref_doc_to', termDays: 'term_days' };
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
    ref: z.string().optional().nullable(), note: z.string().optional().nullable(),
    beneficiary: z.string().optional().nullable(), purpose: z.string().optional().nullable(),
    costCategory: z.string().optional().nullable(), termDays: z.number().int().optional().nullable(),
    refDocNo: z.string().optional().nullable(),
    refDocFrom: z.string().optional().nullable(), refDocTo: z.string().optional().nullable(),
    attachSource: z.string().optional().nullable(),
    attachFrom: z.string().optional().nullable(), attachTo: z.string().optional().nullable(),
  }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const d = parsed.data;
  const fac = await queryOne('select project_id from facilities where id = $1', [d.facilityId]);
  if (!fac) throw new ApiError(404, 'Facility not found');
  const row = await queryOne(
    `insert into credit_requests (facility_id, project_id, amount, start_date, due_date, ref, note, created_by,
                                  beneficiary, purpose, cost_category, term_days, ref_doc_no, ref_doc_from, ref_doc_to,
                                  attach_source, attach_from, attach_to)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning *`,
    [d.facilityId, fac.project_id, d.amount, d.startDate || null,
     d.dueDate || dueFromTerm(d.startDate, d.termDays), d.ref || null, d.note || null, req.profile.id,
     d.beneficiary || null, d.purpose || null, d.costCategory || null, d.termDays ?? null,
     d.refDocNo || null, d.refDocFrom || null, d.refDocTo || null,
     d.attachSource || null, d.attachFrom || null, d.attachTo || null]
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
        `insert into credit_ledger (facility_id, project_id, amount, status, start_date, due_date, ref, note, request_id, created_by,
                                    beneficiary, purpose, cost_category, term_days)
         values ($1,$2,$3,'อนุมัติแล้ว',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
        [r.facility_id, r.project_id, r.amount, r.start_date, r.due_date, r.ref, r.note, r.id, req.profile.id,
         r.beneficiary, r.purpose, r.cost_category, r.term_days]
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
  // ระบบจริงมีรายการชุดเดียว (Transactions) ที่ถือทุกสถานะ ของเราแยกคำขอที่ยัง
  // รออนุมัติไว้ใน credit_requests — การ์ดที่นับ "ทุกรายการที่ยังค้าง" จึงต้อง
  // อ่านทั้งสองตาราง ไม่งั้นตั๋วที่รออนุมัติจะหายไปจากยอดครบกำหนด
  const [facilities, ledger, pendingReqs] = await Promise.all([
    query('select * from facilities where is_active = true'),
    query('select * from credit_ledger'),
    query(`select * from credit_requests where status = 'อยู่ระหว่างเสนออนุมัติ'`),
  ]);
  // อัตราต่อปีอ่านจากข้อความอิสระก่อน แล้วค่อยถอยไปคอลัมน์ตัวเลขเดิม
  const rateBy = Object.fromEntries(facilities.rows.map((f) => [f.id, ratePct(f.interest_note, f.interest_rate)]));
  const authorized = ledger.rows.filter((i) => AUTHORIZED_STATUSES.includes(i.status));
  const usedBy = new Map();
  for (const i of authorized) usedBy.set(i.facility_id, (usedBy.get(i.facility_id) || 0) + Number(i.amount));
  // จัดกลุ่มตามกล่องที่พับรวมแล้ว พร้อมเก็บรายละเอียดของแต่ละประเภทย่อยไว้ให้กาง
  // ดูได้ — ผู้ใช้ต้องเห็นว่ากล่อง BG ก้อนเดียวมาจากค้ำประกันสามใบอะไรบ้าง
  const types = Object.fromEntries((await query('select * from facility_types')).rows.map((t) => [t.no, t]));
  const byType = {};
  for (const f of facilities.rows) {
    const v = facilityView(f, usedBy.get(f.id) || 0);
    const boxNo = foldNo(f.facility_no);
    const box = types[boxNo];
    const key = box?.doc_kind || f.type || '(ไม่ระบุ)';
    const t = byType[key] || { type: key, no: boxNo, name: box?.name_th || key, limit: 0, used: 0, partsBy: new Map() };
    t.limit += v.limit; t.used += v.used;
    // รายละเอียดใต้การ์ดรวมตาม "เลขประเภทวงเงิน" ไม่ใช่ตามแถววงเงิน
    //
    // ธนาคารออกวงเงินแยกตามโครงการ กลุ่มนี้มีเจ็ดโครงการ ถ้าไล่ทีละแถว การ์ด BG
    // จะขึ้น "หนังสือค้ำประกันสัญญา 5%" ซ้ำสามบรรทัด (โครงการละหนึ่ง) โดยไม่มี
    // อะไรบอกว่าบรรทัดไหนของโครงการไหน — อ่านแล้วเข้าใจผิดว่าวงเงินซ้ำ และกระทบ
    // ยอดกับเอกสารธนาคารไม่ได้ ระบบจริงรวมที่ agg[facilityNo] ข้ามโครงการก่อน
    // แล้วจึงทำบรรทัดย่อยประเภทละบรรทัด (computeStats ใน Dashboard.jsx) — ทำตาม
    const no = Number(f.facility_no) || null;
    const p = t.partsBy.get(no) || { no, name: types[no]?.name_th || f.type, limit: 0, used: 0 };
    p.limit += v.limit; p.used += v.used;
    t.partsBy.set(no, p);
    byType[key] = t;
  }
  // การ์ดครบกำหนด: ทุกรายการที่ยังต้องจ่าย (ไม่ใช่เฉพาะที่อนุมัติแล้ว) ยอดบวกเท่านั้น
  const buckets = { overdue: { count: 0, amount: 0 }, thisMonth: { count: 0, amount: 0 }, nextMonth: { count: 0, amount: 0 },
    later: { count: 0, amount: 0 }, due7: { count: 0, amount: 0 } };
  for (const i of [...ledger.rows, ...pendingReqs.rows]) {
    if (!isOutstanding(i.status, i.amount) || !i.due_date) continue;
    const b = dueBucket(i.due_date); buckets[b].count++; buckets[b].amount += Number(i.amount);
    if (isDueWithin7(i.due_date)) { buckets.due7.count++; buckets.due7.amount += Number(i.amount); }
  }
  // ดอกเบี้ยเกินกำหนด: บอกด้วยว่ามีกี่รายการที่ระบุอัตราไม่ได้ (เช่นวงเงินที่
  // หนังสือธนาคารเขียนว่า MLR) ไม่งั้นยอดรวมจะอ่านเหมือนครบแล้วทั้งที่ยังขาด
  let overdueInt = 0; let rateUnknown = 0;
  for (const i of authorized) {
    const info = overdueInterestInfo(i, rateBy[i.facility_id]);
    overdueInt += info.amount;
    if (info.rateUnavailable) rateUnknown += 1;
  }
  // การ์ดสถานะนับรายการ (จำนวน + ยอดเงิน) ตามสถานะของรายการ เหมือนระบบจริง
  const tally = (rows) => ({ count: rows.length, amount: rows.reduce((a, r) => a + Number(r.amount || 0), 0) });
  const newItems = tally(ledger.rows.filter((i) => i.status === 'คำขอใหม่'));
  const pending = tally([...ledger.rows.filter((i) => i.status === 'อยู่ระหว่างเสนออนุมัติ'), ...pendingReqs.rows]);
  const approved = tally(authorized);
  res.json({ data: {
    byType: Object.values(byType).map(({ partsBy, ...t }) => ({ ...t, available: t.limit - t.used,
      pct: t.limit > 0 ? Math.min(100, Math.round((t.used / t.limit) * 100)) : (t.used > 0 ? 100 : 0),
      // ประเภทที่ไม่มีทั้งวงเงินและยอดใช้ ไม่ต้องขึ้นเป็นบรรทัดว่าง (เหมือน .filter ของเขา)
      parts: [...partsBy.values()].filter((p) => p.limit > 0 || p.used > 0)
        .sort((a, b) => (a.no || 0) - (b.no || 0)) })),
    buckets, overdueInterest: Math.round(overdueInt), overdueRateUnknown: rateUnknown,
    newCount: newItems.count, newAmount: newItems.amount,
    pendingCount: pending.count, pendingAmount: pending.amount,
    approvedCount: approved.count, approvedAmount: approved.amount,
  } });
}));
router.get('/overdue', asyncHandler(async (req, res) => {
  const facilities = (await query('select id, interest_rate, interest_note from facilities')).rows;
  const rateBy = Object.fromEntries(facilities.map((f) => [f.id, ratePct(f.interest_note, f.interest_rate)]));
  const { rows } = await query(`select * from credit_ledger where status='อนุมัติแล้ว' and due_date < current_date`);
  res.json({ data: rows.map((i) => {
    const info = overdueInterestInfo(i, rateBy[i.facility_id]);
    return { ...ledgerOut(i), bucket: dueBucket(i.due_date), overdue_interest: Math.round(info.amount),
      // ระบุอัตราไม่ได้ ≠ ดอกเบี้ยศูนย์ — หน้าจอต้องเขียนต่างกัน
      overdue_rate_unavailable: info.rateUnavailable, overdue_days: info.days };
  }) });
}));

// ── cash plan ───────────────────────────────────────────────────────────
router.get('/cash-plan', asyncHandler(async (req, res) => {
  const where = []; const params = [];
  const add = (c, v) => { params.push(v); where.push(c.replace('$$', `$${params.length}`)); };
  if (req.query.projectId) add('project_id = $$', req.query.projectId);
  if (req.query.month) add('month = $$', req.query.month);
  // ฉบับแผนกับฉบับจริงอยู่ตารางเดียวกัน ไม่ระบุมาก็ให้ฉบับแผนเป็นค่าเริ่มต้น
  add('kind = $$', req.query.kind === 'actual' ? 'actual' : 'plan');
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
  kind: z.enum(['plan', 'actual']).optional(),
});
router.post('/cash-plan', asyncHandler(async (req, res) => {
  const parsed = cashPlanSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const d = parsed.data;
  const row = await queryOne(
    `insert into cash_plans (project_id, month, period, income, new_pn, deductions, income_breakdown, available, note, created_by, kind)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     on conflict (project_id, month, period, kind) do update set
       income = excluded.income, new_pn = excluded.new_pn, deductions = excluded.deductions,
       income_breakdown = excluded.income_breakdown, available = excluded.available, note = excluded.note,
       updated_at = now()
     returning *`,
    [d.projectId, d.month, d.period || '1', d.income || 0, d.newPN || 0, d.deductions || 0,
     d.incomeBreakdown || null, d.available || 0, d.note || null, req.profile.id, d.kind || 'plan']
  );
  await writeAudit({ actor: req.profile, action: 'create', target: 'cashplan', targetId: row.id });
  res.status(201).json({ data: cashPlanOut({ ...row, paid_ids: [] }) });
}));
router.patch('/cash-plan/:id', asyncHandler(async (req, res) => {
  const parsed = cashPlanSchema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const d = parsed.data;
  const map = { month: 'month', period: 'period', income: 'income', newPN: 'new_pn', deductions: 'deductions', incomeBreakdown: 'income_breakdown', available: 'available', note: 'note', kind: 'kind' };
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

// ── หมวดค่าใช้จ่าย · งบประมาณ · สรุปค่าใช้จ่าย ──────────────────────────────
// ระบบจริงของลูกค้าตั้งงบเป็นคู่ (โครงการ × หมวดค่าใช้จ่าย) แล้วหน้าสรุปเทียบ
// ยอดที่เบิกไปจริงกับงบนั้น พร้อมเตือนว่าหมวดไหนเกินงบและหมวดไหนยังไม่ได้ตั้งงบ

router.get('/cost-categories', asyncHandler(async (req, res) => {
  const { rows } = await query(
    'select name, sort_order, is_active from credit_cost_categories where is_active order by sort_order, name');
  res.json({ data: rows.map((r) => r.name) });
}));

router.post('/cost-categories', requirePermission('credit', 'edit'), asyncHandler(async (req, res) => {
  const p = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ต้องระบุชื่อหมวดค่าใช้จ่าย');
  const next = await queryOne('select coalesce(max(sort_order), 0) + 1 n from credit_cost_categories');
  await query(
    `insert into credit_cost_categories (name, sort_order) values ($1, $2)
     on conflict (name) do update set is_active = true`, [p.data.name, next.n]);
  await writeAudit({ actor: req.profile, action: 'create', target: 'costCategory', targetId: p.data.name });
  res.status(201).json({ data: { name: p.data.name } });
}));

/**
 * PUT /api/credit/cost-categories — เขียนทะเบียนหมวดค่าใช้จ่ายทั้งชุด
 *
 * จอตั้งค่าของระบบจริงให้แก้ทั้งรายการทีเดียว (เพิ่ม · ย้ายลำดับ · ลบ) แล้วกด
 * บันทึกครั้งเดียว — setCostCategories ของเขาลบแถวเดิมทิ้งทั้งหมดแล้วเขียนใหม่
 *
 * ของเราลบทิ้งแบบนั้นไม่ได้: หมวดถูกอ้างด้วย "ชื่อ" จากรายการสินเชื่อ คำขอ และ
 * ตารางงบประมาณ — ลบชื่อออกจากทะเบียนแล้วเงินที่เบิกไปแล้วจะกลายเป็นหมวดที่
 * ไม่มีอยู่ หน้าสรุปค่าใช้จ่ายจะขึ้นงบที่ตั้งไม่ได้อีก ฉะนั้นหมวดที่ยังถูกใช้อยู่
 * จะถูก "ปิด" (is_active = false) ไม่ใช่ลบ — หายจากเมนู แต่ข้อมูลเก่ายังอ่านได้
 *
 * ลำดับที่ผู้ใช้จัด = ลำดับที่แสดงในเมนู จึงเขียน sort_order ตามตำแหน่งในอาเรย์
 */
router.put('/cost-categories', requirePermission('credit', 'edit'), asyncHandler(async (req, res) => {
  const p = z.object({ list: z.array(z.string().trim().min(1).max(80)).max(200) }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  // ตัดซ้ำแต่คงลำดับที่ผู้ใช้จัดไว้
  const seen = new Set(); const list = [];
  for (const raw of p.data.list) {
    const s = String(raw).trim();
    if (!s || seen.has(s)) continue;
    seen.add(s); list.push(s);
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    // ชุดที่จอนี้แทนที่ = หมวดที่ "เปิดใช้งานอยู่" เท่านั้น
    //
    // จอตั้งค่าโหลดมาแต่หมวดที่เปิดอยู่ (GET ส่งเฉพาะ is_active) หมวดที่เคยปิดไป
    // แล้วจึงไม่เคยปรากฏในรายการที่ผู้ใช้กดบันทึก — ถ้านับรวมเป็น "ของที่ถูกเอาออก"
    // การกดบันทึกโดยไม่แตะอะไรเลยจะลบประวัติหมวดเก่าทิ้งทั้งชุด (ข้อมูลที่นำเข้า
    // มาจากระบบเดิมของลูกค้ามีหมวดปิดอยู่จริงสองหมวด) หมวดที่ปิดแล้วจึงไม่ถูกแตะ
    const before = (await client.query('select name, sort_order, is_active from credit_cost_categories where is_active')).rows;
    // ชื่อที่ยังถูกอ้างถึงจากข้อมูลจริง — ห้ามลบ ปิดแทน
    const inUse = new Set((await client.query(
      `select distinct btrim(cost_category) name from (
         select cost_category from credit_ledger
         union all select cost_category from credit_requests
         union all select cost_category from credit_category_caps) x
        where nullif(btrim(cost_category), '') is not null`)).rows.map((r) => r.name));
    let i = 0; const kept = [];
    for (const name of list) {
      i += 1;
      await client.query(
        `insert into credit_cost_categories (name, sort_order, is_active) values ($1, $2, true)
         on conflict (name) do update set sort_order = excluded.sort_order, is_active = true`, [name, i]);
      kept.push(name);
    }
    const drop = before.map((r) => r.name).filter((n) => !seen.has(n));
    const closed = drop.filter((n) => inUse.has(n));
    const deleted = drop.filter((n) => !inUse.has(n));
    if (closed.length) await client.query('update credit_cost_categories set is_active = false where name = any($1)', [closed]);
    if (deleted.length) await client.query('delete from credit_cost_categories where name = any($1)', [deleted]);
    await client.query('commit');
    await writeAudit({ actor: req.profile, action: 'update', target: 'costCategory', targetId: '*',
      changes: { count: { before: before.length, after: kept.length } },
      note: closed.length ? `ปิดหมวดที่ยังถูกใช้อยู่ ${closed.length} หมวด` : null });
    res.json({ data: { list: kept, count: kept.length, deactivated: closed, removed: deleted } });
  } catch (err) {
    await client.query('rollback'); throw err;
  } finally {
    client.release();
  }
}));

router.get('/category-caps', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select c.project_id, p.code project_code, p.name project_name, c.cost_category,
            c.cap::float8 cap, c.note, c.updated_at
       from credit_category_caps c join projects p on p.id = c.project_id
      order by p.code, c.cost_category`);
  res.json({ data: rows });
}));

router.put('/category-caps', requirePermission('credit', 'edit'), asyncHandler(async (req, res) => {
  const p = z.object({
    projectId: z.string().uuid(), costCategory: z.string().trim().min(1),
    cap: z.number().nonnegative(), note: z.string().optional().nullable(),
  }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const d = p.data;
  // งบศูนย์ = ล้างงบ ลบแถวทิ้ง — ระบบจริงเก็บแถวงบว่างไว้ ทำให้หน้าสรุปขึ้นหมวด
  // "ไม่ได้ตั้ง" ยอด 0 ค้างอยู่และนับเป็นหมวดที่ยังไม่ตั้งงบเพิ่มทุกครั้งที่ล้าง
  if (d.cap === 0) {
    await query('delete from credit_category_caps where project_id = $1 and cost_category = $2', [d.projectId, d.costCategory]);
    await writeAudit({ actor: req.profile, action: 'delete', target: 'categoryCap', targetId: `${d.projectId}|${d.costCategory}` });
    return res.json({ data: { project_id: d.projectId, cost_category: d.costCategory, cap: null, cleared: true } });
  }
  const row = await queryOne(
    `insert into credit_category_caps (project_id, cost_category, cap, note, updated_by, updated_at)
     values ($1,$2,$3,$4,$5, now())
     on conflict (project_id, cost_category) do update
       set cap = excluded.cap, note = excluded.note, updated_by = excluded.updated_by, updated_at = now()
     returning *`,
    [d.projectId, d.costCategory, d.cap, d.note || null, req.profile.id]);
  await writeAudit({ actor: req.profile, action: 'update', target: 'categoryCap',
    targetId: `${d.projectId}|${d.costCategory}`, note: String(d.cap) });
  res.json({ data: { ...row, cap: Number(row.cap) } });
}));

/**
 * GET /api/credit/cost-summary — ใช้ไปเทียบงบ แยกตามโครงการและหมวดค่าใช้จ่าย
 *
 * นับตามระบบจริง (categorySummary): ทุกรายการยกเว้นที่ยกเลิก (void) — รายการที่
 * ชำระแล้วยังนับ เพราะถ้าไม่นับ จ่ายคืนแล้วก็ขอหมวดเดิมได้ไม่รู้จบ และคำขอที่
 * ยังรออนุมัติก็นับ รายการที่ไม่ระบุหมวดรวมเป็นกลุ่มของตัวเอง ไม่ซ่อน
 * งบที่ตั้งไว้แต่ยังไม่มีการใช้ขึ้นเป็นแถวว่าง ("งบ ฿X · ใช้ไป ฿0")
 */
router.get('/cost-summary', asyncHandler(async (req, res) => {
  const pid = req.query.projectId || null;
  const { rows } = await query(
    `select x.project_id, coalesce(nullif(btrim(x.cost_category), ''), '(ไม่ระบุหมวด)') cost_category,
            count(*)::int items, sum(x.amount)::float8 spent
       from (select project_id, cost_category, amount from credit_ledger
              where lower(status) <> 'void' and amount <> 0
             union all
             select project_id, cost_category, amount from credit_requests
              where status = 'อยู่ระหว่างเสนออนุมัติ' and amount <> 0) x
      where ($1::uuid is null or x.project_id = $1)
      group by 1, 2`, [pid]);
  const caps = (await query(
    'select project_id, cost_category, cap::float8 cap, note from credit_category_caps where ($1::uuid is null or project_id = $1)',
    [pid])).rows;
  const projects = new Map((await query('select id, code, name from projects')).rows.map((p) => [p.id, p]));

  const groups = new Map();
  for (const r of rows) groups.set(`${r.project_id}|${r.cost_category}`, { project_id: r.project_id, cost_category: r.cost_category, items: r.items, spent: r.spent, cap: null, note: null });
  for (const c of caps) {
    const k = `${c.project_id}|${c.cost_category}`;
    const g = groups.get(k) || { project_id: c.project_id, cost_category: c.cost_category, items: 0, spent: 0 };
    groups.set(k, { ...g, cap: c.cap, note: c.note || null });
  }
  const byProject = new Map();
  for (const g of [...groups.values()].sort((a, b) => (a.cost_category < b.cost_category ? -1 : 1))) {
    // มีงบ = ตั้งไว้มากกว่าศูนย์ ตั้งศูนย์ไว้ถือว่ายังไม่ได้ตั้ง เหมือนระบบจริง
    const budgeted = g.cap != null && g.cap > 0;
    const ratio = budgeted ? g.spent / g.cap : null;
    const line = {
      cost_category: g.cost_category, items: g.items, spent: g.spent, cap: budgeted ? g.cap : null, note: g.note,
      pct: budgeted ? Math.round(ratio * 1000) / 10 : null,
      remaining: budgeted ? g.cap - g.spent : null,
      over: budgeted && ratio >= 1,
      near: budgeted && ratio >= 0.8 && ratio < 1,
    };
    if (!byProject.has(g.project_id)) {
      const p = projects.get(g.project_id) || {};
      byProject.set(g.project_id, { project_id: g.project_id, project_code: p.code || '', project_name: p.name || '',
        lines: [], spent: 0, cap: 0, overCount: 0, nearCount: 0, noBudgetCount: 0, okCount: 0 });
    }
    const P = byProject.get(g.project_id);
    P.lines.push(line);
    // หัวโครงการรวมเฉพาะหมวดที่ตั้งงบไว้ — เงินในหมวดที่ไม่มีงบไม่มีอะไรให้เทียบ
    if (budgeted) { P.cap += g.cap; P.spent += g.spent; }
    if (line.over) P.overCount += 1;
    else if (line.near) P.nearCount += 1;
    else if (!budgeted) P.noBudgetCount += 1;
    else P.okCount += 1;
  }
  const out = [...byProject.values()]
    .sort((a, b) => (a.project_code < b.project_code ? -1 : 1))
    .map((g) => ({ ...g, pct: g.cap > 0 ? Math.min(150, Math.round((g.spent / g.cap) * 100)) : null }));
  res.json({ data: {
    projects: out,
    overCount: out.reduce((a, g) => a + g.overCount, 0),
    nearCount: out.reduce((a, g) => a + g.nearCount, 0),
    noBudgetCount: out.reduce((a, g) => a + g.noBudgetCount, 0),
  } });
}));

/**
 * GET /api/credit/cash-plan/variance — ผลต่างระหว่างฉบับแผนกับฉบับจริง
 *
 * ทั้งสองฉบับอยู่ในตารางเดียวกันแยกด้วยคอลัมน์ kind การเทียบจึงเป็นการจับคู่
 * ตาม (โครงการ · เดือน · ช่วง) แล้วลบกันทีละช่อง
 */
router.get('/cash-plan/variance', asyncHandler(async (req, res) => {
  const params = []; const where = [];
  if (req.query.projectId) { params.push(req.query.projectId); where.push(`project_id = $${params.length}`); }
  if (req.query.month) { params.push(req.query.month); where.push(`month = $${params.length}`); }
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const { rows } = await query(`select * from cash_plans ${whereSql} order by month, period`, params);
  const key = (r) => `${r.project_id}|${r.month}|${r.period}`;
  const plan = new Map(); const actual = new Map();
  for (const r of rows) (r.kind === 'actual' ? actual : plan).set(key(r), r);
  const keys = [...new Set([...plan.keys(), ...actual.keys()])].sort();
  const n = (v) => Number(v || 0);
  const data = keys.map((k) => {
    const [projectId, month, period] = k.split('|');
    const p = plan.get(k); const a = actual.get(k);
    const f = (col) => ({ plan: n(p?.[col]), actual: n(a?.[col]), diff: n(a?.[col]) - n(p?.[col]) });
    return { project_id: projectId, month, period,
      income: f('income'), new_pn: f('new_pn'), deductions: f('deductions'), available: f('available'),
      has_plan: Boolean(p), has_actual: Boolean(a) };
  });
  res.json({ data });
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
/**
 * GET /api/credit/export — ไฟล์ Excel ตามตัวกรองที่เห็นบนหน้าจอ
 *
 * ลำดับคอลัมน์เรียงตาม exportXlsx ของระบบจริง คนที่เปิดไฟล์นี้อยู่ทุกเดือนอ่าน
 * จากตำแหน่งคอลัมน์ ไม่ได้อ่านหัวตาราง — สลับที่แล้วสูตรใน sheet ปลายทางของเขา
 * เพี้ยนทั้งแฟ้ม คอลัมน์ที่ของเรามีเกิน (ธนาคาร · เลขที่วงเงิน · อัตราดอกเบี้ย)
 * ต่อท้ายไว้ ไม่แทรกกลาง
 *
 * ตัวกรองครบห้าตัวเหมือนบนหน้าจอ (โครงการ · ประเภท · สถานะ · ระยะเวลา · คำค้น)
 * — ไฟล์ที่ได้ต้องเป็นสิ่งเดียวกับที่คนกดส่งออกเห็นอยู่ ไม่ใช่ข้อมูลทั้งฐาน
 */
router.get('/export', asyncHandler(async (req, res) => {
  const where = []; const params = [];
  const add = (c, v) => { params.push(v); where.push(c.replace('$$', `$${params.length}`)); };
  if (req.query.projectId) add('f.project_id = $$', req.query.projectId);
  if (req.query.facilityNo) add('f.facility_no = $$', Number(req.query.facilityNo));
  if (kindList(req.query.kinds).length) {
    add('f.facility_no in (select no from facility_types where kind = any($$))', kindList(req.query.kinds));
  } else if (req.query.type) {
    // กรองด้วยกล่องที่พับรวมแล้ว: เลือก "B/E" ต้องได้ทั้งอาวัล L/G วัสดุ DLC และ PN Post
    const nos = (await query('select no from facility_types where doc_kind = $1', [req.query.type])).rows
      .map((r) => r.no)
      .flatMap((n) => (n === BE_FOLD_INTO ? [n, ...BE_FOLDED] : n === 1 ? BG_PARTS : [n]));
    if (nos.length) add('f.facility_no = any($$)', nos);
    else add('f.type = $$', req.query.type);
  }
  if (req.query.company) add('f.company = $$', req.query.company);
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const facilities = (await query(`select f.*, p.name as project_name, p.code as project_code from facilities f join projects p on p.id=f.project_id ${whereSql} order by p.code, f.facility_no, f.created_at`, params)).rows;
  const usedMap = await authorizedUsedMap(facilities.map((f) => f.id));
  const kinds = Object.fromEntries((await query('select no, doc_kind, name_th from facility_types')).rows.map((r) => [r.no, r]));

  const wb = new ExcelJS.Workbook();
  const fs = wb.addWorksheet('วงเงินสินเชื่อ');
  fs.addRow(['โครงการ', 'บริษัท', 'ประเภท', 'วงเงิน', 'ใช้ไป', 'คงเหลือ', '% ใช้ไป',
    'ธนาคาร', 'เลขที่วงเงิน', 'อัตราดอกเบี้ย', 'ครบกำหนด', 'หมายเหตุ']);
  for (const f of facilities) {
    const v = facilityView(f, usedMap.get(f.id) || 0);
    fs.addRow([f.project_name || f.project_code, f.company || '', kinds[f.facility_no]?.doc_kind || f.type,
      v.limit, v.used, v.available, `${v.pct}%`,
      f.bank || '', f.facility_no || '', f.interest_note || (f.interest_rate != null ? `${Number(f.interest_rate)} % ต่อปี` : ''),
      dateStr(f.due_date), f.notes || '']);
  }
  fs.getRow(1).font = { bold: true };

  const facIds = facilities.map((f) => f.id);
  const lw = ['l.facility_id = any($1)']; const lp = [facIds];
  const ladd = (c, v) => { lp.push(v); lw.push(c.replace('$$', `$${lp.length}`)); };
  if (req.query.status) {
    const list = String(req.query.status).split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length > 1) ladd('l.status = any($$)', list); else ladd('l.status = $$', list[0]);
  }
  const due = req.query.due;
  if (due === 'due7') lw.push('l.due_date between current_date and current_date + 7');
  else if (due === 'overdue') lw.push('l.due_date < current_date');
  else if (due === 'thisMonth') lw.push("date_trunc('month', l.due_date) = date_trunc('month', current_date)");
  else if (due === 'nextMonth') lw.push("date_trunc('month', l.due_date) = date_trunc('month', current_date + interval '1 month')");
  if (req.query.search) {
    ladd(`(coalesce(l.ref,'') || ' ' || coalesce(l.counterparty,'') || ' ' || coalesce(l.beneficiary,'') || ' ' || coalesce(l.note,'')) ilike '%' || $$ || '%'`, String(req.query.search));
  }
  const ledger = facIds.length ? (await query(
    `select l.*, p.name as project_name, p.code as project_code, f.company, f.facility_no, f.interest_rate, f.interest_note
       from credit_ledger l join projects p on p.id=l.project_id join facilities f on f.id=l.facility_id
      where ${lw.join(' and ')} order by l.start_date desc nulls last, l.created_at desc`, lp)).rows : [];

  const ts = wb.addWorksheet('รายการสินเชื่อ');
  ts.addRow(['วันที่', 'บริษัท', 'โครงการ', 'ประเภท', 'รายละเอียด', 'จำนวนเงิน', 'เริ่ม', 'ครบ',
    'ดอกเบี้ยเกินกำหนด', 'สถานะ', 'เอกสารแนบ', 'หมวดค่าใช้จ่าย', 'อ้างอิง', 'หมายเหตุ']);
  for (const l of ledger) {
    const info = overdueInterestInfo(l, ratePct(l.interest_note, l.interest_rate));
    const detail = [l.counterparty, l.beneficiary].filter(Boolean).join(' | ');
    ts.addRow([dateStr(l.start_date || l.created_at), l.company || '', l.project_name || l.project_code,
      kinds[l.facility_no]?.doc_kind || '', detail, Number(l.amount),
      dateStr(l.start_date), dateStr(l.due_date),
      info.rateUnavailable ? 'ระบุอัตราไม่ได้' : (info.amount ? Math.round(info.amount) : '—'),
      l.status, l.source || '—', l.cost_category || '', l.ref || '', l.note || '']);
  }
  ts.getRow(1).font = { bold: true };

  const p2 = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const stamp = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}_${p2(now.getHours())}${p2(now.getMinutes())}`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="CreditFacility_${stamp}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}));

export default router;
