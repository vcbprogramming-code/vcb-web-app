import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne } from '../config/db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';

// =============================================================================
// Module 5 — SOP (คู่มือปฏิบัติงาน). Reference content everyone reads and
// editors maintain: case studies (+ ordered steps, multi-module tags), the
// report-menu register, and swimlane process flows.
// =============================================================================
const router = Router();
router.use(requireAuth);

const canView = requirePermission('sop', 'view');
const canEdit = requirePermission('sop', 'edit');

/** 'PO-3' — derived per module from sort_order, so deleting/reordering can't
 *  leave stale numbers behind. Recomputed on every read, like the source app. */
function withDisplayNo(rows) {
  const seen = new Map();
  return rows.map((r) => {
    const n = (seen.get(r.module) || 0) + 1;
    seen.set(r.module, n);
    return { ...r, display_no: `${r.module}-${n}` };
  });
}

/** Scenarios ordered the way display numbers are assigned (module, then position). */
async function allScenariosOrdered() {
  const { rows } = await query(
    `select no, module, sort_order, title_th, title_en, problem, ref, note, date_added
       from sop_scenarios
      order by module, sort_order, no`
  );
  return withDisplayNo(rows);
}

// ── read ────────────────────────────────────────────────────────────────────

/** GET /api/sop/bootstrap — modules, doc meta and per-module counts. */
router.get('/bootstrap', canView, asyncHandler(async (req, res) => {
  const [mods, meta, sc, fl, rp] = await Promise.all([
    query('select code, name_th_short, name_en_short, name_th, name_en, desc_th, desc_en from sop_modules order by sort_order, code'),
    queryOne('select title, subtitle, manual, version, effective, scope, purpose, notes, updated_at from sop_meta where id = true'),
    query('select module, count(*)::int as n from sop_scenarios group by module'),
    query('select module, count(*)::int as n from sop_flows group by module'),
    query('select count(*)::int as n from sop_reports'),
  ]);
  const byMod = (rows) => Object.fromEntries(rows.rows.map((r) => [r.module, r.n]));
  res.json({
    data: {
      modules: mods.rows,
      meta: meta || null,
      counts: { scenarios: byMod(sc), flows: byMod(fl), reports: rp.rows[0]?.n || 0 },
      canEdit: req.profile.role === 'admin' || req.profile.permissions?.sop?.edit === true,
    },
  });
}));

/** GET /api/sop/scenarios?module=&q= — list (search covers title + problem + steps). */
router.get('/scenarios', canView, asyncHandler(async (req, res) => {
  const mod = Array.isArray(req.query.module) ? req.query.module[0] : req.query.module;
  const q = String(Array.isArray(req.query.q) ? req.query.q[0] : (req.query.q || '')).trim();

  let rows = await allScenariosOrdered();
  // a case tagged into another module also appears in that module's list
  const { rows: tags } = await query('select scenario_no, module from sop_scenario_modules');
  const extraBy = new Map();
  for (const t of tags) extraBy.set(t.scenario_no, [...(extraBy.get(t.scenario_no) || []), t.module]);
  rows = rows.map((r) => ({ ...r, extra_modules: extraBy.get(r.no) || [] }));

  if (mod) rows = rows.filter((r) => r.module === mod || r.extra_modules.includes(mod));
  if (q) {
    const { rows: hits } = await query(
      `select distinct s.no from sop_scenarios s
         left join sop_scenario_steps st on st.scenario_no = s.no
        where s.title_th ilike $1 or coalesce(s.title_en,'') ilike $1
           or s.problem ilike $1 or coalesce(st.text,'') ilike $1`,
      [`%${q}%`]
    );
    const ok = new Set(hits.map((h) => h.no));
    rows = rows.filter((r) => ok.has(r.no));
  }
  res.json({ data: rows });
}));

/** GET /api/sop/scenarios/:no — one case with its steps + tags. */
router.get('/scenarios/:no', canView, asyncHandler(async (req, res) => {
  const no = Number(req.params.no);
  if (!Number.isInteger(no)) throw new ApiError(404, 'ไม่พบกรณีศึกษา');
  const all = await allScenariosOrdered();
  const row = all.find((r) => r.no === no);
  if (!row) throw new ApiError(404, 'ไม่พบกรณีศึกษา');
  const [steps, tags] = await Promise.all([
    query('select step_order, is_substep, text from sop_scenario_steps where scenario_no = $1 order by step_order', [no]),
    query('select module from sop_scenario_modules where scenario_no = $1', [no]),
  ]);
  res.json({ data: { ...row, steps: steps.rows, extra_modules: tags.rows.map((t) => t.module) } });
}));

/** GET /api/sop/flows?module= — swimlane diagrams (full documents). */
router.get('/flows', canView, asyncHandler(async (req, res) => {
  const mod = Array.isArray(req.query.module) ? req.query.module[0] : req.query.module;
  const { rows } = mod
    ? await query('select * from sop_flows where module = $1 order by sort_order, id', [mod])
    : await query('select * from sop_flows order by sort_order, id');
  res.json({ data: rows });
}));

/** GET /api/sop/reports — the report-menu register. */
router.get('/reports', canView, asyncHandler(async (req, res) => {
  // case_no is the register's own running number, not a case reference — see
  // migration 0038.
  const { rows } = await query(
    `select id, case_no, scenario_text, report_path, sort_order
       from sop_reports order by sort_order, id`
  );
  res.json({ data: rows });
}));

// ── write (sop.edit) ────────────────────────────────────────────────────────

const stepSchema = z.object({ text: z.string().trim().min(1), isSubstep: z.boolean().optional() });
const scenarioSchema = z.object({
  module: z.string().min(1).max(10),
  titleTh: z.string().trim().min(1).max(500),
  titleEn: z.string().max(500).optional().nullable(),
  problem: z.string().max(8000).optional().nullable(),
  ref: z.string().max(500).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  dateAdded: z.string().max(100).optional().nullable(),
  steps: z.array(stepSchema).max(200).optional(),
  extraModules: z.array(z.string().max(10)).max(11).optional(),
});

async function assertModule(code) {
  const m = await queryOne('select code from sop_modules where code = $1', [code]);
  if (!m) throw new ApiError(400, 'ไม่พบหมวดงานที่เลือก');
}

/** Replace a case's steps + tags inside an open transaction. */
async function writeChildren(client, no, steps, extraModules, primaryModule) {
  if (steps) {
    await client.query('delete from sop_scenario_steps where scenario_no = $1', [no]);
    let i = 0;
    for (const s of steps) {
      i += 1;
      await client.query(
        'insert into sop_scenario_steps (scenario_no, step_order, is_substep, text) values ($1,$2,$3,$4)',
        [no, i, Boolean(s.isSubstep), s.text.trim()]
      );
    }
  }
  if (extraModules) {
    await client.query('delete from sop_scenario_modules where scenario_no = $1', [no]);
    // the primary module is implicit — never store it as an extra tag
    for (const m of [...new Set(extraModules)].filter((m) => m && m !== primaryModule)) {
      await client.query(
        'insert into sop_scenario_modules (scenario_no, module) values ($1,$2) on conflict do nothing',
        [no, m]
      );
    }
  }
}

router.post('/scenarios', canEdit, asyncHandler(async (req, res) => {
  const p = scenarioSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const f = p.data;
  await assertModule(f.module);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows: nx } = await client.query('select coalesce(max(no),0)+1 as no from sop_scenarios');
    const no = nx[0].no;
    const { rows: so } = await client.query(
      'select coalesce(max(sort_order),0)+1 as s from sop_scenarios where module = $1', [f.module]
    );
    await client.query(
      `insert into sop_scenarios (no, module, sort_order, title_th, title_en, problem, ref, note, date_added)
       values ($1,$2,$3,$4,$5,coalesce($6,''),$7,$8,$9)`,
      [no, f.module, so[0].s, f.titleTh, f.titleEn || null, f.problem, f.ref || null, f.note || null, f.dateAdded || null]
    );
    await writeChildren(client, no, f.steps || [], f.extraModules || [], f.module);
    await client.query('commit');
    res.status(201).json({ data: { no } });
  } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
}));

router.patch('/scenarios/:no', canEdit, asyncHandler(async (req, res) => {
  const no = Number(req.params.no);
  if (!Number.isInteger(no)) throw new ApiError(404, 'ไม่พบกรณีศึกษา');
  const p = scenarioSchema.partial().safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const f = p.data;
  if (f.module) await assertModule(f.module);
  const cur = await queryOne('select module from sop_scenarios where no = $1', [no]);
  if (!cur) throw new ApiError(404, 'ไม่พบกรณีศึกษา');

  const map = { module: 'module', titleTh: 'title_th', titleEn: 'title_en', problem: 'problem', ref: 'ref', note: 'note', dateAdded: 'date_added' };
  const sets = []; const vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (f[k] !== undefined) { vals.push(f[k] === '' ? null : f[k]); sets.push(`${col} = $${vals.length}`); }
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    if (sets.length) {
      vals.push(no);
      await client.query(`update sop_scenarios set ${sets.join(', ')} where no = $${vals.length}`, vals);
    }
    await writeChildren(client, no, f.steps, f.extraModules, f.module || cur.module);
    await client.query('commit');
  } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
  res.json({ data: { no } });
}));

router.delete('/scenarios/:no', canEdit, asyncHandler(async (req, res) => {
  const no = Number(req.params.no);
  if (!Number.isInteger(no)) throw new ApiError(404, 'ไม่พบกรณีศึกษา');
  // steps/tags cascade; reports keep their row but lose the link (set null)
  const row = await queryOne('delete from sop_scenarios where no = $1 returning no', [no]);
  if (!row) throw new ApiError(404, 'ไม่พบกรณีศึกษา');
  res.json({ data: { deleted: true } });
}));

/** POST /api/sop/scenarios/:no/move — swap position with the neighbour (up/down). */
router.post('/scenarios/:no/move', canEdit, asyncHandler(async (req, res) => {
  const no = Number(req.params.no);
  const dir = req.body?.direction;
  if (!Number.isInteger(no) || !['up', 'down'].includes(dir)) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง');
  const me = await queryOne('select no, module, sort_order from sop_scenarios where no = $1', [no]);
  if (!me) throw new ApiError(404, 'ไม่พบกรณีศึกษา');
  const neighbour = await queryOne(
    dir === 'up'
      ? `select no, sort_order from sop_scenarios where module = $1 and (sort_order, no) < ($2, $3)
          order by sort_order desc, no desc limit 1`
      : `select no, sort_order from sop_scenarios where module = $1 and (sort_order, no) > ($2, $3)
          order by sort_order, no limit 1`,
    [me.module, me.sort_order, me.no]
  );
  if (!neighbour) return res.json({ data: { moved: false } }); // already at the edge
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('update sop_scenarios set sort_order = $1 where no = $2', [neighbour.sort_order, me.no]);
    await client.query('update sop_scenarios set sort_order = $1 where no = $2', [me.sort_order, neighbour.no]);
    await client.query('commit');
  } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
  res.json({ data: { moved: true } });
}));

// ── reports register (sop.edit) ─────────────────────────────────────────────

const reportSchema = z.object({
  caseNo: z.number().int().min(1).max(9999).optional().nullable(),
  scenarioText: z.string().trim().min(1).max(1000),
  reportPath: z.string().trim().min(1).max(500),
});

router.post('/reports', canEdit, asyncHandler(async (req, res) => {
  const p = reportSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  // both numbers continue the register; the editor may override case_no.
  const so = await queryOne('select coalesce(max(sort_order),0)+1 as s, coalesce(max(case_no),0)+1 as c from sop_reports');
  const row = await queryOne(
    `insert into sop_reports (case_no, scenario_text, report_path, sort_order)
     values ($1,$2,$3,$4) returning id, case_no, scenario_text, report_path, sort_order`,
    [p.data.caseNo || so.c, p.data.scenarioText, p.data.reportPath, so.s]
  );
  res.status(201).json({ data: row });
}));

router.patch('/reports/:id', canEdit, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(404, 'ไม่พบรายการ');
  const p = reportSchema.partial().safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const map = { caseNo: 'case_no', scenarioText: 'scenario_text', reportPath: 'report_path' };
  const sets = []; const vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (p.data[k] !== undefined) { vals.push(p.data[k] === '' ? null : p.data[k]); sets.push(`${col} = $${vals.length}`); }
  }
  if (!sets.length) throw new ApiError(400, 'ไม่มีข้อมูลที่ต้องแก้ไข');
  vals.push(id);
  const row = await queryOne(
    `update sop_reports set ${sets.join(', ')} where id = $${vals.length}
     returning id, case_no, scenario_text, report_path, sort_order`, vals
  );
  if (!row) throw new ApiError(404, 'ไม่พบรายการ');
  res.json({ data: row });
}));

router.delete('/reports/:id', canEdit, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(404, 'ไม่พบรายการ');
  const row = await queryOne('delete from sop_reports where id = $1 returning id', [id]);
  if (!row) throw new ApiError(404, 'ไม่พบรายการ');
  res.json({ data: { deleted: true } });
}));

export default router;
