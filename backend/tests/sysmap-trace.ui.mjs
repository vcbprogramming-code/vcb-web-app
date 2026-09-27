/**
 * แผนผังระบบ · ไล่เส้นทาง (Trace / Focus) — บนหน้าจอจริง
 *
 * ผังใหญ่ตอบได้แค่ว่ากล่องหนึ่งต่อกับใครหนึ่งช่วง คำถามที่คนเปิดผังมาถามจริงคือ
 * "ของมาจากไหน และไปจบที่ไหน" ปุ่ม ⤢ Trace ของระบบจริงกางคำตอบนั้นเป็นผังเชิงเส้น
 * ชุดนี้ไล่ทุกสถานการณ์ที่ปุ่มนั้นเจอ เทียบพฤติกรรมกับของเขาข้อต่อข้อ
 *
 * ข้อที่ไม่ชัดในตัวเอง และเป็นเหตุผลที่ต้องมีชุดนี้:
 *
 *  · เพดานห้าช่วงต่อข้าง — ไม่ใช่ตัวเลขที่เราตั้งเอง แต่เป็น MAXD=5 ของเขา ถ้าหลุด
 *    เพดาน ผังจะกลายเป็นทั้งแผนที่และอ่านไม่รู้เรื่อง จึงต้องมีข้อตรวจกันไว้
 *  · แถบขั้นที่ไล่มาเป็น "ลำดับตามเวลาที่กด" ไม่ใช่กองซ้อน — กดขั้นเก่าซ้ำแล้วขั้นนั้น
 *    ย้ายมาท้ายแถว ไม่ใช่ตัดขั้นที่เหลือทิ้ง พอร์ตตามของเขาเป๊ะ ชุดนี้ล็อกไว้
 *  · กล่องที่ไม่มีเส้นเชื่อมเลย — ข้อมูลจริงทั้ง 79 กล่องไม่มีกล่องแบบนี้สักกล่อง
 *    ชุดนี้จึงสร้างเลนกับกล่องของตัวเองขึ้นมา (ขึ้นต้น ZZ) แล้วลบทิ้งตอนจบ
 *
 * รัน: cd backend && API=http://localhost:4000/api APP=http://localhost:5173 \
 *        node tests/sysmap-trace.ui.mjs
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, call, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/sysmap-trace-ui`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin;

// ── ข้อมูลของแผนผัง — เอามาจาก API ไม่ใช่เดาจากหน้าจอ ────────────────────
const boot = (await call('/sysmap/bootstrap', { user: A })).data;
const { lanes, nodes, conns } = boot;

/** กราฟเดียวกับที่หน้าจอใช้ — ลำดับภายในเลน บวกเส้นข้ามเลนที่ไม่ใช่เส้นย้อนกลับ */
const pathEdges = () => {
  const out = {}; const inn = {};
  const byLane = new Map(lanes.map((l) => [l.id, []]));
  for (const n of nodes) if (byLane.has(n.lane_id)) byLane.get(n.lane_id).push(n);
  for (const a of byLane.values()) a.sort((x, y) => x.sort_order - y.sort_order);
  const add = (a, b) => { (out[a] = out[a] || []).push(b); (inn[b] = inn[b] || []).push(a); };
  for (const l of lanes) {
    const ns = byLane.get(l.id) || [];
    for (let i = 0; i < ns.length - 1; i += 1) {
      if (!ns[i].standalone && !ns[i + 1].standalone) add(ns[i].id, ns[i + 1].id);
    }
  }
  for (const c of conns) if (!c.feedback) add(c.from_node, c.to_node);
  return { out, inn };
};
const { out: OUT, inn: INN } = pathEdges();
/** กล่องที่ไม่มีอะไรไหลออกต่อ และกล่องที่ไม่มีอะไรไหลเข้ามา — เส้นทางตันคนละด้าน */
const DEAD_OUT = nodes.find((n) => !(OUT[n.id] || []).length && (INN[n.id] || []).length);
const DEAD_IN = nodes.find((n) => !(INN[n.id] || []).length && (OUT[n.id] || []).length);
/** กล่องที่มีทั้งเข้าและออก ใช้เป็นจุดตั้งต้นปกติ */
const BUSY = nodes.find((n) => (OUT[n.id] || []).length >= 2 && (INN[n.id] || []).length >= 2);

// ── กล่องทดสอบของชุดนี้เอง — เลนใหม่ที่มีกล่องเดียว จึงไม่มีเส้นเชื่อมเลย ──
const ZZ_LANE = 'zztest-lane';
const ZZ_NODE = 'zztest-orphan';
const ZZ_LABEL_TH = 'ZZTEST กล่องไม่มีเส้นเชื่อม';
async function makeOrphan() {
  await query(
    `insert into sysmap_lanes (id, label_en, label_th, sort_order) values ($1,$2,$3,$4)
       on conflict (id) do nothing`,
    [ZZ_LANE, 'ZZTEST lane', 'ZZTEST เลนทดสอบ', 999]
  );
  await query(
    `insert into sysmap_nodes (id, lane_id, node_type, dept, label_en, label_th, sub_en, sub_th, sort_order)
       values ($1,$2,'manual','','ZZTEST orphan box',$3,'','',0) on conflict (id) do nothing`,
    [ZZ_NODE, ZZ_LANE, ZZ_LABEL_TH]
  );
}
async function dropOrphan() {
  await query('delete from sysmap_nodes where id = $1', [ZZ_NODE]);
  await query('delete from sysmap_lanes where id = $1', [ZZ_LANE]);
  const { rows } = await query(
    "select id from sysmap_nodes where id like 'zztest%' or label_th like 'ZZTEST%'"
  );
  if (rows.length) await query("delete from sysmap_nodes where id like 'zztest%' or label_th like 'ZZTEST%'");
  await query("delete from sysmap_lanes where id like 'zztest%'");
  return rows.length;
}
// เผื่อรันค้างจากรอบก่อน — ล้างก่อนเริ่ม ไม่ใช่แค่ตอนจบ
await dropOrphan();

// ── เบราว์เซอร์ ───────────────────────────────────────────────────────────
fs.rmSync(`${ROOT}/chrome-sysmap-trace`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-sysmap-trace`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 1400) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0].slice(0, 160)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().split('\n')[0].slice(0, 160));
});

const login = async () => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(A));
};
/** เปิดแผนผัง (จะมาพร้อมผังไล่เส้นทางหรือไม่ก็ได้) แล้วรอจนโหลดเสร็จจริง */
const open = async (qs = '') => {
  await page.goto(`${APP}/sysmap${qs}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await page.waitForFunction(() => !document.body.innerText.includes('กำลังโหลดแผนผัง'),
    { timeout: 30000 }).catch(() => {});
  await settle(1600);
};

/** สภาพของผังไล่เส้นทางตอนนี้ — อ่านจาก DOM ล้วน ไม่แตะ state ข้างใน */
const traceState = () => page.evaluate(() => {
  const layer = document.querySelector('[data-trace-layer]');
  if (!layer) return { open: false };
  const boxes = [...layer.querySelectorAll('[data-trace-node]')];
  const focus = boxes.find((b) => b.dataset.focus === '1');
  return {
    open: true,
    count: boxes.length,
    edges: layer.querySelectorAll('[data-edge]').length,
    focusId: focus ? focus.dataset.traceNode : null,
    ids: boxes.map((b) => b.dataset.traceNode),
    hops: boxes.map((b) => Number(b.dataset.hop)),
    crumbs: [...layer.querySelectorAll('[data-crumb]')].map((c) => c.dataset.crumb),
    crumbText: [...layer.querySelectorAll('[data-crumb]')].map((c) => c.innerText.trim()),
    curCrumb: [...layer.querySelectorAll('[data-crumb]')].filter((c) => c.disabled).map((c) => c.dataset.crumb),
    text: layer.innerText,
    dead: [...layer.querySelectorAll('[data-trace-dead]')].map((e) => e.dataset.traceDead),
    // x ของกล่อง ใช้ยืนยันว่าทางเข้าอยู่ซ้ายของกล่องที่ไล่จริง
    x: Object.fromEntries(boxes.map((b) => [b.dataset.traceNode, parseFloat(b.style.left)])),
  };
});
const clickBox = (id) => page.evaluate((i) => {
  const el = document.querySelector(`[data-trace-node="${i}"]`);
  if (!el) return false;
  el.click();
  return true;
}, id);
const clickText = (label) => page.evaluate((l) => {
  const el = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === l)
    || [...document.querySelectorAll('button')].find((x) => x.innerText.trim().startsWith(l));
  if (el) { el.click(); return true; } return false;
}, label);
/**
 * กดปุ่มที่อยู่บนผังไล่เส้นทางเท่านั้น
 *
 * ชั้นนี้กางทับแผงรายละเอียดที่ยังเปิดค้างอยู่ข้างใต้ ซึ่งมีปุ่ม "ปิด" ของมันเอง —
 * คนกดเห็นแต่ปุ่มบนสุด ชุดทดสอบก็ต้องกดปุ่มเดียวกันนั้น ไม่ใช่ปุ่มแรกใน DOM
 */
const clickInTrace = (label) => page.evaluate((l) => {
  const layer = document.querySelector('[data-trace-layer]');
  if (!layer) return false;
  const el = [...layer.querySelectorAll('button')].find((x) => x.innerText.trim() === l)
    || [...layer.querySelectorAll('button')].find((x) => x.innerText.trim().startsWith(l));
  if (el) { el.click(); return true; } return false;
}, label);

await login();

// ── 1. เปิดผังไล่เส้นทางจากกล่องงานบนผัง ─────────────────────────────────
suite('1. กดกล่องงานบนผัง แล้วกด “ไล่เส้นทาง”');
{
  await open();
  const before = await traceState();
  bad('ยังไม่กด ก็ยังไม่มีผังไล่เส้นทางเปิดค้างอยู่', before.open === false, '');
  const clicked = await page.evaluate((id) => {
    const el = document.getElementById(`sysmap-node-${id}`);
    if (!el) return false;
    el.click();
    return true;
  }, BUSY.id);
  happy('กดกล่องงานบนผังได้', clicked, BUSY.id);
  await settle(1200);
  const panel = await body();
  happy('แผงรายละเอียดมีปุ่มไล่เส้นทางให้กด', panel.includes('ไล่เส้นทาง'), '');
  happy('กดปุ่มไล่เส้นทางได้', await clickText('ไล่เส้นทาง'), '');
  await settle(1500);
  const s = await traceState();
  happy('ผังไล่เส้นทางเปิดขึ้น', s.open, '');
  happy('กล่องที่กดคือกล่องที่กำลังไล่', s.focusId === BUSY.id, `${s.focusId}`);
  happy('กางกล่องรอบข้างออกมาด้วย ไม่ใช่กล่องเดียวโดด ๆ', s.count > 1, `${s.count} กล่อง`);
  happy('วาดเส้นเชื่อมระหว่างกล่อง', s.edges > 0, `${s.edges} เส้น`);
  // คำของเขา: "full in/out pathways · click any box to re-trace"
  happy('บอกว่ากดกล่องไหนก็ไล่ต่อได้', s.text.includes('กดกล่องไหนก็ไล่ต่อจากกล่องนั้น'), '');
  happy('มีคำอธิบายผังเชิงเส้นท้ายแถบ', s.text.includes('ผังเชิงเส้น'), '');
  happy('มีปุ่มแสดงบนผังใหญ่ และปุ่มปิด',
    s.text.includes('แสดงบนผังใหญ่') && s.text.includes('ปิด'), '');
  happy('แถบขั้นที่ไล่มาเริ่มที่หนึ่งขั้น คือกล่องที่กำลังไล่',
    s.crumbs.length === 1 && s.crumbs[0] === BUSY.id, s.crumbs.join(' › '));
  await shot('01-เปิดผังไล่เส้นทาง');
}

// ── 2. รูปทรงของผัง: เข้าซ้าย ออกขวา ไม่เกินห้าช่วง ──────────────────────
suite('2. ทางเข้าอยู่ซ้าย ทางออกอยู่ขวา และไล่ไม่เกินห้าช่วงต่อข้าง');
{
  const s = await traceState();
  const fx = s.x[s.focusId];
  const ins = s.ids.filter((id) => s.hops[s.ids.indexOf(id)] < 0);
  const outs = s.ids.filter((id) => s.hops[s.ids.indexOf(id)] > 0);
  happy('มีกล่องที่ไหลเข้ากล่องนี้', ins.length > 0, `${ins.length} กล่อง`);
  happy('มีกล่องที่กล่องนี้ไหลออกไป', outs.length > 0, `${outs.length} กล่อง`);
  happy('กล่องทางเข้าอยู่ซ้ายของกล่องที่ไล่ทุกกล่อง',
    ins.every((id) => s.x[id] < fx), '');
  happy('กล่องทางออกอยู่ขวาของกล่องที่ไล่ทุกกล่อง',
    outs.every((id) => s.x[id] > fx), '');
  // MAXD=5 ของเขา — หลุดเพดานเมื่อไหร่ ผังกลายเป็นทั้งแผนที่และอ่านไม่ออก
  bad('ไม่มีกล่องไหนไกลเกินห้าช่วง', s.hops.every((h) => Math.abs(h) <= 5), `สูงสุด ${Math.max(...s.hops.map(Math.abs))}`);
  happy('บอกผู้อ่านว่าไล่ให้ไม่เกินห้าช่วง', /ไม่เกิน 5 ช่วง/.test(s.text), '');
  happy('กล่องที่กำลังไล่มีกล่องเดียว',
    (await page.evaluate(() => document.querySelectorAll('[data-trace-node][data-focus="1"]').length)) === 1, '');
}

// ── 3. กดกล่องในเส้นทาง แล้วไล่ต่อจากกล่องนั้น ───────────────────────────
suite('3. กดกล่องในเส้นทางแล้วไล่ต่อจากกล่องนั้น');
{
  const s0 = await traceState();
  const next = s0.ids.find((id) => id !== s0.focusId);
  happy('กดกล่องอื่นในผังได้', await clickBox(next), next);
  await settle(1400);
  const s1 = await traceState();
  happy('กล่องที่กดกลายเป็นกล่องที่กำลังไล่', s1.focusId === next, `${s1.focusId}`);
  happy('ผังวาดใหม่รอบกล่องใหม่', s1.ids.includes(next) && s1.count > 1, `${s1.count} กล่อง`);
  happy('แถบขั้นที่ไล่มาเพิ่มเป็นสองขั้น', s1.crumbs.length === 2, s1.crumbs.join(' › '));
  happy('ขั้นขวาสุดคือกล่องที่กำลังไล่', s1.crumbs[s1.crumbs.length - 1] === next, '');
  happy('ขั้นที่กำลังดูกดซ้ำไม่ได้', s1.curCrumb.length === 1 && s1.curCrumb[0] === next, s1.curCrumb.join(','));
  bad('กดกล่องที่กำลังไล่อยู่แล้ว ไม่ทำให้แถบขั้นยาวขึ้นอีก', await (async () => {
    await clickBox(next);
    await settle(900);
    const s2 = await traceState();
    return s2.crumbs.length === 2 && s2.focusId === next;
  })(), '');
  await shot('03-ไล่ต่อจากกล่องในเส้นทาง');
}

// ── 4. ปุ่มย้อนกลับ ──────────────────────────────────────────────────────
suite('4. ปุ่มย้อนกลับ พากลับไปกล่องที่ไล่ก่อนหน้า');
{
  const s0 = await traceState();
  const prev = s0.crumbs[s0.crumbs.length - 2];
  happy('มีปุ่มย้อนกลับให้กดเมื่อไล่มามากกว่าหนึ่งขั้น', s0.text.includes('ย้อนกลับ'), '');
  happy('กดปุ่มย้อนกลับได้', await clickInTrace('ย้อนกลับ'), '');
  await settle(1300);
  const s1 = await traceState();
  happy('กลับไปที่กล่องก่อนหน้า', s1.focusId === prev, `${s1.focusId} ควรเป็น ${prev}`);
  // ลำดับของเขาเป็น "ตามเวลาที่กด" ไม่ใช่กองซ้อน — กล่องที่กลับไปย้ายมาท้ายแถว
  // ไม่ใช่ตัดขั้นที่เหลือทิ้ง พอร์ตตรงตามนั้น ข้อนี้ล็อกไว้ไม่ให้ใครแก้เป็น stack
  happy('ขั้นที่กลับไปย้ายมาอยู่ขวาสุด ตามลำดับเวลาที่กดแบบระบบจริง',
    s1.crumbs[s1.crumbs.length - 1] === prev && s1.crumbs.length === 2, s1.crumbs.join(' › '));
  // เหลือขั้นเดียวเมื่อไหร่ ปุ่มย้อนกลับต้องหายไป ไม่ใช่กดแล้วไม่เกิดอะไร
  await open(`?trace=${encodeURIComponent(BUSY.id)}`);
  const s2 = await traceState();
  bad('ไล่ขั้นเดียว ไม่มีปุ่มย้อนกลับให้กด',
    s2.crumbs.length === 1 && !s2.text.includes('ย้อนกลับ'), s2.text.slice(0, 60).replace(/\n/g, ' '));
}

// ── 5. แถบขั้นที่ไล่มายาวเกินเจ็ดขั้น ────────────────────────────────────
suite('5. ไล่ยาวเกินเจ็ดขั้น แถบขั้นเก็บเฉพาะเจ็ดขั้นล่าสุด');
{
  await open(`?trace=${encodeURIComponent(BUSY.id)}`);
  const visited = [BUSY.id];
  for (let i = 0; i < 9; i += 1) {
    const s = await traceState();
    const target = s.ids.find((id) => id !== s.focusId && !visited.includes(id))
      || s.ids.find((id) => id !== s.focusId);
    if (!target) break;
    visited.push(target);
    await clickBox(target);
    await settle(900);
  }
  const s = await traceState();
  happy('กดไล่ต่อได้ต่อเนื่องหลายขั้น', visited.length >= 9, `${visited.length} ขั้น`);
  bad('แถบขั้นไม่เกินเจ็ดขั้น', s.crumbs.length <= 7, `${s.crumbs.length} ขั้น`);
  happy('เก็บไว้เจ็ดขั้นเต็ม เมื่อกดมาเกินเจ็ด', s.crumbs.length === 7, `${s.crumbs.length} ขั้น`);
  happy('ขั้นขวาสุดยังเป็นกล่องที่กำลังไล่', s.crumbs[s.crumbs.length - 1] === s.focusId, '');
  happy('ขั้นที่เหลือคือเจ็ดขั้นล่าสุดที่กด',
    s.crumbs.join('>') === visited.slice(-7).join('>'), `${s.crumbs.join('>')} vs ${visited.slice(-7).join('>')}`);
  bad('ไม่มีขั้นซ้ำกันในแถบ', new Set(s.crumbs).size === s.crumbs.length, s.crumbs.join(' › '));
  // กดขั้นเก่าในแถบแล้วไล่ต่อจากขั้นนั้นได้ และขั้นนั้นย้ายมาขวาสุด อย่างของเขา
  const old = s.crumbs[0];
  await page.evaluate((id) => document.querySelector(`[data-crumb="${id}"]`)?.click(), old);
  await settle(1200);
  const s2 = await traceState();
  happy('กดขั้นเก่าในแถบแล้วไล่ต่อจากขั้นนั้นได้', s2.focusId === old, `${s2.focusId}`);
  happy('ขั้นเก่าที่กดซ้ำย้ายมาขวาสุด ไม่ตัดขั้นที่เหลือทิ้ง',
    s2.crumbs[s2.crumbs.length - 1] === old && s2.crumbs.length === 7, s2.crumbs.join(' › '));
  await shot('05-แถบขั้นเจ็ดขั้น');
}

// ── 6. เส้นทางตัน ────────────────────────────────────────────────────────
suite('6. เส้นทางตัน — บอกว่าตันด้านไหน ไม่ใช่ปล่อยให้เดาว่าผังไม่ครบ');
{
  happy('มีกล่องปลายทางในข้อมูลจริงให้ทดสอบ', !!DEAD_OUT, DEAD_OUT?.id);
  await open(`?trace=${encodeURIComponent(DEAD_OUT.id)}`);
  const s = await traceState();
  happy('เปิดผังไล่เส้นทางของกล่องปลายทางได้', s.open && s.focusId === DEAD_OUT.id, `${s.focusId}`);
  bad('ไม่มีกล่องไหนอยู่ทางขวาของกล่องปลายทาง', s.hops.every((h) => h <= 0), `สูงสุด ${Math.max(...s.hops)}`);
  happy('ยังกางทางเข้าให้ดูได้ตามปกติ', s.hops.some((h) => h < 0), '');
  happy('บอกว่ากล่องนี้เป็นปลายทาง', s.dead.includes('out') && s.text.includes('ไม่มีอะไรไหลออกต่อ'), s.dead.join(','));
  bad('ไม่ขึ้นข้อความต้นทางพร้อมกัน', !s.dead.includes('in'), s.dead.join(','));
  await shot('06a-เส้นทางตันด้านออก');

  happy('มีกล่องต้นทางในข้อมูลจริงให้ทดสอบ', !!DEAD_IN, DEAD_IN?.id);
  await open(`?trace=${encodeURIComponent(DEAD_IN.id)}`);
  const s2 = await traceState();
  bad('ไม่มีกล่องไหนอยู่ทางซ้ายของกล่องต้นทาง', s2.hops.every((h) => h >= 0), `ต่ำสุด ${Math.min(...s2.hops)}`);
  happy('บอกว่ากล่องนี้เป็นต้นทาง', s2.dead.includes('in') && s2.text.includes('ไม่มีอะไรไหลเข้ามา'), s2.dead.join(','));
  happy('ยังกางทางออกให้ดูได้ตามปกติ', s2.hops.some((h) => h > 0), '');
  await shot('06b-เส้นทางตันด้านเข้า');
}

// ── 7. กล่องที่ไม่มีเส้นเชื่อมเลย ────────────────────────────────────────
suite('7. กล่องที่ไม่มีเส้นเชื่อมเลย — บอกตรง ๆ ไม่ใช่จอว่าง');
{
  // ข้อมูลจริงไม่มีกล่องแบบนี้ ชุดนี้จึงสร้างของตัวเองขึ้นมาแล้วลบทิ้งตอนจบ
  bad('ข้อมูลจริงของลูกค้าไม่มีกล่องที่ขาดเส้นเชื่อมทั้งสองทางอยู่แล้ว',
    !nodes.some((n) => !(OUT[n.id] || []).length && !(INN[n.id] || []).length), '');
  await makeOrphan();
  await open(`?trace=${encodeURIComponent(ZZ_NODE)}`);
  const s = await traceState();
  happy('เปิดผังไล่เส้นทางของกล่องที่ไม่มีเส้นเชื่อมได้', s.open && s.focusId === ZZ_NODE, `${s.focusId}`);
  happy('มีกล่องเดียวบนผัง', s.count === 1, `${s.count} กล่อง`);
  bad('ไม่มีเส้นให้วาดสักเส้น', s.edges === 0, `${s.edges} เส้น`);
  happy('บอกว่ากล่องนี้ไม่มีเส้นทางให้ไล่',
    s.text.includes('ไม่มีเส้นเชื่อมเข้าหรือออก'), s.text.slice(0, 120).replace(/\n/g, ' '));
  bad('ไม่ขึ้นข้อความเส้นทางตันซ้ำซ้อนกับข้อความไม่มีเส้นเชื่อม', s.dead.length === 0, s.dead.join(','));
  bad('ยังกดปิดออกได้ ไม่ค้างอยู่กับจอเปล่า', await clickInTrace('ปิด'), '');
  await settle(1000);
  happy('ปิดแล้วกลับมาที่ผังใหญ่', !(await traceState()).open, '');
  await shot('07-กล่องไม่มีเส้นเชื่อม');
}

// ── 8. ปิดด้วย Esc ───────────────────────────────────────────────────────
suite('8. ปิดด้วยปุ่ม Esc และลำดับชั้นของการปิด');
{
  await open(`?trace=${encodeURIComponent(BUSY.id)}`);
  happy('ผังไล่เส้นทางเปิดอยู่', (await traceState()).open, '');
  await page.keyboard.press('Escape');
  await settle(900);
  const after = await traceState();
  happy('กด Esc แล้วผังไล่เส้นทางปิด', !after.open, '');
  // ปิดทีละชั้น: Esc ครั้งแรกปิดผังไล่เส้นทางที่กางทับอยู่ แผงรายละเอียดที่อยู่
  // ใต้มันยังเปิดค้างไว้ ครั้งที่สองจึงปิดแผง — ไม่ใช่ปิดหายทั้งสองชั้นทีเดียว
  happy('แผงรายละเอียดกล่องงานยังเปิดอยู่หลัง Esc ครั้งแรก',
    (await body()).includes('การเชื่อมต่อ'), '');
  await page.keyboard.press('Escape');
  await settle(900);
  bad('Esc ครั้งที่สองจึงปิดแผงรายละเอียด', !(await body()).includes('การเชื่อมต่อ'), '');
  bad('ปิดแล้ว URL ไม่ค้างพารามิเตอร์ไล่เส้นทางไว้',
    !(await page.url()).includes('trace='), await page.url());
}

// ── 9. แสดงบนผังใหญ่ ─────────────────────────────────────────────────────
suite('9. ปุ่มแสดงบนผังใหญ่ พากลับไปที่กล่องเดิมบนผัง');
{
  await open(`?trace=${encodeURIComponent(BUSY.id)}`);
  happy('กดปุ่มแสดงบนผังใหญ่ได้', await clickInTrace('แสดงบนผังใหญ่'), '');
  await settle(1400);
  happy('ผังไล่เส้นทางปิดลง', !(await traceState()).open, '');
  const sel = await page.evaluate((id) => {
    const el = document.getElementById(`sysmap-node-${id}`);
    return el ? el.getAttribute('aria-pressed') : null;
  }, BUSY.id);
  happy('กล่องเดิมยังถูกเลือกอยู่บนผังใหญ่', sel === 'true', `aria-pressed=${sel}`);
  happy('แผงรายละเอียดของกล่องเดิมเปิดค้างไว้ให้อ่านต่อ',
    (await body()).includes('การเชื่อมต่อ'), '');
}

// ── 10. สลับภาษาไทย / อังกฤษ ─────────────────────────────────────────────
suite('10. สลับภาษาไทย / อังกฤษ แล้วคำบนผังไล่เส้นทางเปลี่ยนตาม');
{
  await open(`?trace=${encodeURIComponent(DEAD_OUT.id)}`);
  const th = await traceState();
  happy('ภาษาไทยเป็นค่าตั้งต้น', th.text.includes('ผังเชิงเส้น'), '');
  // ปุ่มภาษาที่คนกดได้จริงตอนนี้คือปุ่มบนแถบหัวของผังไล่เส้นทาง ปุ่มของหน้าอยู่ข้างใต้
  happy('มีปุ่มสลับภาษาบนผังไล่เส้นทางให้กดได้จริง', await clickInTrace('EN'), '');
  await settle(1500);
  const en = await traceState();
  happy('ผังไล่เส้นทางไม่ปิดตัวเองตอนสลับภาษา', en.open && en.focusId === DEAD_OUT.id, '');
  happy('คำบนหัวแถบเปลี่ยนเป็นอังกฤษ',
    /Show on big map/i.test(en.text) && /Close/i.test(en.text), en.text.slice(0, 120).replace(/\n/g, ' '));
  happy('คำอธิบายท้ายแถบเปลี่ยนเป็นอังกฤษ', /Linear trace/i.test(en.text), '');
  happy('ข้อความเส้นทางตันเปลี่ยนเป็นอังกฤษด้วย', /nothing flows out/i.test(en.text), '');
  // ทุกคำบนชั้นนี้ต้องผ่าน t() — คำไทยค้างอยู่แม้แต่คำเดียวแปลว่ามีที่ที่ลืมห่อ
  bad('ไม่มีคำไทยของหน้าจอค้างอยู่ตอนเป็นอังกฤษ',
    !/ผังเชิงเส้น|แสดงบนผังใหญ่|ย้อนกลับ|กดกล่องไหน/.test(en.text),
    en.text.slice(0, 160).replace(/\n/g, ' '));
  await shot('10-ภาษาอังกฤษ');
  await clickInTrace('ไทย');
  await settle(1200);
  happy('สลับกลับเป็นไทยได้', (await traceState()).text.includes('ผังเชิงเส้น'), '');
}

// ── 11. บนโทรศัพท์กว้าง 390px ────────────────────────────────────────────
suite('11. บนโทรศัพท์กว้าง 390px');
{
  await page.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true });
  await open(`?trace=${encodeURIComponent(BUSY.id)}`);
  const s = await traceState();
  happy('ผังไล่เส้นทางเปิดได้บนจอโทรศัพท์', s.open, '');
  // ผังกว้างกว่าจอเสมอ มันต้องเลื่อนอยู่ในกรอบของตัวเอง ไม่ใช่ดันทั้งหน้าให้เลื่อน
  const geo = await page.evaluate(() => ({
    pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyOver: document.body.scrollWidth - document.documentElement.clientWidth,
    w: window.innerWidth,
  }));
  bad('หน้าเว็บไม่เลื่อนซ้ายขวา', geo.pageOver <= 0 && geo.bodyOver <= 0, JSON.stringify(geo));
  const btns = await page.evaluate(() => {
    const layer = document.querySelector('[data-trace-layer]');
    return [...layer.querySelectorAll('button')]
      .filter((b) => b.dataset.crumb === undefined && !b.dataset.traceNode)
      .map((b) => { const r = b.getBoundingClientRect(); return { t: b.innerText.trim(), l: r.left, r: r.right, w: r.width }; });
  });
  happy('ปุ่มบนหัวแถบยังอยู่ในจอทั้งหมด',
    btns.length > 0 && btns.every((b) => b.l >= -1 && b.r <= 391), JSON.stringify(btns));
  happy('ยังเห็นชื่อกล่องที่กำลังไล่', s.text.includes('ผังเชิงเส้น'), '');
  const scroller = await page.evaluate(() => {
    const layer = document.querySelector('[data-trace-layer]');
    const sc = [...layer.querySelectorAll('div')].find((d) => d.scrollWidth > d.clientWidth + 4);
    return sc ? { sw: sc.scrollWidth, cw: sc.clientWidth } : null;
  });
  happy('ผังเลื่อนซ้ายขวาอยู่ในกรอบของตัวเอง', !!scroller && scroller.sw > scroller.cw, JSON.stringify(scroller));
  happy('กดกล่องบนจอโทรศัพท์แล้วไล่ต่อได้', await (async () => {
    const t0 = await traceState();
    const target = t0.ids.find((id) => id !== t0.focusId);
    await clickBox(target);
    await settle(1200);
    return (await traceState()).focusId === target;
  })(), '');
  bad('กด Esc ปิดได้บนจอโทรศัพท์ด้วย', await (async () => {
    await page.keyboard.press('Escape');
    await settle(900);
    return !(await traceState()).open;
  })(), '');
  await shot('11-โทรศัพท์390');
  await page.setViewport({ width: 1440, height: 950 });
}

// ── 12. ของเสีย และไม่มีข้อผิดพลาดซ่อนอยู่ ───────────────────────────────
suite('12. ลิงก์เสีย และไม่มีข้อผิดพลาดซ่อนอยู่');
{
  // ลิงก์ที่ชี้กล่องที่ไม่มีอยู่ (ถูกลบไปแล้ว หรือพิมพ์มั่ว) ต้องไม่ทำให้หน้าขาว
  await open('?trace=n-ไม่มีกล่องนี้');
  const s = await traceState();
  bad('ลิงก์ชี้กล่องที่ไม่มีอยู่ ไม่เปิดผังเปล่า', !s.open, '');
  bad('หน้าแผนผังยังอ่านได้ตามปกติ', (await body()).includes('แผนผังการทำงานของระบบ'), '');
  bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' / '));
}

// ── เก็บกวาด ─────────────────────────────────────────────────────────────
suite('เก็บกวาดแถวที่ชุดนี้สร้าง');
{
  await browser.close();
  const left = await dropOrphan();
  const { rows } = await query(
    "select id from sysmap_nodes where id like 'zztest%' union all select id from sysmap_lanes where id like 'zztest%'"
  );
  happy('ลบเลนและกล่องทดสอบออกหมดแล้ว', rows.length === 0, `เหลือ ${rows.length}`);
  const after = (await call('/sysmap/bootstrap', { user: A })).data;
  happy('จำนวนเลนและกล่องกลับมาเท่าเดิม',
    after.counts.lanes === boot.counts.lanes && after.counts.nodes === boot.counts.nodes,
    `${after.counts.lanes}/${after.counts.nodes} vs ${boot.counts.lanes}/${boot.counts.nodes}`);
  if (left) console.log(`  (เก็บกวาดแถวค้าง ${left} แถว)`);
}

process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
