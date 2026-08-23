import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { hasPermission } from '../config/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';

// =============================================================================
// แผนผังระบบ (System Operating Map) — how the group actually works, as data.
//
// Reference material the whole company reads: a swimlane of the process, the
// register of every function each department performs, and where automation was
// judged to pay off. Upstream this lived in source files that only a developer
// could change; here an admin maintains it in place.
//
// Bilingual throughout: each row carries English and Thai, and a blank Thai
// value falls back to the English rather than rendering an empty box.
// =============================================================================
const router = Router();
router.use(requireAuth);

const canView = requirePermission('sysmap', 'view');
const canEdit = requirePermission('sysmap', 'edit');

/** Ids are author-supplied text ('n-bd-pipeline'), so keep them to a safe shape. */
const idRe = /^[a-zA-Z0-9._-]{1,64}$/;
const idField = z.string().trim().regex(idRe, 'ใช้ได้เฉพาะ a-z 0-9 . _ -');
const text = (max = 4000) => z.string().trim().max(max);

// ── read ────────────────────────────────────────────────────────────────────

/** GET /api/sysmap/bootstrap — everything the map needs to draw itself.
 *  One round trip on purpose: the diagram is meaningless in pieces, and every
 *  part of it is small (10 lanes, 79 nodes, 129 edges). */
router.get('/bootstrap', canView, asyncHandler(async (req, res) => {
  const [depts, modules, lanes, nodes, conns] = await Promise.all([
    query('select key, name_en, name_th, short, color, icon from sysmap_depts order by sort_order, key'),
    query('select code, name, purpose from sysmap_modules order by sort_order, code'),
    query('select id, label_en, label_th, sort_order from sysmap_lanes order by sort_order, id'),
    query(`select id, lane_id, node_type, dept, dept2, standalone, at_site, label_en, label_th,
                  sub_en, sub_th, desc_en, desc_th, module, unverified, erp_style, erp_label,
                  items_en, items_th, sort_order
             from sysmap_nodes order by sort_order, id`),
    query('select id, from_node, to_node, conn_type, label, feedback from sysmap_conns order by id'),
  ]);
  res.json({
    data: {
      depts: depts.rows,
      modules: modules.rows,
      lanes: lanes.rows,
      nodes: nodes.rows,
      conns: conns.rows,
      // via the resolver: a right granted by the role is not in the override map
      canEdit: hasPermission(req.profile, 'sysmap', 'edit'),
      counts: { lanes: lanes.rows.length, nodes: nodes.rows.length, conns: conns.rows.length },
    },
  });
}));

/** GET /api/sysmap/functions — the department function register. */
router.get('/functions', canView, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select code, dept, name_en, name_th, erp_type, module, notes_en, notes_th,
            external_entry, at_site, sort_order
       from sysmap_functions order by dept, sort_order, code`
  );
  res.json({ data: rows });
}));

/** GET /api/sysmap/ai — where automation was judged to pay off. */
router.get('/ai', canView, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `select key, title_en, title_th, impact, effort, desc_en, desc_th, tool
       from sysmap_ai_opps order by sort_order, key`
  );
  res.json({ data: rows });
}));

// ── write ───────────────────────────────────────────────────────────────────

const laneSchema = z.object({
  id: idField,
  label_en: text(200),
  label_th: text(200).optional().default(''),
  sort_order: z.number().int().optional(),
});

router.post('/lanes', canEdit, asyncHandler(async (req, res) => {
  const p = laneSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const dup = await queryOne('select id from sysmap_lanes where id = $1', [p.data.id]);
  if (dup) throw new ApiError(409, 'มีเลนรหัสนี้อยู่แล้ว');
  const next = await queryOne('select coalesce(max(sort_order), -1) + 1 as n from sysmap_lanes');
  const row = await queryOne(
    `insert into sysmap_lanes (id, label_en, label_th, sort_order) values ($1,$2,$3,$4) returning *`,
    [p.data.id, p.data.label_en, p.data.label_th, p.data.sort_order ?? next.n]
  );
  res.status(201).json({ data: row });
}));

router.patch('/lanes/:id', canEdit, asyncHandler(async (req, res) => {
  const p = laneSchema.partial().omit({ id: true }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const row = await queryOne(
    `update sysmap_lanes set
       label_en = coalesce($2, label_en), label_th = coalesce($3, label_th),
       sort_order = coalesce($4, sort_order)
     where id = $1 returning *`,
    [req.params.id, p.data.label_en ?? null, p.data.label_th ?? null, p.data.sort_order ?? null]
  );
  if (!row) throw new ApiError(404, 'ไม่พบเลนนี้');
  res.json({ data: row });
}));

router.delete('/lanes/:id', canEdit, asyncHandler(async (req, res) => {
  // Refuse rather than cascade: a lane holds the boxes, and deleting it would
  // silently take a chunk of the process map with it.
  const n = await queryOne('select count(*)::int as n from sysmap_nodes where lane_id = $1', [req.params.id]);
  if (n.n > 0) throw new ApiError(409, `เลนนี้ยังมีกล่องงานอยู่ ${n.n} กล่อง — ย้ายหรือลบกล่องออกก่อน`);
  const row = await queryOne('delete from sysmap_lanes where id = $1 returning id', [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบเลนนี้');
  res.json({ data: { ok: true } });
}));

const nodeSchema = z.object({
  id: idField,
  lane_id: idField,
  node_type: z.enum(['erp', 'manual']).default('manual'),
  dept: text(32).optional().default(''),
  dept2: text(32).optional().default(''),
  standalone: z.boolean().optional().default(false),
  at_site: z.boolean().optional().default(false),
  label_en: text(200),
  label_th: text(200).optional().default(''),
  sub_en: text(200).optional().default(''),
  sub_th: text(200).optional().default(''),
  desc_en: text().optional().default(''),
  desc_th: text().optional().default(''),
  module: text(32).optional().default(''),
  unverified: z.boolean().optional().default(false),
  erp_style: text(32).optional().default(''),
  erp_label: text(120).optional().default(''),
  items_en: z.array(text(500)).max(40).optional().default([]),
  items_th: z.array(text(500)).max(40).optional().default([]),
  sort_order: z.number().int().optional(),
});

const NODE_COLS = ['lane_id', 'node_type', 'dept', 'dept2', 'standalone', 'at_site',
  'label_en', 'label_th', 'sub_en', 'sub_th', 'desc_en', 'desc_th', 'module',
  'unverified', 'erp_style', 'erp_label', 'items_en', 'items_th', 'sort_order'];

router.post('/nodes', canEdit, asyncHandler(async (req, res) => {
  const p = nodeSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const lane = await queryOne('select id from sysmap_lanes where id = $1', [p.data.lane_id]);
  if (!lane) throw new ApiError(400, 'ไม่พบเลนที่ระบุ');
  const dup = await queryOne('select id from sysmap_nodes where id = $1', [p.data.id]);
  if (dup) throw new ApiError(409, 'มีกล่องงานรหัสนี้อยู่แล้ว');
  const next = await queryOne(
    'select coalesce(max(sort_order), -1) + 1 as n from sysmap_nodes where lane_id = $1', [p.data.lane_id]);
  const d = { ...p.data, sort_order: p.data.sort_order ?? next.n };
  const row = await queryOne(
    `insert into sysmap_nodes (id, ${NODE_COLS.join(', ')})
     values ($1, ${NODE_COLS.map((_, i) => `$${i + 2}`).join(', ')})
     returning *`,
    [d.id, ...NODE_COLS.map((c) => (c === 'items_en' || c === 'items_th' ? JSON.stringify(d[c]) : d[c]))]
  );
  res.status(201).json({ data: row });
}));

router.patch('/nodes/:id', canEdit, asyncHandler(async (req, res) => {
  const p = nodeSchema.partial().omit({ id: true }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const given = NODE_COLS.filter((c) => p.data[c] !== undefined);
  if (!given.length) throw new ApiError(400, 'ไม่มีข้อมูลที่จะแก้');
  if (p.data.lane_id) {
    const lane = await queryOne('select id from sysmap_lanes where id = $1', [p.data.lane_id]);
    if (!lane) throw new ApiError(400, 'ไม่พบเลนที่ระบุ');
  }
  const sets = given.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const vals = given.map((c) => (c === 'items_en' || c === 'items_th' ? JSON.stringify(p.data[c]) : p.data[c]));
  const row = await queryOne(
    `update sysmap_nodes set ${sets} where id = $1 returning *`, [req.params.id, ...vals]);
  if (!row) throw new ApiError(404, 'ไม่พบกล่องงานนี้');
  res.json({ data: row });
}));

router.delete('/nodes/:id', canEdit, asyncHandler(async (req, res) => {
  // Its edges go with it — an edge with a missing end draws a line to nowhere.
  // Say how many, so the editor knows what the delete actually cost.
  const c = await queryOne(
    'select count(*)::int as n from sysmap_conns where from_node = $1 or to_node = $1', [req.params.id]);
  const row = await queryOne('delete from sysmap_nodes where id = $1 returning id', [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบกล่องงานนี้');
  res.json({ data: { ok: true, removedConns: c.n } });
}));

const connSchema = z.object({
  from_node: idField,
  to_node: idField,
  conn_type: z.enum(['trigger', 'conditional', 'feeds', 'deferred']).default('feeds'),
  label: text(200).optional().default(''),
  feedback: z.boolean().optional().default(false),
});

router.post('/conns', canEdit, asyncHandler(async (req, res) => {
  const p = connSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const { from_node: from, to_node: to } = p.data;
  if (from === to) throw new ApiError(400, 'ต้นทางกับปลายทางเป็นกล่องเดียวกันไม่ได้');
  const ends = await query('select id from sysmap_nodes where id = any($1)', [[from, to]]);
  if (ends.rows.length !== 2) throw new ApiError(400, 'ไม่พบกล่องงานต้นทางหรือปลายทาง');
  const dup = await queryOne(
    'select id from sysmap_conns where from_node = $1 and to_node = $2 and conn_type = $3',
    [from, to, p.data.conn_type]);
  if (dup) throw new ApiError(409, 'มีเส้นเชื่อมแบบนี้ระหว่างสองกล่องนี้อยู่แล้ว');
  const row = await queryOne(
    `insert into sysmap_conns (from_node, to_node, conn_type, label, feedback)
     values ($1,$2,$3,$4,$5) returning *`,
    [from, to, p.data.conn_type, p.data.label, p.data.feedback]);
  res.status(201).json({ data: row });
}));

router.delete('/conns/:id', canEdit, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(404, 'ไม่พบเส้นเชื่อมนี้');
  const row = await queryOne('delete from sysmap_conns where id = $1 returning id', [id]);
  if (!row) throw new ApiError(404, 'ไม่พบเส้นเชื่อมนี้');
  res.json({ data: { ok: true } });
}));

const fnSchema = z.object({
  code: idField,
  dept: text(32).optional().default(''),
  name_en: text(300),
  name_th: text(300).optional().default(''),
  erp_type: text(60).optional().default(''),
  module: text(60).optional().default(''),
  notes_en: text().optional().default(''),
  notes_th: text().optional().default(''),
  external_entry: z.boolean().optional().default(false),
  at_site: z.boolean().optional().default(false),
  sort_order: z.number().int().optional(),
});
const FN_COLS = ['dept', 'name_en', 'name_th', 'erp_type', 'module', 'notes_en',
  'notes_th', 'external_entry', 'at_site', 'sort_order'];

router.post('/functions', canEdit, asyncHandler(async (req, res) => {
  const p = fnSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const dup = await queryOne('select code from sysmap_functions where code = $1', [p.data.code]);
  if (dup) throw new ApiError(409, 'มีรหัสฟังก์ชันนี้อยู่แล้ว');
  const next = await queryOne(
    'select coalesce(max(sort_order), -1) + 1 as n from sysmap_functions where dept = $1', [p.data.dept]);
  const d = { ...p.data, sort_order: p.data.sort_order ?? next.n };
  const row = await queryOne(
    `insert into sysmap_functions (code, ${FN_COLS.join(', ')})
     values ($1, ${FN_COLS.map((_, i) => `$${i + 2}`).join(', ')}) returning *`,
    [d.code, ...FN_COLS.map((c) => d[c])]);
  res.status(201).json({ data: row });
}));

router.patch('/functions/:code', canEdit, asyncHandler(async (req, res) => {
  const p = fnSchema.partial().omit({ code: true }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const given = FN_COLS.filter((c) => p.data[c] !== undefined);
  if (!given.length) throw new ApiError(400, 'ไม่มีข้อมูลที่จะแก้');
  const sets = given.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const row = await queryOne(
    `update sysmap_functions set ${sets} where code = $1 returning *`,
    [req.params.code, ...given.map((c) => p.data[c])]);
  if (!row) throw new ApiError(404, 'ไม่พบฟังก์ชันนี้');
  res.json({ data: row });
}));

router.delete('/functions/:code', canEdit, asyncHandler(async (req, res) => {
  const row = await queryOne('delete from sysmap_functions where code = $1 returning code', [req.params.code]);
  if (!row) throw new ApiError(404, 'ไม่พบฟังก์ชันนี้');
  res.json({ data: { ok: true } });
}));

const aiSchema = z.object({
  key: idField,
  title_en: text(300),
  title_th: text(300).optional().default(''),
  impact: z.enum(['High', 'Medium', 'Low']).default('Medium'),
  effort: z.enum(['High', 'Medium', 'Low']).default('Medium'),
  desc_en: text().optional().default(''),
  desc_th: text().optional().default(''),
  tool: text(200).optional().default(''),
  sort_order: z.number().int().optional(),
});
const AI_COLS = ['title_en', 'title_th', 'impact', 'effort', 'desc_en', 'desc_th', 'tool', 'sort_order'];

router.post('/ai', canEdit, asyncHandler(async (req, res) => {
  const p = aiSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const dup = await queryOne('select key from sysmap_ai_opps where key = $1', [p.data.key]);
  if (dup) throw new ApiError(409, 'มีรายการรหัสนี้อยู่แล้ว');
  const next = await queryOne('select coalesce(max(sort_order), -1) + 1 as n from sysmap_ai_opps');
  const d = { ...p.data, sort_order: p.data.sort_order ?? next.n };
  const row = await queryOne(
    `insert into sysmap_ai_opps (key, ${AI_COLS.join(', ')})
     values ($1, ${AI_COLS.map((_, i) => `$${i + 2}`).join(', ')}) returning *`,
    [d.key, ...AI_COLS.map((c) => d[c])]);
  res.status(201).json({ data: row });
}));

router.patch('/ai/:key', canEdit, asyncHandler(async (req, res) => {
  const p = aiSchema.partial().omit({ key: true }).safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const given = AI_COLS.filter((c) => p.data[c] !== undefined);
  if (!given.length) throw new ApiError(400, 'ไม่มีข้อมูลที่จะแก้');
  const sets = given.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const row = await queryOne(
    `update sysmap_ai_opps set ${sets} where key = $1 returning *`,
    [req.params.key, ...given.map((c) => p.data[c])]);
  if (!row) throw new ApiError(404, 'ไม่พบรายการนี้');
  res.json({ data: row });
}));

router.delete('/ai/:key', canEdit, asyncHandler(async (req, res) => {
  const row = await queryOne('delete from sysmap_ai_opps where key = $1 returning key', [req.params.key]);
  if (!row) throw new ApiError(404, 'ไม่พบรายการนี้');
  res.json({ data: { ok: true } });
}));

export default router;
