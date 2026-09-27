/**
 * สามโมดูลอ้างอิง — ขับหน้าจอจริงตามสถานการณ์ที่ถอดจากซอร์สของลูกค้า
 *
 * ชุด API พิสูจน์กฎที่อยู่หลังบ้าน ชุดนี้ถามสิ่งที่เห็นได้เฉพาะบนจอ: เมนูซ้ายกาง
 * หมวดของกรณีและของผังแยกกันจริงไหม หัวหมวดบอกคำอธิบายไหม รายการผังคั่นหัวข้อ
 * ตามหมวดไหม หน้าเริ่มต้นที่ตั้งไว้พาไปถูกที่ไหม กล่องแก้ไขมีที่ให้สลับตำแหน่ง
 * และปุ่มลบไหม (บนโทรศัพท์ปุ่มลบอยู่ในกล่องนี้ที่เดียว) และภาษาอังกฤษสลับชื่อ
 * ข้อมูลสองภาษาให้จริงไหม
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query, call } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/refmodules-ui`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin;
const MARK = 'ZZREFUI';
const startMaxVersion = (await query('select coalesce(max(id),0)::int id from sop_versions')).rows[0].id;
/**
 * ลำดับของกรณีจริงทั้งเล่มตอนเริ่ม — ชุดนี้กดสลับตำแหน่งจริงบนหน้าจอ ถ้าลืมสลับ
 * กลับ กรณีของลูกค้าจะสลับเลขกันค้างไว้ (เคยเกิดแล้วครั้งหนึ่ง: PO-1 กลายเป็น PO-3)
 */
const orderAtStart = (await query(
  'select no, module, display_no from sop_scenarios order by no')).rows
  .map((r) => `${r.no}:${r.display_no}`).join(' ');

async function clean() {
  const list = (await call('/sop/scenarios', { user: A })).data || [];
  for (const x of list.filter((r) => String(r.title_th).startsWith(MARK))) {
    await call(`/sop/scenarios/${x.no}`, { method: 'DELETE', user: A });
  }
  await query('delete from sop_versions where id > $1', [startMaxVersion]);
}
await clean();

fs.rmSync(`${ROOT}/chrome-refmod`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-refmod`,
  defaultViewport: { width: 1480, height: 980 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 1600) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });

// ตั้งหน้าเริ่มต้นเป็นกรณีทั้งหมดให้ทุกรอบ — ถ้าปล่อยว่าง ระบบเปิดมาที่ผังกระบวนการ
// ตามค่าเริ่มต้นของระบบจริง (ตรวจพฤติกรรมนั้นไว้ในข้อ SOP-UI 5 โดยเฉพาะ)
const as = async (user, path = '/sop', keepStorage = false, view = 'ALL') => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t, keep, v) => {
    if (!keep) localStorage.clear();
    localStorage.setItem('hr_access_token', t);
    if (!keep && v) localStorage.setItem('vcb_sop_default_view', v);
  }, tok(user), keepStorage, view);
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(2800);
};
const click = (label) => page.evaluate((l) => {
  const el = [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim() === l)
    || [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim().includes(l));
  if (el) { el.click(); return true; } return false;
}, label);
const typeSearch = (value) => page.evaluate((v) => {
  const i = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('ค้นหา'));
  if (!i) return false;
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, v);
  i.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, value);
/** นับการ์ดกรณี — ชิปรหัสรายหมวดในปุ่ม เช่น PO-1 */
const countCases = () => page.evaluate(() =>
  [...document.querySelectorAll('button .chip')].filter((c) => /^[A-Z]{2}-\d+$/.test(c.innerText.trim())).length);

// ── SOP ────────────────────────────────────────────────────────────────────
suite('SOP-UI 1. เมนูซ้ายกางหมวดของกรณีและของผังแยกกัน');
{
  await as(A);
  const readMenu = () => page.evaluate(() => ({
    cases: [...document.querySelectorAll('[data-mod]')].map((el) => `${el.dataset.mod}:${el.dataset.count}`),
    flows: [...document.querySelectorAll('[data-flowmod]')].map((el) => `${el.dataset.flowmod}:${el.dataset.count}`),
    disabled: [...document.querySelectorAll('[data-mod]')].filter((el) => el.disabled).length,
  }));
  const menu = await readMenu();
  happy('หมวดของกรณีขึ้นครบ 11 หมวด', menu.cases.length === 11, menu.cases.join(' '));
  bad('ไม่มีหมวดไหนถูกปิดปุ่มไว้จนกดไม่ได้ (ของเขาหรี่แต่ยังกดได้)', menu.disabled === 0, `${menu.disabled}`);
  // กลุ่มที่ไม่ได้ดูอยู่ต้องพับ — ของเขากางทีละกลุ่ม (คลาส cs-open/flows-open)
  bad('กลุ่มผังยังพับอยู่ตอนกำลังดูกรณี', menu.flows.length === 0, menu.flows.join(' '));
  await click('ผังกระบวนการ');
  await settle(2200);
  const onFlows = await readMenu();
  happy('หมวดของผังขึ้นเฉพาะ 8 หมวดที่มีผังจริง', onFlows.flows.length === 8, onFlows.flows.join(' '));
  happy('ผังเรียง BD ก่อน ตามลำดับที่งานเดินจริงของเขา',
    onFlows.flows[0].startsWith('BD:'), onFlows.flows.join(' '));
  bad('ไม่มีหมวดผังที่ขึ้นเลข 0 ค้างไว้', onFlows.flows.every((s) => !s.endsWith(':0')), onFlows.flows.join(' '));
  bad('สลับมาดูผังแล้วกลุ่มกรณีพับเก็บ', onFlows.cases.length === 0, onFlows.cases.join(' '));
  // ตัวเลขบนหมวดของกรณีไม่เปลี่ยนความหมายเมื่อสลับไปดูผังแล้วกลับมา
  await click('กรณีเฉพาะ');
  await settle(2200);
  const back = await readMenu();
  happy('กลับมาที่กรณีแล้วตัวเลขของหมวดยังเป็นจำนวนกรณีเดิม',
    back.cases.join(' ') === menu.cases.join(' '), back.cases.join(' '));
  await shot('01-เมนูซ้ายสองชุด');
}

suite('SOP-UI 2. รายการผังคั่นหัวข้อตามหมวด');
{
  await click('ผังกระบวนการ');
  await settle(2200);
  const t = await body();
  happy('มีหัวข้อกลุ่มของหมวดในรายการผัง', /BD · งบประมาณ/.test(t), '');
  happy('หัวข้อกลุ่มเรียง BD ก่อน PO', t.indexOf('BD · งบประมาณ') < t.indexOf('PO · จัดซื้อ'), '');
  happy('กรองผังตามหมวดได้จากเมนูซ้าย', await page.evaluate(() => {
    const el = document.querySelector('[data-flowmod="AP"]');
    if (!el) return false; el.click(); return true;
  }), '');
  await settle(2200);
  const ap = await body();
  happy('กรองแล้วเหลือเฉพาะผังของหมวดนั้น',
    /แสดง 7 จาก 33 ผัง/.test(ap) && !/BD · งบประมาณ/.test(ap),
    (ap.match(/แสดง \d+ จาก \d+ ผัง/) || [''])[0]);
  await shot('02-ผังจัดกลุ่ม');
}

suite('SOP-UI 3. หัวหมวดบนรายการกรณี และหน้าต้อนรับ');
{
  await as(A);
  const home = await body();
  // หน้าต้อนรับของเขาบอกว่ากำลังอ่านคู่มือฉบับไหน ไม่ใช่แค่ให้เลือกจากซ้าย
  happy('หน้าต้อนรับบอกชื่อคู่มือ ฉบับ และจำนวนกรณี/รายงาน',
    /เวอร์ชัน:/.test(home) && /33 กรณีเฉพาะ/.test(home) && /24 รายงาน/.test(home),
    home.slice(0, 120).replace(/\n/g, ' | '));
  happy('เลือกหมวดจากเมนูซ้ายได้', await page.evaluate(() => {
    const el = document.querySelector('[data-mod="AP"]');
    if (!el) return false; el.click(); return true;
  }), '');
  await settle(2400);
  const ap = await body();
  const mod = (await call('/sop/bootstrap', { user: A })).data.modules.find((m) => m.code === 'AP');
  happy('ขึ้นหัวหมวดพร้อมชื่อเต็มของหมวด', ap.includes(mod.name_th), mod.name_th);
  happy('และคำอธิบายว่าหมวดนี้ทำอะไร', ap.includes(mod.desc_th.slice(0, 24)), mod.desc_th.slice(0, 40));
  await shot('03-หัวหมวด');
}

suite('SOP-UI 4. ค้นหาด้วยรหัสกรณี และคำที่อยู่ลึกในขั้นตอน');
{
  await as(A);
  await typeSearch('PO-3');
  await settle(2200);
  const n = await countCases();
  const t = await body();
  happy('พิมพ์รหัส PO-3 แล้วเจอกรณีนั้น', n >= 1 && t.includes('PO-3'), `${n} การ์ด`);
  happy('และรายการแคบลงจริง (ไม่ใช่ 33 ใบ)', n < 33, `${n}`);
  await typeSearch('zzqqxx');
  await settle(2000);
  happy('ค้นไม่เจอขึ้นข้อความของเขา', (await body()).includes('ไม่พบรายการที่ค้นหา'), '');
  // รายการว่างไม่ทำให้แถบขวาหายไป — ระบบจริงยังขึ้นหน้าต้อนรับข้าง ๆ
  happy('ค้นไม่เจอแล้วแถบรายละเอียดยังอยู่', (await body()).includes('เวอร์ชัน:'), '');
  await typeSearch('');
  await settle(1600);
  await shot('04-ค้นหา');
}

suite('SOP-UI 5. หน้าเริ่มต้นที่ตั้งไว้ — ตั้งแล้วไปเลย และจำไว้รอบหน้า');
{
  await as(A);
  happy('เปิดหน้าตั้งค่าได้', await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '').includes('การตั้งค่า'));
    if (!b) return false; b.click(); return true;
  }), '');
  await settle(1400);
  const opts = await page.evaluate(() => {
    const s = document.getElementById('sop-default-view');
    return s ? [...s.options].map((o) => `${o.value}|${o.text}`) : [];
  });
  happy('ตัวเลือกมีผังกระบวนการและวิธีเรียก Report ด้วย ไม่ใช่แค่หมวด',
    opts.some((o) => o.startsWith('flows|')) && opts.some((o) => o.startsWith('reports|')),
    opts.slice(0, 3).join(' · '));
  happy('เลือกผังกระบวนการเป็นหน้าเริ่มต้นได้', await page.evaluate(() => {
    const s = document.getElementById('sop-default-view');
    if (!s) return false;
    s.value = 'flows';
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }), '');
  await settle(2200);
  await click('ปิด');
  await settle(1800);
  happy('เลือกแล้วพาไปหน้านั้นทันที ไม่ต้องรอเปิดใหม่',
    (await body()).includes('ผังกระบวนการ · Process Flows'), '');
  // เปิดใหม่ (เก็บ localStorage ไว้) ต้องยังมาที่ผัง
  await as(A, '/sop', true);
  happy('เปิดใหม่แล้วยังมาที่ผังกระบวนการ',
    (await body()).includes('ผังกระบวนการ · Process Flows'), '');
  // คืนค่าเป็นทั้งหมด
  await page.evaluate(() => localStorage.removeItem('vcb_sop_default_view'));
  await shot('05-หน้าเริ่มต้น');
}

suite('SOP-UI 6. หน้าต่างแก้ไข — สลับตำแหน่ง และปุ่มลบในหน้าต่าง');
{
  const mk = await call('/sop/scenarios', { method: 'POST', user: A,
    body: { module: 'PO', titleTh: `${MARK} กรณีจากหน้าจอ`, titleEn: 'Screen case', steps: [{ text: 'หนึ่ง' }] } });
  happy('เตรียมกรณีทดสอบไว้ได้', mk.status === 201, `${mk.status}`);
  await as(A, `/sop?case=${mk.data.no}`);
  happy('เปิดกรณีนั้นแล้วกดแก้ไขได้', await click('แก้ไข · Edit'), '');
  await settle(1800);
  const t = await body();
  happy('หัวหน้าต่างบอกทั้งรหัสและชื่อกรณี แบบระบบจริง',
    /แก้ไขกรณีที่ PO-\d+ · ZZREFUI/.test(t), (t.match(/แก้ไขกรณีที่[^\n]*/) || [''])[0]);
  happy('มีช่องสลับตำแหน่งในหน้าต่างแก้ไข', t.includes('สลับตำแหน่ง'), '');
  happy('มีปุ่ม ↔ สลับ', /↔\s*สลับ/.test(t), '');
  happy('บอกผลของการสลับไว้ให้อ่านก่อนกด', t.includes('กรณีอื่นไม่ถูกเลื่อนตำแหน่ง'), '');
  happy('มีปุ่มลบกรณีนี้ในหน้าต่างแก้ไข (ทางเดียวที่กดได้บนโทรศัพท์)',
    t.includes('ลบกรณีนี้ · Delete'), '');
  const opts = await page.evaluate(() => {
    const s = document.getElementById('sop-swap');
    return s ? [...s.options].map((o) => o.value).filter(Boolean) : [];
  });
  happy('รายการให้เลือกเป็นกรณีในหมวดเดียวกันเท่านั้น',
    opts.length > 0 && opts.every((v) => v.startsWith('PO-')), opts.slice(0, 5).join(','));
  bad('ไม่เลือกคู่แล้วกดสลับ → เตือน ไม่ใช่เงียบ', await (async () => {
    await click('↔ สลับ');
    await settle(1500);
    return (await body()).includes('กรุณาเลือกกรณีที่ต้องการสลับตำแหน่ง');
  })(), '');
  // สลับจริงกับใบแรกของหมวด
  const before = opts[0];
  const mineWas = (await call(`/sop/scenarios/${mk.data.no}`, { user: A })).data.display_no;
  happy(`เลือก ${before} แล้วกดสลับได้`, await page.evaluate((v) => {
    const s = document.getElementById('sop-swap');
    if (!s) return false;
    s.value = v;
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, before), '');
  await click('↔ สลับ');
  await settle(3000);
  const now = (await call(`/sop/scenarios/${mk.data.no}`, { user: A })).data.display_no;
  happy('สลับแล้วรหัสของกรณีนี้กลายเป็นรหัสของคู่ที่เลือก', now === before, `${now} (คาด ${before})`);
  await shot('06-หน้าต่างแก้ไข');
  // สลับกลับทันที — คู่ที่ถูกสลับเป็นกรณีจริงของลูกค้า ปล่อยไว้คือเลขของเขาสลับค้าง
  const undo = await call(`/sop/scenarios/${mk.data.no}/swap`, { method: 'POST', user: A, body: { swapWith: mineWas } });
  happy('สลับกลับคืนตำแหน่งเดิมได้', undo.status === 200
    && (await call(`/sop/scenarios/${mk.data.no}`, { user: A })).data.display_no === mineWas, `${undo.status}`);
  await call(`/sop/scenarios/${mk.data.no}`, { method: 'DELETE', user: A });
}

suite('SOP-UI 7. สลับภาษา — ชื่อสองภาษาสลับบรรทัดหลัก/รอง');
{
  await as(A);
  const thFirst = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => {
      const c = x.querySelector('.chip');
      return c && c.innerText.trim() === 'PO-1';
    });
    return b ? b.innerText : '';
  });
  happy('ภาษาไทยขึ้นชื่อไทยเป็นบรรทัดหลัก', /กรณี/.test(thFirst), thFirst.slice(0, 60).replace(/\n/g, ' | '));
  happy('กดเป็นภาษาอังกฤษได้', await click('EN'), '');
  await settle(2600);
  const enFirst = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => {
      const c = x.querySelector('.chip');
      return c && c.innerText.trim() === 'PO-1';
    });
    return b ? b.innerText : '';
  });
  const po1 = ((await call('/sop/scenarios?module=PO', { user: A })).data || [])
    .find((r) => r.display_no === 'PO-1');
  happy('ภาษาอังกฤษขึ้นชื่ออังกฤษเป็นบรรทัดหลัก อย่างระบบจริง',
    Boolean(po1?.title_en) && enFirst.includes(po1.title_en) && !enFirst.includes(po1.title_th),
    `${po1?.title_en} | ${enFirst.slice(0, 60).replace(/\n/g, ' | ')}`);
  await shot('07-สองภาษา');
  await click('ไทย');
  await settle(1600);
}

// ── แผนผังระบบ ─────────────────────────────────────────────────────────────
suite('MAP-UI 1. ตัวกรองผสมกัน และปุ่มล้างตัวกรองล้างให้ครบ');
{
  await as(A, '/sysmap');
  happy('เปิดแผนผังได้', (await body()).includes('แผนผังการทำงานของระบบ'), '');
  happy('กรองเลเยอร์ ERP ได้', await click('ERP เท่านั้น'), '');
  await settle(1200);
  happy('กรองแผนกพร้อมกันได้', await click('บัญชี'), '');
  await settle(1200);
  const both = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('button[aria-pressed]')];
    return { total: boxes.length, dim: boxes.filter((b) => /opacity-20/.test(b.className)).length };
  });
  happy('ตัวกรองสองตัวทำงานร่วมกันแบบ "และ" (กล่องที่ไม่ผ่านถูกหรี่ ไม่ได้หายไป)',
    both.total > 0 && both.dim > 0 && both.dim < both.total, JSON.stringify(both));
  // ปิดสวิตช์ชนิดเส้นแล้วกดล้างตัวกรอง — ของเขาคืนทุกอย่างรวมเส้นด้วย
  happy('ปิดเส้นตรงได้', await click('เส้นตรง'), '');
  await settle(900);
  happy('กดล้างตัวกรองได้', await click('ล้างตัวกรอง'), '');
  await settle(1400);
  const reset = await page.evaluate(() => {
    const on = (label) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().includes(label));
      return b ? /bg-white\b/.test(b.className) : null;
    };
    return {
      direct: on('เส้นตรง'), indirect: on('เส้นมีเงื่อนไข'), all: on('ทั้งหมด'),
      dim: [...document.querySelectorAll('button[aria-pressed]')].filter((b) => /opacity-20/.test(b.className)).length,
    };
  });
  happy('ล้างแล้วสวิตช์ชนิดเส้นกลับมาเปิดทั้งคู่', reset.direct === true && reset.indirect === true, JSON.stringify(reset));
  happy('และไม่มีกล่องงานถูกหรี่ค้างไว้', reset.dim === 0, `${reset.dim}`);
  await shot('08-ตัวกรองแผนผัง');
}

suite('MAP-UI 2. แผงกล่องงาน — ป้ายยืนยัน และปิดด้วย Esc');
{
  // n-pr (ใบขอซื้อ) เป็นกล่องที่ข้อมูลยืนยันแล้ว
  const node = (await call('/sysmap/bootstrap', { user: A })).data.nodes.find((n) => !n.unverified);
  await as(A, `/sysmap?node=${node.id}`);
  const t = await body();
  happy('กล่องที่ยืนยันแล้วมีป้ายบอกว่ายืนยันแล้ว อย่างระบบจริง', t.includes('ยืนยันแล้ว'), node.id);
  happy('แท็บแรกบอกจำนวนขั้นตอน/งานของกล่องนั้น', /(ขั้นตอน|งาน) \(\d+\)/.test(t),
    (t.match(/(ขั้นตอน|งาน) \(\d+\)/) || [''])[0]);
  await page.keyboard.press('Escape');
  await settle(1200);
  happy('กด Esc แล้วแผงปิด', (await body()).includes('คลิกโหนดใดก็ได้'), '');
  await shot('09-แผงกล่องงาน');
}

suite('MAP-UI 3. ชิปหน้าที่ที่เกี่ยวข้อง — เปิดทะเบียนทั้งฉบับแล้วเน้นแถวนั้น');
{
  await as(A, '/sysmap?node=n-gl');
  const chip = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /^[A-Z]{2,5}(-[A-Z]{2})?-\d\d$/.test(x.innerText.trim()));
    if (!b) return '';
    const code = b.innerText.trim();
    b.click();
    return code;
  });
  happy('กดชิปรหัสหน้าที่ได้', Boolean(chip), chip);
  await settle(2400);
  const t = await body();
  happy('ทะเบียนเปิดมาทั้งฉบับ ไม่ถูกกรองเหลือแถวเดียว', /แสดง 1[0-9][0-9] จาก/.test(t),
    (t.match(/แสดง \d+ จาก \d+/) || [''])[0]);
  happy('แถวที่กดถูกเน้นและเลื่อนมาให้เห็น', await page.evaluate((code) => {
    const row = [...document.querySelectorAll('tr')]
      .find((r) => (r.querySelector('td') || {}).innerText?.trim() === code);
    if (!row) return false;
    const r = row.getBoundingClientRect();
    return /ring/.test(row.className) && r.top > 0 && r.top < window.innerHeight;
  }, chip), chip);
  happy('บรรทัดสรุปบอกจุดที่คนนอกกรอกและงานหน้างานด้วย',
    t.includes('จุดที่คนนอกเป็นผู้กรอก') && t.includes('งานที่ทำที่หน้างาน'), '');
  await shot('10-ชิปเข้าทะเบียน');
}

// ── พอร์ทัล ────────────────────────────────────────────────────────────────
suite('PORTAL-UI 1. ค้นหาแอป — พิมพ์อังกฤษตอนหน้าจอเป็นไทยก็ต้องเจอ');
{
  await as(A, '/');
  const search = (v) => page.evaluate((q) => {
    const i = [...document.querySelectorAll('input[type="search"]')]
      .find((x) => (x.placeholder || '').includes('ค้นหาแอป'));
    if (!i) return false;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, q);
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, v);
  const cards = () => page.evaluate(() =>
    [...document.querySelectorAll('button h3')].map((h) => h.innerText.trim()));
  happy('พิมพ์คำไทยเจอ', await (async () => {
    await search('ประชุม'); await settle(900);
    return (await cards()).some((c) => c.includes('ประชุม'));
  })(), '');
  happy('พิมพ์คำอังกฤษตอนหน้าจอเป็นไทยก็เจอ (ระบบจริงเจอเฉพาะอังกฤษ ของเราต้องเจอทั้งสอง)',
    await (async () => {
      await search('credit'); await settle(900);
      return (await cards()).some((c) => c.includes('สินเชื่อ'));
    })(), (await cards()).join(' · '));
  happy('ค้นไม่เจอบอกด้วยคำของเขา', await (async () => {
    await search('zzqqxx'); await settle(900);
    return (await body()).includes('ไม่พบแอปพลิเคชันที่ค้นหา');
  })(), '');
  await search('');
  await settle(900);
  await shot('11-ค้นหาแอป');
}

suite('PORTAL-UI 2. ปฏิทินวันหยุดตามภาษา และวันหยุดถัดไป');
{
  const th = await body();
  happy('ภาษาไทยขึ้นหัวคอลัมน์วันแบบไทย', /\nอา\n|อา\tจ/.test(th) || th.includes('อา'), '');
  happy('บอกวันหยุดถัดไปพร้อมจำนวนวัน', /วันหยุดถัดไป:/.test(th) && /(อีก \d+ วัน|วันนี้)/.test(th),
    (th.match(/วันหยุดถัดไป:[^\n]*/) || [''])[0]);
  happy('กดเป็นภาษาอังกฤษได้', await click('EN'), '');
  await settle(2200);
  const en = await body();
  happy('หัวคอลัมน์วันเปลี่ยนเป็นอังกฤษ', en.includes('Su') && en.includes('Mo'), '');
  happy('ชื่อเดือนเปลี่ยนเป็นอังกฤษ (ไม่ใช่ไทยค้าง)',
    /(January|February|March|April|May|June|July|August|September|October|November|December)/.test(en), '');
  happy('จำนวนวันถึงวันหยุดถัดไปเป็นอังกฤษด้วย', /(in \d+ days|Today)/i.test(en),
    (en.match(/Next holiday:[^\n]*/) || [''])[0]);
  bad('ไม่มีคำไทยของปฏิทินค้างอยู่ตอนเป็นอังกฤษ', !/อีก \d+ วัน/.test(en), '');
  await shot('12-ปฏิทินอังกฤษ');
  await click('ไทย');
  await settle(1600);
}

suite('PORTAL-UI 3. กล่องช่วยเหลือ — ไม่เลือกส่วนที่เกี่ยวข้องต้องไม่ผ่าน');
{
  happy('เปิดกล่องช่วยเหลือได้', await click('ช่วยเหลือ / แจ้งปัญหา'), '');
  await settle(1400);
  const t = await body();
  happy('มีทั้งช่องเลือกส่วนที่เกี่ยวข้องและช่องรายละเอียด',
    t.includes('ส่วนที่เกี่ยวข้อง') && t.includes('รายละเอียด'), '');
  happy('ทั้งสองช่องถูกทำเครื่องหมายว่าจำเป็น', await page.evaluate(() =>
    [...document.querySelectorAll('label')].filter((l) => /ส่วนที่เกี่ยวข้อง \*|รายละเอียด \*/.test(l.innerText)).length === 2), '');
  await click('ส่งเรื่อง');
  await settle(1500);
  bad('ไม่เลือกส่วนที่เกี่ยวข้อง → เตือน ไม่ส่งออกไป',
    (await body()).includes('กรุณาเลือกสิ่งที่คุณกำลังทำอยู่'), '');
  // เลือกส่วนแล้วแต่ไม่กรอกข้อความ ต้องเตือนอีกข้อความหนึ่ง
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) =>
      [...x.options].some((o) => o.text.includes('เลือกส่วนที่เกี่ยวข้อง')));
    if (!s) return;
    s.value = s.options[1].value;
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await click('ส่งเรื่อง');
  await settle(1500);
  bad('เลือกแล้วแต่ไม่กรอกรายละเอียด → เตือนคนละข้อความ',
    (await body()).includes('กรุณาอธิบายปัญหาก่อนส่ง'), '');
  await shot('13-กล่องช่วยเหลือ');
  await click('ปิด');
}

suite('ไม่มีข้อผิดพลาดซ่อนอยู่');
bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' | '));

suite('เก็บกวาด');
{
  await clean();
  const left = ((await call('/sop/scenarios', { user: A })).data || [])
    .filter((r) => String(r.title_th).startsWith(MARK));
  happy('ไม่มีกรณีทดสอบค้างไว้', left.length === 0, `${left.length}`);
  const vers = (await query('select count(*)::int n from sop_versions where id > $1', [startMaxVersion])).rows[0].n;
  happy('ประวัติเวอร์ชันกลับไปเท่าตอนเริ่ม', vers === 0, `${vers}`);
  const total = (await call('/sop/bootstrap', { user: A })).data.counts.scenarioTotal;
  happy('จำนวนกรณีในคู่มือกลับมาเป็น 33', total === 33, `${total}`);
  const orderNow = (await query(
    'select no, module, display_no from sop_scenarios order by no')).rows
    .map((r) => `${r.no}:${r.display_no}`).join(' ');
  bad('ลำดับและรหัสของกรณีจริงทั้งเล่มไม่ถูกเปลี่ยนทิ้งไว้', orderNow === orderAtStart,
    orderNow === orderAtStart ? '' : 'ลำดับเปลี่ยนไป — ต้องสลับกลับ');
}

await browser.close();
process.exit(report(`${ROOT}/refmodules-flows-ui.json`) ? 1 : 0);
