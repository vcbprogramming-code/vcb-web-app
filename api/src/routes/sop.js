// VCB-MANGO ERP SOP.
//
// The whole SOP is ONE JSON document — { meta, scenarios, reports } — held in a
// single row, sop.sop_document, with id fixed at 1. That is deliberate and not
// an unfinished migration: the client reads and writes the tree as a whole
// (getSopDataForClient / renumberAllSteps_), so normalising it into modules and
// steps would mean rebuilding that logic for no gain until something actually
// queries by step.
//
// ACCESS, ported from the RLS policies in
// sop/FOR DEPLOYMENT TEAM/supabase/schema.sql, which no longer run now that the
// browser reaches Postgres through this API rather than directly:
//
//   "sop readable by anyone"        → allowAnonymous. The SOP is reference
//                                     material staff open without signing in;
//                                     requiring auth here would be a regression.
//   "sop writable by editors"       → requireRole('sop','editor')
//   "sop versions readable by …"    → requireRole('sop','editor')
//
// Every mutation reads the document, edits it in Node, and writes it back
// inside one transaction with `select … for update`. Two editors saving at once
// would otherwise last-write-wins away a whole document, not just one field.

import { Router } from 'express';
import { z } from 'zod';
import { one, rows, tx } from '../db.js';
import { allowAnonymous, requireAuth, requireRole } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error.js';

const router = Router();

/* --------------------------------- schemas -------------------------------- */

const attachmentSchema = z.object({
  label: z.string().trim().max(300).default(''),
  url: z.string().trim().url().max(2000),
});

const scenarioCreateSchema = z.object({
  module: z.string().trim().min(1).max(16),
  titleTH: z.string().trim().min(1).max(500),
  titleEN: z.string().trim().max(500).default(''),
  when: z.string().trim().max(2000).default(''),
  steps: z.array(z.string().max(4000)).default([]),
  ref: z.string().trim().max(500).default(''),
  note: z.string().trim().max(2000).default(''),
  extraModules: z.array(z.string().trim().max(16)).default([]),
  attachments: z.array(attachmentSchema).default([]),
});

// Every field optional: an omitted key means "leave alone", which is the
// contract editScenario() in the original Code.js already had. An empty
// `attachments` array is therefore meaningfully different from omitting it —
// it removes them all.
const scenarioEditSchema = z.object({
  module: z.string().trim().min(1).max(16).optional(),
  titleTH: z.string().trim().min(1).max(500).optional(),
  titleEN: z.string().trim().max(500).optional(),
  when: z.string().trim().max(2000).optional(),
  steps: z.array(z.string().max(4000)).optional(),
  ref: z.string().trim().max(500).optional(),
  note: z.string().trim().max(2000).optional(),
  extraModules: z.array(z.string().trim().max(16)).optional(),
  attachments: z.array(attachmentSchema).optional(),
});

const swapSchema = z.object({
  // The target is identified by its displayNo ("PO-5"), not its `no`, because
  // that is the label the editor actually sees on the card.
  swapWith: z.string().trim().min(1).max(32),
});

const reportSchema = z.object({
  case: z.number().int().positive().optional(),
  scenario: z.string().trim().min(1).max(1000),
  path: z.string().trim().min(1).max(1000),
});

const metaSchema = z
  .object({
    title: z.string().trim().max(300).optional(),
    subtitle: z.string().trim().max(500).optional(),
    manual: z.string().trim().max(500).optional(),
    version: z.string().trim().max(100).optional(),
    effective: z.string().trim().max(100).optional(),
    scope: z.string().trim().max(4000).optional(),
    purpose: z.string().trim().max(4000).optional(),
    notes: z.array(z.string().max(2000)).optional(),
  })
  .refine((m) => Object.keys(m).length > 0, { message: 'No fields to update' });

const versionQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
});

/* --------------------------------- helpers -------------------------------- */

const SINGLETON_ID = 1;

/** Read the document. Null when the row has never been seeded. */
async function readDocument() {
  return one(
    'select data, updated_at, updated_by from sop.sop_document where id = $1',
    [SINGLETON_ID]
  );
}

/**
 * Per-module running number ("PO-3"). Recomputed from the current row order on
 * every read and every write, and never persisted as authoritative — deleting a
 * case renumbers everything after it in that module, so a stored value would go
 * stale the moment anyone reorders.
 */
function assignDisplayNo(scenarios) {
  const counters = {};
  for (const s of scenarios) {
    const m = s.module || '?';
    counters[m] = (counters[m] || 0) + 1;
    s.displayNo = `${m}-${counters[m]}`;
  }
  return scenarios;
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

/** Port of formatThaiDate_: "D เดือน พ.ศ." — Buddhist-era year. */
function formatThaiDate(d = new Date()) {
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/**
 * Read-modify-write the document under a row lock.
 *
 * `mutate` receives the parsed document and returns whatever the route should
 * respond with; anything it throws rolls the whole thing back. Writing the
 * document fires the sop_snapshot trigger, so version history happens in the
 * database and cannot be skipped by a route forgetting to snapshot.
 */
async function mutateDocument(actor, mutate) {
  return tx(async (c) => {
    const { rows: r } = await c.query(
      'select data from sop.sop_document where id = $1 for update',
      [SINGLETON_ID]
    );
    if (!r.length) {
      const err = new Error('SOP document has not been seeded');
      err.status = 409;
      err.code = 'NOT_SEEDED';
      throw err;
    }

    const doc = r[0].data;
    doc.meta = doc.meta || {};
    doc.scenarios = doc.scenarios || [];
    doc.reports = doc.reports || [];

    const result = await mutate(doc);

    assignDisplayNo(doc.scenarios);
    doc.meta.updatedAt = new Date().toISOString();

    // isAdmin / userEmail are injected per request by the read route and must
    // never be persisted — they are one caller's session, not document content.
    delete doc.meta.isAdmin;
    delete doc.meta.userEmail;

    await c.query(
      'update sop.sop_document set data = $2::jsonb, updated_by = $3 where id = $1',
      [SINGLETON_ID, JSON.stringify(doc), actor]
    );

    return result;
  });
}

/** The shape the React store expects: the document plus this caller's session. */
function withSession(doc, req) {
  const canEdit = req.user?.roles?.sop === 'editor';
  return {
    ...doc,
    meta: {
      ...(doc.meta || {}),
      isAdmin: canEdit,
      userEmail: req.user?.email || '',
    },
    scenarios: assignDisplayNo(doc.scenarios || []),
    reports: doc.reports || [],
  };
}

/* -------------------------------- document -------------------------------- */

/**
 * The whole SOP. Public — "sop readable by anyone".
 *
 * meta.isAdmin here is a UI hint that decides whether the Edit affordances
 * render. It is not the gate; the write routes below are.
 */
router.get(
  '/',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const row = await readDocument();
    if (!row) return res.status(404).json({ error: 'NOT_SEEDED' });
    res.json(withSession(row.data, req));
  })
);

/** Document metadata (title, version, scope, purpose, notes). */
router.patch(
  '/meta',
  requireAuth,
  requireRole('sop', 'editor'),
  asyncRoute(async (req, res) => {
    const patch = metaSchema.parse(req.body);
    const meta = await mutateDocument(req.user.email, (doc) => {
      Object.assign(doc.meta, patch);
      return doc.meta;
    });
    res.json({ ok: true, meta });
  })
);

/* -------------------------------- scenarios ------------------------------- */

router.get(
  '/scenarios',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const row = await readDocument();
    if (!row) return res.status(404).json({ error: 'NOT_SEEDED' });
    const module = req.query.module ? String(req.query.module) : null;
    const list = assignDisplayNo(row.data.scenarios || []);
    res.json(
      module
        ? list.filter((s) => s.module === module || (s.extraModules || []).includes(module))
        : list
    );
  })
);

router.get(
  '/scenarios/:no',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const no = Number(req.params.no);
    if (!Number.isInteger(no) || no < 1) return res.status(400).json({ error: 'BAD_SCENARIO_NO' });

    const row = await readDocument();
    if (!row) return res.status(404).json({ error: 'NOT_SEEDED' });

    const hit = assignDisplayNo(row.data.scenarios || []).find((s) => s.no === no);
    if (!hit) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(hit);
  })
);

/**
 * Append a case. `no` is always length + 1 — a row-order id, not a per-module
 * one; the per-module label is displayNo, computed on read.
 */
router.post(
  '/scenarios',
  requireAuth,
  requireRole('sop', 'editor'),
  asyncRoute(async (req, res) => {
    const body = scenarioCreateSchema.parse(req.body);

    const created = await mutateDocument(req.user.email, (doc) => {
      const scenario = {
        no: doc.scenarios.length + 1,
        module: body.module,
        titleTH: body.titleTH,
        titleEN: body.titleEN,
        // '-' rather than '' so the card renders a placeholder instead of a
        // blank row where the trigger condition should be.
        when: body.when || '-',
        steps: body.steps,
        ref: body.ref,
        note: body.note,
        // A case is never an "extra" of its own primary module.
        extraModules: body.extraModules.filter((m) => m && m !== body.module),
        attachments: body.attachments,
        dateAdded: formatThaiDate(),
      };
      doc.scenarios.push(scenario);
      return scenario;
    });

    res.status(201).json({ ok: true, no: created.no, scenario: created });
  })
);

router.patch(
  '/scenarios/:no',
  requireAuth,
  requireRole('sop', 'editor'),
  asyncRoute(async (req, res) => {
    const no = Number(req.params.no);
    if (!Number.isInteger(no) || no < 1) return res.status(400).json({ error: 'BAD_SCENARIO_NO' });
    const patch = scenarioEditSchema.parse(req.body);

    const updated = await mutateDocument(req.user.email, (doc) => {
      const idx = doc.scenarios.findIndex((s) => s.no === no);
      if (idx < 0) {
        const err = new Error(`Scenario #${no} not found`);
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      const target = doc.scenarios[idx];
      const nextModule = patch.module ?? target.module;
      const next = {
        ...target,
        module: nextModule,
        titleTH: patch.titleTH ?? target.titleTH,
        titleEN: patch.titleEN ?? target.titleEN,
        when: patch.when ?? target.when,
        steps: patch.steps ?? target.steps,
        note: patch.note ?? target.note,
        ref: patch.ref ?? target.ref,
        extraModules: (patch.extraModules ?? target.extraModules ?? []).filter(
          (m) => m && m !== nextModule
        ),
        attachments: patch.attachments ?? target.attachments,
      };
      doc.scenarios[idx] = next;
      return next;
    });

    res.json({ ok: true, no, scenario: updated });
  })
);

/**
 * Swap two cases' content.
 *
 * The two `no` values stay where they are and only the bodies trade places, so
 * the row count and every other case's position are unaffected. Moving rows
 * instead would renumber `no` for everything in between, and `no` is what the
 * edit and delete routes address a case by.
 */
router.post(
  '/scenarios/:no/swap',
  requireAuth,
  requireRole('sop', 'editor'),
  asyncRoute(async (req, res) => {
    const no = Number(req.params.no);
    if (!Number.isInteger(no) || no < 1) return res.status(400).json({ error: 'BAD_SCENARIO_NO' });
    const { swapWith } = swapSchema.parse(req.body);

    await mutateDocument(req.user.email, (doc) => {
      // displayNo is not stored, so recompute before matching swapWith.
      assignDisplayNo(doc.scenarios);

      const aIdx = doc.scenarios.findIndex((s) => s.no === no);
      if (aIdx < 0) {
        const err = new Error(`Scenario #${no} not found`);
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      const bIdx = doc.scenarios.findIndex((s) => s.displayNo === swapWith);
      if (bIdx < 0) {
        const err = new Error(`Case "${swapWith}" not found`);
        err.status = 404;
        err.code = 'SWAP_TARGET_NOT_FOUND';
        throw err;
      }
      if (aIdx === bIdx) {
        const err = new Error('Cannot swap a case with itself');
        err.status = 400;
        err.code = 'SWAP_SELF';
        throw err;
      }

      const { no: aNo, ...aRest } = doc.scenarios[aIdx];
      const { no: bNo, ...bRest } = doc.scenarios[bIdx];
      doc.scenarios[aIdx] = { no: aNo, ...bRest };
      doc.scenarios[bIdx] = { no: bNo, ...aRest };
    });

    const row = await readDocument();
    res.json({ ok: true, scenarios: (row?.data.scenarios || []).length });
  })
);

/**
 * Delete a case. Every later case in the same module renumbers up by one, which
 * costs nothing because displayNo is always recomputed and never stored.
 */
router.delete(
  '/scenarios/:no',
  requireAuth,
  requireRole('sop', 'editor'),
  asyncRoute(async (req, res) => {
    const no = Number(req.params.no);
    if (!Number.isInteger(no) || no < 1) return res.status(400).json({ error: 'BAD_SCENARIO_NO' });

    const remaining = await mutateDocument(req.user.email, (doc) => {
      const idx = doc.scenarios.findIndex((s) => s.no === no);
      if (idx < 0) {
        const err = new Error(`Scenario #${no} not found`);
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      doc.scenarios.splice(idx, 1);
      return doc.scenarios.length;
    });

    res.json({ ok: true, scenarios: remaining });
  })
);

/* --------------------------------- reports -------------------------------- */
//
// The "which report do I run" table. No server-assigned id: `case` is a label
// the caller supplies, defaulting to the next row number.

router.get(
  '/reports',
  allowAnonymous,
  asyncRoute(async (_req, res) => {
    const row = await readDocument();
    if (!row) return res.status(404).json({ error: 'NOT_SEEDED' });
    res.json(row.data.reports || []);
  })
);

router.post(
  '/reports',
  requireAuth,
  requireRole('sop', 'editor'),
  asyncRoute(async (req, res) => {
    const body = reportSchema.parse(req.body);

    const created = await mutateDocument(req.user.email, (doc) => {
      const report = {
        case: body.case ?? doc.reports.length + 1,
        scenario: body.scenario,
        path: body.path,
      };
      doc.reports.push(report);
      return report;
    });

    res.status(201).json({ ok: true, report: created });
  })
);

router.delete(
  '/reports/:case',
  requireAuth,
  requireRole('sop', 'editor'),
  asyncRoute(async (req, res) => {
    const caseNo = Number(req.params.case);
    if (!Number.isInteger(caseNo)) return res.status(400).json({ error: 'BAD_CASE_NO' });

    const remaining = await mutateDocument(req.user.email, (doc) => {
      const idx = doc.reports.findIndex((r) => r.case === caseNo);
      if (idx < 0) {
        const err = new Error(`Report #${caseNo} not found`);
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      doc.reports.splice(idx, 1);
      return doc.reports.length;
    });

    res.json({ ok: true, reports: remaining });
  })
);

/* -------------------------------- versions -------------------------------- */
//
// "sop versions readable by editors". Rows are written by the sop_snapshot
// trigger on every update, never by a client — so there is no POST here, and a
// version list is a strictly editor-facing view of pre-edit content.

router.get(
  '/versions',
  requireAuth,
  requireRole('sop', 'editor'),
  asyncRoute(async (req, res) => {
    const { limit } = versionQuerySchema.parse(req.query);
    // The payloads are whole SOP documents, so the list deliberately omits
    // `data` — fetching 50 full trees to render a dropdown would be absurd.
    const list = await rows(
      `select id, taken_at, taken_by, note
         from sop.sop_versions
        order by taken_at desc, id desc
        limit $1`,
      [limit]
    );
    res.json(
      list.map((v) => ({
        id: String(v.id),
        takenAt: v.taken_at,
        takenBy: v.taken_by || '',
        note: v.note || '',
      }))
    );
  })
);

router.get(
  '/versions/:id',
  requireAuth,
  requireRole('sop', 'editor'),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'BAD_VERSION_ID' });

    const v = await one(
      'select id, taken_at, taken_by, note, data from sop.sop_versions where id = $1',
      [id]
    );
    if (!v) return res.status(404).json({ error: 'NOT_FOUND' });

    res.json({
      id: String(v.id),
      takenAt: v.taken_at,
      takenBy: v.taken_by || '',
      note: v.note || '',
      data: { ...v.data, scenarios: assignDisplayNo(v.data.scenarios || []) },
    });
  })
);

/**
 * Restore a past version.
 *
 * Writing the old document back is an ordinary update, so the trigger snapshots
 * the CURRENT document first — a restore is itself undoable, and no history is
 * lost by rolling back.
 */
router.post(
  '/versions/:id/restore',
  requireAuth,
  requireRole('sop', 'editor'),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'BAD_VERSION_ID' });

    const restored = await tx(async (c) => {
      const { rows: v } = await c.query('select data from sop.sop_versions where id = $1', [id]);
      if (!v.length) {
        const err = new Error('Version not found');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }

      await c.query('select 1 from sop.sop_document where id = $1 for update', [SINGLETON_ID]);

      const doc = v[0].data;
      doc.meta = doc.meta || {};
      doc.meta.updatedAt = new Date().toISOString();
      delete doc.meta.isAdmin;
      delete doc.meta.userEmail;

      const { rowCount } = await c.query(
        'update sop.sop_document set data = $2::jsonb, updated_by = $3 where id = $1',
        [SINGLETON_ID, JSON.stringify(doc), req.user.email]
      );
      if (!rowCount) {
        const err = new Error('SOP document has not been seeded');
        err.status = 409;
        err.code = 'NOT_SEEDED';
        throw err;
      }
      return doc;
    });

    res.json({ ok: true, restoredFrom: String(id), scenarios: (restored.scenarios || []).length });
  })
);

export default router;
