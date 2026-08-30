import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { query, queryOne } from '../config/db.js';
import { requireAuth, requireRole, requirePermission } from '../middleware/auth.js';
import { hasPermission } from '../config/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import multer from 'multer';
import { buildLeaveSlip } from '../services/leaveSlip.js';
import { buildMandayReportPdf } from '../services/mandayReportPdf.js';
import { putObject, deleteObject, openDownloadStream } from '../config/storage.js';
import { env } from '../config/env.js';

// =============================================================================
// Module 2 — daily work-ACTIVITY log (hr-worklog). API mirrors the reference
// app's server contract: bootstrap / site-month / admin-summary / cell save,
// plus activity + cost-category catalogs. A cell is team (operation composite
// "A-1 / 5") | detail (support free text) | pm (optional 2nd task). No OT.
// =============================================================================

const router = Router();
router.use(requireAuth);

// อัปโหลดไฟล์ในโมดูลนี้ใช้ตัวเดียวกันทั้งหมด
const fileUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxUploadBytes } });


// ── helpers ──────────────────────────────────────────────────────────────
/** Units this user may see. admin/executive = null (all); hr = their unit ids. */
function scopedUnitIds(profile) {
  if (profile.role === 'admin' || profile.role === 'executive') return null;
  const ids = new Set();
  if (profile.unit_id) ids.add(profile.unit_id);
  for (const u of profile.unit_ids || []) ids.add(u);
  return [...ids];
}
function assertUnitInScope(scoped, unitId) {
  if (scoped && !scoped.includes(unitId)) throw new ApiError(403, 'ไม่มีสิทธิ์เข้าถึงหน่วยงานนี้');
}
const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const daysInMonthN = (y, m) => new Date(y, m, 0).getDate();
/** Format a pg `date` (parsed to LOCAL midnight) by its local calendar parts. */
// ประเภทการลา — declared up here because the roster loader labels a day off with
// it, and the leave endpoints further down share the same list.
const LEAVE_TYPES_TH = {
  sick: 'ลาป่วย', personal: 'ลากิจ', vacation: 'ลาพักผ่อน',
  maternity: 'ลาคลอด', ordination: 'ลาบวช', other: 'อื่น ๆ',
};
const LEAVE_TH = LEAVE_TYPES_TH;

const dateStr = (v) => {
  const d = v instanceof Date ? v : new Date(v);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const todayStr = () => { const t = new Date(); return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
const addDaysStr = (s, n) => { const [Y, M, D] = s.split('-').map(Number); const d = new Date(Y, M - 1, D + n); return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
// reference: weekend = Sunday only (dow === 0)
const isWeekend = (Y, M, d) => new Date(Y, M - 1, d).getDay() === 0;
/** editable window = [today − lockDays, today + 1]; locked outside it. */
function isLocked(ds, lockDays) {
  const today = todayStr();
  if (ds > addDaysStr(today, 1)) return true; // no logging beyond tomorrow (upper bound)
  if (!lockDays || lockDays <= 0) return false;
  return ds < addDaysStr(today, -lockDays);
}

/**
 * §4 wants three states on screen, not two: a day that is still open, a day
 * about to close, and a day that has closed. "About to close" is what actually
 * changes behaviour — it is the last chance to fix something.
 */
const DUE_SOON_DAYS = 1;
function lockState(ds, lockDays, closedMonths = new Set()) {
  if (closedMonths.has(ds.slice(0, 7))) return 'closed';
  if (isLocked(ds, lockDays)) return 'locked';
  if (lockDays > 0 && ds <= addDaysStr(todayStr(), -(lockDays - DUE_SOON_DAYS))) return 'due-soon';
  return 'editable';
}

/** Months already closed for a unit — a close outranks the rolling window. */
async function closedMonthsFor(unitId) {
  const { rows } = await query('select ym from period_closes where unit_id = $1', [unitId]);
  return new Set(rows.map((r) => r.ym));
}

/**
 * §9. The module kept no history of its own — E-Memo's audit_log covers
 * documents only — so a figure could change with nothing to show who changed it
 * or why. Every write goes through here.
 */
async function logWork({ actor, workLogId, employeeId, unitId, ymd: day, action, before, after, reason }) {
  await query(
    `insert into work_log_audit (work_log_id, employee_id, unit_id, ymd, action, before_val, after_val, reason, actor_id, actor_label)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [workLogId || null, employeeId || null, unitId || null, day || null, action,
     before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null,
     reason || null, actor?.id || null, actor?.full_name || actor?.email || null]
  ).catch(() => {});
}

/** The fields §3 asks to be recorded, as they are stored. */
const workFields = (r) => ({
  team: r?.team ?? null, detail: r?.detail ?? null, pm: r?.pm ?? null,
  manDay: r?.man_day == null ? null : Number(r.man_day),
  hours: r?.hours == null ? null : Number(r.hours),
  workStatus: r?.work_status ?? null,
});
const cellFilled = (c) => Boolean(c && ((c.team && c.team.trim()) || (c.detail && c.detail.trim()) || (c.pm && c.pm.trim())));

const siteOut = (u) => ({ key: u.code, name: u.name, company: u.company, color: u.color, lockDays: u.lock_days ?? 3 });
const activityOut = (a) => ({ code: a.code, name: a.name, desc: a.description || '', category: a.category, mapping: a.mapping || 'one-to-many', fixed_cost: a.fixed_cost || undefined, sites: '' });
const categoryOut = (c) => ({ code: c.code, name: c.name, name_en: c.name_en || '' });

async function loadUnitByKey(key) {
  return queryOne('select * from units where code = $1', [key]);
}
async function loadActivities() {
  // hr-worklog activities MUST have a code (used in the "A-1 / 5" composite); skip
  // legacy code-less work_types left over from the old OT module.
  return (await query("select id, code, name, description, category, mapping, fixed_cost, sort_order from work_types where is_active = true and code is not null order by sort_order, code, name")).rows;
}
async function loadCategories() {
  return (await query('select code, name, name_en, sort_order from cost_categories where is_active = true order by sort_order, code')).rows;
}

// canEntry = may record work (admin/hr, or explicit performance.edit); executives view only.
function canEntry(profile) {
  return profile.role === 'admin' || profile.role === 'hr';
}

// ── bootstrap ──────────────────────────────────────────────────────────────
router.get('/bootstrap', asyncHandler(async (req, res) => {
  const scoped = scopedUnitIds(req.profile);
  const units = (scoped
    ? await query('select code, name, company, color, lock_days from units where id = any($1) and code is not null order by name', [scoped])
    : await query('select code, name, company, color, lock_days from units where code is not null order by name')).rows;
  res.json({
    ok: true,
    email: req.profile.email,
    role: req.profile.role,
    isAdmin: req.profile.role === 'admin',
    canEntry: canEntry(req.profile),
    sites: units.map((u) => ({ key: u.code, name: u.name, company: u.company, lockDays: u.lock_days ?? 3 })),
  });
}));

// ── catalogs (Work Index) ───────────────────────────────────────────────────
router.get('/activities', asyncHandler(async (req, res) => {
  res.json({ data: (await loadActivities()).map(activityOut) });
}));
router.get('/cost-categories', asyncHandler(async (req, res) => {
  res.json({ data: (await loadCategories()).map(categoryOut) });
}));

const activitySchema = z.object({
  code: z.string().min(1), name: z.string().min(1), description: z.string().optional().nullable(),
  category: z.string().min(1), mapping: z.enum(['one-to-one', 'one-to-many']).optional(),
  fixedCost: z.string().optional().nullable(), sortOrder: z.number().int().optional(),
});
router.post('/activities', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = activitySchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const d = p.data;
  const row = await queryOne(
    `insert into work_types (code, name, description, category, mapping, fixed_cost, sort_order)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [d.code, d.name, d.description || null, d.category, d.mapping || 'one-to-many', d.fixedCost || null, d.sortOrder ?? 0]
  ).catch((e) => { if (e.code === '23505') throw new ApiError(409, 'รหัสกิจกรรมนี้มีอยู่แล้ว'); throw e; });
  res.status(201).json({ data: activityOut(row) });
}));
router.patch('/activities/:code', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = activitySchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const map = { name: 'name', description: 'description', category: 'category', mapping: 'mapping', fixedCost: 'fixed_cost', sortOrder: 'sort_order', isActive: 'is_active' };
  const sets = []; const vals = [];
  for (const [k, col] of Object.entries(map)) if (p.data[k] !== undefined) { vals.push(p.data[k]); sets.push(`${col} = $${vals.length}`); }
  if (!sets.length) throw new ApiError(400, 'No fields to update');
  vals.push(req.params.code);
  const row = await queryOne(`update work_types set ${sets.join(', ')} where code = $${vals.length} returning *`, vals);
  if (!row) throw new ApiError(404, 'ไม่พบกิจกรรม');
  res.json({ data: activityOut(row) });
}));

const categorySchema = z.object({ code: z.string().min(1), name: z.string().min(1), nameEn: z.string().optional().nullable(), sortOrder: z.number().int().optional() });
router.post('/cost-categories', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = categorySchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const d = p.data;
  const row = await queryOne(
    `insert into cost_categories (code, name, name_en, sort_order) values ($1,$2,$3,$4) returning *`,
    [d.code, d.name, d.nameEn || null, d.sortOrder ?? 0]
  ).catch((e) => { if (e.code === '23505') throw new ApiError(409, 'รหัสหมวดต้นทุนนี้มีอยู่แล้ว'); throw e; });
  res.status(201).json({ data: categoryOut(row) });
}));
router.patch('/cost-categories/:code', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = categorySchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const map = { name: 'name', nameEn: 'name_en', sortOrder: 'sort_order', isActive: 'is_active' };
  const sets = []; const vals = [];
  for (const [k, col] of Object.entries(map)) if (p.data[k] !== undefined) { vals.push(p.data[k]); sets.push(`${col} = $${vals.length}`); }
  if (!sets.length) throw new ApiError(400, 'No fields to update');
  vals.push(req.params.code);
  const row = await queryOne(`update cost_categories set ${sets.join(', ')} where code = $${vals.length} returning *`, vals);
  if (!row) throw new ApiError(404, 'ไม่พบหมวดต้นทุน');
  res.json({ data: categoryOut(row) });
}));

// set a site's back-date lock window (admin, Settings screen)
router.patch('/sites/:code', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = z.object({ lockDays: z.number().int().min(0).max(60) }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const unit = await loadUnitByKey(req.params.code);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  const row = await queryOne('update units set lock_days = $1 where id = $2 returning code, name, company, color, lock_days', [p.data.lockDays, unit.id]);
  res.json({ data: siteOut(row) });
}));

// ── employees ────────────────────────────────────────────────────────────
async function employeesForUnit(unitId, month) {
  const emps = (await query(
    `select e.*, d.name as department_name, p.name as position_name
       from employees e
       left join departments d on d.id = e.department_id
       left join positions p on p.id = e.position_id
      where e.unit_id = $1 and e.is_active = true
      order by e.kind, e.full_name`, [unitId]
  )).rows;
  const ids = emps.map((e) => e.id);
  let awayBy = {};
  const leaveBy = {};
  if (ids.length) {
    // real month bounds — a literal `${month}-31` is an invalid date for 30/28-day
    // months and makes the whole query 500.
    const [mY, mM] = month ? month.split('-').map(Number) : [];
    const from = month ? `${month}-01` : null;
    const to = month ? `${month}-${pad(daysInMonthN(mY, mM))}` : null;
    // Carry the leave type along: a blank day says the person was not here, but
    // "ลาป่วย" says why — and that is the whole point of having asked.
    const rows = month
      ? (await query(`select a.employee_id, a.ymd, r.leave_type from employee_away a
                        left join leave_requests r on r.id = a.leave_request_id
                       where a.employee_id = any($1) and a.ymd >= $2 and a.ymd <= $3`, [ids, from, to])).rows
      : (await query(`select a.employee_id, a.ymd, r.leave_type from employee_away a
                        left join leave_requests r on r.id = a.leave_request_id
                       where a.employee_id = any($1)`, [ids])).rows;
    for (const r of rows) {
      const d = dateStr(r.ymd);
      (awayBy[r.employee_id] ||= []).push(d);
      if (r.leave_type) (leaveBy[r.employee_id] ||= {})[d] = LEAVE_TH[r.leave_type] || r.leave_type;
    }
  }
  return emps.map((e) => ({
    eid: e.id, name: e.full_name, emp_id: e.employee_code || '',
    department: e.department_name || '', position: e.position_name || '',
    kind: e.kind, team: e.team || '', away: awayBy[e.id] || [],
    leave: leaveBy[e.id] || {},
    moved_in: '', moved_out: '',
  }));
}

router.get('/employees', asyncHandler(async (req, res) => {
  const key = req.query.site;
  if (!key) throw new ApiError(400, 'site is required');
  const unit = await loadUnitByKey(key);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  assertUnitInScope(scopedUnitIds(req.profile), unit.id);
  res.json({ data: await employeesForUnit(unit.id, req.query.month) });
}));

const employeeSchema = z.object({
  site: z.string().min(1), fullName: z.string().min(1),
  employeeCode: z.string().optional().nullable(), kind: z.enum(['operation', 'support']),
  // §2 the register carries a department and a position, so both have to be
  // settable where a person is created, not only through the Excel import
  departmentId: z.string().uuid().optional().nullable(),
  positionId: z.string().uuid().optional().nullable(),
});
router.post('/employees', requirePermission('performance', 'edit'), asyncHandler(async (req, res) => {
  const p = employeeSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const unit = await loadUnitByKey(p.data.site);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  assertUnitInScope(scopedUnitIds(req.profile), unit.id);
  const row = await queryOne(
    `insert into employees (unit_id, full_name, employee_code, kind, is_active, department_id, position_id)
     values ($1,$2,$3,$4,true,$5,$6) returning id`,
    [unit.id, p.data.fullName, p.data.employeeCode || null, p.data.kind,
     p.data.departmentId || null, p.data.positionId || null]
  );
  res.status(201).json({ data: { eid: row.id } });
}));
// load an employee and confirm it belongs to a unit the caller may write to
async function assertEmployeeScoped(profile, employeeId) {
  const emp = await queryOne('select id, unit_id, kind, is_active from employees where id = $1', [employeeId]);
  if (!emp) throw new ApiError(404, 'ไม่พบพนักงาน');
  assertUnitInScope(scopedUnitIds(profile), emp.unit_id);
  return emp;
}
router.patch('/employees/:id', requirePermission('performance', 'edit'), asyncHandler(async (req, res) => {
  const p = z.object({
    fullName: z.string().optional(), employeeCode: z.string().optional().nullable(),
    kind: z.enum(['operation', 'support']).optional(), isActive: z.boolean().optional(),
    departmentId: z.string().uuid().optional().nullable(),
    positionId: z.string().uuid().optional().nullable(),
  }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  await assertEmployeeScoped(req.profile, req.params.id); // #B: no cross-unit writes
  const map = { fullName: 'full_name', employeeCode: 'employee_code', kind: 'kind', isActive: 'is_active',
    departmentId: 'department_id', positionId: 'position_id' };
  const sets = []; const vals = [];
  for (const [k, col] of Object.entries(map)) if (p.data[k] !== undefined) { vals.push(p.data[k]); sets.push(`${col} = $${vals.length}`); }
  if (!sets.length) throw new ApiError(400, 'No fields to update');
  vals.push(req.params.id);
  const row = await queryOne(`update employees set ${sets.join(', ')} where id = $${vals.length} returning id`, vals);
  if (!row) throw new ApiError(404, 'ไม่พบพนักงาน');
  res.json({ data: { eid: row.id } });
}));
// mark / unmark an away (leave) day for an employee
router.post('/employees/:id/away', requirePermission('performance', 'edit'), asyncHandler(async (req, res) => {
  const p = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), away: z.boolean() }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  await assertEmployeeScoped(req.profile, req.params.id); // #B: no cross-unit writes
  if (p.data.away) await query('insert into employee_away (employee_id, ymd) values ($1,$2) on conflict do nothing', [req.params.id, p.data.date]);
  else await query('delete from employee_away where employee_id = $1 and ymd = $2', [req.params.id, p.data.date]);
  res.json({ data: { ok: true } });
}));

// ── site-month (grid) ───────────────────────────────────────────────────────
router.get('/site-month', asyncHandler(async (req, res) => {
  const key = req.query.site;
  const Y = Number(req.query.year), M = Number(req.query.month);
  if (!key || !Y || !M) throw new ApiError(400, 'site, year, month are required');
  const unit = await loadUnitByKey(key);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  assertUnitInScope(scopedUnitIds(req.profile), unit.id);

  const dim = daysInMonthN(Y, M);
  const days = [];
  for (let d = 1; d <= dim; d++) {
    const ds = ymd(Y, M, d);
    days.push({ date: ds, dow: new Date(Y, M - 1, d).getDay(), weekend: isWeekend(Y, M, d) });
  }
  const month = `${Y}-${pad(M)}`;
  const employees = await employeesForUnit(unit.id, month);
  const logs = (await query(
    `select employee_id, ymd, team, detail, pm, man_day, hours, work_status, entry_at, updated_at, verified_at
       from work_logs where unit_id = $1 and ymd >= $2 and ymd <= $3 and deleted_at is null`,
    [unit.id, ymd(Y, M, 1), ymd(Y, M, dim)])).rows;
  const entries = {};
  for (const l of logs) {
    const ds = dateStr(l.ymd);
    const cell = {};
    if (l.team) cell.team = l.team;
    if (l.detail) cell.detail = l.detail;
    if (l.pm) cell.pm = l.pm;
    if (l.man_day != null) cell.manDay = Number(l.man_day);
    if (l.hours != null) cell.hours = Number(l.hours);
    if (l.work_status) cell.workStatus = l.work_status;
    // §3 the day it describes and the moment it was keyed are different facts
    if (l.entry_at) cell.entryAt = l.entry_at;
    if (l.updated_at) cell.updatedAt = l.updated_at;
    if (l.verified_at) cell.verifiedAt = l.verified_at;
    if (Object.keys(cell).length) (entries[l.employee_id] ||= {})[ds] = cell;
  }
  const closedMonths = await closedMonthsFor(unit.id);
  for (const d of days) d.state = lockState(d.date, unit.lock_days ?? 3, closedMonths);
  const teams = (await loadActivities()).map(activityOut);
  const costs = (await loadCategories()).map((c) => ({ code: c.code, name: c.name }));
  res.json({
    ok: true, days, employees, entries, teams, costs,
    today: todayStr(), lockDays: unit.lock_days ?? 3, edits: {},
  });
}));

// ── save one cell field (autosave) ──────────────────────────────────────────
const cellSaveSchema = z.object({
  site: z.string().min(1),
  eid: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  field: z.enum(['team', 'detail', 'pm']),
  value: z.string().optional().default(''),
  adminUnlock: z.boolean().optional(),
  // §4 unlocking a closed day has to say why, and the reason is kept
  reason: z.string().optional(),
  // §12 what the client believed it was editing; a mismatch means someone else
  // saved first and this write would silently overwrite them
  seenAt: z.string().optional(),
});
router.post('/cell', requirePermission('performance', 'edit'), asyncHandler(async (req, res) => {
  const p = cellSaveSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const { site, eid, date, field, value, adminUnlock } = p.data;
  const unit = await loadUnitByKey(site);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  assertUnitInScope(scopedUnitIds(req.profile), unit.id);
  const emp = await queryOne('select id, unit_id, kind, is_active from employees where id = $1', [eid]);
  if (!emp || emp.unit_id !== unit.id) throw new ApiError(400, 'พบพนักงานที่ไม่ได้อยู่ในไซต์นี้');
  if (emp.is_active === false) throw new ApiError(400, 'พนักงานคนนี้ถูกปิดการใช้งานแล้ว');

  // §3 validation — a day in the future is a typo, not a record of work
  if (date > addDaysStr(todayStr(), 1)) throw new ApiError(400, 'บันทึกล่วงหน้าเกินวันพรุ่งนี้ไม่ได้');

  const lockDays = unit.lock_days ?? 3;
  const closed = await closedMonthsFor(unit.id);
  if (closed.has(date.slice(0, 7))) throw new ApiError(409, 'เดือนนี้ปิดงวดแล้ว แก้ไขข้อมูลไม่ได้');
  const canUnlock = req.profile.role === 'admin' && adminUnlock;
  if (isLocked(date, lockDays) && !canUnlock) throw new ApiError(409, 'วันที่นี้เลยกำหนดแก้ไขแล้ว (ผู้ดูแลระบบปลดล็อกได้)');
  // §4 an override is allowed, but never silently
  if (isLocked(date, lockDays) && canUnlock && !(p.data.reason || '').trim()) {
    throw new ApiError(400, 'การแก้ไขข้อมูลที่ล็อกแล้วต้องระบุเหตุผล');
  }

  const existing = await queryOne(
    'select id, team, detail, pm, man_day, hours, work_status, verified_at, updated_at from work_logs where employee_id = $1 and ymd = $2 and deleted_at is null',
    [eid, date]
  );
  // §12 two people on the same cell: the second one is told, not ignored
  if (existing && p.data.seenAt && new Date(p.data.seenAt).getTime() < new Date(existing.updated_at).getTime() - 1000) {
    throw new ApiError(409, 'มีผู้อื่นแก้ไขช่องนี้ไปแล้ว กรุณาโหลดข้อมูลใหม่ก่อนบันทึกทับ');
  }
  // §5 a verified day is a statement someone signed; re-open it to change it
  if (existing?.verified_at && !canUnlock) throw new ApiError(409, 'ข้อมูลวันนี้ถูกยืนยันแล้ว ต้องยกเลิกการยืนยันก่อนแก้ไข');

  const before = existing ? workFields(existing) : null;
  const next = { team: existing?.team || null, detail: existing?.detail || null, pm: existing?.pm || null };
  next[field] = value && value.trim() ? value.trim() : null;

  if (!next.team && !next.detail && !next.pm) {
    // §9 a delete stays visible — the row is marked, never removed
    if (existing) {
      await query('update work_logs set deleted_at = now(), deleted_by = $2, updated_at = now() where id = $1', [existing.id, req.profile.id]);
      await logWork({ actor: req.profile, workLogId: existing.id, employeeId: eid, unitId: unit.id, ymd: date,
        action: 'delete', before, after: null, reason: p.data.reason });
    }
    return res.json({ data: { ok: true, cleared: true } });
  }
  await query(
    `insert into work_logs (employee_id, unit_id, ymd, kind, team, detail, pm, status, updated_by)
     values ($1,$2,$3,$4,$5,$6,$7,'',$8)
     on conflict (employee_id, ymd) do update set
       unit_id=excluded.unit_id, kind=excluded.kind, team=excluded.team, detail=excluded.detail,
       pm=excluded.pm, updated_by=excluded.updated_by, updated_at=now()`,
    [eid, unit.id, date, emp.kind, next.team, next.detail, next.pm, req.profile.id]
  );
  const saved = await queryOne('select id, team, detail, pm, man_day, hours, work_status, updated_at from work_logs where employee_id = $1 and ymd = $2', [eid, date]);
  await logWork({ actor: req.profile, workLogId: saved?.id, employeeId: eid, unitId: unit.id, ymd: date,
    action: existing ? 'edit' : 'create', before, after: workFields(saved),
    reason: p.data.reason || (canUnlock && isLocked(date, lockDays) ? 'แก้ไขย้อนหลังโดยผู้ดูแลระบบ' : null) });
  res.json({ data: { ok: true, updatedAt: saved?.updated_at } });
}));

// ── admin summary (dashboard) ────────────────────────────────────────────────
router.get('/admin-summary', asyncHandler(async (req, res) => {
  const Y = Number(req.query.year), M = Number(req.query.month);
  if (!Y || !M) throw new ApiError(400, 'year, month are required');
  const scoped = scopedUnitIds(req.profile);
  const units = (scoped
    ? await query('select * from units where id = any($1) and code is not null order by name', [scoped])
    : await query('select * from units where code is not null order by name')).rows;

  const dim = daysInMonthN(Y, M);
  const tStr = todayStr();
  const actMap = new Map((await loadActivities()).map((a) => [a.code, a.name]));
  const catMap = new Map((await loadCategories()).map((c) => [c.code, c.name]));

  const rows = [];
  for (const u of units) {
    const emps = (await query("select id, kind from employees where unit_id = $1 and is_active = true", [u.id])).rows;
    const awayRows = emps.length ? (await query('select employee_id, ymd from employee_away where employee_id = any($1) and ymd >= $2 and ymd <= $3', [emps.map((e) => e.id), ymd(Y, M, 1), ymd(Y, M, dim)])).rows : [];
    const awayBy = {}; for (const a of awayRows) (awayBy[a.employee_id] ||= new Set()).add(dateStr(a.ymd));
    const logs = (await query('select employee_id, ymd, team, detail, pm from work_logs where unit_id = $1 and ymd >= $2 and ymd <= $3', [u.id, ymd(Y, M, 1), ymd(Y, M, dim)])).rows;
    const cellBy = new Map(logs.map((l) => [`${l.employee_id}_${dateStr(l.ymd)}`, l]));

    const nOp = emps.filter((e) => e.kind === 'operation').length;
    const nSup = emps.length - nOp;
    const startedOp = new Set(), startedSup = new Set();
    const daysFilled = [];
    let fillRateDenom = 0, filledSum = 0, entriesCount = 0;
    const actAgg = new Map(), costAgg = new Map();
    let topTotal = 0;

    for (let d = 1; d <= dim; d++) {
      const ds = ymd(Y, M, d);
      const weekend = isWeekend(Y, M, d);
      let total = 0, filled = 0;
      for (const e of emps) {
        const away = awayBy[e.id]?.has(ds);
        if (!weekend && !away) total++;
        const c = cellBy.get(`${e.id}_${ds}`);
        if (cellFilled(c)) {
          entriesCount++;
          // count toward the fill rate only when this employee/day is in the denominator
          // (not a weekend, not marked away) — otherwise an away day with a stray log
          // could push filled past total and show >100%.
          if (!weekend && !away) filled++;
          (e.kind === 'operation' ? startedOp : startedSup).add(e.id);
          // top lists — slots weighted 0.5 each when a 2nd task exists
          const slots = [c.team || c.detail, c.pm].filter((s) => s && s.trim());
          const w = slots.length > 1 ? 0.5 : 1;
          for (const s of slots) {
            const [actCode, costCode] = s.split(' / ').map((x) => x && x.trim());
            const actName = actMap.get(actCode) || actCode;
            actAgg.set(actName, (actAgg.get(actName) || 0) + w);
            if (costCode) { const cn = catMap.get(costCode) || costCode; costAgg.set(cn, (costAgg.get(cn) || 0) + w); }
            topTotal += w;
          }
        }
      }
      daysFilled.push({ date: ds, weekend, total, filled });
      if (ds <= tStr && !weekend) { fillRateDenom += total; filledSum += filled; }
    }
    const toTop = (agg) => [...agg.entries()]
      .map(([name, x]) => ({ name, count: Math.round(x * 10) / 10, pct: topTotal ? Math.round((x / topTotal) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    rows.push({
      site_key: u.code, site_name: u.name, company: u.company, color: u.color,
      n_emp: emps.length, n_support: nSup, n_operation: nOp,
      support_started: startedSup.size, operation_started: startedOp.size,
      entries: entriesCount,
      fillRate: fillRateDenom ? Math.round((filledSum / fillRateDenom) * 100) : 0,
      fillRateDenom, daysFilled,
      topActivities: toTop(actAgg), topCostCodes: toTop(costAgg),
    });
  }
  res.json({ ok: true, rows, today: tStr, lockDays: 3 });
}));

// ── export xlsx ───────────────────────────────────────────────────────────
router.get('/export', asyncHandler(async (req, res) => {
  const key = req.query.site;
  const Y = Number(req.query.year), M = Number(req.query.month);
  if (!key || !Y || !M) throw new ApiError(400, 'site, year, month are required');
  const unit = await loadUnitByKey(key);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  assertUnitInScope(scopedUnitIds(req.profile), unit.id);
  const dim = daysInMonthN(Y, M);
  const employees = await employeesForUnit(unit.id, `${Y}-${pad(M)}`);
  const logs = (await query('select employee_id, ymd, team, detail, pm from work_logs where unit_id = $1 and ymd >= $2 and ymd <= $3', [unit.id, ymd(Y, M, 1), ymd(Y, M, dim)])).rows;
  const byKey = new Map(logs.map((l) => [`${l.employee_id}_${dateStr(l.ymd)}`, l]));

  const wb = new ExcelJS.Workbook();
  // Excel sheet names reject * ? : \ / [ ] and cap at 31 chars — sanitize or addWorksheet throws 500
  const wsName = `${unit.name} ${Y}-${pad(M)}`.replace(/[*?:\\/\[\]]/g, ' ').slice(0, 30) || 'Sheet1';
  const ws = wb.addWorksheet(wsName);
  const header = ['พนักงาน', 'ประเภท'];
  for (let d = 1; d <= dim; d++) header.push(String(d));
  ws.addRow(header);
  for (const e of employees) {
    const row = [e.name, e.kind === 'operation' ? 'ปฏิบัติการ' : 'สนับสนุน'];
    for (let d = 1; d <= dim; d++) {
      const l = byKey.get(`${e.eid}_${ymd(Y, M, d)}`);
      let v = '';
      if (l) {
        const primary = e.kind === 'operation' ? l.team : l.detail;
        v = [primary, l.pm].filter(Boolean).join(' + ');
      }
      row.push(v);
    }
    ws.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="worklog-${key}-${Y}-${pad(M)}.xlsx"`);
  res.send(Buffer.from(buf));
}));

// =============================================================================
// ระบบลางาน — the request behind a day off.
//
// employee_away already recorded THAT someone was away. This records why, who
// asked, and who agreed — and then writes the days into employee_away itself, so
// every screen that already reads it shows approved leave with no change.
//
// Who may decide is not a role: the client's own framing is "หัวหน้ามีลูกน้อง
// เป็นใครบ้าง", so leave_approvers pairs a supervisor with the people who report
// to them. An employee with nobody assigned falls through to the admins — a
// request must never be invisible to everyone.
// =============================================================================

const LEAVE_TYPES_DEF = [
  { code: 'sick', th: 'ลาป่วย' },
  { code: 'personal', th: 'ลากิจ' },
  { code: 'vacation', th: 'ลาพักผ่อน' },
  { code: 'maternity', th: 'ลาคลอด' },
  { code: 'ordination', th: 'ลาบวช' },
  { code: 'other', th: 'อื่น ๆ' },
];


const leaveSelect = `
  select r.id, r.employee_id, r.unit_id, r.leave_type, r.from_date, r.to_date,
         r.reason, r.status, r.requested_at, r.decided_at, r.decide_note,
         e.full_name as employee_name, e.employee_code,
         pos.name as position, dept.name as department,
         u.code as site_key, u.name as site_name,
         rp.full_name as requested_by_name, dp.full_name as decided_by_name,
         (r.to_date - r.from_date + 1) as days
    from leave_requests r
    join employees e on e.id = r.employee_id
    left join positions pos on pos.id = e.position_id
    left join departments dept on dept.id = e.department_id
    left join units u on u.id = r.unit_id
    left join profiles rp on rp.id = r.requested_by
    left join profiles dp on dp.id = r.decided_by`;

const leaveOut = (r) => ({ ...r, leave_type_th: LEAVE_TH[r.leave_type] || r.leave_type });

/** The employee ids this person may decide for. null = every one of them (admin). */
async function approvableEmployeeIds(profile) {
  if (profile.role === 'admin') return null;
  const { rows } = await query(
    'select employee_id from leave_approvers where approver_id = $1', [profile.id]);
  return rows.map((r) => r.employee_id);
}

/** GET /api/performance/leave/types */
router.get('/leave/types', asyncHandler(async (req, res) => {
  res.json({ ok: true, types: LEAVE_TYPES_DEF });
}));

/** GET /api/performance/leave/mine — requests this user submitted. */
router.get('/leave/mine', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `${leaveSelect} where r.requested_by = $1 order by r.requested_at desc limit 200`,
    [req.profile.id]
  );
  res.json({ ok: true, rows: rows.map(leaveOut) });
}));

/** GET /api/performance/leave/pending — my team's requests still waiting. */
router.get('/leave/pending', asyncHandler(async (req, res) => {
  const ids = await approvableEmployeeIds(req.profile);
  // An admin also picks up anyone nobody was assigned to, which is what stops a
  // request from sitting in a queue no human can see.
  const where = ids === null
    ? `r.status = 'pending'`
    : `r.status = 'pending' and r.employee_id = any($1)`;
  const { rows } = await query(
    `${leaveSelect} where ${where} order by r.requested_at`,
    ids === null ? [] : [ids]
  );
  res.json({ ok: true, rows: rows.map(leaveOut), canDecide: ids === null || ids.length > 0 });
}));

/** GET /api/performance/leave/decided — what my team's requests came to. */
router.get('/leave/decided', asyncHandler(async (req, res) => {
  const ids = await approvableEmployeeIds(req.profile);
  const where = ids === null
    ? `r.status <> 'pending'`
    : `r.status <> 'pending' and r.employee_id = any($1)`;
  const { rows } = await query(
    `${leaveSelect} where ${where} order by r.decided_at desc nulls last, r.requested_at desc limit 200`,
    ids === null ? [] : [ids]
  );
  res.json({ ok: true, rows: rows.map(leaveOut) });
}));

const leaveSchema = z.object({
  employeeId: z.string().uuid(),
  leaveType: z.enum(['sick', 'personal', 'vacation', 'maternity', 'ordination', 'other']).default('other'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(1000).optional().default(''),
  // §6 a half day is a real case, and counting it as one distorts man-days
  dayPart: z.enum(['full', 'first_half', 'second_half']).optional().default('full'),
  attachmentUrl: z.string().max(300).optional().nullable(),
  attachmentName: z.string().max(300).optional().nullable(),
});

/** POST /api/performance/leave — ask for leave (HR files it for the employee). */
router.post('/leave', requirePermission('performance', 'edit'), fileUpload.single('file'), asyncHandler(async (req, res) => {
  // §6 ใบรับรองแพทย์มากับคำขอในครั้งเดียว — multer ปล่อยคำขอ JSON ผ่านไปตามเดิม
  if (req.file) {
    const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const key = `leave/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await putObject(key, req.file.buffer, req.file.mimetype || 'application/octet-stream');
    req.body.attachmentUrl = key;
    req.body.attachmentName = name;
  }
  const p = leaveSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const { employeeId, leaveType, from, to, reason } = p.data;
  if (to < from) throw new ApiError(400, 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มลา');

  const emp = await queryOne('select id, unit_id, full_name from employees where id = $1', [employeeId]);
  if (!emp) throw new ApiError(404, 'ไม่พบพนักงานคนนี้');
  // Same rule as the rest of the module: you cannot act on a site you are not
  // allowed to see. Without this an account scoped to one project could file
  // leave for anybody in the company.
  assertUnitInScope(scopedUnitIds(req.profile), emp.unit_id);

  // Two live requests over the same days say nothing extra and would each write
  // the same days into the work log.
  const clash = await queryOne(
    `select id, from_date, to_date from leave_requests
      where employee_id = $1 and status in ('pending','approved')
        and from_date <= $3 and to_date >= $2 limit 1`,
    [employeeId, from, to]
  );
  if (clash) {
    throw new ApiError(409,
      `ช่วงวันที่ทับกับคำขอที่มีอยู่แล้ว (${String(clash.from_date).slice(0, 10)} ถึง ${String(clash.to_date).slice(0, 10)})`);
  }

  // §6 half a day only makes sense on a single day
  const dayPart = p.data.dayPart || 'full';
  if (dayPart !== 'full' && from !== to) throw new ApiError(400, 'ลาครึ่งวันเลือกได้เฉพาะวันเดียว');
  const spanDays = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  const days = dayPart === 'full' ? spanDays : 0.5;

  // §6 warn when the days asked for already carry work — the recorder needs to
  // know they are about to contradict something already entered
  const worked = (await query(
    `select ymd from work_logs where employee_id = $1 and ymd >= $2 and ymd <= $3 and deleted_at is null order by ymd`,
    [employeeId, from, to])).rows.map((r) => dateStr(r.ymd));

  const row = await queryOne(
    `insert into leave_requests (employee_id, unit_id, leave_type, from_date, to_date, reason, requested_by,
                                day_part, days, attachment_url, attachment_name)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
    [employeeId, emp.unit_id, leaveType, from, to, reason, req.profile.id,
     dayPart, days, p.data.attachmentUrl || null, p.data.attachmentName || null]
  );
  const full = await queryOne(`${leaveSelect} where r.id = $1`, [row.id]);
  res.status(201).json({ ok: true, row: leaveOut(full), warnWorkedDays: worked });
}));

/** GET /api/performance/leave/:id/attachment — the certificate that came with it. */
router.get('/leave/:id/attachment', asyncHandler(async (req, res) => {
  const row = await queryOne('select * from leave_requests where id = $1', [req.params.id]);
  if (!row?.attachment_url) throw new ApiError(404, 'คำขอนี้ไม่มีไฟล์แนบ');
  assertUnitInScope(scopedUnitIds(req.profile), row.unit_id);
  const obj = await openDownloadStream(row.attachment_url);
  if (!obj?.stream) throw new ApiError(404, 'ไม่พบไฟล์ในที่จัดเก็บ');
  res.setHeader('Content-Type', obj.contentType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.attachment_name || 'file')}`);
  obj.stream.pipe(res);
}));

/** POST /api/performance/leave/:id/decide — approve or refuse one request. */
router.post('/leave/:id/decide', asyncHandler(async (req, res) => {
  const p = z.object({
    approve: z.boolean(),
    note: z.string().trim().max(1000).optional().default(''),
  }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());

  const row = await queryOne('select * from leave_requests where id = $1', [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบคำขอลานี้');
  if (row.status !== 'pending') throw new ApiError(409, 'คำขอนี้ถูกตัดสินไปแล้ว');

  const ids = await approvableEmployeeIds(req.profile);
  if (ids !== null && !ids.includes(row.employee_id)) {
    throw new ApiError(403, 'ท่านไม่ได้เป็นผู้อนุมัติของพนักงานคนนี้');
  }
  // Deciding your own request is not a decision. The acceptance criteria say
  // "no person may approve their own request" with no exception, so the admin
  // carve-out that used to be here is gone.
  if (row.requested_by === req.profile.id) {
    throw new ApiError(403, 'ผู้ยื่นคำขอตัดสินคำขอของตัวเองไม่ได้');
  }
  const self = await queryOne('select id from employees where id = $1 and lower(email) = lower($2)', [row.employee_id, req.profile.email || '']);
  if (self) throw new ApiError(403, 'อนุมัติคำขอลาของตนเองไม่ได้');

  const status = p.data.approve ? 'approved' : 'rejected';
  await query(
    `update leave_requests set status = $2, decided_by = $3, decided_at = now(),
            decide_note = $4, updated_at = now() where id = $1`,
    [row.id, status, req.profile.id, p.data.note]
  );

  // Approval is what puts the days into the work log. Tagged with the request id
  // so reversing the decision takes back exactly these days and leaves any an
  // admin marked by hand alone.
  if (p.data.approve) {
    await query(
      `insert into employee_away (employee_id, ymd, leave_request_id)
       select $1, d::date, $2 from generate_series($3::date, $4::date, interval '1 day') d
       on conflict do nothing`,
      [row.employee_id, row.id, row.from_date, row.to_date]
    );
  }

  const full = await queryOne(`${leaveSelect} where r.id = $1`, [row.id]);
  res.json({ ok: true, row: leaveOut(full) });
}));

/** POST /api/performance/leave/:id/cancel — the requester's own way out.
 *  Only while pending: once decided the row is a record, not a draft. */
router.post('/leave/:id/cancel', asyncHandler(async (req, res) => {
  const row = await queryOne('select * from leave_requests where id = $1', [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบคำขอลานี้');
  if (row.requested_by !== req.profile.id && req.profile.role !== 'admin') {
    throw new ApiError(403, 'ยกเลิกได้เฉพาะคำขอที่ท่านเป็นผู้ยื่น');
  }
  if (row.status !== 'pending') throw new ApiError(409, 'คำขอที่ถูกตัดสินแล้วยกเลิกไม่ได้');
  await query(`update leave_requests set status = 'cancelled', updated_at = now() where id = $1`, [row.id]);
  res.json({ ok: true });
}));

/** GET /api/performance/leave/:id/slip — the request as a printable ใบลา.
 *  Anyone who may see the request may print it: the requester, the assigned
 *  supervisor, or an admin. */
router.get('/leave/:id/slip', asyncHandler(async (req, res) => {
  const row = await queryOne(`${leaveSelect} where r.id = $1`, [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบคำขอลานี้');

  const ids = await approvableEmployeeIds(req.profile);
  const mayApprove = ids === null || ids.includes(row.employee_id);
  if (!mayApprove && row.requested_by !== req.profile.id) {
    throw new ApiError(403, 'ไม่มีสิทธิ์เปิดใบลาฉบับนี้');
  }

  const company = (await queryOne(
    'select company from units where id = $1', [row.unit_id]))?.company || undefined;
  const doc = buildLeaveSlip(row, company ? { company } : {});
  res.setHeader('Content-Type', 'application/pdf');
  // inline: people open it to read and print, and a forced download makes that
  // two steps instead of one
  res.setHeader('Content-Disposition',
    `inline; filename="leave-${String(row.id).slice(0, 8)}.pdf"`);
  doc.pipe(res);
}));

/** GET /api/performance/leave/approvers — the supervisor → team map. Admin only. */
router.get('/leave/approvers', requireRole('admin'), asyncHandler(async (req, res) => {
  const [pairs, people, emps] = await Promise.all([
    query('select approver_id, employee_id from leave_approvers'),
    query(`select id, full_name, email, role from profiles where is_active = true order by full_name`),
    query(`select e.id, e.full_name, e.employee_code, u.code as site_key, u.name as site_name
             from employees e left join units u on u.id = e.unit_id
            where e.is_active = true order by u.name nulls last, e.full_name`),
  ]);
  const assigned = new Set(pairs.rows.map((r) => r.employee_id));
  res.json({
    ok: true,
    pairs: pairs.rows,
    people: people.rows,
    employees: emps.rows,
    // Say plainly who nobody is watching: those requests land on the admins,
    // which works but is not what anyone intended.
    unassigned: emps.rows.filter((e) => !assigned.has(e.id)).map((e) => e.id),
  });
}));

/** PUT /api/performance/leave/approvers/:approverId — set one supervisor's team. */
router.put('/leave/approvers/:approverId', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = z.object({ employeeIds: z.array(z.string().uuid()).max(500) }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const who = await queryOne('select id from profiles where id = $1 and is_active = true', [req.params.approverId]);
  if (!who) throw new ApiError(404, 'ไม่พบผู้ใช้คนนี้');

  await query('delete from leave_approvers where approver_id = $1', [req.params.approverId]);
  if (p.data.employeeIds.length) {
    await query(
      `insert into leave_approvers (approver_id, employee_id)
       select $1, x from unnest($2::uuid[]) x on conflict do nothing`,
      [req.params.approverId, p.data.employeeIds]
    );
  }
  res.json({ ok: true, count: p.data.employeeIds.length });
}));

// =============================================================================
// Acceptance criteria (UAT) — what the client's document asks for that the
// diary did not carry: how much manpower a day cost, who checked it, when it
// was closed, and a trail of every change.
// =============================================================================

// ── §3 man-day, hours and working status ──────────────────────────────────
const daySchema = z.object({
  site: z.string().min(1),
  eid: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  manDay: z.number().min(0).max(1).optional().nullable(),
  hours: z.number().min(0).max(24).optional().nullable(),
  workStatus: z.enum(['ปกติ', 'ล่วงเวลา', 'Standby', 'ลา', 'ขาดงาน']).optional().nullable(),
  // §3 one person may spend a day across several activities; the parts may not
  // add up to more than one man-day, which is the whole point of the measure
  lines: z.array(z.object({
    workTypeCode: z.string().optional().nullable(),
    workTypeName: z.string().optional().nullable(),
    costCode: z.string().optional().nullable(),
    manDay: z.number().positive().max(1),
    hours: z.number().min(0).max(24).optional().nullable(),
    workStatus: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
  })).optional(),
  adminUnlock: z.boolean().optional(),
  reason: z.string().optional(),
});
const HOURS_PER_DAY = 8;

router.post('/day', requirePermission('performance', 'edit'), asyncHandler(async (req, res) => {
  const p = daySchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const d = p.data;
  const unit = await loadUnitByKey(d.site);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  assertUnitInScope(scopedUnitIds(req.profile), unit.id);

  const emp = await queryOne('select id, unit_id, kind, is_active from employees where id = $1', [d.eid]);
  if (!emp || emp.unit_id !== unit.id) throw new ApiError(400, 'พบพนักงานที่ไม่ได้อยู่ในไซต์นี้');
  // §3 a person who has left cannot have worked
  if (emp.is_active === false) throw new ApiError(400, 'พนักงานคนนี้พ้นสภาพแล้ว บันทึกงานไม่ได้');
  if (d.date > addDaysStr(todayStr(), 1)) throw new ApiError(400, 'บันทึกล่วงหน้าเกินวันพรุ่งนี้ไม่ได้');

  const lockDays = unit.lock_days ?? 3;
  const closed = await closedMonthsFor(unit.id);
  if (closed.has(d.date.slice(0, 7))) throw new ApiError(409, 'เดือนนี้ปิดงวดแล้ว แก้ไขข้อมูลไม่ได้');
  const canUnlock = req.profile.role === 'admin' && d.adminUnlock;
  if (isLocked(d.date, lockDays) && !canUnlock) throw new ApiError(409, 'วันที่นี้เลยกำหนดแก้ไขแล้ว');
  if (isLocked(d.date, lockDays) && canUnlock && !(d.reason || '').trim()) {
    throw new ApiError(400, 'การแก้ไขข้อมูลที่ล็อกแล้วต้องระบุเหตุผล');
  }

  const lines = d.lines || [];
  const lineTotal = lines.reduce((a, l) => a + Number(l.manDay), 0);
  if (lines.length && lineTotal > 1.0001) {
    throw new ApiError(400, `รวมแรงงาน-วันของวันนี้ได้ ${lineTotal.toFixed(2)} ซึ่งเกิน 1 แรงงาน-วัน`);
  }
  const manDay = lines.length ? Number(lineTotal.toFixed(2)) : (d.manDay ?? null);
  if (manDay != null && manDay > 1.0001) throw new ApiError(400, 'แรงงาน-วันต่อคนต่อวันเกิน 1 ไม่ได้');
  // hours and man-day describe the same day; derive whichever is missing so a
  // report never has to guess which one the site meant
  const hours = d.hours ?? (manDay != null ? Number((manDay * HOURS_PER_DAY).toFixed(2)) : null);
  if (hours != null && hours > 24) throw new ApiError(400, 'จำนวนชั่วโมงต่อวันเกิน 24 ไม่ได้');

  const existing = await queryOne(
    'select id, team, detail, pm, man_day, hours, work_status, verified_at from work_logs where employee_id = $1 and ymd = $2 and deleted_at is null',
    [d.eid, d.date]
  );
  if (existing?.verified_at && !canUnlock) throw new ApiError(409, 'ข้อมูลวันนี้ถูกยืนยันแล้ว ต้องยกเลิกการยืนยันก่อนแก้ไข');
  const before = existing ? workFields(existing) : null;

  const row = await queryOne(
    `insert into work_logs (employee_id, unit_id, ymd, kind, man_day, hours, work_status, status, updated_by)
     values ($1,$2,$3,$4,$5,$6,$7,'',$8)
     on conflict (employee_id, ymd) do update set
       man_day = excluded.man_day, hours = excluded.hours, work_status = excluded.work_status,
       deleted_at = null, deleted_by = null, updated_by = excluded.updated_by, updated_at = now()
     returning *`,
    [d.eid, unit.id, d.date, emp.kind, manDay, hours, d.workStatus ?? null, req.profile.id]
  );
  await query('delete from work_log_lines where work_log_id = $1', [row.id]);
  for (const l of lines) {
    await query(
      `insert into work_log_lines (work_log_id, work_type_code, work_type_name, cost_code, man_day, hours, work_status, note)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [row.id, l.workTypeCode || null, l.workTypeName || null, l.costCode || null,
       l.manDay, l.hours ?? null, l.workStatus || null, l.note || null]
    );
  }
  await logWork({ actor: req.profile, workLogId: row.id, employeeId: d.eid, unitId: unit.id, ymd: d.date,
    action: existing ? 'edit' : 'create', before, after: { ...workFields(row), lines: lines.length },
    reason: d.reason });
  res.json({ data: { ok: true, manDay, hours, lines: lines.length } });
}));

// ── §5 verification, by someone who did not key it ────────────────────────
const verifySchema = z.object({
  site: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  undo: z.boolean().optional(),
});
router.post('/verify', asyncHandler(async (req, res) => {
  const p = verifySchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const { site, from, to, undo } = p.data;
  // §1/§5 verifying is a separate right from recording — a site recorder may
  // not sign off their own numbers
  if (!['admin', 'executive'].includes(req.profile.role) && !hasVerifyRight(req.profile)) {
    throw new ApiError(403, 'ไม่มีสิทธิ์ยืนยันข้อมูล — สิทธิ์นี้แยกจากผู้บันทึก');
  }
  const unit = await loadUnitByKey(site);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  assertUnitInScope(scopedUnitIds(req.profile), unit.id);
  if (to < from) throw new ApiError(400, 'ช่วงวันที่ไม่ถูกต้อง');

  const rows = (await query(
    'select id, employee_id, updated_by, verified_at from work_logs where unit_id = $1 and ymd >= $2 and ymd <= $3 and deleted_at is null',
    [unit.id, from, to])).rows;
  let done = 0; let skippedOwn = 0;
  for (const r of rows) {
    // §5 the recorder and the verifier must be different people
    if (!undo && r.updated_by && r.updated_by === req.profile.id) { skippedOwn += 1; continue; }
    await query('update work_logs set verified_by = $2, verified_at = $3, updated_at = now() where id = $1',
      [r.id, undo ? null : req.profile.id, undo ? null : new Date()]);
    done += 1;
  }
  await logWork({ actor: req.profile, unitId: unit.id, ymd: from, action: undo ? 'unverify' : 'verify',
    after: { from, to, rows: done } });
  res.json({ data: { ok: true, verified: done, skippedOwn } });
}));

/** A verifier is named by permission, so the client can appoint one per site
 *  without a code change (§1). Read it through hasPermission — the raw override
 *  map only holds what an admin changed, so a right that comes from the role
 *  (the whole point of the verifier role) is not in there. */
function hasVerifyRight(profile) {
  return hasPermission(profile, 'performance', 'verify');
}

// ── §4 closing a month ────────────────────────────────────────────────────
router.get('/period-closes', asyncHandler(async (req, res) => {
  const unit = req.query.site ? await loadUnitByKey(req.query.site) : null;
  const { rows } = unit
    ? await query('select p.*, u.code site from period_closes p join units u on u.id = p.unit_id where unit_id = $1 order by ym desc', [unit.id])
    : await query('select p.*, u.code site from period_closes p join units u on u.id = p.unit_id order by ym desc limit 200');
  res.json({ data: rows });
}));
const closeSchema = z.object({ site: z.string().min(1), ym: z.string().regex(/^\d{4}-\d{2}$/), note: z.string().optional() });
router.post('/period-close', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = closeSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const unit = await loadUnitByKey(p.data.site);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  const row = await queryOne(
    `insert into period_closes (unit_id, ym, closed_by, note) values ($1,$2,$3,$4)
     on conflict (unit_id, ym) do nothing returning *`,
    [unit.id, p.data.ym, req.profile.id, p.data.note || null]);
  if (!row) throw new ApiError(409, 'เดือนนี้ปิดงวดไปแล้ว');
  await logWork({ actor: req.profile, unitId: unit.id, action: 'period-close', after: { ym: p.data.ym }, reason: p.data.note });
  res.json({ data: row });
}));
router.post('/period-open', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = z.object({ site: z.string(), ym: z.string().regex(/^\d{4}-\d{2}$/), reason: z.string().min(1) }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'การเปิดงวดที่ปิดแล้วต้องระบุเหตุผล', p.error?.flatten());
  const unit = await loadUnitByKey(p.data.site);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  await query('delete from period_closes where unit_id = $1 and ym = $2', [unit.id, p.data.ym]);
  await logWork({ actor: req.profile, unitId: unit.id, action: 'period-open', after: { ym: p.data.ym }, reason: p.data.reason });
  res.json({ data: { ok: true } });
}));

// ── §9 the trail itself ───────────────────────────────────────────────────
router.get('/audit', asyncHandler(async (req, res) => {
  const where = []; const params = [];
  if (req.query.site) {
    const unit = await loadUnitByKey(req.query.site);
    if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
    assertUnitInScope(scopedUnitIds(req.profile), unit.id);
    params.push(unit.id); where.push(`unit_id = $${params.length}`);
  } else {
    const scoped = scopedUnitIds(req.profile);
    if (scoped) { params.push(scoped); where.push(`unit_id = any($${params.length}::uuid[])`); }
  }
  if (req.query.employeeId) { params.push(req.query.employeeId); where.push(`employee_id = $${params.length}`); }
  if (req.query.from) { params.push(req.query.from); where.push(`ymd >= $${params.length}`); }
  if (req.query.to) { params.push(req.query.to); where.push(`ymd <= $${params.length}`); }
  const sql = `select * from work_log_audit ${where.length ? 'where ' + where.join(' and ') : ''} order by created_at desc limit 500`;
  const { rows } = await query(sql, params);
  res.json({ data: rows });
}));

// ── §2 the team register ──────────────────────────────────────────────────
router.get('/teams', asyncHandler(async (req, res) => {
  const unit = req.query.site ? await loadUnitByKey(req.query.site) : null;
  const { rows } = unit
    ? await query('select t.*, u.code site from teams t join units u on u.id = t.unit_id where t.unit_id = $1 order by t.name', [unit.id])
    : await query('select t.*, u.code site from teams t join units u on u.id = t.unit_id order by u.name, t.name');
  res.json({ data: rows });
}));
router.post('/teams', requirePermission('performance', 'edit'), asyncHandler(async (req, res) => {
  const p = z.object({ site: z.string(), name: z.string().min(1), code: z.string().optional() }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const unit = await loadUnitByKey(p.data.site);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  assertUnitInScope(scopedUnitIds(req.profile), unit.id);
  const row = await queryOne(
    `insert into teams (unit_id, code, name) values ($1,$2,$3)
     on conflict (unit_id, name) do update set is_active = true, updated_at = now() returning *`,
    [unit.id, p.data.code || null, p.data.name.trim()]);
  res.status(201).json({ data: row });
}));
router.patch('/teams/:id', requirePermission('performance', 'edit'), asyncHandler(async (req, res) => {
  const p = z.object({ name: z.string().min(1).optional(), code: z.string().optional().nullable(), isActive: z.boolean().optional() }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const sets = []; const vals = [];
  for (const [k, col] of [['name', 'name'], ['code', 'code'], ['isActive', 'is_active']]) {
    if (p.data[k] !== undefined) { vals.push(p.data[k]); sets.push(`${col} = $${vals.length}`); }
  }
  if (!sets.length) throw new ApiError(400, 'ไม่มีข้อมูลที่เปลี่ยนแปลง');
  vals.push(req.params.id);
  const row = await queryOne(`update teams set ${sets.join(', ')}, updated_at = now() where id = $${vals.length} returning *`, vals);
  if (!row) throw new ApiError(404, 'ไม่พบทีมนี้');
  res.json({ data: row });
}));

// ── §7 manpower, as of a day or over a range ──────────────────────────────
router.get('/manpower', asyncHandler(async (req, res) => {
  const from = req.query.from || todayStr();
  const to = req.query.to || from;
  if (to < from) throw new ApiError(400, 'ช่วงวันที่ไม่ถูกต้อง');
  const scoped = scopedUnitIds(req.profile);
  const params = [from, to]; const where = ['w.ymd >= $1', 'w.ymd <= $2', 'w.deleted_at is null'];
  if (scoped) { params.push(scoped); where.push(`w.unit_id = any($${params.length}::uuid[])`); }
  if (req.query.site) {
    const unit = await loadUnitByKey(req.query.site);
    if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
    assertUnitInScope(scoped, unit.id);
    params.push(unit.id); where.push(`w.unit_id = $${params.length}`);
  }
  if (req.query.team) { params.push(req.query.team); where.push(`w.team = $${params.length}`); }
  if (req.query.departmentId) { params.push(req.query.departmentId); where.push(`e.department_id = $${params.length}`); }
  const W = `where ${where.join(' and ')}`;

  // A day with no man-day recorded still used a person, so it counts as one
  // head; the man-day column stays honest about what was actually measured.
  const md = 'coalesce(w.man_day, 1)';
  const [byProject, byTeam, byType, byStatus, totals] = await Promise.all([
    query(`select u.code site, u.name site_name, sum(${md})::numeric manday, count(distinct w.employee_id)::int people
             from work_logs w join units u on u.id = w.unit_id join employees e on e.id = w.employee_id ${W}
            group by u.code, u.name order by manday desc`, params),
    query(`select coalesce(w.team, '(ไม่ระบุทีม)') team, sum(${md})::numeric manday, count(distinct w.employee_id)::int people
             from work_logs w join employees e on e.id = w.employee_id ${W} group by 1 order by manday desc limit 50`, params),
    query(`select coalesce(l.work_type_name, w.detail, w.team, '(ไม่ระบุงาน)') work_type, sum(coalesce(l.man_day, ${md}))::numeric manday
             from work_logs w join employees e on e.id = w.employee_id
             left join work_log_lines l on l.work_log_id = w.id ${W} group by 1 order by manday desc limit 50`, params),
    query(`select coalesce(w.work_status, '(ไม่ระบุ)') status, sum(${md})::numeric manday
             from work_logs w join employees e on e.id = w.employee_id ${W} group by 1 order by manday desc`, params),
    query(`select sum(${md})::numeric manday, count(*)::int rows, count(distinct w.employee_id)::int people
             from work_logs w join employees e on e.id = w.employee_id ${W}`, params),
  ]);
  const num = (rows) => rows.map((r) => ({ ...r, manday: Number(r.manday || 0) }));
  res.json({ data: {
    range: { from, to },
    total: { manday: Number(totals.rows[0]?.manday || 0), rows: totals.rows[0]?.rows || 0, people: totals.rows[0]?.people || 0 },
    byProject: num(byProject.rows), byTeam: num(byTeam.rows), byWorkType: num(byType.rows), byStatus: num(byStatus.rows),
    generatedAt: new Date().toISOString(),
  } });
}));

// ── §8 the man-day report, and the month in one file ──────────────────────
/** Every report carries what it covers, when it was taken, and by whom (§8). */
const reportMeta = (req, from, to) => ({
  from, to,
  generatedAt: new Date().toISOString(),
  generatedBy: req.profile.full_name || req.profile.email,
});

router.get('/report/manday', asyncHandler(async (req, res) => {
  const from = req.query.from, to = req.query.to;
  if (!from || !to) throw new ApiError(400, 'ต้องระบุช่วงวันที่ (from, to)');
  const groupBy = ['project', 'team', 'worktype', 'employee'].includes(req.query.groupBy) ? req.query.groupBy : 'project';
  const scoped = scopedUnitIds(req.profile);
  const params = [from, to]; const where = ['w.ymd >= $1', 'w.ymd <= $2', 'w.deleted_at is null'];
  if (scoped) { params.push(scoped); where.push(`w.unit_id = any($${params.length}::uuid[])`); }
  const W = `where ${where.join(' and ')}`;
  const md = 'coalesce(w.man_day, 1)';
  const SQL = {
    project:  `select u.code key, u.name label, sum(${md})::numeric manday, count(distinct w.employee_id)::int people
                 from work_logs w join units u on u.id = w.unit_id ${W} group by 1,2 order by 3 desc`,
    team:     `select coalesce(w.team,'(ไม่ระบุ)') key, coalesce(w.team,'(ไม่ระบุทีม)') label, sum(${md})::numeric manday,
                      count(distinct w.employee_id)::int people from work_logs w ${W} group by 1,2 order by 3 desc`,
    worktype: `select coalesce(l.work_type_code, '-') key, coalesce(l.work_type_name, w.detail, w.team, '(ไม่ระบุงาน)') label,
                      sum(coalesce(l.man_day, ${md}))::numeric manday, count(distinct w.employee_id)::int people
                 from work_logs w left join work_log_lines l on l.work_log_id = w.id ${W} group by 1,2 order by 3 desc`,
    employee: `select e.employee_code key, e.full_name label, sum(${md})::numeric manday, count(*)::int people
                 from work_logs w join employees e on e.id = w.employee_id ${W} group by 1,2 order by 3 desc`,
  }[groupBy];
  const { rows } = await query(SQL, params);
  res.json({ data: { groupBy, meta: reportMeta(req, from, to), rows: rows.map((r) => ({ ...r, manday: Number(r.manday || 0) })) } });
}));

/** §8 the monthly report has to be one file covering every project. */
router.get('/report/monthly.xlsx', asyncHandler(async (req, res) => {
  const ym = String(req.query.ym || '');
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new ApiError(400, 'ต้องระบุเดือน (ym=YYYY-MM)');
  const [Y, M] = ym.split('-').map(Number);
  const from = ymd(Y, M, 1), to = ymd(Y, M, daysInMonthN(Y, M));
  const scoped = scopedUnitIds(req.profile);
  const params = [from, to]; let scopeSql = '';
  if (scoped) { params.push(scoped); scopeSql = ` and w.unit_id = any($${params.length}::uuid[])`; }
  const md = 'coalesce(w.man_day, 1)';
  const { rows } = await query(
    `select u.code site, u.name site_name, e.employee_code, e.full_name, coalesce(w.team,'') team,
            w.ymd, ${md}::numeric manday, coalesce(w.hours, 0)::numeric hours,
            coalesce(w.work_status,'') work_status, coalesce(l.work_type_code,'') work_type_code,
            coalesce(l.work_type_name, w.detail, '') work_type_name
       from work_logs w
       join units u on u.id = w.unit_id
       join employees e on e.id = w.employee_id
       left join work_log_lines l on l.work_log_id = w.id
      where w.ymd >= $1 and w.ymd <= $2 and w.deleted_at is null${scopeSql}
      order by u.name, e.full_name, w.ymd`, params);

  const wb = new ExcelJS.Workbook();
  const meta = reportMeta(req, from, to);
  const info = wb.addWorksheet('ข้อมูลรายงาน');
  info.columns = [{ width: 26 }, { width: 52 }];
  info.addRows([
    ['รายงานแรงงาน-วัน รายเดือน', ''],
    ['ช่วงข้อมูล', `${from} ถึง ${to}`],
    ['วันเวลาที่ดึงข้อมูล', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })],
    ['ผู้ดึงข้อมูล', meta.generatedBy || ''],
    ['จำนวนรายการ', rows.length],
  ]);
  const ws = wb.addWorksheet('รายละเอียด');
  ws.columns = [
    { header: 'รหัสโครงการ', key: 'site', width: 14 },
    { header: 'โครงการ', key: 'site_name', width: 28 },
    { header: 'รหัสพนักงาน', key: 'employee_code', width: 14 },
    { header: 'ชื่อ-สกุล', key: 'full_name', width: 26 },
    { header: 'ทีม', key: 'team', width: 16 },
    { header: 'วันที่ปฏิบัติงาน', key: 'ymd', width: 16 },
    { header: 'รหัสประเภทงาน', key: 'work_type_code', width: 16 },
    { header: 'ประเภทงาน', key: 'work_type_name', width: 30 },
    { header: 'สถานะการทำงาน', key: 'work_status', width: 16 },
    { header: 'แรงงาน-วัน', key: 'manday', width: 12 },
    { header: 'ชั่วโมง', key: 'hours', width: 10 },
  ];
  for (const r of rows) {
    ws.addRow({
      ...r, ymd: dateStr(r.ymd),
      // §8 numbers have to arrive as numbers, or the client cannot total them
      manday: Number(r.manday), hours: Number(r.hours),
    });
  }
  ws.getRow(1).font = { bold: true };
  ws.getColumn('manday').numFmt = '0.00';
  ws.getColumn('hours').numFmt = '0.00';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="manday-${ym}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}));

// ── §10 what still needs doing ────────────────────────────────────────────
/** Sites that have not recorded today, and days about to lock. A notification
 *  that disappears before it is acted on is worse than none, so this is derived
 *  from the data every time rather than stored and marked read. */
router.get('/alerts', asyncHandler(async (req, res) => {
  const scoped = scopedUnitIds(req.profile);
  const units = (scoped
    ? await query('select id, code, name, lock_days from units where id = any($1) and code is not null', [scoped])
    : await query('select id, code, name, lock_days from units where code is not null')).rows;
  const today = todayStr();
  const alerts = [];
  for (const u of units) {
    const lockDays = u.lock_days ?? 3;
    const headcount = Number((await queryOne('select count(*)::int n from employees where unit_id = $1 and is_active', [u.id]))?.n || 0);
    if (!headcount) continue;
    const todayRows = Number((await queryOne(
      'select count(*)::int n from work_logs where unit_id = $1 and ymd = $2 and deleted_at is null', [u.id, today]))?.n || 0);
    if (todayRows === 0) {
      alerts.push({ kind: 'not-recorded', site: u.code, siteName: u.name, date: today,
        message: `${u.name} ยังไม่บันทึกข้อมูลของวันนี้` });
    } else if (todayRows < headcount) {
      alerts.push({ kind: 'partial', site: u.code, siteName: u.name, date: today,
        message: `${u.name} บันทึกแล้ว ${todayRows} จาก ${headcount} คน` });
    }
    // the last day still editable — after this it locks on its own
    const edge = addDaysStr(today, -(lockDays - DUE_SOON_DAYS));
    const missing = Number((await queryOne(
      'select count(*)::int n from work_logs where unit_id = $1 and ymd = $2 and deleted_at is null', [u.id, edge]))?.n || 0);
    if (missing < headcount) {
      alerts.push({ kind: 'due-soon', site: u.code, siteName: u.name, date: edge,
        message: `ข้อมูลวันที่ ${edge} ของ ${u.name} จะถูกล็อกเร็ว ๆ นี้ (บันทึกแล้ว ${missing}/${headcount})` });
    }
  }
  res.json({ data: alerts });
}));

// ── §2 นำเข้าข้อมูลหลักจากไฟล์ Excel ──────────────────────────────────────
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

/** Read a sheet as objects keyed by the header row, trimmed. */
function sheetRows(ws) {
  const head = [];
  ws.getRow(1).eachCell((cell, i) => { head[i] = String(cell.value ?? '').trim(); });
  const out = [];
  for (let r = 2; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const obj = {}; let any = false;
    row.eachCell((cell, i) => {
      const key = head[i];
      if (!key) return;
      let v = cell.value;
      if (v && typeof v === 'object' && 'text' in v) v = v.text;
      if (v && typeof v === 'object' && 'result' in v) v = v.result;
      v = v == null ? '' : String(v).trim();
      obj[key] = v;
      if (v) any = true;
    });
    if (any) out.push({ _row: r, ...obj });
  }
  return out;
}
const pick = (o, ...names) => { for (const n of names) if (o[n] !== undefined && o[n] !== '') return o[n]; return ''; };

/**
 * §2 bring the employee register in from a spreadsheet, and say plainly which
 * rows did not make it and why. An import that silently drops rows is worse
 * than typing them by hand, so nothing is written unless the whole file parses,
 * and every rejection carries its row number.
 */
router.post('/import/employees', requirePermission('performance', 'edit'), importUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'ยังไม่ได้เลือกไฟล์');
    const dryRun = String(req.query.dryRun || req.body?.dryRun || '') === 'true';
    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.load(req.file.buffer); }
    catch { throw new ApiError(400, 'อ่านไฟล์ไม่สำเร็จ — ต้องเป็นไฟล์ Excel (.xlsx)'); }
    const ws = wb.worksheets[0];
    if (!ws) throw new ApiError(400, 'ไฟล์นี้ไม่มีชีตข้อมูล');

    const rows = sheetRows(ws);
    if (!rows.length) throw new ApiError(400, 'ไฟล์นี้ไม่มีข้อมูลใต้หัวตาราง');

    const scoped = scopedUnitIds(req.profile);
    const units = (await query('select id, code, name from units where code is not null')).rows;
    const bySiteCode = new Map(units.map((u) => [String(u.code).toLowerCase(), u]));
    const bySiteName = new Map(units.map((u) => [String(u.name).trim(), u]));
    const depts = (await query('select id, name from departments')).rows;
    const positions = (await query('select id, name from positions')).rows;
    const byDept = new Map(depts.map((d) => [d.name.trim(), d.id]));
    const byPos = new Map(positions.map((d) => [d.name.trim(), d.id]));

    const ok = []; const failed = [];
    const seenCodes = new Set();
    for (const r of rows) {
      const code = pick(r, 'รหัสพนักงาน', 'employee_code', 'code');
      const name = pick(r, 'ชื่อ-สกุล', 'ชื่อ', 'full_name', 'name');
      const siteRaw = pick(r, 'โครงการ', 'หน่วยงาน', 'ไซต์งาน', 'site', 'unit');
      const kindRaw = pick(r, 'ประเภท', 'สาย', 'kind') || 'operation';
      const deptName = pick(r, 'แผนก', 'department');
      const posName = pick(r, 'ตำแหน่ง', 'position');
      const activeRaw = pick(r, 'สถานะ', 'สถานะการจ้าง', 'is_active');

      const problems = [];
      if (!name) problems.push('ไม่มีชื่อ-สกุล');
      if (!siteRaw) problems.push('ไม่ได้ระบุโครงการ');
      const unit = bySiteCode.get(String(siteRaw).toLowerCase()) || bySiteName.get(String(siteRaw).trim());
      if (siteRaw && !unit) problems.push(`ไม่พบโครงการ "${siteRaw}"`);
      if (unit && scoped && !scoped.includes(unit.id)) problems.push('โครงการนี้อยู่นอกขอบเขตของท่าน');
      // §2 one person, one code — a duplicate would split their history in two
      if (code) {
        if (seenCodes.has(code)) problems.push('รหัสพนักงานซ้ำภายในไฟล์เดียวกัน');
        seenCodes.add(code);
        const clash = await queryOne('select id, unit_id from employees where employee_code = $1', [code]);
        if (clash && unit && clash.unit_id !== unit.id) problems.push('รหัสพนักงานนี้มีอยู่แล้วในโครงการอื่น');
      }
      const kind = /สนับ|support/i.test(kindRaw) ? 'support' : 'operation';
      const isActive = !/ลาออก|พ้นสภาพ|inactive|false|0/i.test(activeRaw || '');
      if (deptName && !byDept.has(deptName.trim())) problems.push(`ไม่พบแผนก "${deptName}"`);
      if (posName && !byPos.has(posName.trim())) problems.push(`ไม่พบตำแหน่ง "${posName}"`);

      if (problems.length) failed.push({ row: r._row, name, code, reason: problems.join(' · ') });
      else ok.push({ row: r._row, code: code || null, name, unitId: unit.id, kind, isActive,
        departmentId: deptName ? byDept.get(deptName.trim()) : null,
        positionId: posName ? byPos.get(posName.trim()) : null });
    }

    let imported = 0; let updated = 0;
    if (!dryRun) {
      for (const e of ok) {
        const existing = e.code ? await queryOne('select id from employees where employee_code = $1', [e.code]) : null;
        if (existing) {
          await query(
            `update employees set full_name = $2, unit_id = $3, kind = $4, is_active = $5,
                    department_id = coalesce($6, department_id), position_id = coalesce($7, position_id), updated_at = now()
              where id = $1`,
            [existing.id, e.name, e.unitId, e.kind, e.isActive, e.departmentId, e.positionId]);
          updated += 1;
        } else {
          await query(
            `insert into employees (unit_id, full_name, employee_code, kind, is_active, department_id, position_id)
             values ($1,$2,$3,$4,$5,$6,$7)`,
            [e.unitId, e.name, e.code, e.kind, e.isActive, e.departmentId, e.positionId]);
          imported += 1;
        }
      }
      await logWork({ actor: req.profile, action: 'import-employees',
        after: { imported, updated, failed: failed.length, file: req.file.originalname } });
    }
    res.json({ data: { dryRun, total: rows.length, imported, updated, failedCount: failed.length, failed, accepted: ok.length } });
  }));

/** §2 the template, so nobody has to guess the column names. */
router.get('/import/employees/template.xlsx', asyncHandler(async (req, res) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('พนักงาน');
  ws.columns = [
    { header: 'รหัสพนักงาน', key: 'code', width: 16 },
    { header: 'ชื่อ-สกุล', key: 'name', width: 28 },
    { header: 'โครงการ', key: 'site', width: 26 },
    { header: 'ประเภท', key: 'kind', width: 14 },
    { header: 'แผนก', key: 'dept', width: 18 },
    { header: 'ตำแหน่ง', key: 'pos', width: 18 },
    { header: 'สถานะ', key: 'status', width: 14 },
  ];
  const sample = (await query('select code, name from units where code is not null order by name limit 1')).rows[0];
  ws.addRow({ code: 'EMP-001', name: 'ตัวอย่าง ชื่อจริง', site: sample?.code || 'รหัสโครงการ',
    kind: 'ปฏิบัติการ', dept: 'ฝ่ายบุคคล', pos: '', status: 'ปฏิบัติงาน' });
  ws.getRow(1).font = { bold: true };
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="employee-import-template.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}));

// ── §3 บันทึกทั้งทีมในครั้งเดียว ──────────────────────────────────────────
const bulkSchema = z.object({
  site: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employeeIds: z.array(z.string().uuid()).min(1).max(300),
  manDay: z.number().min(0).max(1).optional().nullable(),
  workStatus: z.enum(['ปกติ', 'ล่วงเวลา', 'Standby', 'ลา', 'ขาดงาน']).optional().nullable(),
  team: z.string().optional().nullable(),
  adminUnlock: z.boolean().optional(),
  reason: z.string().optional(),
  // §3 the same batch sent twice must not double-count; the client sends one id
  // per press and a replay lands on the same rows
  batchId: z.string().max(80).optional(),
});

/**
 * §3 keying a whole team at once. The site foreman has thirty people who all
 * did a normal day; making them type thirty identical cells is how days go
 * unrecorded. Each person is still a row of their own, so everything downstream
 * — verification, audit, reports — is unchanged.
 */
router.post('/bulk', requirePermission('performance', 'edit'), asyncHandler(async (req, res) => {
  const p = bulkSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const d = p.data;
  const unit = await loadUnitByKey(d.site);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  assertUnitInScope(scopedUnitIds(req.profile), unit.id);
  if (d.date > addDaysStr(todayStr(), 1)) throw new ApiError(400, 'บันทึกล่วงหน้าเกินวันพรุ่งนี้ไม่ได้');

  const lockDays = unit.lock_days ?? 3;
  const closed = await closedMonthsFor(unit.id);
  if (closed.has(d.date.slice(0, 7))) throw new ApiError(409, 'เดือนนี้ปิดงวดแล้ว แก้ไขข้อมูลไม่ได้');
  const canUnlock = req.profile.role === 'admin' && d.adminUnlock;
  if (isLocked(d.date, lockDays) && !canUnlock) throw new ApiError(409, 'วันที่นี้เลยกำหนดแก้ไขแล้ว');
  if (isLocked(d.date, lockDays) && canUnlock && !(d.reason || '').trim()) {
    throw new ApiError(400, 'การแก้ไขข้อมูลที่ล็อกแล้วต้องระบุเหตุผล');
  }

  const emps = (await query(
    'select id, kind, is_active from employees where id = any($1) and unit_id = $2', [d.employeeIds, unit.id])).rows;
  const byId = new Map(emps.map((e) => [e.id, e]));
  const saved = []; const skipped = [];
  for (const eid of d.employeeIds) {
    const e = byId.get(eid);
    if (!e) { skipped.push({ id: eid, reason: 'ไม่ได้อยู่ในไซต์นี้' }); continue; }
    if (e.is_active === false) { skipped.push({ id: eid, reason: 'พ้นสภาพแล้ว' }); continue; }
    const existing = await queryOne(
      'select id, team, detail, pm, man_day, hours, work_status, verified_at from work_logs where employee_id = $1 and ymd = $2 and deleted_at is null',
      [eid, d.date]);
    if (existing?.verified_at && !canUnlock) { skipped.push({ id: eid, reason: 'ยืนยันแล้ว' }); continue; }
    const hours = d.manDay != null ? Number((d.manDay * HOURS_PER_DAY).toFixed(2)) : null;
    const row = await queryOne(
      `insert into work_logs (employee_id, unit_id, ymd, kind, team, man_day, hours, work_status, status, updated_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'',$9)
       on conflict (employee_id, ymd) do update set
         team = coalesce(excluded.team, work_logs.team),
         man_day = excluded.man_day, hours = excluded.hours, work_status = excluded.work_status,
         deleted_at = null, deleted_by = null, updated_by = excluded.updated_by, updated_at = now()
       returning *`,
      [eid, unit.id, d.date, e.kind, d.team || null, d.manDay ?? null, hours, d.workStatus ?? null, req.profile.id]);
    await logWork({ actor: req.profile, workLogId: row.id, employeeId: eid, unitId: unit.id, ymd: d.date,
      action: existing ? 'edit' : 'create', before: existing ? workFields(existing) : null,
      after: { ...workFields(row), batch: d.batchId || null }, reason: d.reason || 'บันทึกทั้งทีม' });
    saved.push(eid);
  }
  res.json({ data: { ok: true, saved: saved.length, skipped, batchId: d.batchId || null } });
}));

// ── §8 รายงานเป็น PDF ─────────────────────────────────────────────────────
const GROUP_TH = { project: 'รายโครงการ', team: 'รายทีม', worktype: 'รายประเภทงาน', employee: 'รายพนักงาน' };
router.get('/report/manday.pdf', asyncHandler(async (req, res) => {
  const from = req.query.from, to = req.query.to;
  if (!from || !to) throw new ApiError(400, 'ต้องระบุช่วงวันที่ (from, to)');
  const groupBy = Object.keys(GROUP_TH).includes(req.query.groupBy) ? req.query.groupBy : 'project';
  const scoped = scopedUnitIds(req.profile);
  const params = [from, to]; const where = ['w.ymd >= $1', 'w.ymd <= $2', 'w.deleted_at is null'];
  if (scoped) { params.push(scoped); where.push(`w.unit_id = any($${params.length}::uuid[])`); }
  const W = `where ${where.join(' and ')}`;
  const md = 'coalesce(w.man_day, 1)';
  const SQL = {
    project:  `select u.code key, u.name label, sum(${md})::numeric manday, count(distinct w.employee_id)::int people
                 from work_logs w join units u on u.id = w.unit_id ${W} group by 1,2 order by 3 desc`,
    team:     `select coalesce(w.team,'-') key, coalesce(w.team,'(ไม่ระบุทีม)') label, sum(${md})::numeric manday,
                      count(distinct w.employee_id)::int people from work_logs w ${W} group by 1,2 order by 3 desc`,
    worktype: `select coalesce(l.work_type_code,'-') key, coalesce(l.work_type_name, w.detail, w.team, '(ไม่ระบุงาน)') label,
                      sum(coalesce(l.man_day, ${md}))::numeric manday, count(distinct w.employee_id)::int people
                 from work_logs w left join work_log_lines l on l.work_log_id = w.id ${W} group by 1,2 order by 3 desc`,
    employee: `select e.employee_code key, e.full_name label, sum(${md})::numeric manday, count(*)::int people
                 from work_logs w join employees e on e.id = w.employee_id ${W} group by 1,2 order by 3 desc`,
  }[groupBy];
  const { rows } = await query(SQL, params);
  const totals = rows.reduce((a, r) => ({ manday: a.manday + Number(r.manday || 0), people: a.people + Number(r.people || 0) }), { manday: 0, people: 0 });
  const pdf = await buildMandayReportPdf({
    title: 'รายงานแรงงาน-วัน (Man-day Report)',
    groupLabel: GROUP_TH[groupBy],
    meta: reportMeta(req, from, to),
    rows: rows.map((r) => ({ ...r, manday: Number(r.manday || 0) })),
    totals,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="manday-${groupBy}-${from}_${to}.pdf"`);
  res.end(pdf);
}));

// ── §11 ไฟล์ประกอบการบันทึก ───────────────────────────────────────────────
router.post('/attachments', requirePermission('performance', 'edit'), fileUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'ยังไม่ได้เลือกไฟล์');
    const site = req.body.site, eid = req.body.employeeId, date = req.body.date;
    if (!site || !eid || !date) throw new ApiError(400, 'ต้องระบุ site, employeeId และ date');
    const unit = await loadUnitByKey(site);
    if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
    assertUnitInScope(scopedUnitIds(req.profile), unit.id);
    const log = await queryOne('select id from work_logs where employee_id = $1 and ymd = $2 and deleted_at is null', [eid, date]);
    // multipart filenames arrive latin1-decoded; Thai names come back as mojibake
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const key = `worklog/${unit.id}/${date}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await putObject(key, req.file.buffer, req.file.mimetype || 'application/octet-stream');
    const row = await queryOne(
      `insert into work_log_attachments (work_log_id, unit_id, employee_id, ymd, file_name, content_type, size_bytes, storage_key, uploaded_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [log?.id || null, unit.id, eid, date, fileName, req.file.mimetype, req.file.size, key, req.profile.id]);
    await logWork({ actor: req.profile, workLogId: log?.id, employeeId: eid, unitId: unit.id, ymd: date,
      action: 'attach', after: { file: fileName } });
    res.status(201).json({ data: row });
  }));

router.get('/attachments', asyncHandler(async (req, res) => {
  const { site, employeeId, date } = req.query;
  if (!site) throw new ApiError(400, 'ต้องระบุไซต์งาน');
  const unit = await loadUnitByKey(site);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  assertUnitInScope(scopedUnitIds(req.profile), unit.id);
  const params = [unit.id]; const where = ['unit_id = $1'];
  if (employeeId) { params.push(employeeId); where.push(`employee_id = $${params.length}`); }
  if (date) { params.push(date); where.push(`ymd = $${params.length}`); }
  const { rows } = await query(`select * from work_log_attachments where ${where.join(' and ')} order by created_at desc`, params);
  res.json({ data: rows });
}));

router.get('/attachments/:id/file', asyncHandler(async (req, res) => {
  const row = await queryOne('select * from work_log_attachments where id = $1', [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบไฟล์นี้');
  assertUnitInScope(scopedUnitIds(req.profile), row.unit_id);
  // openDownloadStream hands back { stream, contentType, length } — not the
  // stream itself; piping the wrapper is a 500 with a very unhelpful message
  const obj = await openDownloadStream(row.storage_key);
  if (!obj?.stream) throw new ApiError(404, 'ไม่พบไฟล์ในที่จัดเก็บ');
  res.setHeader('Content-Type', row.content_type || obj.contentType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`);
  if (obj.length != null) res.setHeader('Content-Length', obj.length);
  obj.stream.pipe(res);
}));

router.delete('/attachments/:id', requirePermission('performance', 'edit'), asyncHandler(async (req, res) => {
  const row = await queryOne('select * from work_log_attachments where id = $1', [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบไฟล์นี้');
  assertUnitInScope(scopedUnitIds(req.profile), row.unit_id);
  await deleteObject(row.storage_key).catch(() => {});
  await query('delete from work_log_attachments where id = $1', [req.params.id]);
  await logWork({ actor: req.profile, unitId: row.unit_id, employeeId: row.employee_id, ymd: row.ymd,
    action: 'detach', before: { file: row.file_name } });
  res.json({ data: { deleted: true } });
}));

// ── §2 ทะเบียนแผนกและตำแหน่ง ──────────────────────────────────────────────
// A department belongs to a site; a position belongs to a department. Neither
// is ever deleted once used — §2 wants a change to apply going forward without
// rewriting what is already filed, so retiring is a switch, not a removal.

router.get('/departments', asyncHandler(async (req, res) => {
  const scoped = scopedUnitIds(req.profile);
  const params = []; const where = [];
  if (req.query.site) {
    const unit = await loadUnitByKey(req.query.site);
    if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
    assertUnitInScope(scoped, unit.id);
    params.push(unit.id); where.push(`d.unit_id = $${params.length}`);
  } else if (scoped) {
    params.push(scoped); where.push(`d.unit_id = any($${params.length}::uuid[])`);
  }
  if (!req.query.all) where.push('d.is_active');
  const { rows } = await query(
    `select d.*, u.code site, u.name site_name,
            (select count(*)::int from positions p where p.department_id = d.id and p.is_active) positions,
            (select count(*)::int from employees e where e.department_id = d.id and e.is_active) people
       from departments d join units u on u.id = d.unit_id
       ${where.length ? 'where ' + where.join(' and ') : ''}
      order by u.name, d.name`, params);
  res.json({ data: rows });
}));

const deptSchema = z.object({ site: z.string().min(1), name: z.string().trim().min(1).max(120) });
router.post('/departments', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = deptSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const unit = await loadUnitByKey(p.data.site);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  const dup = await queryOne('select id, is_active from departments where unit_id = $1 and name = $2', [unit.id, p.data.name]);
  if (dup?.is_active) throw new ApiError(409, 'ไซต์งานนี้มีแผนกชื่อนี้อยู่แล้ว');
  const row = dup
    ? await queryOne('update departments set is_active = true, updated_at = now() where id = $1 returning *', [dup.id])
    : await queryOne('insert into departments (unit_id, name) values ($1,$2) returning *', [unit.id, p.data.name]);
  await logWork({ actor: req.profile, unitId: unit.id, action: 'department-create', after: { name: row.name } });
  res.status(201).json({ data: row });
}));

router.patch('/departments/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = z.object({ name: z.string().trim().min(1).max(120).optional(), isActive: z.boolean().optional() }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const before = await queryOne('select * from departments where id = $1', [req.params.id]);
  if (!before) throw new ApiError(404, 'ไม่พบแผนกนี้');
  if (p.data.name && p.data.name !== before.name) {
    const clash = await queryOne('select id from departments where unit_id = $1 and name = $2 and id <> $3',
      [before.unit_id, p.data.name, before.id]);
    if (clash) throw new ApiError(409, 'ไซต์งานนี้มีแผนกชื่อนี้อยู่แล้ว');
  }
  const sets = []; const vals = [];
  if (p.data.name !== undefined) { vals.push(p.data.name); sets.push(`name = $${vals.length}`); }
  if (p.data.isActive !== undefined) { vals.push(p.data.isActive); sets.push(`is_active = $${vals.length}`); }
  if (!sets.length) throw new ApiError(400, 'ไม่มีข้อมูลที่เปลี่ยนแปลง');
  vals.push(req.params.id);
  const after = await queryOne(`update departments set ${sets.join(', ')}, updated_at = now() where id = $${vals.length} returning *`, vals);
  // retiring a department retires what hangs off it, or the position picker
  // would keep offering roles in a department that no longer exists
  if (p.data.isActive === false) await query('update positions set is_active = false, updated_at = now() where department_id = $1', [after.id]);
  await logWork({ actor: req.profile, unitId: after.unit_id, action: 'department-update',
    before: { name: before.name, isActive: before.is_active }, after: { name: after.name, isActive: after.is_active } });
  res.json({ data: after });
}));

router.delete('/departments/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const row = await queryOne('select * from departments where id = $1', [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบแผนกนี้');
  const used = await queryOne('select count(*)::int n from employees where department_id = $1', [row.id]);
  // §2 a change must not rewrite what is already filed — once people are
  // recorded under a department, it can only be retired
  if (used.n > 0) throw new ApiError(409, `แผนกนี้มีพนักงานผูกอยู่ ${used.n} คน — ปิดใช้งานได้ แต่ลบไม่ได้`);
  await query('delete from positions where department_id = $1', [row.id]);
  await query('delete from departments where id = $1', [row.id]);
  await logWork({ actor: req.profile, unitId: row.unit_id, action: 'department-delete', before: { name: row.name } });
  res.json({ data: { deleted: true } });
}));

router.get('/positions', asyncHandler(async (req, res) => {
  const params = []; const where = [];
  if (req.query.departmentId) { params.push(req.query.departmentId); where.push(`p.department_id = $${params.length}`); }
  const scoped = scopedUnitIds(req.profile);
  if (scoped) { params.push(scoped); where.push(`d.unit_id = any($${params.length}::uuid[])`); }
  if (!req.query.all) where.push('p.is_active');
  const { rows } = await query(
    `select p.*, d.name department_name, d.unit_id,
            (select count(*)::int from employees e where e.position_id = p.id and e.is_active) people
       from positions p join departments d on d.id = p.department_id
       ${where.length ? 'where ' + where.join(' and ') : ''}
      order by d.name, p.name`, params);
  res.json({ data: rows });
}));

const posSchema = z.object({ departmentId: z.string().uuid(), name: z.string().trim().min(1).max(120) });
router.post('/positions', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = posSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const dept = await queryOne('select * from departments where id = $1', [p.data.departmentId]);
  if (!dept) throw new ApiError(404, 'ไม่พบแผนกนี้');
  const dup = await queryOne('select id, is_active from positions where department_id = $1 and name = $2', [dept.id, p.data.name]);
  if (dup?.is_active) throw new ApiError(409, 'แผนกนี้มีตำแหน่งชื่อนี้อยู่แล้ว');
  const row = dup
    ? await queryOne('update positions set is_active = true, updated_at = now() where id = $1 returning *', [dup.id])
    : await queryOne('insert into positions (department_id, name) values ($1,$2) returning *', [dept.id, p.data.name]);
  await logWork({ actor: req.profile, unitId: dept.unit_id, action: 'position-create', after: { name: row.name, department: dept.name } });
  res.status(201).json({ data: row });
}));

router.patch('/positions/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const p = z.object({ name: z.string().trim().min(1).max(120).optional(), isActive: z.boolean().optional() }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const before = await queryOne('select * from positions where id = $1', [req.params.id]);
  if (!before) throw new ApiError(404, 'ไม่พบตำแหน่งนี้');
  if (p.data.name && p.data.name !== before.name) {
    const clash = await queryOne('select id from positions where department_id = $1 and name = $2 and id <> $3',
      [before.department_id, p.data.name, before.id]);
    if (clash) throw new ApiError(409, 'แผนกนี้มีตำแหน่งชื่อนี้อยู่แล้ว');
  }
  const sets = []; const vals = [];
  if (p.data.name !== undefined) { vals.push(p.data.name); sets.push(`name = $${vals.length}`); }
  if (p.data.isActive !== undefined) { vals.push(p.data.isActive); sets.push(`is_active = $${vals.length}`); }
  if (!sets.length) throw new ApiError(400, 'ไม่มีข้อมูลที่เปลี่ยนแปลง');
  vals.push(req.params.id);
  const after = await queryOne(`update positions set ${sets.join(', ')}, updated_at = now() where id = $${vals.length} returning *`, vals);
  await logWork({ actor: req.profile, action: 'position-update',
    before: { name: before.name, isActive: before.is_active }, after: { name: after.name, isActive: after.is_active } });
  res.json({ data: after });
}));

router.delete('/positions/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const row = await queryOne('select * from positions where id = $1', [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบตำแหน่งนี้');
  const used = await queryOne('select count(*)::int n from employees where position_id = $1', [row.id]);
  if (used.n > 0) throw new ApiError(409, `ตำแหน่งนี้มีพนักงานผูกอยู่ ${used.n} คน — ปิดใช้งานได้ แต่ลบไม่ได้`);
  await query('delete from positions where id = $1', [row.id]);
  await logWork({ actor: req.profile, action: 'position-delete', before: { name: row.name } });
  res.json({ data: { deleted: true } });
}));

export default router;
