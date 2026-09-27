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

/**
 * 'PO-3' — รหัสแสดงผลรายหมวดที่ระบบจริงของลูกค้าใช้เรียกกรณีกันในที่ทำงาน
 *
 * ค่าจริงเก็บไว้ในคอลัมน์ display_no (นำเข้าตรงจากระบบเขา) ตรงนี้เป็นตัวสำรอง
 * เผื่อแถวไหนยังไม่มีค่า — คำนวณจากตำแหน่งในหมวดแบบเดียวกับที่ renumberModule
 * เขียนลงฐานข้อมูล ทั้งสองทางจึงได้เลขเดียวกันเสมอ
 */
function withDisplayNo(rows) {
  const seen = new Map();
  return rows.map((r) => {
    const n = (seen.get(r.module) || 0) + 1;
    seen.set(r.module, n);
    return { ...r, display_no: r.display_no || `${r.module}-${n}` };
  });
}

/**
 * เขียนรหัสแสดงผลของทั้งหมวดใหม่ตามตำแหน่งปัจจุบัน
 *
 * รหัสเป็นป้ายบอกตำแหน่ง ลบ PO-2 ออกแล้ว PO-3 ต้องเลื่อนขึ้นมาเป็น PO-2
 * ระบบของเขาคำนวณใหม่ทุกครั้งที่อ่าน ของเราเก็บเป็นคอลัมน์ (หน้าจอและชุดทดสอบ
 * อ่านจากคอลัมน์ได้ตรง ๆ) จึงต้องเขียนใหม่ทุกครั้งที่ลำดับในหมวดขยับ
 */
async function renumberModule(runner, module) {
  if (!module) return;
  await runner.query(
    `update sop_scenarios s
        set display_no = $1::text || '-' || x.rn::text
       from (select no, row_number() over (order by sort_order, no) as rn
               from sop_scenarios where module = $1) x
      where s.no = x.no
        and coalesce(s.display_no, '') <> $1::text || '-' || x.rn::text`,
    [module]
  );
}

/** Scenarios ordered the way display numbers are assigned (module, then position). */
async function allScenariosOrdered() {
  const { rows } = await query(
    `select no, module, display_no, sort_order, title_th, title_en, problem, ref, note, date_added
       from sop_scenarios
      order by module, sort_order, no`
  );
  return withDisplayNo(rows);
}

/** เลขท้ายของรหัสแสดงผล ('PO-12' → 12) ใช้เรียงกรณีในหมวดให้เหมือนของเขา */
const displayIndex = (r) => {
  const m = /-(\d+)$/.exec(r.display_no || '');
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};

// ── ประวัติเวอร์ชัน ─────────────────────────────────────────────────────────

/**
 * เอกสาร SOP ทั้งฉบับเป็นก้อนเดียว — ใช้ทั้งตอนเก็บ snapshot และตอนกู้คืน
 * รูปร่างตรงกับที่เอกสารข้อกำหนดฟังก์ชัน §4.1 อธิบายไว้ ({meta, scenarios, reports})
 * บวก flows และ modules ที่ระบบเรามีเพิ่ม
 */
async function readWholeDocument() {
  const [meta, scenarios, steps, tags, reports, flows, modules, attachments] = await Promise.all([
    queryOne('select * from sop_meta where id = true'),
    query('select * from sop_scenarios order by module, sort_order, no'),
    query('select * from sop_scenario_steps order by scenario_no, step_order'),
    query('select * from sop_scenario_modules order by scenario_no, module'),
    query('select * from sop_reports order by id'),
    query('select * from sop_flows order by module, id'),
    query('select * from sop_modules order by sort_order, code'),
    query('select * from sop_scenario_attachments order by scenario_no, sort'),
  ]);
  return {
    meta: meta || null,
    scenarios: scenarios.rows, steps: steps.rows, tags: tags.rows,
    reports: reports.rows, flows: flows.rows, modules: modules.rows, attachments: attachments.rows,
  };
}

/**
 * เก็บภาพเอกสารก่อนการแก้ไข — ต้องเรียกก่อนทุกเส้นทางที่เขียนข้อมูล
 *
 * ระบบของลูกค้าใช้ database trigger เพราะเอกสารเขาเป็น JSON แถวเดียว ของเรา
 * แยกเป็นเจ็ดตาราง trigger รายตารางจะได้ snapshot คนละครึ่งใบ จึงเก็บเป็น
 * ภาพรวมทั้งเอกสารตรงนี้แทน และมีชุดทดสอบไล่ทุก route ที่เขียนข้อมูลว่าสร้าง
 * เวอร์ชันไว้จริง — ทำหน้าที่แทนสิ่งที่ trigger รับประกันให้เขา
 */
async function snapshot(profile, note) {
  const data = await readWholeDocument();
  await query('insert into sop_versions (data, note, taken_by) values ($1,$2,$3)',
    [JSON.stringify(data), note, profile?.id || null]);
}

/**
 * เขียนหลายแถวด้วยคำสั่งเดียว
 *
 * การกู้คืนเขียนคืนทั้งเอกสาร — กรณีศึกษา ขั้นตอน ป้ายหมวด รายงาน และผังงาน
 * รวมกันหลายร้อยแถว ถ้ายิงทีละคำสั่งก็คือวิ่งไป-กลับฐานข้อมูลหลายร้อยรอบ
 * วัดบนฐานข้อมูลจริงได้สิบวินาทีต่อการกดหนึ่งครั้ง ผู้ใช้เห็นแต่วงกลมหมุน
 * รวบเป็นคำสั่งเดียวต่อตารางแล้วเหลือไม่ถึงวินาที
 */
async function insertMany(client, table, cols, rows, tail = '') {
  const CHUNK = 500;                       // กันพารามิเตอร์ทะลุเพดานของ pg
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    const params = [];
    const tuples = part.map((r) => `(${r.map((v) => { params.push(v); return `$${params.length}`; }).join(',')})`);
    await client.query(`insert into ${table} (${cols.join(',')}) values ${tuples.join(',')} ${tail}`, params);
  }
}

// ── read ────────────────────────────────────────────────────────────────────

/** GET /api/sop/bootstrap — modules, doc meta and per-module counts. */
router.get('/bootstrap', canView, asyncHandler(async (req, res) => {
  const [mods, meta, sc, fl, rp, tot] = await Promise.all([
    query('select code, name_th_short, name_en_short, name_th, name_en, desc_th, desc_en from sop_modules order by sort_order, code'),
    queryOne('select title, subtitle, manual, version, effective, scope, purpose, notes, updated_at from sop_meta where id = true'),
    // จำนวนกรณีต่อหมวดต้องนับหมวดเสริมด้วย เพราะรายการของหมวดนั้นก็แสดงกรณีที่ถูก
    // แท็กมา (เช่น AP มีกรณีหลัก 6 แต่ถูกแท็กเข้ามาอีก 10 → ชิปต้องขึ้น 16
    // เหมือนระบบจริง) ก่อนหน้านี้นับเฉพาะหมวดหลัก ตัวเลขบนชิปจึงน้อยกว่าจำนวน
    // แถวที่กดเข้าไปแล้วเห็น และ AR/FIN ที่ไม่มีกรณีหลักเลยขึ้นเป็น 0 ทั้งที่กดได้
    query(`select module, count(distinct no)::int as n from (
             select no, module from sop_scenarios
             union
             select scenario_no as no, module from sop_scenario_modules
           ) x group by module`),
    query('select module, count(*)::int as n from sop_flows group by module'),
    query('select count(*)::int as n from sop_reports'),
    query('select (select count(*) from sop_scenarios)::int as sc, (select count(*) from sop_flows)::int as fl'),
  ]);
  const byMod = (rows) => Object.fromEntries(rows.rows.map((r) => [r.module, r.n]));
  res.json({
    data: {
      modules: mods.rows,
      meta: meta || null,
      // scenarioTotal แยกส่งมาเพราะบวกชิปต่อหมวดไม่ได้ — กรณีที่แท็กหลายหมวดถูกนับซ้ำ
      counts: {
        scenarios: byMod(sc), flows: byMod(fl), reports: rp.rows[0]?.n || 0,
        scenarioTotal: tot.rows[0]?.sc || 0, flowTotal: tot.rows[0]?.fl || 0,
      },
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

  // รหัสแสดงผลคิดจากลำดับในหมวด แต่รายการ "ทั้งหมด" ของเขาเรียงตามเลขกรณี
  // (เปิดมาเจอ PO-1 เป็นใบแรก ไม่ใช่ AP-1 ที่มาก่อนเพราะเรียงตามตัวอักษรของหมวด)
  rows.sort((a, b) => a.no - b.no);
  if (mod) {
    rows = rows.filter((r) => r.module === mod || r.extra_modules.includes(mod));
    // ในหมวดหนึ่ง กรณีที่หมวดนี้เป็นหมวดหลักขึ้นก่อนเรียงตามรหัสแสดงผล (PO-1, PO-2…)
    // แล้วจึงกรณีที่ถูกแท็กมาจากหมวดอื่น — ลำดับเดียวกับระบบจริง
    const primaries = rows.filter((r) => r.module === mod).sort((a, b) => displayIndex(a) - displayIndex(b));
    rows = [...primaries, ...rows.filter((r) => r.module !== mod)];
  }
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
  const [steps, tags, att] = await Promise.all([
    query('select step_order, is_substep, style, text from sop_scenario_steps where scenario_no = $1 order by step_order', [no]),
    query('select module from sop_scenario_modules where scenario_no = $1', [no]),
    query('select label, url from sop_scenario_attachments where scenario_no = $1 order by sort', [no]),
  ]);
  res.json({ data: { ...row, steps: steps.rows, extra_modules: tags.rows.map((t) => t.module), attachments: att.rows } });
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

/**
 * ขั้นตอนมีสี่ระดับตามคู่มือของระบบจริง: ลำดับ (1. 2. 3.) · จุด (·) · ย่อย (») ·
 * ย่อยชั้นสอง (» ») เดิมเรามีแค่สองระดับ ขั้นตอนที่มีชั้นย่อยสองชั้นจึงแบนลง
 * isSubstep ยังรับอยู่เพื่อให้หน้าจอรุ่นเก่าส่งมาได้
 */
const STEP_STYLES = ['num', 'bullet', 'sub', 'sub2'];
const stepSchema = z.object({
  text: z.string().trim().min(1),
  isSubstep: z.boolean().optional(),
  style: z.enum(STEP_STYLES).optional(),
});
const stepStyle = (s) => s.style || (s.isSubstep ? 'sub' : 'num');
// เอกสารแนบของกรณี — ระบบจริงแนบไฟล์ SOP ฉบับเต็มใน Google Drive ไว้กับทุกกรณี
const attachmentSchema = z.object({
  label: z.string().max(300).optional().nullable(),
  url: z.string().trim().url().max(2000),
});
const scenarioSchema = z.object({
  module: z.string().min(1).max(10),
  titleTh: z.string().trim().min(1).max(500),
  titleEn: z.string().max(500).optional().nullable(),
  problem: z.string().max(8000).optional().nullable(),
  ref: z.string().max(500).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  dateAdded: z.string().max(100).optional().nullable(),
  steps: z.array(stepSchema).max(300).optional(),
  extraModules: z.array(z.string().max(10)).max(11).optional(),
  attachments: z.array(attachmentSchema).max(20).optional(),
});

async function assertModule(code) {
  const m = await queryOne('select code from sop_modules where code = $1', [code]);
  if (!m) throw new ApiError(400, 'ไม่พบหมวดงานที่เลือก');
}

/** Replace a case's steps + tags inside an open transaction. */
async function writeChildren(client, no, steps, extraModules, primaryModule, attachments) {
  if (steps) {
    await client.query('delete from sop_scenario_steps where scenario_no = $1', [no]);
    let i = 0;
    for (const s of steps) {
      i += 1;
      const style = stepStyle(s);
      await client.query(
        'insert into sop_scenario_steps (scenario_no, step_order, is_substep, style, text) values ($1,$2,$3,$4,$5)',
        [no, i, style === 'sub' || style === 'sub2', style, s.text.trim()]
      );
    }
  }
  if (attachments) {
    await client.query('delete from sop_scenario_attachments where scenario_no = $1', [no]);
    let i = 0;
    for (const a of attachments) {
      i += 1;
      await client.query('insert into sop_scenario_attachments (scenario_no, sort, label, url) values ($1,$2,$3,$4)',
        [no, i, (a.label || '').trim() || null, a.url.trim()]);
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
  await snapshot(req.profile, 'เพิ่มกรณีศึกษาใหม่');
  const p = scenarioSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const f = p.data;
  await assertModule(f.module);
  const client = await pool.connect();
  try {
    await client.query('begin');
    // เลขที่กรณีศึกษาเป็นกุญแจหลัก อ่าน max แล้วเขียนพร้อมกันสองคนจะได้เลข
    // เดียวกันและคนหลังชนกุญแจซ้ำ → 500 (ทดสอบพร้อมกัน 8 คน สำเร็จแค่คนเดียว)
    // ล็อกเฉพาะช่วงจองเลข ปล่อยเองเมื่อจบทรานแซกชัน คนอ่านไม่ถูกกระทบ
    await client.query('select pg_advisory_xact_lock(hashtext($1))', ['sop_scenarios.no']);
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
    await writeChildren(client, no, f.steps || [], f.extraModules || [], f.module, f.attachments || []);
    await renumberModule(client, f.module);   // กรณีใหม่ได้รหัสถัดไปของหมวด เช่น PO-4
    await client.query('commit');
    res.status(201).json({ data: { no } });
  } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
}));

router.patch('/scenarios/:no', canEdit, asyncHandler(async (req, res) => {
  await snapshot(req.profile, 'แก้ไขเนื้อหากรณีศึกษา');
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
    await writeChildren(client, no, f.steps, f.extraModules, f.module || cur.module, f.attachments);
    // ย้ายหมวด = รหัสแสดงผลต้องเปลี่ยนทั้งหมวดที่ออกและหมวดที่เข้า
    if (f.module && f.module !== cur.module) {
      await client.query(
        `update sop_scenarios set sort_order =
           coalesce((select max(sort_order) from sop_scenarios where module = $1 and no <> $2), 0) + 1
          where no = $2`,
        [f.module, no]
      );
      await renumberModule(client, cur.module);
    }
    await renumberModule(client, f.module || cur.module);
    await client.query('commit');
  } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
  res.json({ data: { no } });
}));

router.delete('/scenarios/:no', canEdit, asyncHandler(async (req, res) => {
  await snapshot(req.profile, 'ลบกรณีศึกษาออก');
  const no = Number(req.params.no);
  if (!Number.isInteger(no)) throw new ApiError(404, 'ไม่พบกรณีศึกษา');
  // steps/tags cascade; reports keep their row but lose the link (set null)
  const row = await queryOne('delete from sop_scenarios where no = $1 returning no, module', [no]);
  if (!row) throw new ApiError(404, 'ไม่พบกรณีศึกษา');
  await renumberModule({ query }, row.module);  // ลบ PO-2 แล้ว PO-3 เลื่อนขึ้นเป็น PO-2
  res.json({ data: { deleted: true } });
}));

/** POST /api/sop/scenarios/:no/move — swap position with the neighbour (up/down). */
router.post('/scenarios/:no/move', canEdit, asyncHandler(async (req, res) => {
  await snapshot(req.profile, 'สลับลำดับกรณีศึกษา');
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
    await renumberModule(client, me.module);   // รหัสแสดงผลเป็นป้ายบอกตำแหน่ง จึงสลับตามไปด้วย
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
  await snapshot(req.profile, 'เพิ่มรายการรายงาน');
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
  await snapshot(req.profile, 'แก้ไขรายการรายงาน');
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
  await snapshot(req.profile, 'ลบรายการรายงานออก');
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(404, 'ไม่พบรายการ');
  const row = await queryOne('delete from sop_reports where id = $1 returning id', [id]);
  if (!row) throw new ApiError(404, 'ไม่พบรายการ');
  res.json({ data: { deleted: true } });
}));

// ── ประวัติเวอร์ชันและการกู้คืน ─────────────────────────────────────────────

/** GET /api/sop/versions — รายการ snapshot ล่าสุด (ไม่ส่งเนื้อหาเต็มมาด้วย) */
router.get('/versions', canEdit, asyncHandler(async (req, res) => {
  // เนื้อหาแต่ละเวอร์ชันคือเอกสารทั้งฉบับ ดึงมา 50 ชุดเพื่อวาดตารางจะเปลืองเปล่า
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const { rows } = await query(
    `select v.id, v.note, v.taken_at, coalesce(p.full_name, 'ระบบ (นำเข้าข้อมูล)') as taken_by_name,
            jsonb_array_length(coalesce(v.data->'scenarios','[]'::jsonb)) as scenarios,
            jsonb_array_length(coalesce(v.data->'reports','[]'::jsonb)) as reports
       from sop_versions v left join profiles p on p.id = v.taken_by
      order by v.taken_at desc limit $1`, [limit]);
  res.json({ data: rows });
}));

/** GET /api/sop/versions/:id — เวอร์ชันเดียวพร้อมเนื้อหาเต็ม */
router.get('/versions/:id', canEdit, asyncHandler(async (req, res) => {
  const row = await queryOne(
    `select v.*, coalesce(p.full_name, 'ระบบ (นำเข้าข้อมูล)') as taken_by_name from sop_versions v
       left join profiles p on p.id = v.taken_by where v.id = $1`, [req.params.id]);
  if (!row) throw new ApiError(404, 'ไม่พบเวอร์ชันนี้');
  res.json({ data: row });
}));

/**
 * POST /api/sop/versions/:id/restore — เขียนเอกสารจากเวอร์ชันนี้กลับเป็นฉบับปัจจุบัน
 *
 * ตัวการกู้คืนเองก็เก็บ snapshot ของฉบับปัจจุบันไว้ก่อน แปลว่ากู้คืนผิดเวอร์ชัน
 * ก็ย้อนกลับได้อีก ไม่มีทางที่ข้อมูลจะหายไปเพราะกดปุ่มนี้
 */
router.post('/versions/:id/restore', canEdit, asyncHandler(async (req, res) => {
  const v = await queryOne('select * from sop_versions where id = $1', [req.params.id]);
  if (!v) throw new ApiError(404, 'ไม่พบเวอร์ชันนี้');
  await snapshot(req.profile, `ก่อนกู้คืนเวอร์ชัน #${v.id}`);

  const d = v.data || {};
  const client = await pool.connect();
  try {
    await client.query('begin');
    // เขียนทับทั้งเอกสารในทรานแซกชันเดียว — กู้คืนครึ่งใบแย่กว่าไม่กู้คืนเลย
    for (const t of ['sop_scenario_attachments', 'sop_scenario_steps', 'sop_scenario_modules', 'sop_reports', 'sop_flows', 'sop_scenarios']) {
      await client.query(`delete from ${t}`);
    }
    await insertMany(client, 'sop_scenarios',
      ['no', 'module', 'display_no', 'sort_order', 'title_th', 'title_en', 'problem', 'ref', 'note', 'date_added'],
      (d.scenarios || []).map((r) => [r.no, r.module, r.display_no ?? null, r.sort_order, r.title_th, r.title_en,
        r.problem, r.ref, r.note, r.date_added]));
    // เวอร์ชันที่เก็บไว้ก่อนมีคอลัมน์รหัสแสดงผลจะไม่มีค่ามาด้วย — เติมจากตำแหน่งใน
    // หมวด เฉพาะแถวที่ว่าง ส่วนแถวที่เวอร์ชันนั้นมีค่าอยู่แล้วให้คืนค่าเดิมตามที่เก็บไว้
    await client.query(
      `update sop_scenarios s set display_no = s.module || '-' || x.rn::text
         from (select no, row_number() over (partition by module order by sort_order, no) as rn
                 from sop_scenarios) x
        where s.no = x.no and s.display_no is null`);
    // เวอร์ชันที่เก็บก่อนมีระดับขั้นตอนไม่มี style — เดาจาก is_substep แบบเดียวกับตอนย้ายข้อมูล
    await insertMany(client, 'sop_scenario_steps',
      ['scenario_no', 'step_order', 'is_substep', 'style', 'text'],
      (d.steps || []).map((r) => [r.scenario_no, r.step_order, r.is_substep, r.style || (r.is_substep ? 'sub' : 'num'), r.text]));
    await insertMany(client, 'sop_scenario_attachments', ['scenario_no', 'sort', 'label', 'url'],
      (d.attachments || []).map((r) => [r.scenario_no, r.sort, r.label, r.url]));
    await insertMany(client, 'sop_scenario_modules', ['scenario_no', 'module'],
      (d.tags || []).map((r) => [r.scenario_no, r.module]), 'on conflict do nothing');
    await insertMany(client, 'sop_reports',
      ['id', 'case_no', 'scenario_text', 'report_path', 'sort_order'],
      (d.reports || []).map((r) => [r.id, r.case_no, r.scenario_text, r.report_path, r.sort_order]));
    // narrative ต้องอยู่ในรายการคอลัมน์ด้วย — เคยตกไป การกู้คืนครั้งเดียวจึงลบคำ
    // บรรยายขั้นตอนของทั้ง 33 ผังทิ้ง (คอลัมน์มีค่าเริ่มต้นเป็นอาเรย์ว่าง จึงไม่มี
    // error ให้เห็น) เวอร์ชันที่เก็บไว้เก็บ narrative มาด้วยอยู่แล้วเพราะอ่านด้วย select *
    await insertMany(client, 'sop_flows',
      ['id', 'module', 'title_th', 'title_en', 'sort_order', 'lanes', 'nodes', 'edges', 'narrative'],
      (d.flows || []).map((r) => [r.id, r.module, r.title_th, r.title_en, r.sort_order,
        JSON.stringify(r.lanes ?? []), JSON.stringify(r.nodes ?? []), JSON.stringify(r.edges ?? []),
        Array.isArray(r.narrative) ? r.narrative : []]));
    // ลำดับ id ของ sop_reports เป็น serial — ดันให้พ้นค่าที่เพิ่งเขียนกลับไป
    // ไม่งั้นการเพิ่มรายงานถัดไปจะชนกับ id ที่กู้คืนมา
    await client.query(
      `select setval(pg_get_serial_sequence('sop_reports','id'),
                     greatest(coalesce((select max(id) from sop_reports), 0), 1))`);
    if (d.meta) {
      await client.query(
        `update sop_meta set title=$1, subtitle=$2, manual=$3, version=$4, effective=$5,
                             scope=$6, purpose=$7, notes=$8, updated_at=now() where id = true`,
        [d.meta.title, d.meta.subtitle, d.meta.manual, d.meta.version, d.meta.effective,
         d.meta.scope, d.meta.purpose, d.meta.notes]);
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  res.json({ data: { ok: true, restoredFrom: v.id, takenAt: v.taken_at } });
}));

export default router;
