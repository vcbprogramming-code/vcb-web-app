/**
 * Import the operating map from the reference implementation into our tables.
 *
 * The upstream data lives in TypeScript source files with no backend behind it
 * — one export per file, plain object/array literals transcribed from the
 * canonical Apps Script app. We read those literals directly rather than
 * hand-copying 79 nodes and 129 connections, which no one could review.
 *
 * Idempotent: every insert upserts on its key, so re-running after an upstream
 * re-sync updates in place and never duplicates. Rows an editor added by hand
 * are left alone — this only writes the keys it finds in the source.
 *
 *   node scripts/seed-sysmap.mjs [path-to-System-Operating-Map]
 */
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { query } from '../src/config/db.js';

const REF = process.argv[2]
  || '/Users/pok/Desktop/Jobs/วิจิตรภัณฑ์ก่อสร้าง/vcb-dev-ref/System Operating Map';
const DATA = path.join(REF, 'src', 'data');

/** Read one `export const X = <literal>;` file and return the literal. */
function readLiteral(file) {
  const src = fs.readFileSync(path.join(DATA, file), 'utf8');
  const eq = src.indexOf('= ');
  const end = src.lastIndexOf(';');
  if (eq < 0 || end < 0) throw new Error(`${file}: not a single-export literal`);
  // the literals are plain JSON-ish data — no calls, no identifiers to resolve
  // eslint-disable-next-line no-eval
  return eval(`(${src.slice(eq + 2, end)})`);
}

const LANES = readLiteral('lanes.ts');
const CONNS = readLiteral('crossConns.ts');
const DEPTS = readLiteral('depts.ts');
const DEPT_META = readLiteral('deptMeta.ts');
const MODULES = readLiteral('modules.ts');
const REGISTRY = readLiteral('functionRegistry.ts');
const AI_OPPS = readLiteral('aiOpps.ts');
const TH = readLiteral('langTh.ts');
const FN_LOC = readLiteral('functionLoc.ts');
const FN_DEPT2 = readLiteral('functionDept2.ts');

const S = (v) => (v == null ? '' : String(v));
let counts = {};
const bump = (k, n = 1) => { counts[k] = (counts[k] || 0) + n; };

// ── แผนก ───────────────────────────────────────────────────────────────────
{
  const order = Object.keys(DEPTS);
  for (const [key, d] of Object.entries(DEPTS)) {
    const meta = DEPT_META[key] || {};
    await query(
      `insert into sysmap_depts (key, name_en, name_th, short, color, icon, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (key) do update set
         name_en = excluded.name_en, name_th = excluded.name_th, short = excluded.short,
         color = excluded.color, icon = excluded.icon, sort_order = excluded.sort_order`,
      [key, S(d.name), S(TH.depts?.[key]), S(meta.short), S(d.color || meta.color), S(d.icon || meta.icon), order.indexOf(key)]
    );
    bump('depts');
  }
}

// ── โมดูล ERP ──────────────────────────────────────────────────────────────
{
  const order = Object.keys(MODULES);
  for (const [code, m] of Object.entries(MODULES)) {
    await query(
      `insert into sysmap_modules (code, name, purpose, sort_order) values ($1,$2,$3,$4)
       on conflict (code) do update set name = excluded.name, purpose = excluded.purpose,
         sort_order = excluded.sort_order`,
      [code, S(m.name), S(m.purpose), order.indexOf(code)]
    );
    bump('modules');
  }
}

// ── เลน + กล่องงาน ─────────────────────────────────────────────────────────
for (const [li, lane] of LANES.entries()) {
  await query(
    `insert into sysmap_lanes (id, label_en, label_th, sort_order) values ($1,$2,$3,$4)
     on conflict (id) do update set label_en = excluded.label_en,
       label_th = excluded.label_th, sort_order = excluded.sort_order`,
    [lane.id, S(lane.label), S(TH.lanes?.[lane.id]), li]
  );
  bump('lanes');

  for (const [ni, n] of (lane.nodes || []).entries()) {
    const th = TH.nodes?.[n.id] || {};
    await query(
      `insert into sysmap_nodes
         (id, lane_id, node_type, dept, dept2, standalone, at_site, label_en, label_th,
          sub_en, sub_th, desc_en, desc_th, module, unverified, erp_style, erp_label,
          items_en, items_th, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20)
       on conflict (id) do update set
         lane_id = excluded.lane_id, node_type = excluded.node_type, dept = excluded.dept,
         dept2 = excluded.dept2, standalone = excluded.standalone, at_site = excluded.at_site,
         label_en = excluded.label_en, label_th = excluded.label_th,
         sub_en = excluded.sub_en, sub_th = excluded.sub_th,
         desc_en = excluded.desc_en, desc_th = excluded.desc_th,
         module = excluded.module, unverified = excluded.unverified,
         erp_style = excluded.erp_style, erp_label = excluded.erp_label,
         items_en = excluded.items_en, items_th = excluded.items_th,
         sort_order = excluded.sort_order`,
      [
        n.id, lane.id, S(n.type) || 'manual', S(n.dept), S(n.dept2),
        Boolean(n.standalone), n.loc === 'site',
        S(n.label), S(th.label), S(n.sub), S(th.sub), S(n.desc), S(th.desc),
        S(n.module), Boolean(n.unverified), S(n.erp_style), S(n.erp_label),
        JSON.stringify(n.items || []), JSON.stringify(th.items || []), ni,
      ]
    );
    bump('nodes');
  }
}

// ── เส้นเชื่อม ─────────────────────────────────────────────────────────────
{
  const { rows } = await query('select id from sysmap_nodes');
  const known = new Set(rows.map((r) => r.id));
  let skipped = 0;
  for (const c of CONNS) {
    // an edge whose ends are not both on the map would draw a line to nowhere
    if (!known.has(c.from) || !known.has(c.to)) { skipped += 1; continue; }
    await query(
      `insert into sysmap_conns (from_node, to_node, conn_type, label, feedback)
       values ($1,$2,$3,$4,$5)
       on conflict (from_node, to_node, conn_type) do update set
         label = excluded.label, feedback = excluded.feedback`,
      [c.from, c.to, S(c.type) || 'feeds', S(c.label), Boolean(c.feedback)]
    );
    bump('conns');
  }
  if (skipped) console.log(`  ข้ามเส้นเชื่อมที่ปลายทางไม่มีกล่อง ${skipped} เส้น`);
}

// ── ทะเบียนฟังก์ชัน ────────────────────────────────────────────────────────
for (const [dept, rows] of Object.entries(REGISTRY)) {
  for (const [i, row] of rows.entries()) {
    const [code, name, erpType, module, notes, external] = row;
    const th = TH.registry?.[code] || [];
    await query(
      `insert into sysmap_functions
         (code, dept, name_en, name_th, erp_type, module, notes_en, notes_th,
          external_entry, at_site, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (code) do update set
         dept = excluded.dept, name_en = excluded.name_en, name_th = excluded.name_th,
         erp_type = excluded.erp_type, module = excluded.module,
         notes_en = excluded.notes_en, notes_th = excluded.notes_th,
         external_entry = excluded.external_entry, at_site = excluded.at_site,
         sort_order = excluded.sort_order`,
      [code, S(FN_DEPT2[code]) || dept, S(name), S(th[0]), S(erpType), S(module),
       S(notes), S(th[1]), Boolean(external), FN_LOC.has(code), i]
    );
    bump('functions');
  }
}

// ── โอกาสใช้ AI ────────────────────────────────────────────────────────────
{
  const order = Object.keys(AI_OPPS);
  for (const [key, o] of Object.entries(AI_OPPS)) {
    await query(
      `insert into sysmap_ai_opps (key, title_en, title_th, impact, effort, desc_en, desc_th, tool, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (key) do update set
         title_en = excluded.title_en, title_th = excluded.title_th,
         impact = excluded.impact, effort = excluded.effort,
         desc_en = excluded.desc_en, desc_th = excluded.desc_th,
         tool = excluded.tool, sort_order = excluded.sort_order`,
      [key, S(o.title), '', S(o.impact) || 'Medium', S(o.effort) || 'Medium', S(o.desc), '', S(o.tool), order.indexOf(key)]
    );
    bump('ai');
  }
}

console.log('\nนำเข้าข้อมูลแผนผังระบบเรียบร้อย');
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(12)} ${v}`);
process.exit(0);
