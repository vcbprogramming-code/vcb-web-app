import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import {
  Project,
  Facility,
  CreditLedger,
  CreditRequest,
  CashPlan,
  CreditAudit,
} from '../models/index.js';
import { FACILITY_TYPES } from '../models/Facility.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import {
  facilityView,
  facilityViewWith,
  authorizedUsedMap,
  dueBucket,
  overdueInterest,
  writeAudit,
  diff,
} from '../services/credit.js';

// Financial data — restricted to admin + executive only.
const router = Router();
router.use(requireAuth, requireRole('admin', 'executive'));

const ledgerOut = (l) => ({
  id: String(l._id),
  facility_id: String(l.facilityId),
  project_id: String(l.projectId),
  amount: l.amount,
  status: l.status,
  start_date: l.startDate ?? null,
  due_date: l.dueDate ?? null,
  settled_date: l.settledDate ?? null,
  ref: l.ref ?? null,
  source: l.source ?? null,
  doc_from: l.docFrom ?? null,
  doc_to: l.docTo ?? null,
  interest_rate: l.interestRate ?? null,
  note: l.note ?? null,
  request_id: l.requestId ? String(l.requestId) : null,
});
const requestOut = (r) => ({
  id: String(r._id),
  facility_id: String(r.facilityId),
  project_id: String(r.projectId),
  amount: r.amount,
  start_date: r.startDate ?? null,
  due_date: r.dueDate ?? null,
  ref: r.ref ?? null,
  note: r.note ?? null,
  status: r.status,
  decided_at: r.decidedAt ?? null,
  decision_note: r.decisionNote ?? null,
  ledger_id: r.ledgerId ? String(r.ledgerId) : null,
});
const cashPlanOut = (c) => ({
  id: String(c._id),
  project_id: String(c.projectId),
  month: c.month,
  period: c.period,
  income: c.income,
  paid_ids: (c.paidIds || []).map(String),
  new_pn: c.newPN,
  deductions: c.deductions,
  income_breakdown: c.incomeBreakdown ?? null,
  available: c.available,
  note: c.note ?? null,
});

// ── facilities ──────────────────────────────────────────────────────────────

/**
 * GET /api/credit/facilities — facilities with computed used/available.
 * Filters: ?projectId= &type= &search=
 */
router.get(
  '/facilities',
  asyncHandler(async (req, res) => {
    const { projectId, type, search } = req.query;
    const filter = {};
    if (projectId) filter.projectId = projectId;
    if (type) filter.type = type;
    const rows = await Facility.find(filter).sort({ createdAt: 1 }).lean();
    // one aggregation for all facilities' used amounts (no per-facility query)
    const usedMap = await authorizedUsedMap(rows.map((r) => r._id));
    let views = rows.map((f) => facilityViewWith(f, usedMap.get(String(f._id)) || 0));
    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      views = views.filter((v) => rx.test(v.facility_no || '') || rx.test(v.bank || '') || rx.test(v.company || ''));
    }
    res.json({ data: views });
  })
);

const facilitySchema = z.object({
  projectId: z.string().min(1),
  company: z.string().optional().nullable(),
  bank: z.string().optional().nullable(),
  facilityNo: z.string().optional().nullable(),
  type: z.enum(FACILITY_TYPES),
  limit: z.number().nonnegative(),
  usedBaseline: z.number().optional(),
  interestRate: z.number().optional().nullable(),
  feeRate: z.number().optional().nullable(),
  approvedDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post(
  '/facilities',
  asyncHandler(async (req, res) => {
    const parsed = facilitySchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const d = parsed.data;
    const created = await Facility.create({
      ...d,
      approvedDate: d.approvedDate ? new Date(d.approvedDate) : null,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      usedBaseline: d.usedBaseline || 0,
    });
    await writeAudit({ actor: req.profile, action: 'create', target: 'facility', targetId: created._id, note: d.type });
    res.status(201).json({ data: await facilityView(created.toObject()) });
  })
);

router.patch(
  '/facilities/:id',
  asyncHandler(async (req, res) => {
    const parsed = facilitySchema.partial().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const before = await Facility.findById(req.params.id).lean();
    if (!before) throw new ApiError(404, 'Facility not found');
    const d = parsed.data;
    const set = { ...d };
    if (d.approvedDate !== undefined) set.approvedDate = d.approvedDate ? new Date(d.approvedDate) : null;
    if (d.dueDate !== undefined) set.dueDate = d.dueDate ? new Date(d.dueDate) : null;
    const after = await Facility.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
    await writeAudit({
      actor: req.profile, action: 'update', target: 'facility', targetId: req.params.id,
      changes: diff(before, after, ['limit', 'interestRate', 'dueDate', 'type', 'bank', 'facilityNo', 'company', 'notes']),
    });
    res.json({ data: await facilityView(after) });
  })
);

/** PUT /api/credit/facilities/:id/limit — override the approved limit. */
router.put(
  '/facilities/:id/limit',
  asyncHandler(async (req, res) => {
    const parsed = z.object({ limit: z.number().nonnegative() }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const before = await Facility.findById(req.params.id).lean();
    if (!before) throw new ApiError(404, 'Facility not found');
    const after = await Facility.findByIdAndUpdate(
      req.params.id, { $set: { limit: parsed.data.limit } }, { new: true }
    ).lean();
    await writeAudit({
      actor: req.profile, action: 'set-limit', target: 'limit', targetId: req.params.id,
      changes: { limit: { before: before.limit, after: parsed.data.limit } },
    });
    res.json({ data: await facilityView(after) });
  })
);

// ── ledger (drawdown / settle / edit / delete) ──────────────────────────────

/** GET /api/credit/ledger?facilityId=&projectId=&status= */
router.get(
  '/ledger',
  asyncHandler(async (req, res) => {
    const { facilityId, projectId, status } = req.query;
    const filter = {};
    if (facilityId) filter.facilityId = facilityId;
    if (projectId) filter.projectId = projectId;
    if (status) filter.status = status;
    const rows = await CreditLedger.find(filter).sort({ startDate: -1, createdAt: -1 }).lean();
    res.json({ data: rows.map(ledgerOut) });
  })
);

const ledgerSchema = z.object({
  facilityId: z.string().min(1),
  amount: z.number(),
  status: z.string().optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  ref: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  docFrom: z.string().optional().nullable(),
  docTo: z.string().optional().nullable(),
  interestRate: z.number().optional().nullable(),
  note: z.string().optional().nullable(),
});

router.post(
  '/ledger',
  asyncHandler(async (req, res) => {
    const parsed = ledgerSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const d = parsed.data;
    const facility = await Facility.findById(d.facilityId).lean();
    if (!facility) throw new ApiError(404, 'Facility not found');
    const created = await CreditLedger.create({
      ...d,
      projectId: facility.projectId,
      status: d.status || 'อนุมัติแล้ว',
      startDate: d.startDate ? new Date(d.startDate) : null,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      createdBy: req.profile.id,
    });
    await writeAudit({ actor: req.profile, action: 'create', target: 'ledger', targetId: created._id, note: `${d.amount}` });
    res.status(201).json({ data: ledgerOut(created.toObject()) });
  })
);

router.patch(
  '/ledger/:id',
  asyncHandler(async (req, res) => {
    const parsed = ledgerSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const before = await CreditLedger.findById(req.params.id).lean();
    if (!before) throw new ApiError(404, 'Ledger item not found');
    const d = parsed.data;
    const set = { ...d };
    delete set.facilityId;
    if (d.startDate !== undefined) set.startDate = d.startDate ? new Date(d.startDate) : null;
    if (d.dueDate !== undefined) set.dueDate = d.dueDate ? new Date(d.dueDate) : null;
    const after = await CreditLedger.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
    await writeAudit({
      actor: req.profile, action: 'update', target: 'ledger', targetId: req.params.id,
      changes: diff(before, after, ['amount', 'status', 'dueDate', 'startDate', 'ref', 'note']),
    });
    res.json({ data: ledgerOut(after) });
  })
);

/** POST /api/credit/ledger/:id/settle — mark settled (releases the line). */
router.post(
  '/ledger/:id/settle',
  asyncHandler(async (req, res) => {
    const before = await CreditLedger.findById(req.params.id).lean();
    if (!before) throw new ApiError(404, 'Ledger item not found');
    const after = await CreditLedger.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'ชำระแล้ว', settledDate: new Date() } },
      { new: true }
    ).lean();
    await writeAudit({
      actor: req.profile, action: 'settle', target: 'ledger', targetId: req.params.id,
      changes: { status: { before: before.status, after: 'ชำระแล้ว' } },
    });
    res.json({ data: ledgerOut(after) });
  })
);

router.delete(
  '/ledger/:id',
  asyncHandler(async (req, res) => {
    const before = await CreditLedger.findById(req.params.id).lean();
    if (!before) throw new ApiError(404, 'Ledger item not found');
    await CreditLedger.findByIdAndDelete(req.params.id);
    await writeAudit({ actor: req.profile, action: 'delete', target: 'ledger', targetId: req.params.id, note: `${before.amount}` });
    res.json({ data: { deleted: true } });
  })
);

// ── requests + approval ─────────────────────────────────────────────────────

/** GET /api/credit/requests?status= */
router.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const rows = await CreditRequest.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ data: rows.map(requestOut) });
  })
);

const requestSchema = z.object({
  facilityId: z.string().min(1),
  amount: z.number().positive(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  ref: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

router.post(
  '/requests',
  asyncHandler(async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const d = parsed.data;
    const facility = await Facility.findById(d.facilityId).lean();
    if (!facility) throw new ApiError(404, 'Facility not found');
    const created = await CreditRequest.create({
      ...d,
      projectId: facility.projectId,
      startDate: d.startDate ? new Date(d.startDate) : null,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      createdBy: req.profile.id,
    });
    await writeAudit({ actor: req.profile, action: 'create', target: 'request', targetId: created._id, note: `${d.amount}` });
    res.status(201).json({ data: requestOut(created.toObject()) });
  })
);

/**
 * POST /api/credit/requests/:id/decide  { decision: 'อนุมัติ'|'ไม่อนุมัติ', note? }
 * On approve, AUTO-create a linked authorized ledger entry (no double count).
 */
router.post(
  '/requests/:id/decide',
  asyncHandler(async (req, res) => {
    const parsed = z.object({
      decision: z.enum(['อนุมัติ', 'ไม่อนุมัติ']),
      note: z.string().optional().nullable(),
    }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());

    const reqDoc = await CreditRequest.findById(req.params.id);
    if (!reqDoc) throw new ApiError(404, 'Request not found');
    if (reqDoc.status !== 'อยู่ระหว่างเสนออนุมัติ') {
      throw new ApiError(409, 'คำขอนี้ถูกตัดสินไปแล้ว');
    }

    reqDoc.status = parsed.data.decision;
    reqDoc.decidedBy = req.profile.id;
    reqDoc.decidedAt = new Date();
    reqDoc.decisionNote = parsed.data.note || null;

    let ledger = null;
    if (parsed.data.decision === 'อนุมัติ') {
      ledger = await CreditLedger.create({
        facilityId: reqDoc.facilityId,
        projectId: reqDoc.projectId,
        amount: reqDoc.amount,
        status: 'อนุมัติแล้ว',
        startDate: reqDoc.startDate,
        dueDate: reqDoc.dueDate,
        ref: reqDoc.ref,
        note: reqDoc.note,
        requestId: reqDoc._id,
        createdBy: req.profile.id,
      });
      reqDoc.ledgerId = ledger._id;
    }
    await reqDoc.save();

    await writeAudit({
      actor: req.profile, action: parsed.data.decision === 'อนุมัติ' ? 'approve' : 'reject',
      target: 'request', targetId: reqDoc._id,
      changes: { status: { before: 'อยู่ระหว่างเสนออนุมัติ', after: parsed.data.decision } },
      note: parsed.data.note || null,
    });

    res.json({ data: { request: requestOut(reqDoc.toObject()), ledger: ledger ? ledgerOut(ledger.toObject()) : null } });
  })
);

// ── overview: due-buckets + overdue interest + status totals ────────────────

/** GET /api/credit/overview — dashboard headline numbers. */
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    // facilities + all authorized ledger items in parallel (2 queries)
    const [facilities, authorized] = await Promise.all([
      Facility.find({ isActive: true }).lean(),
      CreditLedger.find({ status: 'อนุมัติแล้ว' }).lean(),
    ]);
    const rateByFacility = Object.fromEntries(facilities.map((f) => [String(f._id), f.interestRate]));

    // sum authorized ledger per facility in memory (no extra queries)
    const usedMap = new Map();
    for (const item of authorized) {
      const k = String(item.facilityId);
      usedMap.set(k, (usedMap.get(k) || 0) + (item.amount || 0));
    }

    // totals by type (limit/used)
    const byType = {};
    for (const f of facilities) {
      const v = facilityViewWith(f, usedMap.get(String(f._id)) || 0);
      const t = byType[f.type] || { type: f.type, limit: 0, used: 0 };
      t.limit += v.limit;
      t.used += v.used;
      byType[f.type] = t;
    }
    const buckets = { overdue: { count: 0, amount: 0 }, thisMonth: { count: 0, amount: 0 }, nextMonth: { count: 0, amount: 0 }, later: { count: 0, amount: 0 } };
    let overdueInterestTotal = 0;
    for (const item of authorized) {
      const b = dueBucket(item.dueDate);
      buckets[b].count++;
      buckets[b].amount += item.amount || 0;
      overdueInterestTotal += overdueInterest(item, rateByFacility[String(item.facilityId)]);
    }

    // request totals (parallel)
    const [pending, approved] = await Promise.all([
      CreditRequest.find({ status: 'อยู่ระหว่างเสนออนุมัติ' }).lean(),
      CreditRequest.countDocuments({ status: 'อนุมัติ' }),
    ]);

    res.json({
      data: {
        byType: Object.values(byType).map((t) => ({ ...t, available: t.limit - t.used, pct: t.limit ? Math.round((t.used / t.limit) * 100) : 0 })),
        buckets,
        overdueInterest: Math.round(overdueInterestTotal),
        pendingCount: pending.length,
        pendingAmount: pending.reduce((s, r) => s + (r.amount || 0), 0),
        approvedCount: approved,
      },
    });
  })
);

/** GET /api/credit/overdue — authorized items past due, with interest. */
router.get(
  '/overdue',
  asyncHandler(async (req, res) => {
    const facilities = await Facility.find().lean();
    const rateByFacility = Object.fromEntries(facilities.map((f) => [String(f._id), f.interestRate]));
    const items = await CreditLedger.find({ status: 'อนุมัติแล้ว', dueDate: { $lt: new Date() } }).lean();
    const out = items.map((i) => ({
      ...ledgerOut(i),
      bucket: dueBucket(i.dueDate),
      overdue_interest: Math.round(overdueInterest(i, rateByFacility[String(i.facilityId)])),
    }));
    res.json({ data: out });
  })
);

// ── cash plan (T-bar) ───────────────────────────────────────────────────────

/** GET /api/credit/cash-plan?projectId=&month= */
router.get(
  '/cash-plan',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.projectId) filter.projectId = req.query.projectId;
    if (req.query.month) filter.month = req.query.month;
    const rows = await CashPlan.find(filter).sort({ month: 1, period: 1 }).lean();
    res.json({ data: rows.map(cashPlanOut) });
  })
);

const cashPlanSchema = z.object({
  projectId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  period: z.string().optional(),
  income: z.number().optional(),
  paidIds: z.array(z.string()).optional(),
  newPN: z.number().optional(),
  deductions: z.number().optional(),
  incomeBreakdown: z.string().optional().nullable(),
  available: z.number().optional(),
  note: z.string().optional().nullable(),
});

router.post(
  '/cash-plan',
  asyncHandler(async (req, res) => {
    const parsed = cashPlanSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const created = await CashPlan.create({ ...parsed.data, createdBy: req.profile.id });
    await writeAudit({ actor: req.profile, action: 'create', target: 'cashplan', targetId: created._id });
    res.status(201).json({ data: cashPlanOut(created.toObject()) });
  })
);

router.patch(
  '/cash-plan/:id',
  asyncHandler(async (req, res) => {
    const parsed = cashPlanSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    const row = await CashPlan.findByIdAndUpdate(req.params.id, { $set: parsed.data }, { new: true }).lean();
    if (!row) throw new ApiError(404, 'Cash plan row not found');
    await writeAudit({ actor: req.profile, action: 'update', target: 'cashplan', targetId: req.params.id });
    res.json({ data: cashPlanOut(row) });
  })
);

router.delete(
  '/cash-plan/:id',
  asyncHandler(async (req, res) => {
    await CashPlan.findByIdAndDelete(req.params.id);
    await writeAudit({ actor: req.profile, action: 'delete', target: 'cashplan', targetId: req.params.id });
    res.json({ data: { deleted: true } });
  })
);

// ── audit trail ─────────────────────────────────────────────────────────────

/** GET /api/credit/audit?target=&targetId= — recent audit entries. */
router.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.target) filter.target = req.query.target;
    if (req.query.targetId) filter.targetId = String(req.query.targetId);
    const rows = await CreditAudit.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.json({
      data: rows.map((a) => ({
        id: String(a._id),
        actor_label: a.actorLabel ?? null,
        action: a.action,
        target: a.target,
        target_id: a.targetId ?? null,
        changes: a.changes ?? null,
        note: a.note ?? null,
        created_at: a.createdAt,
      })),
    });
  })
);

// ── xlsx export ─────────────────────────────────────────────────────────────

/** GET /api/credit/export?projectId=&type= — facilities + transactions sheets. */
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const { projectId, type } = req.query;
    const fFilter = {};
    if (projectId) fFilter.projectId = projectId;
    if (type) fFilter.type = type;
    const facilities = await Facility.find(fFilter).lean();
    const projects = await Project.find().lean();
    const projName = Object.fromEntries(projects.map((p) => [String(p._id), p.name || p.code]));

    const wb = new ExcelJS.Workbook();
    const fs = wb.addWorksheet('วงเงินสินเชื่อ');
    fs.addRow(['โครงการ', 'บริษัท', 'ธนาคาร', 'เลขที่วงเงิน', 'ประเภท', 'วงเงิน', 'ใช้ไป', 'คงเหลือ', 'ดอกเบี้ย%', 'ครบกำหนด']);
    for (const f of facilities) {
      const v = await facilityView(f);
      fs.addRow([
        projName[String(f.projectId)] || '', f.company || '', f.bank || '', f.facilityNo || '',
        f.type, v.limit, v.used, v.available, f.interestRate ?? '', f.dueDate ? new Date(f.dueDate).toISOString().slice(0, 10) : '',
      ]);
    }
    fs.getRow(1).font = { bold: true };

    const facIds = facilities.map((f) => f._id);
    const ledger = await CreditLedger.find({ facilityId: { $in: facIds } }).sort({ startDate: -1 }).lean();
    const ts = wb.addWorksheet('รายการสินเชื่อ');
    ts.addRow(['โครงการ', 'จำนวนเงิน', 'สถานะ', 'วันเริ่ม', 'ครบกำหนด', 'อ้างอิง', 'หมายเหตุ']);
    for (const l of ledger) {
      ts.addRow([
        projName[String(l.projectId)] || '', l.amount, l.status,
        l.startDate ? new Date(l.startDate).toISOString().slice(0, 10) : '',
        l.dueDate ? new Date(l.dueDate).toISOString().slice(0, 10) : '',
        l.ref || '', l.note || '',
      ]);
    }
    ts.getRow(1).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="credit-facilities.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  })
);

export default router;
