import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { query, queryOne } from '../config/db.js';
import { requireAuth, requireRole, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';

// =============================================================================
// Module 2 — daily work-ACTIVITY log (hr-worklog). API mirrors the reference
// app's server contract: bootstrap / site-month / admin-summary / cell save,
// plus activity + cost-category catalogs. A cell is team (operation composite
// "A-1 / 5") | detail (support free text) | pm (optional 2nd task). No OT.
// =============================================================================

const router = Router();
router.use(requireAuth);

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
  if (ids.length) {
    // real month bounds — a literal `${month}-31` is an invalid date for 30/28-day
    // months and makes the whole query 500.
    const [mY, mM] = month ? month.split('-').map(Number) : [];
    const from = month ? `${month}-01` : null;
    const to = month ? `${month}-${pad(daysInMonthN(mY, mM))}` : null;
    const rows = month
      ? (await query('select employee_id, ymd from employee_away where employee_id = any($1) and ymd >= $2 and ymd <= $3', [ids, from, to])).rows
      : (await query('select employee_id, ymd from employee_away where employee_id = any($1)', [ids])).rows;
    for (const r of rows) (awayBy[r.employee_id] ||= []).push(dateStr(r.ymd));
  }
  return emps.map((e) => ({
    eid: e.id, name: e.full_name, emp_id: e.employee_code || '',
    department: e.department_name || '', position: e.position_name || '',
    kind: e.kind, team: e.team || '', away: awayBy[e.id] || [],
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
});
router.post('/employees', requirePermission('performance', 'edit'), asyncHandler(async (req, res) => {
  const p = employeeSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  const unit = await loadUnitByKey(p.data.site);
  if (!unit) throw new ApiError(404, 'ไม่พบไซต์งาน');
  assertUnitInScope(scopedUnitIds(req.profile), unit.id);
  const row = await queryOne(
    `insert into employees (unit_id, full_name, employee_code, kind, is_active) values ($1,$2,$3,$4,true) returning id`,
    [unit.id, p.data.fullName, p.data.employeeCode || null, p.data.kind]
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
  const p = z.object({ fullName: z.string().optional(), employeeCode: z.string().optional().nullable(), kind: z.enum(['operation', 'support']).optional(), isActive: z.boolean().optional() }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'Invalid input', p.error.flatten());
  await assertEmployeeScoped(req.profile, req.params.id); // #B: no cross-unit writes
  const map = { fullName: 'full_name', employeeCode: 'employee_code', kind: 'kind', isActive: 'is_active' };
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
  const logs = (await query('select employee_id, ymd, team, detail, pm from work_logs where unit_id = $1 and ymd >= $2 and ymd <= $3', [unit.id, ymd(Y, M, 1), ymd(Y, M, dim)])).rows;
  const entries = {};
  for (const l of logs) {
    const ds = dateStr(l.ymd);
    const cell = {};
    if (l.team) cell.team = l.team;
    if (l.detail) cell.detail = l.detail;
    if (l.pm) cell.pm = l.pm;
    if (Object.keys(cell).length) (entries[l.employee_id] ||= {})[ds] = cell;
  }
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

  const lockDays = unit.lock_days ?? 3;
  const canUnlock = req.profile.role === 'admin' && adminUnlock;
  if (isLocked(date, lockDays) && !canUnlock) throw new ApiError(409, 'วันที่นี้เลยกำหนดแก้ไขแล้ว (ผู้ดูแลระบบปลดล็อกได้)');

  const existing = await queryOne('select team, detail, pm from work_logs where employee_id = $1 and ymd = $2', [eid, date]);
  const next = { team: existing?.team || null, detail: existing?.detail || null, pm: existing?.pm || null };
  next[field] = value && value.trim() ? value.trim() : null;

  if (!next.team && !next.detail && !next.pm) {
    await query('delete from work_logs where employee_id = $1 and ymd = $2', [eid, date]);
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
  res.json({ data: { ok: true } });
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

export default router;
