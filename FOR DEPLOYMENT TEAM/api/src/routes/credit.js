// Credit Facility. Facilities, transactions, requests, limits, category caps
// and the cash plan.
//
// The Apps Script version put everything behind one getData() call and let the
// client hold the whole workbook in memory. That is kept here as GET /data,
// because the React app still expects one payload with `me`, facilities,
// transactions and requests together — splitting it would mean rewriting the
// front end. Everything else is a normal REST endpoint.
//
// Guards mirror the RLS policies in credit-facility/…/supabase/schema.sql:
//   select  → any signed-in user (this is company financial data, never anon)
//   insert/update/delete → public.is_manager(), i.e. requireRole('credit','manager')
//   audit   → append-only, managers insert, nobody updates

import { Router } from 'express';
import { z } from 'zod';
import { rows, one, tx } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error.js';

const router = Router();

// Every route in this module needs a signed-in caller. Mounting it once here
// rather than per-route means a new route cannot accidentally ship public.
//
// NOT gated on a credit role, deliberately. Access rights are administered from
// the portal (and each app own settings) and are not wired yet; gating here
// would lock everyone out of a module whose permissions nobody can grant.
// The ROLE VOCABULARY is defined - see docs/ACCESS_MODEL.md - so turning this
// into requireRole('credit', 'manager', 'viewer') is a one-line change once
// the admin UI can assign it.
router.use(requireAuth);

const manager = requireRole('credit', 'manager');

/* --------------------------------- helpers -------------------------------- */

/**
 * Write an audit row. Mirrors audit_() in Code.js.
 *
 * Takes an explicit client so it joins the caller's transaction — an audit row
 * for a write that then rolled back would be a lie.
 */
function audit(client, actor, action, target, targetId, changes, note = null) {
  return client.query(
    `insert into credit.audit (actor, action, target, target_id, changes, note)
     values ($1, $2, $3, $4, $5, $6)`,
    [actor, action, target, targetId == null ? null : String(targetId), changes ?? null, note]
  );
}

/** Numeric columns arrive from pg as strings; the client expects numbers. */
const num = (v) => (v == null || v === '' ? 0 : Number(v));

/** Dates are rendered dd/mm/yyyy by the client (fmt_ in Code.js). */
function dmy(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const s = (v) => (v == null ? '' : String(v));

/* ------------------------------- row mappers ------------------------------ */
// The client's types.ts is camelCase and was written against the sheet, so the
// mapping happens here rather than aliasing 20 columns in every query.

function toTransaction(r) {
  return {
    id: r.id,
    date: dmy(r.txn_date),
    project: r.project,
    facilityNo: r.facility_no ?? '',
    kind: s(r.kind),
    ref: s(r.ref),
    desc: s(r.description),
    start: dmy(r.start_date),
    due: dmy(r.due_date),
    // The sheet had no separate maturity column on Transactions; the client
    // reads both names off the same due date.
    maturity: dmy(r.due_date),
    amount: num(r.amount),
    status: s(r.status),
    by: s(r.created_by),
    requester: s(r.created_by),
    paidDate: dmy(r.paid_date),
    note: s(r.note),
    purpose: s(r.purpose || r.description),
    beneficiary: s(r.beneficiary),
    source: s(r.source),
    costCategory: s(r.cost_category),
    refDocFrom: s(r.ref_doc_from),
    refDocTo: s(r.ref_doc_to),
    docFrom: s(r.doc_from),
    docTo: s(r.doc_to),
    updated: dmy(r.updated_at),
  };
}

function toRequest(r) {
  return {
    id: r.id,
    date: dmy(r.req_date),
    project: r.project,
    company: s(r.company),
    facilityNo: r.facility_no ?? '',
    amount: num(r.amount),
    purpose: s(r.purpose),
    beneficiary: s(r.beneficiary),
    status: s(r.status),
    requester: s(r.requester),
    decidedBy: s(r.decided_by),
    decidedAt: dmy(r.decided_at),
    note: s(r.note),
    maturity: dmy(r.maturity),
    linkedTxn: s(r.linked_txn),
    source: s(r.source),
    docFrom: s(r.doc_from),
    docTo: s(r.doc_to),
    updated: dmy(r.updated_at),
  };
}

function toCashPlan(r) {
  return {
    id: r.id,
    project: r.project,
    month: r.month,
    periodIdx: Number(r.period_idx) || 0,
    periodLabel: s(r.period_label),
    periodDate: s(r.period_date ? dmy(r.period_date) : ''),
    periodType: s(r.period_type),
    income: num(r.income),
    workRef: s(r.work_ref),
    paidIds: r.paid_ids ?? [],
    deductions: r.deductions ?? [],
    incomeBreak: r.income_break ?? [],
    avalAmount: num(r.aval_amount),
    newPNAmount: num(r.new_pn_amount),
    newPNNote: s(r.new_pn_note),
    note: s(r.note),
    showAllDue: !!r.show_all_due,
    variant: r.variant || 'plan',
    extraRows: r.extra_rows ?? [],
    updated: dmy(r.updated_at),
  };
}

/* --------------------------------- schemas -------------------------------- */

// facility_no is `text` in the schema but the client sends a number, so coerce
// both directions rather than making the client care.
const facilityNo = z.union([z.string(), z.number()]).transform((v) => String(v));
const money = z.coerce.number().finite();
// Optional money that may be explicitly cleared: '' / null means "unset the
// override" and must survive as null, not become 0.
const nullableMoney = z
  .union([z.coerce.number().finite(), z.literal(''), z.null()])
  .transform((v) => (v === '' || v === null ? null : v));
// dd/mm/yyyy from the client, or '' — the sheet's format, kept on the wire.
const dateStr = z.string().trim().max(20).optional().default('');

function toDate(v) {
  if (!v) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v).trim());
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const transactionSchema = z.object({
  project: z.string().min(1),
  facilityNo: facilityNo,
  kind: z.string().max(40).optional().default(''),
  ref: z.string().max(200).optional().default(''),
  desc: z.string().max(2000).optional().default(''),
  start: dateStr,
  due: dateStr,
  amount: money,
  status: z.string().max(60).optional().default('อนุมัติแล้ว'),
  note: z.string().max(2000).optional().default(''),
  source: z.string().max(200).optional().default(''),
  docFrom: z.string().max(200).optional().default(''),
  docTo: z.string().max(200).optional().default(''),
  costCategory: z.string().max(200).optional().default(''),
  purpose: z.string().max(2000).optional().default(''),
  beneficiary: z.string().max(400).optional().default(''),
  refDocFrom: z.string().max(200).optional().default(''),
  refDocTo: z.string().max(200).optional().default(''),
});

const requestSchema = z.object({
  project: z.string().min(1),
  company: z.string().max(400).optional().default(''),
  facilityNo: facilityNo,
  amount: money,
  purpose: z.string().max(2000).optional().default(''),
  beneficiary: z.string().max(400).optional().default(''),
  note: z.string().max(2000).optional().default(''),
  maturity: dateStr,
  source: z.string().max(200).optional().default(''),
  docFrom: z.string().max(200).optional().default(''),
  docTo: z.string().max(200).optional().default(''),
  status: z.string().max(60).optional().default('คำขอใหม่'),
});

const statusSchema = z.object({ status: z.string().min(1).max(60) });

const decisionSchema = z.object({
  // The two Thai literals Code.js decideRequest accepts. An open string here
  // would let a caller invent a status the UI cannot render.
  decision: z.enum(['อนุมัติ', 'ไม่อนุมัติ']),
});

const limitSchema = z.object({
  project: z.string().min(1),
  facilityNo: facilityNo,
  limit: money,
});

const usedOverrideSchema = z.object({
  project: z.string().min(1),
  facilityNo: facilityNo,
  used: nullableMoney,
});

const capSchema = z.object({
  project: z.string().min(1),
  costCategory: z.string().min(1).max(200),
  cap: nullableMoney,
  note: z.string().max(2000).optional().default(''),
});

const costCategoriesSchema = z.object({
  list: z.array(z.string().trim().min(1).max(200)).max(200),
});

const cashPlanQuery = z.object({
  project: z.string().min(1),
  month: z.string().min(1).max(20),
  variant: z.enum(['plan', 'actual']).optional().default('plan'),
});

const cashPlanSchema = z.object({
  id: z.string().max(120).optional(),
  project: z.string().min(1),
  month: z.string().min(1).max(20),
  periodIdx: z.coerce.number().int().min(0),
  periodLabel: z.string().max(200).optional().default(''),
  periodDate: dateStr,
  periodType: z.string().max(40).optional().default('mixed'),
  income: money.optional().default(0),
  workRef: z.string().max(200).optional().default(''),
  paidIds: z.array(z.string()).optional().default([]),
  deductions: z.array(z.object({ label: z.string(), amount: z.coerce.number() })).optional().default([]),
  incomeBreak: z
    .array(
      z.object({
        label: z.string(),
        workValue: z.coerce.number(),
        pnAmount: z.coerce.number(),
        pnDays: z.coerce.number().optional(),
        sub: z.coerce.number().optional(),
        subDate: z.string().optional(),
      })
    )
    .optional()
    .default([]),
  extraRows: z.array(z.object({ label: z.string(), amount: z.coerce.number() })).optional().default([]),
  avalAmount: money.optional().default(0),
  newPNAmount: money.optional().default(0),
  newPNNote: z.string().max(2000).optional().default(''),
  note: z.string().max(2000).optional().default(''),
  showAllDue: z.boolean().optional().default(false),
  variant: z.enum(['plan', 'actual']).optional().default('plan'),
});

const listQuery = z.object({
  project: z.string().min(1).optional(),
  facilityNo: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
});

/* ----------------------------------- read --------------------------------- */

/**
 * The whole workbook in one response — what the client's getData() returns.
 *
 * Six queries in parallel rather than one big join: these are independent
 * tables with no shared key, so joining would multiply rows and then need
 * de-duplicating in JS.
 */
router.get(
  '/data',
  asyncRoute(async (req, res) => {
    const [facilities, costCategories, caps, transactions, requests, projects, facTypes] =
      await Promise.all([
      // facility_used is the view that reproduces the sheet's derived `Used`
      // (override, else the sum of unpaid transactions). Reading it here keeps
      // that calculation in one place instead of duplicating it in JS.
      rows(
        `select f.project, f.facility_no, f.type, f.interest, f.notes,
                coalesce(fu.limit_amt, f.limit_amt) as limit_amt,
                fu.used,
                (l.used_override is not null) as used_overridden
           from credit.facilities f
           left join credit.facility_used fu
             on fu.project = f.project and fu.facility_no = f.facility_no
           left join credit.limits l
             on l.project = f.project and l.facility_no = f.facility_no
          order by f.project, f.facility_no`
      ),
      rows('select name from credit.cost_categories order by sort_order nulls last, name'),
      rows(
        `select project, cost_category, cap, note, updated_at
           from credit.category_caps
          order by project, cost_category`
      ),
      rows('select * from credit.transactions order by updated_at desc'),
      rows('select * from credit.requests order by updated_at desc'),
      // Sent with the bootstrap rather than fetched separately: the UI cannot
      // render a project name, a company filter or a document-kind pill without
      // them, so a second round trip would only add a flash of raw codes.
      rows(
        `select code, name_th, company, sort_order
           from credit.projects
          where active
          order by sort_order nulls last, code`
      ),
      rows(
        `select no, code, name_th, name_en, kind, doc_kind
           from credit.facility_types
          order by no`
      ),
    ]);

    res.json({
      // `isManager` drives which controls the UI renders. It is a hint only —
      // the same fact is re-checked by requireRole on every write below.
      me: { email: req.user.email, isManager: req.user.roles?.credit === 'manager' },
      facilities: facilities.map((f) => {
        const limit = num(f.limit_amt);
        const used = num(f.used);
        return {
          project: f.project,
          facilityNo: f.facility_no,
          type: s(f.type),
          limit,
          used,
          available: limit - used,
          usedOverridden: !!f.used_overridden,
          interest: s(f.interest),
          notes: s(f.notes),
        };
      }),
      costCategories: costCategories.map((c) => c.name),
      categoryCaps: caps.map((c) => ({
        project: c.project,
        costCategory: c.cost_category,
        cap: num(c.cap),
        note: s(c.note),
        updated: dmy(c.updated_at),
      })),
      transactions: transactions.map(toTransaction),
      requests: requests.map(toRequest),
      projects: projects.map((p) => ({
        code: p.code,
        th: p.name_th,
        company: p.company,
        sortOrder: p.sort_order,
      })),
      facTypes: facTypes.map((t) => ({
        no: t.no,
        code: t.code,
        th: t.name_th,
        en: t.name_en,
        kind: t.kind,
        docKind: t.doc_kind,
      })),
    });
  })
);

router.get(
  '/facilities',
  asyncRoute(async (_req, res) => {
    const list = await rows(
      `select project, facility_no, limit_amt, used
         from credit.facility_used
        order by project, facility_no`
    );
    res.json(
      list.map((f) => ({
        project: f.project,
        facilityNo: f.facility_no,
        limit: num(f.limit_amt),
        used: num(f.used),
        available: num(f.limit_amt) - num(f.used),
      }))
    );
  })
);

router.get(
  '/transactions',
  asyncRoute(async (req, res) => {
    const q = listQuery.parse(req.query);
    // Filters are optional. Rather than assembling a where clause by string
    // concatenation, pass every filter as a parameter and let a null one mean
    // "no filter" — same plan, no injection surface.
    const list = await rows(
      `select * from credit.transactions
        where ($1::text is null or project = $1)
          and ($2::text is null or facility_no = $2)
          and ($3::text is null or status = $3)
        order by updated_at desc`,
      [q.project ?? null, q.facilityNo ?? null, q.status ?? null]
    );
    res.json(list.map(toTransaction));
  })
);

router.get(
  '/requests',
  asyncRoute(async (req, res) => {
    const q = listQuery.parse(req.query);
    const list = await rows(
      `select * from credit.requests
        where ($1::text is null or project = $1)
          and ($2::text is null or status = $2)
        order by updated_at desc`,
      [q.project ?? null, q.status ?? null]
    );
    res.json(list.map(toRequest));
  })
);

router.get(
  '/cost-categories',
  asyncRoute(async (_req, res) => {
    const list = await rows('select name from credit.cost_categories order by sort_order nulls last, name');
    res.json(list.map((c) => c.name));
  })
);

/**
 * The projects every other table's `project` column refers to.
 *
 * These were hardcoded arrays in the client until the migration made them real
 * tables. The client needs them for three things it cannot do from codes alone:
 * show Thai project names rather than `BT1`, populate the company filter (which
 * otherwise has nothing to list), and group projects by the legal entity that
 * signs — several projects share one company.
 */
router.get(
  '/projects',
  asyncRoute(async (_req, res) => {
    const list = await rows(
      `select code, name_th, company, sort_order, active
         from credit.projects
        where active
        order by sort_order nulls last, code`
    );
    res.json(
      list.map((p) => ({
        code: p.code,
        th: p.name_th,
        company: p.company,
        sortOrder: p.sort_order,
      }))
    );
  })
);

/**
 * The ten facility types, keyed by the number carried on every facility and
 * transaction. `docKind` drives the BG / T/L / L/G / B/E pills.
 */
router.get(
  '/facility-types',
  asyncRoute(async (_req, res) => {
    const list = await rows(
      `select no, code, name_th, name_en, kind, doc_kind
         from credit.facility_types
        order by no`
    );
    res.json(
      list.map((t) => ({
        no: t.no,
        code: t.code,
        th: t.name_th,
        en: t.name_en,
        kind: t.kind,
        docKind: t.doc_kind,
      }))
    );
  })
);

router.get(
  '/cash-plan',
  asyncRoute(async (req, res) => {
    const q = cashPlanQuery.parse(req.query);
    const list = await rows(
      `select * from credit.cash_plan
        where project = $1 and month = $2 and coalesce(variant, 'plan') = $3
        order by period_idx`,
      [q.project, q.month, q.variant]
    );
    res.json(list.map(toCashPlan));
  })
);

/**
 * The audit trail. Managers only — reading who approved what is not something
 * every signed-in employee needs, even though the RLS policy allowed it.
 */
router.get(
  '/audit',
  manager,
  asyncRoute(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const list = await rows(
      'select id, at, actor, action, target, target_id, changes, note from credit.audit order by at desc limit $1',
      [limit]
    );
    res.json(list);
  })
);

/* ---------------------------------- writes -------------------------------- */

router.post(
  '/transactions',
  manager,
  asyncRoute(async (req, res) => {
    const p = transactionSchema.parse(req.body);
    const id = `TXN-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const row = await tx(async (c) => {
      const ins = await c.query(
        `insert into credit.transactions
           (id, txn_date, project, facility_no, kind, ref, description, start_date, due_date,
            amount, status, created_by, note, source, doc_from, doc_to, cost_category,
            purpose, beneficiary, ref_doc_from, ref_doc_to, updated_at)
         values ($1, current_date, $2, $3, $4, $5, $6, $7, $8,
                 $9, $10, $11, $12, $13, $14, $15, $16,
                 $17, $18, $19, $20, now())
         returning *`,
        [
          id, p.project, p.facilityNo, p.kind, p.ref, p.desc, toDate(p.start), toDate(p.due),
          p.amount, p.status, req.user.email, p.note, p.source, p.docFrom, p.docTo, p.costCategory,
          p.purpose, p.beneficiary, p.refDocFrom, p.refDocTo,
        ]
      );
      await audit(c, req.user.email, 'addTransaction', 'transactions', id, p);
      return ins.rows[0];
    });

    res.status(201).json({ ok: true, id, transaction: toTransaction(row) });
  })
);

router.patch(
  '/transactions/:id',
  manager,
  asyncRoute(async (req, res) => {
    const p = transactionSchema.partial().parse(req.body);

    const row = await tx(async (c) => {
      // coalesce($n, column) applies only the fields the caller actually sent,
      // so a PATCH cannot blank out columns it never mentioned.
      const upd = await c.query(
        `update credit.transactions set
           project       = coalesce($2, project),
           facility_no   = coalesce($3, facility_no),
           kind          = coalesce($4, kind),
           ref           = coalesce($5, ref),
           description   = coalesce($6, description),
           start_date    = coalesce($7, start_date),
           due_date      = coalesce($8, due_date),
           amount        = coalesce($9, amount),
           status        = coalesce($10, status),
           note          = coalesce($11, note),
           source        = coalesce($12, source),
           doc_from      = coalesce($13, doc_from),
           doc_to        = coalesce($14, doc_to),
           cost_category = coalesce($15, cost_category),
           purpose       = coalesce($16, purpose),
           beneficiary   = coalesce($17, beneficiary),
           ref_doc_from  = coalesce($18, ref_doc_from),
           ref_doc_to    = coalesce($19, ref_doc_to),
           updated_at    = now()
         where id = $1
         returning *`,
        [
          req.params.id, p.project ?? null, p.facilityNo ?? null, p.kind ?? null, p.ref ?? null,
          p.desc ?? null, toDate(p.start), toDate(p.due), p.amount ?? null, p.status ?? null,
          p.note ?? null, p.source ?? null, p.docFrom ?? null, p.docTo ?? null,
          p.costCategory ?? null, p.purpose ?? null, p.beneficiary ?? null,
          p.refDocFrom ?? null, p.refDocTo ?? null,
        ]
      );
      if (!upd.rows[0]) return null;
      await audit(c, req.user.email, 'updateTransaction', 'transactions', req.params.id, p);
      return upd.rows[0];
    });

    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true, transaction: toTransaction(row) });
  })
);

router.post(
  '/transactions/:id/status',
  manager,
  asyncRoute(async (req, res) => {
    const { status } = statusSchema.parse(req.body);
    const row = await tx(async (c) => {
      const upd = await c.query(
        'update credit.transactions set status = $2, updated_at = now() where id = $1 returning *',
        [req.params.id, status]
      );
      if (!upd.rows[0]) return null;
      await audit(c, req.user.email, 'setTxnStatus', 'transactions', req.params.id, { status });
      return upd.rows[0];
    });
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true, transaction: toTransaction(row) });
  })
);

/** Settle: mark paid and stamp the date. Mirrors settleTxn() in Code.js. */
router.post(
  '/transactions/:id/settle',
  manager,
  asyncRoute(async (req, res) => {
    const result = await tx(async (c) => {
      // Guard in the UPDATE rather than a read-then-write, so two managers
      // clicking Settle at once cannot both succeed.
      const upd = await c.query(
        `update credit.transactions
            set status = 'ชำระแล้ว', paid_date = current_date, updated_at = now()
          where id = $1 and coalesce(status,'') <> 'ชำระแล้ว' and coalesce(amount,0) > 0
          returning *`,
        [req.params.id]
      );
      if (!upd.rows[0]) return null;
      await audit(c, req.user.email, 'settleTxn', 'transactions', req.params.id, null);
      return upd.rows[0];
    });

    if (!result) {
      // Distinguish "no such row" from "already settled / nothing owing", since
      // the client shows different messages for each.
      const existing = await one('select status, amount from credit.transactions where id = $1', [
        req.params.id,
      ]);
      if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });
      return res.status(409).json({
        error: existing.status === 'ชำระแล้ว' ? 'ALREADY_SETTLED' : 'NOTHING_OWING',
      });
    }
    res.json({ ok: true, transaction: toTransaction(result) });
  })
);

router.delete(
  '/transactions/:id',
  manager,
  asyncRoute(async (req, res) => {
    const deleted = await tx(async (c) => {
      const del = await c.query('delete from credit.transactions where id = $1 returning id', [
        req.params.id,
      ]);
      if (!del.rows[0]) return false;
      await audit(c, req.user.email, 'deleteTxn', 'transactions', req.params.id, null);
      return true;
    });
    if (!deleted) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  })
);

router.post(
  '/requests',
  manager,
  asyncRoute(async (req, res) => {
    const p = requestSchema.parse(req.body);
    const id = `REQ-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const row = await tx(async (c) => {
      const ins = await c.query(
        `insert into credit.requests
           (id, req_date, project, company, facility_no, amount, purpose, beneficiary,
            status, requester, note, maturity, source, doc_from, doc_to, updated_at)
         values ($1, current_date, $2, $3, $4, $5, $6, $7,
                 $8, $9, $10, $11, $12, $13, $14, now())
         returning *`,
        [
          id, p.project, p.company, p.facilityNo, p.amount, p.purpose, p.beneficiary,
          p.status, req.user.email, p.note, toDate(p.maturity), p.source, p.docFrom, p.docTo,
        ]
      );
      await audit(c, req.user.email, 'addRequest', 'requests', id, p);
      return ins.rows[0];
    });

    res.status(201).json({ ok: true, id, request: toRequest(row) });
  })
);

router.patch(
  '/requests/:id',
  manager,
  asyncRoute(async (req, res) => {
    const p = requestSchema.partial().parse(req.body);
    const row = await tx(async (c) => {
      const upd = await c.query(
        `update credit.requests set
           project     = coalesce($2, project),
           company     = coalesce($3, company),
           facility_no = coalesce($4, facility_no),
           amount      = coalesce($5, amount),
           purpose     = coalesce($6, purpose),
           beneficiary = coalesce($7, beneficiary),
           note        = coalesce($8, note),
           maturity    = coalesce($9, maturity),
           source      = coalesce($10, source),
           doc_from    = coalesce($11, doc_from),
           doc_to      = coalesce($12, doc_to),
           status      = coalesce($13, status),
           updated_at  = now()
         where id = $1
         returning *`,
        [
          req.params.id, p.project ?? null, p.company ?? null, p.facilityNo ?? null,
          p.amount ?? null, p.purpose ?? null, p.beneficiary ?? null, p.note ?? null,
          toDate(p.maturity), p.source ?? null, p.docFrom ?? null, p.docTo ?? null,
          p.status ?? null,
        ]
      );
      if (!upd.rows[0]) return null;
      await audit(c, req.user.email, 'updateRequest', 'requests', req.params.id, p);
      return upd.rows[0];
    });
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true, request: toRequest(row) });
  })
);

/**
 * Approve or reject. On approval this also creates the drawdown transaction and
 * links it, exactly as decideRequest() did — one transaction so a request can
 * never end up approved with no matching drawdown.
 */
router.post(
  '/requests/:id/decide',
  manager,
  asyncRoute(async (req, res) => {
    const { decision } = decisionSchema.parse(req.body);

    const result = await tx(async (c) => {
      // `for update` holds the row for the length of the transaction so a
      // second approver waits and then sees the decided status.
      const cur = await c.query('select * from credit.requests where id = $1 for update', [
        req.params.id,
      ]);
      const row = cur.rows[0];
      if (!row) return { error: 'NOT_FOUND', status: 404 };
      if (row.status === 'อนุมัติ' || row.status === 'ไม่อนุมัติ') {
        return { error: 'ALREADY_DECIDED', status: 409 };
      }

      let linkedTxn = row.linked_txn;
      if (decision === 'อนุมัติ' && !linkedTxn) {
        linkedTxn = `TXN-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
        await c.query(
          `insert into credit.transactions
             (id, txn_date, project, facility_no, kind, ref, description, start_date, due_date,
              amount, status, created_by, purpose, beneficiary, cost_category, updated_at)
           values ($1, current_date, $2, $3, '', $4, $5, current_date, $6,
                   $7, 'อนุมัติแล้ว', $8, $9, $10, '', now())`,
          [
            linkedTxn, row.project, row.facility_no, row.id,
            [row.purpose, row.beneficiary].filter(Boolean).join(' — '),
            row.maturity, row.amount, `request:${row.id}`, row.purpose, row.beneficiary,
          ]
        );
      }

      const upd = await c.query(
        `update credit.requests
            set status = $2, decided_by = $3, decided_at = now(),
                linked_txn = $4, updated_at = now()
          where id = $1
          returning *`,
        [req.params.id, decision, req.user.email, linkedTxn]
      );
      await audit(c, req.user.email, 'decideRequest', 'requests', req.params.id, {
        decision,
        linkedTxn,
      });
      return { row: upd.rows[0] };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ ok: true, request: toRequest(result.row) });
  })
);

router.delete(
  '/requests/:id',
  manager,
  asyncRoute(async (req, res) => {
    const deleted = await tx(async (c) => {
      const del = await c.query('delete from credit.requests where id = $1 returning id', [
        req.params.id,
      ]);
      if (!del.rows[0]) return false;
      await audit(c, req.user.email, 'deleteRequest', 'requests', req.params.id, null);
      return true;
    });
    if (!deleted) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  })
);

/** Set the per-facility limit override (Limits.Limit in the sheet). */
router.put(
  '/limits',
  manager,
  asyncRoute(async (req, res) => {
    const p = limitSchema.parse(req.body);
    await tx(async (c) => {
      await c.query(
        `insert into credit.limits (project, facility_no, limit_amt, updated_at)
         values ($1, $2, $3, now())
         on conflict (project, facility_no)
           do update set limit_amt = excluded.limit_amt, updated_at = now()`,
        [p.project, p.facilityNo, p.limit]
      );
      await audit(c, req.user.email, 'setLimit', 'limits', `${p.project}|${p.facilityNo}`, p);
    });
    res.json({ ok: true });
  })
);

/**
 * Pin or unpin the derived `used` figure. A null clears the pin and hands the
 * number back to the facility_used view.
 */
router.put(
  '/limits/used-override',
  manager,
  asyncRoute(async (req, res) => {
    const p = usedOverrideSchema.parse(req.body);
    await tx(async (c) => {
      await c.query(
        `insert into credit.limits (project, facility_no, used_override, updated_at)
         values ($1, $2, $3, now())
         on conflict (project, facility_no)
           do update set used_override = excluded.used_override, updated_at = now()`,
        [p.project, p.facilityNo, p.used]
      );
      await audit(
        c, req.user.email, 'setUsedOverride', 'limits', `${p.project}|${p.facilityNo}`, p
      );
    });
    res.json({ ok: true });
  })
);

router.put(
  '/category-caps',
  manager,
  asyncRoute(async (req, res) => {
    const p = capSchema.parse(req.body);

    // A null cap with no existing row is a no-op, not an insert of an empty
    // budget — matches setCategoryCap() in Code.js.
    if (p.cap === null) {
      const existing = await one(
        'select 1 from credit.category_caps where project = $1 and cost_category = $2',
        [p.project, p.costCategory]
      );
      if (!existing) return res.json({ ok: true });
    }

    await tx(async (c) => {
      await c.query(
        `insert into credit.category_caps (project, cost_category, cap, note, updated_at)
         values ($1, $2, $3, $4, now())
         on conflict (project, cost_category)
           do update set cap = excluded.cap, note = excluded.note, updated_at = now()`,
        [p.project, p.costCategory, p.cap, p.note]
      );
      await audit(
        c, req.user.email, 'setCategoryCap', 'category_caps',
        `${p.project}|${p.costCategory}`, p
      );
    });
    res.json({ ok: true });
  })
);

/**
 * Replace the whole cost-category list. It is a replace rather than a diff
 * because the list is ordered and the client edits it as one array; deleting
 * and re-inserting inside one transaction keeps sort_order consistent.
 */
router.put(
  '/cost-categories',
  manager,
  asyncRoute(async (req, res) => {
    const { list } = costCategoriesSchema.parse(req.body);
    const clean = [...new Set(list.map((x) => x.trim()).filter(Boolean))];

    await tx(async (c) => {
      await c.query('delete from credit.cost_categories');
      if (clean.length) {
        // unnest with ordinality: one round trip regardless of list length,
        // and still fully parameterised.
        await c.query(
          `insert into credit.cost_categories (name, sort_order, updated_at)
           select n, ord, now() from unnest($1::text[]) with ordinality as t(n, ord)`,
          [clean]
        );
      }
      await audit(c, req.user.email, 'setCostCategories', 'cost_categories', null, { list: clean });
    });

    res.json({ ok: true, count: clean.length });
  })
);

router.put(
  '/cash-plan',
  manager,
  asyncRoute(async (req, res) => {
    const p = cashPlanSchema.parse(req.body);
    const id = p.id || `PL-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const row = await tx(async (c) => {
      // Conflict on the natural key as well as the id: the client may save a
      // period it created offline with a fresh id, and the unique
      // (project, month, period_idx, variant) constraint would otherwise 409.
      const up = await c.query(
        `insert into credit.cash_plan
           (id, project, month, period_idx, period_label, period_date, period_type,
            income, work_ref, paid_ids, new_pn_amount, new_pn_note, note,
            deductions, income_break, aval_amount, show_all_due, variant, extra_rows, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7,
                 $8, $9, $10::jsonb, $11, $12, $13,
                 $14::jsonb, $15::jsonb, $16, $17, $18, $19::jsonb, now())
         on conflict (project, month, period_idx, variant) do update set
           period_label  = excluded.period_label,
           period_date   = excluded.period_date,
           period_type   = excluded.period_type,
           income        = excluded.income,
           work_ref      = excluded.work_ref,
           paid_ids      = excluded.paid_ids,
           new_pn_amount = excluded.new_pn_amount,
           new_pn_note   = excluded.new_pn_note,
           note          = excluded.note,
           deductions    = excluded.deductions,
           income_break  = excluded.income_break,
           aval_amount   = excluded.aval_amount,
           show_all_due  = excluded.show_all_due,
           extra_rows    = excluded.extra_rows,
           updated_at    = now()
         returning *`,
        [
          id, p.project, p.month, p.periodIdx, p.periodLabel, toDate(p.periodDate), p.periodType,
          p.income, p.workRef, JSON.stringify(p.paidIds), p.newPNAmount, p.newPNNote, p.note,
          JSON.stringify(p.deductions), JSON.stringify(p.incomeBreak), p.avalAmount,
          p.showAllDue, p.variant, JSON.stringify(p.extraRows),
        ]
      );
      await audit(c, req.user.email, 'saveCashPlanPeriod', 'cash_plan', up.rows[0].id, {
        project: p.project, month: p.month, periodIdx: p.periodIdx, variant: p.variant,
      });
      return up.rows[0];
    });

    res.json({ ok: true, id: row.id, period: toCashPlan(row) });
  })
);

router.delete(
  '/cash-plan/:id',
  manager,
  asyncRoute(async (req, res) => {
    const deleted = await tx(async (c) => {
      const del = await c.query('delete from credit.cash_plan where id = $1 returning id', [
        req.params.id,
      ]);
      if (!del.rows[0]) return false;
      await audit(c, req.user.email, 'deleteCashPlanPeriod', 'cash_plan', req.params.id, null);
      return true;
    });
    if (!deleted) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  })
);

export default router;
