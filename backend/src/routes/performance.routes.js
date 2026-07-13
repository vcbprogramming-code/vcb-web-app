import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { query, queryOne } from '../config/db.js';
import { requireAuth, requireRole, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

const EMPLOYEE_KINDS = ['operation', 'support'];

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
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
function isLocked(ymdStr, lockDays) {
  if (!lockDays || lockDays <= 0) return false;
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [Y, M, D] = ymdStr.split('-').map(Number);
  const diff = Math.round((t - new Date(Y, M - 1, D)) / 86400000);
  return diff > lockDays;
}
const unitOut = (u) => ({ id: u.id, name: u.name, code: u.code, company: u.company, color: u.color, lock_days: u.lock_days });
const empOut = (e) => ({ id: e.id, full_name: e.full_name, employee_code: e.employee_code, unit_id: e.unit_id, kind: e.kind, team: e.team, is_active: e.is_active });
// Format a pg `date` (parsed to LOCAL midnight) by its local calendar parts.
// Using toISOString() here would shift the day on any server with a +UTC offset
// (e.g. Asia/Bangkok), breaking coverage/export key matching against ymd().
const dateStr = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
};
const logOut = (l) => ({
  id: l.id, employee_id: l.employee_id, ymd: dateStr(l.ymd), kind: l.kind, team: l.team,
  work_type_id: l.work_type_id, work_type_name: l.work_type_name,
  ot_hours: l.ot_hours != null ? Number(l.ot_hours) : null, ot_rate: l.ot_rate != null ? Number(l.ot_rate) : null,
  ot_amount: l.ot_amount != null ? Number(l.ot_amount) : null, reason: l.reason,
  detail: l.detail, note: l.note, status: l.status || '',
});

// ── sites + dashboard ──────────────────────────────────────────────────────
router.get('/sites', asyncHandler(async (req, res) => {
  const scoped = scopedUnitIds(req.profile);
  const { rows } = scoped
    ? await query('select * from units where id = any($1) order by name', [scoped])
    : await query('select * from units order by name');
  res.json({ data: rows.map(unitOut) });
}));

router.get('/dashboard', asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const [Y, M] = month.split('-').map(Number);
  const dim = daysInMonth(Y, M);
  const today = new Date();
  const lastDay = (Y === today.getFullYear() && M === today.getMonth() + 1) ? today.getDate() : dim;
  const scoped = scopedUnitIds(req.profile);

  const units = (scoped
    ? await query('select * from units where id = any($1) order by name', [scoped])
    : await query('select * from units order by name')).rows;

  const empAgg = (await query(
    `select unit_id, count(*)::int total, count(*) filter (where kind='operation')::int op
       from employees where is_active = true ${scoped ? 'and unit_id = any($1)' : ''} group by unit_id`,
    scoped ? [scoped] : []
  )).rows;
  const logAgg = (await query(
    `select unit_id, count(*)::int filled from work_logs
       where ymd >= $1 and ymd <= $2 ${scoped ? 'and unit_id = any($3)' : ''} group by unit_id`,
    scoped ? [ymd(Y, M, 1), ymd(Y, M, lastDay), scoped] : [ymd(Y, M, 1), ymd(Y, M, lastDay)]
  )).rows;

  const empBy = Object.fromEntries(empAgg.map((e) => [e.unit_id, e]));
  const filledBy = Object.fromEntries(logAgg.map((l) => [l.unit_id, l.filled]));
  const cards = units.map((u) => {
    const e = empBy[u.id] || { total: 0, op: 0 };
    const expected = e.total * lastDay;
    const filled = filledBy[u.id] || 0;
    return { ...unitOut(u), employees: e.total, op_count: e.op, sup_count: e.total - e.op,
      filled, expected, pct: expected ? Math.round((filled / expected) * 100) : 0 };
  });
  res.json({ data: { month, cards } });
}));

// ── employees ────────────────────────────────────────────────────────────
router.get('/employees', asyncHandler(async (req, res) => {
  const { unitId } = req.query;
  if (!unitId) throw new ApiError(400, 'unitId is required');
  assertUnitInScope(scopedUnitIds(req.profile), unitId);
  const { rows } = await query('select * from employees where unit_id = $1 order by kind, full_name', [unitId]);
  res.json({ data: rows.map(empOut) });
}));

const employeeSchema = z.object({
  unitId: z.string().uuid(), fullName: z.string().min(1),
  employeeCode: z.string().optional().nullable(), kind: z.enum(EMPLOYEE_KINDS),
  team: z.string().optional().nullable(),
});
router.post('/employees', requirePermission('performance', 'edit'), asyncHandler(async (req, res) => {
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  assertUnitInScope(scopedUnitIds(req.profile), parsed.data.unitId);
  const d = parsed.data;
  const row = await queryOne(
    `insert into employees (unit_id, full_name, employee_code, kind, team, is_active)
     values ($1,$2,$3,$4,$5,true) returning *`,
    [d.unitId, d.fullName, d.employeeCode || null, d.kind, d.team || null]
  );
  res.status(201).json({ data: empOut(row) });
}));
router.patch('/employees/:id', requirePermission('performance', 'edit'), asyncHandler(async (req, res) => {
  const parsed = employeeSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const f = parsed.data;
  const map = { fullName: 'full_name', employeeCode: 'employee_code', kind: 'kind', team: 'team', isActive: 'is_active' };
  const sets = []; const vals = [];
  for (const [k, col] of Object.entries(map)) if (f[k] !== undefined) { vals.push(f[k]); sets.push(`${col} = $${vals.length}`); }
  if (!sets.length) throw new ApiError(400, 'No fields to update');
  vals.push(req.params.id);
  const row = await queryOne(`update employees set ${sets.join(', ')} where id = $${vals.length} returning *`, vals);
  if (!row) throw new ApiError(404, 'Employee not found');
  res.json({ data: empOut(row) });
}));

// ── work-type master index ──────────────────────────────────────────────
router.get('/work-types', asyncHandler(async (req, res) => {
  const { rows } = await query('select id, code, name, description, category from work_types where is_active = true order by category, sort_order, name');
  res.json({ data: rows });
}));
router.post('/work-types', requireRole('admin'), asyncHandler(async (req, res) => {
  const parsed = z.object({ code: z.string().optional().nullable(), name: z.string().min(1),
    description: z.string().optional().nullable(), category: z.string().optional(), sortOrder: z.number().int().optional() }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
  const d = parsed.data;
  const row = await queryOne(
    `insert into work_types (code, name, description, category, sort_order)
     values ($1,$2,$3,$4,$5) returning id, code, name, description, category`,
    [d.code || null, d.name, d.description || null, d.category || 'ทั่วไป', d.sortOrder ?? 0]
  );
  res.status(201).json({ data: row });
}));

// ── grid load + save ──────────────────────────────────────────────────────
router.get('/grid', asyncHandler(async (req, res) => {
  const { unitId } = req.query;
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (!unitId) throw new ApiError(400, 'unitId is required');
  assertUnitInScope(scopedUnitIds(req.profile), unitId);
  const unit = await queryOne('select * from units where id = $1', [unitId]);
  if (!unit) throw new ApiError(404, 'Site not found');
  const lockDays = unit.lock_days ?? 3;
  const [Y, M] = month.split('-').map(Number);
  const dim = daysInMonth(Y, M);
  const today = new Date();
  const todayYmd = ymd(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const days = [];
  for (let d = 1; d <= dim; d++) {
    const ds = ymd(Y, M, d);
    const dow = new Date(Y, M - 1, d).getDay();
    days.push({ ymd: ds, day: d, weekend: dow === 0 || dow === 6, today: ds === todayYmd, future: ds > todayYmd, locked: isLocked(ds, lockDays) });
  }
  const employees = (await query('select * from employees where unit_id = $1 and is_active = true order by kind, full_name', [unitId])).rows;
  const logs = (await query('select * from work_logs where unit_id = $1 and ymd >= $2 and ymd <= $3', [unitId, ymd(Y, M, 1), ymd(Y, M, dim)])).rows;
  res.json({ data: { month, unit: unitOut(unit), days, employees: employees.map(empOut), logs: logs.map(logOut) } });
}));

const cellSchema = z.object({
  employeeId: z.string().uuid(), ymd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), kind: z.enum(EMPLOYEE_KINDS),
  team: z.string().optional().nullable(), workTypeId: z.string().uuid().optional().nullable(),
  workTypeName: z.string().optional().nullable(), otHours: z.number().optional().nullable(),
  otRate: z.number().optional().nullable(), otAmount: z.number().optional().nullable(),
  reason: z.string().optional().nullable(), detail: z.string().optional().nullable(),
  note: z.string().optional().nullable(), status: z.enum(['', 'leave', 'off']).optional(),
});
router.post('/grid/save', requirePermission('performance', 'edit'), asyncHandler(async (req, res) => {
  const body = z.object({ unitId: z.string().uuid(), cells: z.array(cellSchema).min(1).max(500), adminUnlock: z.boolean().optional() }).safeParse(req.body);
  if (!body.success) throw new ApiError(400, 'Invalid input', body.error.flatten());
  const { unitId, cells, adminUnlock } = body.data;
  assertUnitInScope(scopedUnitIds(req.profile), unitId);
  const unit = await queryOne('select lock_days from units where id = $1', [unitId]);
  if (!unit) throw new ApiError(404, 'Site not found');
  const lockDays = unit.lock_days ?? 3;
  const canUnlock = req.profile.role === 'admin' && adminUnlock;

  // guard: every cell's employee must belong to this unit, otherwise a user
  // scoped to unit A could overwrite unit B's logs by passing a foreign employeeId
  // (work_logs.unique(employee_id, ymd) ignores unit_id on conflict).
  const empIds = [...new Set(cells.map((c) => c.employeeId))];
  const { rows: unitEmps } = await query('select id from employees where unit_id = $1 and id = any($2::uuid[])', [unitId, empIds]);
  const allowedEmp = new Set(unitEmps.map((e) => e.id));
  for (const c of cells) {
    if (!allowedEmp.has(c.employeeId)) throw new ApiError(400, 'พบพนักงานที่ไม่ได้อยู่ในไซต์นี้');
  }

  const saved = [];
  for (const c of cells) {
    if (isLocked(c.ymd, lockDays) && !canUnlock) continue;
    const otAmount = c.otAmount != null ? c.otAmount : (c.otHours != null && c.otRate != null ? c.otHours * c.otRate : null);
    const row = await queryOne(
      `insert into work_logs
         (employee_id, unit_id, ymd, kind, team, work_type_id, work_type_name, ot_hours, ot_rate, ot_amount, reason, detail, note, status, updated_by)
       values ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       on conflict (employee_id, ymd) do update set
         kind=excluded.kind, team=excluded.team, work_type_id=excluded.work_type_id, work_type_name=excluded.work_type_name,
         ot_hours=excluded.ot_hours, ot_rate=excluded.ot_rate, ot_amount=excluded.ot_amount, reason=excluded.reason,
         detail=excluded.detail, note=excluded.note, status=excluded.status, updated_by=excluded.updated_by, updated_at=now()
       returning *`,
      [c.employeeId, unitId, c.ymd, c.kind, c.team ?? null, c.workTypeId || null, c.workTypeName ?? null,
       c.otHours ?? null, c.otRate ?? null, otAmount, c.reason ?? null, c.detail ?? null, c.note ?? null, c.status ?? '', req.profile.id]
    );
    saved.push(logOut(row));
  }
  res.json({ data: { saved, count: saved.length } });
}));

// ── coverage ──────────────────────────────────────────────────────────────
router.get('/coverage', asyncHandler(async (req, res) => {
  const { unitId } = req.query;
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (!unitId) throw new ApiError(400, 'unitId is required');
  assertUnitInScope(scopedUnitIds(req.profile), unitId);
  const [Y, M] = month.split('-').map(Number);
  const dim = daysInMonth(Y, M);
  const today = new Date();
  const todayYmd = ymd(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const employees = (await query('select * from employees where unit_id = $1 and is_active = true order by kind, full_name', [unitId])).rows;
  const logs = (await query('select * from work_logs where unit_id = $1 and ymd >= $2 and ymd <= $3', [unitId, ymd(Y, M, 1), ymd(Y, M, dim)])).rows;
  const byKey = new Map(logs.map((l) => [`${l.employee_id}_${dateStr(l.ymd)}`, l]));

  const cellStatus = (emp, ds, dow) => {
    if (ds > todayYmd) return 'future';
    const log = byKey.get(`${emp.id}_${ds}`);
    if (log) {
      if (log.status === 'leave') return 'leave';
      if (log.status === 'off') return 'off';
      const has = log.kind === 'operation' ? (log.work_type_name || log.ot_hours != null || log.team) : (log.detail || log.note);
      return has ? 'filled' : 'missed';
    }
    if (dow === 0 || dow === 6) return 'off';
    return 'missed';
  };
  const rows = employees.map((emp) => {
    const cells = [];
    for (let d = 1; d <= dim; d++) {
      const ds = ymd(Y, M, d);
      cells.push({ ymd: ds, status: cellStatus(emp, ds, new Date(Y, M - 1, d).getDay()) });
    }
    return { employee: empOut(emp), cells };
  });
  const days = [];
  for (let d = 1; d <= dim; d++) {
    const ds = ymd(Y, M, d);
    if (ds > todayYmd) { days.push({ ymd: ds, pct: null }); continue; }
    let exp = 0, ok = 0;
    for (const r of rows) {
      const c = r.cells[d - 1];
      if (c.status === 'off' || c.status === 'future') continue;
      exp++;
      if (c.status === 'filled' || c.status === 'leave') ok++;
    }
    days.push({ ymd: ds, pct: exp ? Math.round((ok / exp) * 100) : null });
  }
  res.json({ data: { month, days, rows } });
}));

// ── export xlsx ───────────────────────────────────────────────────────────
router.get('/export', asyncHandler(async (req, res) => {
  const { unitId } = req.query;
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (!unitId) throw new ApiError(400, 'unitId is required');
  assertUnitInScope(scopedUnitIds(req.profile), unitId);
  const unit = await queryOne('select * from units where id = $1', [unitId]);
  const [Y, M] = month.split('-').map(Number);
  const dim = daysInMonth(Y, M);
  const employees = (await query('select * from employees where unit_id = $1 and is_active = true order by kind, full_name', [unitId])).rows;
  const logs = (await query('select * from work_logs where unit_id = $1 and ymd >= $2 and ymd <= $3', [unitId, ymd(Y, M, 1), ymd(Y, M, dim)])).rows;
  const byKey = new Map(logs.map((l) => [`${l.employee_id}_${dateStr(l.ymd)}`, l]));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${unit?.name || 'site'} ${month}`);
  const header = ['พนักงาน', 'ประเภท'];
  for (let d = 1; d <= dim; d++) header.push(String(d));
  ws.addRow(header);
  for (const e of employees) {
    const row = [e.full_name, e.kind === 'operation' ? 'ปฏิบัติการ' : 'สนับสนุน'];
    for (let d = 1; d <= dim; d++) {
      const l = byKey.get(`${e.id}_${ymd(Y, M, d)}`);
      let v = '';
      if (l) {
        if (l.status === 'leave') v = 'ลา';
        else if (l.status === 'off') v = 'พัก';
        else if (e.kind === 'operation') v = l.ot_hours != null ? `OT ${l.ot_hours}` : (l.work_type_name || l.team || '✓');
        else v = l.detail ? '✓' : '';
      }
      row.push(v);
    }
    ws.addRow(row);
  }
  ws.getRow(1).font = { bold: true };
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="performance-${month}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}));

export default router;
