/**
 * แผนผังระบบ — the data behind the map, and who may change it.
 *
 * The map is reference material the whole company reads and an admin maintains.
 * These checks cover the rules that matter: everyone can read it, only an editor
 * can change it, and the graph cannot be left describing something impossible —
 * an edge with no box at one end, a lane deleted out from under its boxes.
 */
import { fileURLToPath } from 'node:url';
import { call, suite, happy, bad, report, U, warm, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
await warm();
const { admin: A, exec: C, hr: H } = U;
const MARK = 'ZZTEST';
const made = { lanes: [], nodes: [], fns: [], ai: [] };

// ── 1. อ่านข้อมูล ──────────────────────────────────────────────────────────
suite('1. ข้อมูลแผนผังที่นำเข้ามา');
{
  const b = await call('/sysmap/bootstrap', { user: A });
  happy('เปิดแผนผังได้', b.status === 200, `${b.status}`);
  happy('มีเลนครบ', b.data.counts.lanes >= 10, `${b.data.counts.lanes}`);
  happy('มีกล่องงานครบ', b.data.counts.nodes >= 79, `${b.data.counts.nodes}`);
  happy('มีเส้นเชื่อมครบ', b.data.counts.conns >= 129, `${b.data.counts.conns}`);
  happy('มีแผนกและโมดูล ERP', b.data.depts.length >= 7 && b.data.modules.length >= 10, '');

  happy('ทุกกล่องงานมีคำแปลไทย',
    b.data.nodes.every((n) => (n.label_th || '').trim().length > 0),
    b.data.nodes.filter((n) => !n.label_th).map((n) => n.id).slice(0, 3).join(', '));
  bad('ไม่มีเส้นเชื่อมที่ปลายทางไม่มีกล่อง', (() => {
    const ids = new Set(b.data.nodes.map((n) => n.id));
    return b.data.conns.every((c) => ids.has(c.from_node) && ids.has(c.to_node));
  })(), '');
  bad('ไม่มีกล่องงานที่อยู่ในเลนที่ไม่มีจริง', (() => {
    const ids = new Set(b.data.lanes.map((l) => l.id));
    return b.data.nodes.every((n) => ids.has(n.lane_id));
  })(), '');

  const f = await call('/sysmap/functions', { user: A });
  happy('ทะเบียนฟังก์ชันครบ', f.status === 200 && f.data.length >= 158, `${f.data?.length}`);
  happy('มีฟังก์ชันที่ทำที่หน้างานติดธงไว้', f.data.some((r) => r.at_site), '');
  const ai = await call('/sysmap/ai', { user: A });
  happy('รายการโอกาสใช้ AI ครบ', ai.status === 200 && ai.data.length >= 35, `${ai.data?.length}`);
}

// ── 2. ใครเห็นได้ ใครแก้ได้ ────────────────────────────────────────────────
suite('2. สิทธิ์ — ทุกคนดูได้ เฉพาะผู้ดูแลแก้ได้');
{
  for (const [u, who] of [[C, 'ผู้บริหาร'], [H, 'ฝ่ายบุคคล']]) {
    const r = await call('/sysmap/bootstrap', { user: u });
    happy(`${who}เปิดดูแผนผังได้`, r.status === 200, `${r.status}`);
    happy(`${who}ไม่ได้สิทธิ์แก้ไข`, r.data?.canEdit === false, String(r.data?.canEdit));
  }
  const b = await call('/sysmap/bootstrap', { user: A });
  happy('ผู้ดูแลได้สิทธิ์แก้ไข', b.data.canEdit === true, '');

  bad('ฝ่ายบุคคลเพิ่มเลนไม่ได้',
    (await call('/sysmap/lanes', { method: 'POST', user: H, body: { id: 'zz', label_en: 'X' } })).status === 403, '');
  bad('ผู้บริหารลบกล่องงานไม่ได้',
    (await call('/sysmap/nodes/n-gl', { method: 'DELETE', user: C })).status === 403, '');
  bad('ไม่ล็อกอินเปิดไม่ได้', (await call('/sysmap/bootstrap', { user: null })).status === 401, '');
}

// ── 3. แก้ไขข้อมูลผ่านฟอร์ม ────────────────────────────────────────────────
suite('3. ผู้ดูแลแก้ไขข้อมูลแผนผังได้');
{
  const laneId = `zz-lane-${Date.now().toString(36)}`;
  const lane = await call('/sysmap/lanes', { method: 'POST', user: A,
    body: { id: laneId, label_en: `${MARK} Lane`, label_th: `${MARK} เลนทดสอบ` } });
  happy('เพิ่มเลนได้', lane.status === 201, `${lane.status}`);
  if (lane.status === 201) made.lanes.push(laneId);

  bad('เพิ่มเลนรหัสซ้ำไม่ได้',
    (await call('/sysmap/lanes', { method: 'POST', user: A, body: { id: laneId, label_en: 'x' } })).status === 409, '');
  bad('รหัสที่มีอักขระแปลกไม่ผ่าน',
    (await call('/sysmap/lanes', { method: 'POST', user: A, body: { id: 'ไม่ใช่รหัส!', label_en: 'x' } })).status === 400, '');

  const nodeId = `zz-node-${Date.now().toString(36)}`;
  const node = await call('/sysmap/nodes', { method: 'POST', user: A, body: {
    id: nodeId, lane_id: laneId, node_type: 'erp', dept: 'fin',
    label_en: `${MARK} Step`, label_th: `${MARK} ขั้นตอนทดสอบ`,
    items_en: ['one', 'two'], items_th: ['หนึ่ง', 'สอง'] } });
  happy('เพิ่มกล่องงานได้', node.status === 201, `${node.status}`);
  if (node.status === 201) made.nodes.push(nodeId);
  happy('เก็บรายการสิ่งที่ทำเป็นลิสต์',
    Array.isArray(node.data?.items_th) && node.data.items_th.length === 2, JSON.stringify(node.data?.items_th));

  bad('เพิ่มกล่องงานในเลนที่ไม่มีจริงไม่ได้',
    (await call('/sysmap/nodes', { method: 'POST', user: A, body: { id: 'zz-x', lane_id: 'no-such-lane', label_en: 'x' } })).status === 400, '');
  bad('ลบเลนที่ยังมีกล่องงานอยู่ไม่ได้',
    (await call(`/sysmap/lanes/${laneId}`, { method: 'DELETE', user: A })).status === 409, '');

  const upd = await call(`/sysmap/nodes/${nodeId}`, { method: 'PATCH', user: A, body: { label_th: `${MARK} แก้แล้ว` } });
  happy('แก้ไขกล่องงานได้', upd.status === 200 && upd.data.label_th.includes('แก้แล้ว'), upd.data?.label_th);

  const conn = await call('/sysmap/conns', { method: 'POST', user: A,
    body: { from_node: nodeId, to_node: 'n-gl', conn_type: 'feeds', label: `${MARK}` } });
  happy('เพิ่มเส้นเชื่อมได้', conn.status === 201, `${conn.status}`);
  bad('เส้นเชื่อมวนกลับกล่องตัวเองไม่ได้',
    (await call('/sysmap/conns', { method: 'POST', user: A, body: { from_node: nodeId, to_node: nodeId } })).status === 400, '');
  bad('เส้นเชื่อมไปยังกล่องที่ไม่มีจริงไม่ได้',
    (await call('/sysmap/conns', { method: 'POST', user: A, body: { from_node: nodeId, to_node: 'no-such-node' } })).status === 400, '');
  bad('เส้นเชื่อมซ้ำแบบเดิมไม่ได้',
    (await call('/sysmap/conns', { method: 'POST', user: A, body: { from_node: nodeId, to_node: 'n-gl', conn_type: 'feeds' } })).status === 409, '');

  // deleting a box must take its edges with it, and say how many
  const del = await call(`/sysmap/nodes/${nodeId}`, { method: 'DELETE', user: A });
  happy('ลบกล่องงานได้ และบอกว่าลบเส้นเชื่อมไปกี่เส้น',
    del.status === 200 && del.data.removedConns === 1, JSON.stringify(del.data));
  made.nodes = made.nodes.filter((x) => x !== nodeId);
  const left = await query('select count(*)::int n from sysmap_conns where from_node = $1 or to_node = $1', [nodeId]);
  bad('ไม่เหลือเส้นเชื่อมที่ชี้ไปกล่องที่ถูกลบ', left.rows[0].n === 0, `${left.rows[0].n}`);

  happy('ลบเลนที่ว่างแล้วได้', (await call(`/sysmap/lanes/${laneId}`, { method: 'DELETE', user: A })).status === 200, '');
  made.lanes = made.lanes.filter((x) => x !== laneId);
}

// ── 4. ทะเบียนฟังก์ชันและโอกาส AI ──────────────────────────────────────────
suite('4. ทะเบียนฟังก์ชันและโอกาสใช้ AI');
{
  const code = `ZZ-${Date.now().toString(36)}`;
  const f = await call('/sysmap/functions', { method: 'POST', user: A,
    body: { code, dept: 'fin', name_en: `${MARK} Function`, name_th: `${MARK} ฟังก์ชันทดสอบ`, at_site: true } });
  happy('เพิ่มฟังก์ชันได้', f.status === 201, `${f.status}`);
  if (f.status === 201) made.fns.push(code);
  happy('ธง "ทำที่หน้างาน" ถูกบันทึก', f.data?.at_site === true, String(f.data?.at_site));
  happy('แก้ไขฟังก์ชันได้',
    (await call(`/sysmap/functions/${code}`, { method: 'PATCH', user: A, body: { erp_type: 'ERP' } })).status === 200, '');
  bad('แก้ฟังก์ชันที่ไม่มีจริง → 404',
    (await call('/sysmap/functions/NOPE-99', { method: 'PATCH', user: A, body: { erp_type: 'x' } })).status === 404, '');

  const key = `zz-ai-${Date.now().toString(36)}`;
  const a = await call('/sysmap/ai', { method: 'POST', user: A,
    body: { key, title_en: `${MARK} Opportunity`, impact: 'High', effort: 'Low' } });
  happy('เพิ่มโอกาสใช้ AI ได้', a.status === 201, `${a.status}`);
  if (a.status === 201) made.ai.push(key);
  bad('ระดับผลกระทบนอกเหนือจากที่กำหนดไม่ได้',
    (await call('/sysmap/ai', { method: 'POST', user: A, body: { key: 'zz2', title_en: 'x', impact: 'มหาศาล' } })).status === 400, '');
}

// ── เก็บกวาด ───────────────────────────────────────────────────────────────
for (const c of made.fns) await call(`/sysmap/functions/${c}`, { method: 'DELETE', user: A });
for (const k of made.ai) await call(`/sysmap/ai/${k}`, { method: 'DELETE', user: A });
for (const n of made.nodes) await call(`/sysmap/nodes/${n}`, { method: 'DELETE', user: A });
for (const l of made.lanes) await call(`/sysmap/lanes/${l}`, { method: 'DELETE', user: A });
const leftovers = await query(
  `select (select count(*) from sysmap_lanes where id like 'zz-%')::int l,
          (select count(*) from sysmap_nodes where id like 'zz-%')::int n,
          (select count(*) from sysmap_functions where code like 'ZZ-%')::int f,
          (select count(*) from sysmap_ai_opps where key like 'zz-%')::int a`);
suite('5. ไม่ทิ้งข้อมูลทดสอบไว้');
happy('ลบข้อมูลทดสอบออกหมดแล้ว',
  Object.values(leftovers.rows[0]).every((v) => v === 0), JSON.stringify(leftovers.rows[0]));

process.exit(report(`${ROOT}/sysmap.json`) ? 1 : 0);
