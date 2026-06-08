import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { Unit, Employee, WorkType, WorkLog, EMPLOYEE_KINDS } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

// ── helpers ────────────────────────────────────────────────────────────────

/** Units this user may see. admin/executive = all; hr = their unitIds (+unitId). */
async function scopedUnitIds(profile) {
  if (profile.role === 'admin' || profile.role === 'executive') return null; // all
  const ids = [];
  if (profile.unit_id) ids.push(String(profile.unit_id));
  for (const u of profile.unit_ids || []) ids.push(String(u));
  return [...new Set(ids)];
}

/** Throw 403 if an hr user touches a unit out of scope. */
function assertUnitInScope(scoped, unitId) {
  if (scoped && !scoped.includes(String(unitId))) {
    throw new ApiError(403, 'ไม่มีสิทธิ์เข้าถึงหน่วยงานนี้');
  }
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // month is 1-based here
}
/** Per-unit backdate lock: a ymd older than lockDays (excl. today) is locked. */
function isLocked(ymdStr, lockDays) {
  if (!lockDays || lockDays <= 0) return false;
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [Y, M, D] = ymdStr.split('-').map(Number);
  const cell = new Date(Y, M - 1, D);
  const diffDays = Math.round((t - cell) / 86400000);
  return diffDays > lockDays;
}

const unitOut = (u) => ({
  id: String(u._id),
  name: u.name,
  code: u.code ?? null,
  company: u.company ?? null,
  color: u.color ?? null,
  lock_days: u.lockDays ?? 3,
});
const empOut = (e) => ({
  id: String(e._id),
  full_name: e.fullName,
  employee_code: e.employeeCode ?? null,
  unit_id: String(e.unitId),
  kind: e.kind,
  team: e.team ?? null,
  is_active: e.isActive,
});
const logOut = (l) => ({
  id: String(l._id),
  employee_id: String(l.employeeId),
  ymd: l.ymd,
  kind: l.kind,
  team: l.team ?? null,
  work_type_id: l.workTypeId ? String(l.workTypeId) : null,
  work_type_name: l.workTypeName ?? null,
  ot_hours: l.otHours ?? null,
  ot_rate: l.otRate ?? null,
  ot_amount: l.otAmount ?? null,
  reason: l.reason ?? null,
  detail: l.detail ?? null,
  note: l.note ?? null,
  status: l.status ?? '',
});

// ── sites (units) ───────────────────────────────────────────────────────────

/** GET /api/performance/sites — units the user can see (the dashboard cards). */
router.get(
  '/sites',
  asyncHandler(async (req, res) => {
    const scoped = await scopedUnitIds(req.profile);
    const filter = scoped ? { _id: { $in: scoped } } : {};
    const units = await Unit.find(filter).sort({ name: 1 }).lean();
    res.json({ data: units.map(unitOut) });
  })
);

/**
 * GET /api/performance/dashboard?month=YYYY-MM
 * Per-site completeness summary for the month (cards + ring %).
 */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [Y, M] = month.split('-').map(Number);
    const dim = daysInMonth(Y, M);
    const monthPrefix = `${Y}-${pad(M)}-`;

    const scoped = await scopedUnitIds(req.profile);
    const unitFilter = scoped ? { _id: { $in: scoped } } : {};
    const units = await Unit.find(unitFilter).sort({ name: 1 }).lean();

    const cards = [];
    for (const u of units) {
      const employees = await Employee.find({ unitId: u._id, isActive: true }).lean();
      const opCount = employees.filter((e) => e.kind === 'operation').length;
      const supCount = employees.filter((e) => e.kind === 'support').length;

      // count filled cells up to today within the month
      const today = new Date();
      const lastDay = (Y === today.getFullYear() && M === today.getMonth() + 1)
        ? today.getDate()
        : dim;
      const expected = employees.length * lastDay;
      const filled = await WorkLog.countDocuments({
        unitId: u._id,
        ymd: { $gte: monthPrefix + '01', $lte: monthPrefix + pad(lastDay) },
      });
      const pct = expected ? Math.round((filled / expected) * 100) : 0;

      cards.push({
        ...unitOut(u),
        employees: employees.length,
        op_count: opCount,
        sup_count: supCount,
        filled,
        expected,
        pct,
      });
    }
    res.json({ data: { month, cards } });
  })
);

// ── employees ───────────────────────────────────────────────────────────────

/** GET /api/performance/employees?unitId= — roster for a site. */
router.get(
  '/employees',
  asyncHandler(async (req, res) => {
    const { unitId } = req.query;
    if (!unitId) throw new ApiError(400, 'unitId is required');
    const scoped = await scopedUnitIds(req.profile);
    assertUnitInScope(scoped, unitId);
    const rows = await Employee.find({ unitId }).sort({ kind: 1, fullName: 1 }).lean();
    res.json({ data: rows.map(empOut) });
  })
);

const employeeSchema = z.object({
  unitId: z.string().min(1),
  fullName: z.string().min(1),
  employeeCode: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  kind: z.enum(EMPLOYEE_KINDS),
  team: z.string().optional().nullable(),
});

router.post(
  '/employees',
  asyncHandler(async (req, res) => {
    const parsed = employeeSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const scoped = await scopedUnitIds(req.profile);
    assertUnitInScope(scoped, parsed.data.unitId);
    const created = await Employee.create({
      ...parsed.data,
      departmentId: parsed.data.departmentId || null,
      isActive: true,
    });
    res.status(201).json({ data: empOut(created.toObject()) });
  })
);

router.patch(
  '/employees/:id',
  asyncHandler(async (req, res) => {
    const parsed = employeeSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const f = parsed.data;
    const set = {};
    for (const k of ['fullName', 'employeeCode', 'kind', 'team']) {
      if (f[k] !== undefined) set[k] = f[k];
    }
    if (f.isActive !== undefined) set.isActive = f.isActive;
    const row = await Employee.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
    if (!row) throw new ApiError(404, 'Employee not found');
    res.json({ data: empOut(row) });
  })
);

// ── work-type master index ──────────────────────────────────────────────────

/** GET /api/performance/work-types — searchable picker source (grouped). */
router.get(
  '/work-types',
  asyncHandler(async (req, res) => {
    const rows = await WorkType.find({ isActive: true }).sort({ category: 1, sortOrder: 1, name: 1 }).lean();
    res.json({
      data: rows.map((w) => ({
        id: String(w._id),
        code: w.code ?? null,
        name: w.name,
        description: w.description ?? null,
        category: w.category,
      })),
    });
  })
);

const workTypeSchema = z.object({
  code: z.string().optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

router.post(
  '/work-types',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const parsed = workTypeSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const created = await WorkType.create({ ...parsed.data, category: parsed.data.category || 'ทั่วไป' });
    res.status(201).json({ data: { id: String(created._id), ...parsed.data } });
  })
);

// ── grid: load a month + save cells ─────────────────────────────────────────

/**
 * GET /api/performance/grid?unitId=&month=YYYY-MM
 * Returns the employees, day meta (locked/weekend/today/future), and all logs.
 */
router.get(
  '/grid',
  asyncHandler(async (req, res) => {
    const { unitId } = req.query;
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    if (!unitId) throw new ApiError(400, 'unitId is required');
    const scoped = await scopedUnitIds(req.profile);
    assertUnitInScope(scoped, unitId);

    const unit = await Unit.findById(unitId).lean();
    if (!unit) throw new ApiError(404, 'Site not found');
    const lockDays = unit.lockDays ?? 3;

    const [Y, M] = month.split('-').map(Number);
    const dim = daysInMonth(Y, M);
    const today = new Date();
    const todayYmd = ymd(today.getFullYear(), today.getMonth() + 1, today.getDate());

    const days = [];
    for (let d = 1; d <= dim; d++) {
      const ds = ymd(Y, M, d);
      const dow = new Date(Y, M - 1, d).getDay(); // 0=Sun..6=Sat
      days.push({
        ymd: ds,
        day: d,
        weekend: dow === 0 || dow === 6,
        today: ds === todayYmd,
        future: ds > todayYmd,
        locked: isLocked(ds, lockDays),
      });
    }

    const employees = await Employee.find({ unitId, isActive: true }).sort({ kind: 1, fullName: 1 }).lean();
    const logs = await WorkLog.find({
      unitId,
      ymd: { $gte: ymd(Y, M, 1), $lte: ymd(Y, M, dim) },
    }).lean();

    res.json({
      data: {
        month,
        unit: unitOut(unit),
        days,
        employees: employees.map(empOut),
        logs: logs.map(logOut),
      },
    });
  })
);

const cellSchema = z.object({
  employeeId: z.string().min(1),
  ymd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(EMPLOYEE_KINDS),
  team: z.string().optional().nullable(),
  workTypeId: z.string().optional().nullable(),
  workTypeName: z.string().optional().nullable(),
  otHours: z.number().optional().nullable(),
  otRate: z.number().optional().nullable(),
  otAmount: z.number().optional().nullable(),
  reason: z.string().optional().nullable(),
  detail: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  status: z.enum(['', 'leave', 'off']).optional(),
});

/**
 * POST /api/performance/grid/save  { unitId, cells: [...], adminUnlock? }
 * Batch upsert of edited cells (matches the auto-save UX). Honors the backdate
 * lock unless an admin passes adminUnlock=true.
 */
router.post(
  '/grid/save',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        unitId: z.string().min(1),
        cells: z.array(cellSchema).min(1).max(500),
        adminUnlock: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) throw new ApiError(400, 'Invalid input', body.error.flatten());
    const { unitId, cells, adminUnlock } = body.data;

    const scoped = await scopedUnitIds(req.profile);
    assertUnitInScope(scoped, unitId);

    const unit = await Unit.findById(unitId).lean();
    if (!unit) throw new ApiError(404, 'Site not found');
    const lockDays = unit.lockDays ?? 3;
    const canUnlock = req.profile.role === 'admin' && adminUnlock;

    const saved = [];
    for (const c of cells) {
      if (isLocked(c.ymd, lockDays) && !canUnlock) {
        continue; // silently skip locked cells unless admin unlocks
      }
      const otAmount =
        c.otAmount != null
          ? c.otAmount
          : c.otHours != null && c.otRate != null
          ? c.otHours * c.otRate
          : null;
      const doc = await WorkLog.findOneAndUpdate(
        { employeeId: c.employeeId, ymd: c.ymd },
        {
          $set: {
            unitId,
            kind: c.kind,
            team: c.team ?? null,
            workTypeId: c.workTypeId || null,
            workTypeName: c.workTypeName ?? null,
            otHours: c.otHours ?? null,
            otRate: c.otRate ?? null,
            otAmount,
            reason: c.reason ?? null,
            detail: c.detail ?? null,
            note: c.note ?? null,
            status: c.status ?? '',
            updatedBy: req.profile.id,
          },
        },
        { upsert: true, new: true }
      ).lean();
      saved.push(logOut(doc));
    }
    res.json({ data: { saved, count: saved.length } });
  })
);

// ── coverage view ───────────────────────────────────────────────────────────

/**
 * GET /api/performance/coverage?unitId=&month=YYYY-MM
 * employee×day status grid (filled/missed/leave/off/future) + per-day % summary.
 */
router.get(
  '/coverage',
  asyncHandler(async (req, res) => {
    const { unitId } = req.query;
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    if (!unitId) throw new ApiError(400, 'unitId is required');
    const scoped = await scopedUnitIds(req.profile);
    assertUnitInScope(scoped, unitId);

    const [Y, M] = month.split('-').map(Number);
    const dim = daysInMonth(Y, M);
    const today = new Date();
    const todayYmd = ymd(today.getFullYear(), today.getMonth() + 1, today.getDate());

    const employees = await Employee.find({ unitId, isActive: true }).sort({ kind: 1, fullName: 1 }).lean();
    const logs = await WorkLog.find({
      unitId,
      ymd: { $gte: ymd(Y, M, 1), $lte: ymd(Y, M, dim) },
    }).lean();
    const byKey = new Map(logs.map((l) => [`${l.employeeId}_${l.ymd}`, l]));

    const cellStatus = (emp, ds, dow) => {
      if (ds > todayYmd) return 'future';
      const log = byKey.get(`${emp._id}_${ds}`);
      if (log) {
        if (log.status === 'leave') return 'leave';
        if (log.status === 'off') return 'off';
        const hasContent = log.kind === 'operation'
          ? (log.workTypeName || log.otHours != null || log.team)
          : (log.detail || log.note);
        return hasContent ? 'filled' : 'missed';
      }
      if (dow === 0 || dow === 6) return 'off';
      return 'missed';
    };

    const rows = employees.map((emp) => {
      const cells = [];
      for (let d = 1; d <= dim; d++) {
        const ds = ymd(Y, M, d);
        const dow = new Date(Y, M - 1, d).getDay();
        cells.push({ ymd: ds, status: cellStatus(emp, ds, dow) });
      }
      return { employee: empOut(emp), cells };
    });

    // per-day completeness % (over employees expected to work that day)
    const dayPct = [];
    for (let d = 1; d <= dim; d++) {
      const ds = ymd(Y, M, d);
      if (ds > todayYmd) { dayPct.push({ ymd: ds, pct: null }); continue; }
      let expected = 0;
      let ok = 0;
      for (const r of rows) {
        const cell = r.cells[d - 1];
        if (cell.status === 'off' || cell.status === 'future') continue;
        expected++;
        if (cell.status === 'filled' || cell.status === 'leave') ok++;
      }
      dayPct.push({ ymd: ds, pct: expected ? Math.round((ok / expected) * 100) : null });
    }

    res.json({ data: { month, days: dayPct, rows } });
  })
);

// ── export ──────────────────────────────────────────────────────────────────

/** GET /api/performance/export?unitId=&month=YYYY-MM — month grid as .xlsx */
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const { unitId } = req.query;
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    if (!unitId) throw new ApiError(400, 'unitId is required');
    const scoped = await scopedUnitIds(req.profile);
    assertUnitInScope(scoped, unitId);

    const unit = await Unit.findById(unitId).lean();
    const [Y, M] = month.split('-').map(Number);
    const dim = daysInMonth(Y, M);
    const employees = await Employee.find({ unitId, isActive: true }).sort({ kind: 1, fullName: 1 }).lean();
    const logs = await WorkLog.find({ unitId, ymd: { $gte: ymd(Y, M, 1), $lte: ymd(Y, M, dim) } }).lean();
    const byKey = new Map(logs.map((l) => [`${l.employeeId}_${l.ymd}`, l]));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`${unit?.name || 'site'} ${month}`);
    const header = ['พนักงาน', 'ประเภท'];
    for (let d = 1; d <= dim; d++) header.push(String(d));
    ws.addRow(header);
    for (const e of employees) {
      const row = [e.fullName, e.kind === 'operation' ? 'ปฏิบัติการ' : 'สนับสนุน'];
      for (let d = 1; d <= dim; d++) {
        const l = byKey.get(`${e._id}_${ymd(Y, M, d)}`);
        let v = '';
        if (l) {
          if (l.status === 'leave') v = 'ลา';
          else if (l.status === 'off') v = 'พัก';
          else if (e.kind === 'operation') v = l.otHours != null ? `OT ${l.otHours}` : (l.workTypeName || l.team || '✓');
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
  })
);

export default router;
