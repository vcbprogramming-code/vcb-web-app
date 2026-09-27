/**
 * รายงานการประชุม — เส้นเวลา · หน้ากระดาษ A4 + QR · และเส้นทางที่เหลือของโมดูล
 *
 * ชุดนี้ขับหน้าจอจริงด้วยเบราว์เซอร์จริง ไม่ใช่เรียก API: สิ่งที่ตรวจในไฟล์นี้คือ
 * ของที่ "จริงแค่บนหน้าจอ" — หน้ากระดาษตกที่ไหน จุดบนเส้นเวลาพาไปฉบับไหน ขนาด
 * ตัวอักษรที่เลือกไว้เปลี่ยนข้อความจริงไหมและยังอยู่ไหมหลังรีโหลด
 *
 * ── ห้ามแตะข้อมูลจริง ──────────────────────────────────────────────────────
 * ฐานข้อมูลนี้มีบันทึกจริงของลูกค้า 82 ฉบับใน 9 กลุ่ม ทุกแถวที่ชุดนี้สร้างจึงมี
 * MARK อยู่ในชื่อและถูกลบตอนจบ และทุกการกดปุ่มที่ทำอะไรกับเอกสาร (ปักหมุด ลบ
 * เผยแพร่) ต้องกดเฉพาะปุ่มที่อยู่ "ในเอกสารที่เปิดอยู่" — เคยมีครั้งที่ชุดทดสอบ
 * ไปกดปักหมุดบันทึกจริงของลูกค้าเพราะเลือกปุ่มจากทั้งหน้า
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query, call } from './harness.mjs';
import { clickInDialog } from './tools/ui.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/meetings-flows`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin;      // ผู้ดูแล — แก้ไขและจัดการสิทธิ์ได้
const C = U.exec;       // ผู้บริหาร — อ่านได้อย่างเดียว
const MARK = 'ZZMTGFLOW';

const clean = async () => {
  await query('delete from mtg_group_guests where group_id in (select id from mtg_groups where code like $1)', [`${MARK}%`]);
  await query('delete from mtg_meetings where title like $1 or content like $1', [`%${MARK}%`]);
  await query('delete from mtg_groups where code like $1', [`${MARK}%`]);
};
await clean();

// สองกลุ่มของชุดทดสอบเอง — ต้องมีสองกลุ่มเพราะเส้นทาง "ย้ายโครงการ" และ
// "จัดเก็บเข้าหลายโครงการ" ต้องมีปลายทางที่ไม่ใช่ที่เดิม
const gA = (await query(
  `insert into mtg_groups (code, name, name_en, color, visibility, sort_order)
   values ($1,$2,$3,'#0ea5e9','public', 996) returning *`,
  [`${MARK}-A`, `${MARK} โครงการเอ`, `${MARK} Project A`])).rows[0];
const gB = (await query(
  `insert into mtg_groups (code, name, name_en, color, visibility, sort_order)
   values ($1,$2,$3,'#f59e0b','public', 997) returning *`,
  [`${MARK}-B`, `${MARK} โครงการบี`, `${MARK} Project B`])).rows[0];

/** ปีของวันประชุมที่ชุดนี้ใช้ — ปีปัจจุบัน เพื่อให้ปฏิทินเปิดมาเจอโดยไม่ต้องกดเลื่อน */
const NOW = new Date();
const Y = NOW.getFullYear();
const iso = (mo, d) => `${Y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * เนื้อหายาวพอที่จะเกินหนึ่งหน้ากระดาษ A4
 *
 * พื้นที่พิมพ์สูง 250 มม. (297 − 27 − 20) ที่ตัวอักษร 15 พิกเซล ระยะบรรทัด 1.55
 * ได้ราว 40 บรรทัดต่อหน้า — ย่อหน้าสามสิบย่อหน้าที่ยาวประมาณสองบรรทัดจึงกินสาม
 * หน้าขึ้นไปแน่นอน ไม่ใช่ "น่าจะเกิน" ซึ่งทำให้ข้อตรวจล้มสลับไปมา
 */
const LONG = `<h2>${MARK} วาระที่ 1 ความก้าวหน้างานโครงสร้าง</h2>`
  + Array.from({ length: 30 }, (_, i) =>
    `<p>${MARK} ย่อหน้าที่ ${i + 1} — ที่ประชุมรับทราบความก้าวหน้างานเสาเข็มเจาะและงานฐานรากในเขตพื้นที่ที่ ${i + 1} `
    + 'พร้อมมอบหมายให้ผู้ควบคุมงานจัดทำรายงานประจำสัปดาห์เสนอผู้จัดการโครงการภายในวันศุกร์ของทุกสัปดาห์</p>').join('');

const mk = async (body) => {
  const r = await call('/meetings', { method: 'POST', user: A, body });
  if (r.status !== 201) throw new Error(`สร้างบันทึกไม่ได้ ${r.status}: ${JSON.stringify(r).slice(0, 200)}`);
  return r.data.id;
};

// บันทึกที่เส้นเวลาต้องพลอต: สองฉบับในโครงการเอ (คนละเดือน) หนึ่งฉบับในโครงการบี
// วันเดียวกับฉบับแรกของเอ เพื่อให้มีวันที่มีสองฉบับ (ทดสอบกล่องเลือกวันในปฏิทิน)
const mLong = await mk({
  groupId: gA.id, title: `${MARK} ประชุมความก้าวหน้า ครั้งที่ 1`,
  meetingDate: iso(3, 12), timeLabel: '10:00', content: LONG, visible: true,
});
const mShort = await mk({
  groupId: gA.id, title: `${MARK} ประชุมติดตามผล ครั้งที่ 2`,
  meetingDate: iso(6, 20), content: `<p>${MARK} สรุปสั้น ๆ หนึ่งย่อหน้า</p>`, visible: true,
});
const mSameDay = await mk({
  groupId: gB.id, title: `${MARK} ประชุมโครงการบี วันเดียวกัน`,
  meetingDate: iso(3, 12), content: `<p>${MARK} วาระของโครงการบี</p>`, visible: true,
});
// ฉบับที่มีหัวบริษัทอยู่ในเนื้อหาเองแล้ว — ใช้ตรวจว่าเราไม่เติมหัวจดหมายซ้ำ
const mOwnHead = await mk({
  groupId: gA.id, title: `${MARK} ฉบับที่มีหัวของตัวเอง`,
  meetingDate: iso(7, 1),
  content: `<h1>บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด</h1><p>${MARK} เนื้อหาที่มีหัวมาแล้ว</p>`,
  visible: true,
});

fs.rmSync(`${ROOT}/chrome-mtgflow`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-mtgflow`,
  defaultViewport: { width: 1600, height: 1000 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 1500) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const waitText = async (needle, ms = 15000) => {
  const until = Date.now() + ms;
  for (;;) {
    if ((await body()).includes(needle)) return true;
    if (Date.now() > until) return false;
    await settle(300);
  }
};
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
// ปิดกล่องพิมพ์ของระบบไว้ ไม่อย่างนั้นกล่องจะค้างรอคนกดและชุดทดสอบหยุดอยู่ตรงนั้น
// ตั้งในทุกเอกสารใหม่ รวมกรอบ srcdoc ที่หน้าพิมพ์สร้างขึ้นเอง — เราจึงตรวจ
// "เอกสารที่ถูกส่งเข้าเครื่องพิมพ์" ได้จริงโดยไม่ต้องพิมพ์
await page.evaluateOnNewDocument(() => {
  window.__printCalls = 0;
  window.print = () => { window.__printCalls += 1; };
});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0].slice(0, 160)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().split('\n')[0].slice(0, 160));
});

const as = async (user, path = '/meetings') => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((tk) => { localStorage.clear(); localStorage.setItem('hr_access_token', tk); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(1200);
  if (path.startsWith('/meetings')) await waitText('ทุกการประชุม');
  await settle(800);
};

const clickOnce = (label) => page.evaluate((l) => {
  const all = [...document.querySelectorAll('button, a')];
  const el = all.find((x) => x.innerText.trim() === l) || all.find((x) => x.innerText.trim().includes(l));
  if (el) { el.click(); return true; } return false;
}, label);
const click = async (label, ms = 10000) => {
  const until = Date.now() + ms;
  for (;;) {
    if (await clickOnce(label)) return true;
    if (Date.now() > until) return false;
    await settle(300);
  }
};
/** กดปุ่มที่อยู่ในเอกสารที่เปิดอยู่เท่านั้น — ชื่อปุ่มหลายชื่อไปโผล่ในแถวรายการ
 *  ของบันทึกจริงได้ กดจากทั้งหน้าคือการไปแก้ข้อมูลของลูกค้า */
const clickInDoc = async (label, ms = 10000) => {
  const until = Date.now() + ms;
  for (;;) {
    const hit = await page.evaluate((l) => {
      const doc = document.querySelector('article');
      if (!doc) return false;
      const all = [...doc.querySelectorAll('button, a')];
      const el = all.find((x) => x.innerText.trim() === l) || all.find((x) => x.innerText.trim().includes(l));
      if (el) { el.click(); return true; } return false;
    }, label);
    if (hit) return true;
    if (Date.now() > until) return false;
    await settle(300);
  }
};
const clickLabel = async (aria, ms = 10000) => {
  const until = Date.now() + ms;
  for (;;) {
    const hit = await page.evaluate((a) => {
      const el = document.querySelector(`[aria-label="${a}"]`);
      if (el) { el.click(); return true; } return false;
    }, aria);
    if (hit) return true;
    if (Date.now() > until) return false;
    await settle(300);
  }
};
const count = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);
/** รอให้จำนวนองค์ประกอบถึงเกณฑ์ — รายการเต็ม (บันทึกจริง 82 ฉบับ) ใช้เวลาโหลด
 *  ไม่เท่ากันทุกรอบ การรอเวลาคงที่คือที่มาของข้อตรวจที่ผ่านบ้างไม่ผ่านบ้าง */
const waitCount = async (sel, min = 1, ms = 20000) => {
  const until = Date.now() + ms;
  for (;;) {
    if ((await count(sel)) >= min) return true;
    if (Date.now() > until) return false;
    await settle(300);
  }
};
const textOf = (sel) => page.evaluate((s) => document.querySelector(s)?.innerText?.trim() || '', sel);
const fill = (labelOrPlaceholder, value) => page.evaluate(([l, v]) => {
  const fields = [...document.querySelectorAll('input, textarea, select')];
  const el = fields.find((x) => (x.placeholder || '').includes(l))
    || fields.find((x) => x.closest('div')?.innerText.trim().startsWith(l));
  if (!el) return false;
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
    : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  return true;
}, [labelOrPlaceholder, value]);
/**
 * กรอกโครงการ + ชื่อเรื่องในกล่องเพิ่ม/แก้ไขรายงาน
 *
 * ต้องหาช่องกรอก "ในฟอร์ม" เท่านั้น — ช่องค้นหาบนแถบหัวน้ำเงินอยู่ก่อนกล่องในลำดับ
 * เอกสาร การหยิบ input ตัวแรกของหน้าจึงไปพิมพ์ลงช่องค้นหา แล้วรายการก็ถูกกรองหาย
 * ไปเฉย ๆ ขณะที่ชื่อเรื่องยังว่าง (เจอจริงในรอบแรกของชุดนี้)
 */
const formFill = (groupId, title) => page.evaluate(([gid, ttl]) => {
  const form = document.getElementById('mtg-form');
  if (!form) return false;
  const sel = form.querySelector('select');
  if (sel) {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, gid);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const el = [...form.querySelectorAll('input')]
    .find((x) => (x.placeholder || '').includes('ประชุมความก้าวหน้าโครงการ'));
  if (!el) return false;
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, ttl);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, [groupId, title]);

/** เปิดฉบับหนึ่งด้วยลิงก์ตรง ๆ — เร็วและไม่ไปกดการ์ดผิดใบในรายการ 82 แถว */
const open = async (id) => {
  await page.goto(`${APP}/meetings?meeting=${id}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(1200);
  return waitText('พิมพ์ / PDF');
};

// ═══════════════════════════════════════════════════════════════════════════
suite('1. เส้นเวลา — ปุ่มใช้ได้จริง ไม่ใช่ป้าย "เร็ว ๆ นี้"');
// ═══════════════════════════════════════════════════════════════════════════
{
  await as(A);
  const first = await body();
  bad('ไม่มีป้าย “เร็ว ๆ นี้” บนปุ่มเส้นเวลาอีกแล้ว', !first.includes('เร็ว ๆ นี้'), '');
  happy('กดปุ่มเส้นเวลาได้', await click('เส้นเวลา'), '');
  happy('เส้นเวลาโหลดข้อมูลของตัวเองเสร็จ', await waitCount('[data-testid="tl-dot"]', 4), '');
  const t = await body();
  happy('หน้าเส้นเวลาเปิดขึ้นมา พร้อมสองโหมด',
    t.includes('แนวนอน') && t.includes('ปฏิทินทั้งปี'), t.slice(0, 120).replace(/\n/g, ' | '));
  // เส้นเวลาต้องอ่านข้อมูลของตัวเองแบบไม่กรอง ไม่ใช่รายการที่หน้าแม่กรองไว้ —
  // กลุ่มทดสอบทั้งสองกลุ่มจึงต้องมีเลนพร้อมกัน แม้ยังไม่ได้เลือกโครงการใด
  happy('เห็นโครงการทดสอบทั้งสองกลุ่มเป็นเลน',
    t.includes(`${MARK} โครงการเอ`) && t.includes(`${MARK} โครงการบี`), '');
  const lanes = await count('[data-testid="tl-lane"]');
  happy('มีเลนมากกว่าหนึ่งเลน (เลนละโครงการ)', lanes >= 2, `lanes=${lanes}`);
  const dots = await count('[data-testid="tl-dot"]');
  happy('มีจุดการประชุมบนเลน', dots >= 4, `dots=${dots}`);
  const ticks = await count('[data-testid="tl-tick"]');
  happy('มีขีดเดือนกำกับบนแกนเวลา', ticks >= 2, `ticks=${ticks}`);
  bad('ไม่มี error บนคอนโซลตอนเปิดเส้นเวลา', errors.length === 0, errors.slice(0, 2).join(' / '));
  await shot('01-เส้นเวลาแนวนอน');
}

suite('2. เส้นเวลา — ปิดโครงการทีละอันแล้วจุดหายจริง');
{
  const before = await count('[data-testid="tl-dot"]');
  const off = await page.evaluate((mark) => {
    const b = [...document.querySelectorAll('button')]
      .find((x) => x.innerText.trim() === `${mark} โครงการบี`);
    if (b) { b.click(); return true; } return false;
  }, MARK);
  happy('กดปุ่มโครงการเพื่อปิดได้', off, '');
  await settle(1200);
  const after = await count('[data-testid="tl-dot"]');
  happy('ปิดโครงการแล้วจุดของโครงการนั้นหายไป', after < before, `${before} → ${after}`);
  const gone = !(await page.evaluate((mark) => [...document.querySelectorAll('[data-testid="tl-lane"]')]
    .some((l) => l.innerText.includes(`${mark} โครงการบี`)), MARK));
  happy('เลนของโครงการที่ปิดไว้หายไปด้วย', gone, '');
  // เปิดกลับ — ข้อถัดไปต้องเห็นวันที่มีสองฉบับในปฏิทิน
  await page.evaluate((mark) => {
    const b = [...document.querySelectorAll('button')]
      .find((x) => x.innerText.trim() === `${mark} โครงการบี`);
    if (b) b.click();
  }, MARK);
  await settle(1200);
  const back = await count('[data-testid="tl-dot"]');
  happy('เปิดกลับแล้วจุดกลับมาครบ', back === before, `${after} → ${back} (เดิม ${before})`);
}

suite('3. เส้นเวลา — ปฏิทินทั้งปี และปุ่มปีเป็น พ.ศ.');
{
  happy('สลับไปโหมดปฏิทินได้', await click('ปฏิทินทั้งปี'), '');
  await waitCount('[data-testid="tl-month"]', 12);
  const months = await count('[data-testid="tl-month"]');
  happy('ปฏิทินแสดงครบสิบสองเดือน', months === 12, `months=${months}`);
  const t = await body();
  happy('ปุ่มปีแสดงเป็นพุทธศักราช', t.includes(String(Y + 543)), `ควรเห็น ${Y + 543}`);
  const days = await count('[data-testid="tl-day"]');
  happy('มีวันที่ถูกทำเครื่องหมายว่ามีประชุม', days >= 3, `days=${days}`);
  await shot('02-เส้นเวลาปฏิทิน');

  // กดปีถัดไป — ปีที่ไม่มีบันทึกต้องขึ้นข้อความว่างแบบเดียวกับที่โมดูลใช้อยู่
  happy('กดปีถัดไปได้', await clickLabel('ปีถัดไป'), '');
  await settle(1500);
  const t2 = await body();
  happy('ปีถัดไปแสดงเป็น พ.ศ. ที่เพิ่มขึ้นหนึ่ง', t2.includes(String(Y + 544)), '');
  happy('ปีที่ไม่มีบันทึกขึ้นข้อความว่าง ไม่ใช่ปฏิทินเปล่า',
    t2.includes('ไม่มีการประชุมในปี'), t2.slice(0, 120).replace(/\n/g, ' | '));
  await clickLabel('ปีก่อนหน้า');
  await settle(1500);
  happy('กดกลับมาปีเดิมแล้วปฏิทินกลับมา', (await count('[data-testid="tl-month"]')) === 12, '');
}

suite('4. เส้นเวลา — กดจุด/วันแล้วเปิดฉบับนั้นจริง');
{
  // วันที่มีสองฉบับ (โครงการเอกับบี วันเดียวกัน) ต้องให้เลือก ไม่ใช่เดาเอาฉบับแรก
  // ต้องเลือกวันของข้อมูลทดสอบเท่านั้น — ฐานข้อมูลมีบันทึกจริง 82 ฉบับ และวันที่มี
  // หลายฉบับของลูกค้าก็มีอยู่ กดวันของเขาคือการไปเปิดเอกสารของเขาแล้วตรวจผิดเรื่อง
  const picked = await page.evaluate((mark) => {
    const cells = [...document.querySelectorAll('[data-testid="tl-day"]')]
      .filter((c) => {
        const ttl = c.getAttribute('title') || '';
        return ttl.includes(mark) && ttl.includes(',');
      });
    if (!cells.length) return false;
    cells[0].click(); return true;
  }, MARK);
  happy('วันที่มีหลายฉบับกดแล้วมีกล่องให้เลือก', picked, '');
  await settle(1200);
  const box = await body();
  happy('กล่องเลือกวันบอกวันที่และรายชื่อฉบับของวันนั้น',
    box.includes('การประชุมวันที่') && box.includes(`${MARK} ประชุมความก้าวหน้า ครั้งที่ 1`),
    box.slice(0, 160).replace(/\n/g, ' | '));
  happy('เลือกฉบับในกล่องแล้วเปิดเอกสารนั้น', await click(`${MARK} ประชุมโครงการบี วันเดียวกัน`), '');
  await settle(2000);
  const doc = await body();
  happy('เอกสารที่เปิดคือฉบับที่กดเลือก',
    doc.includes(`${MARK} ประชุมโครงการบี วันเดียวกัน`) && doc.includes('พิมพ์ / PDF'),
    doc.slice(0, 140).replace(/\n/g, ' | '));
  happy('ออกจากเส้นเวลาแล้วรายการกลับมา', doc.includes('ทั้งหมด') && doc.includes('สัปดาห์นี้'), '');
  await shot('03-กดจุดแล้วเปิดเอกสาร');

  // โหมดแนวนอน: กดจุดบนเลนแล้วต้องเปิดฉบับนั้นเช่นกัน
  await click('เส้นเวลา');
  await waitCount('[data-testid="tl-dot"]', 4);
  const opened = await page.evaluate((mark) => {
    const d = [...document.querySelectorAll('[data-testid="tl-dot"]')]
      .find((x) => (x.getAttribute('title') || '').includes(mark));
    if (!d) return '';
    const title = d.getAttribute('title') || '';
    d.click(); return title;
  }, MARK);
  happy('จุดบนเลนมีคำอธิบายเป็นชื่อเรื่อง + วันที่', opened.includes(MARK), opened.slice(0, 80));
  await settle(2000);
  happy('กดจุดบนเลนแล้วเปิดฉบับนั้น',
    (await body()).includes(opened.split(' — ')[0].trim()), '');
}

// ═══════════════════════════════════════════════════════════════════════════
suite('5. หน้ากระดาษ A4 — เรนเดอร์ในกรอบ A4 จริงและแบ่งหน้าเอง');
// ═══════════════════════════════════════════════════════════════════════════
{
  happy('เปิดฉบับเนื้อหายาวได้', await open(mLong), '');
  happy('กดพิมพ์ / PDF แล้วได้ตัวอย่างหน้ากระดาษ', await clickInDoc('พิมพ์ / PDF'), '');
  await settle(3000);
  const sheets = await count('[data-testid="mtg-sheet"]');
  happy('เนื้อหายาวถูกแบ่งเป็นหลายหน้า', sheets >= 2, `sheets=${sheets}`);
  const geo = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="mtg-sheet"]');
    if (!s) return null;
    // ความกว้าง/สูงที่ประกาศไว้ ไม่ใช่ที่วัดได้หลังย่อ — การย่อเป็นเรื่องของจอ
    return { w: Math.round(parseFloat(s.style.width)), h: Math.round(parseFloat(s.style.height)) };
  });
  // A4 ที่ 96 จุดต่อนิ้ว = 794 × 1123 พิกเซล ซึ่งเป็นมาตราที่เบราว์เซอร์ใช้พิมพ์
  happy('กรอบหน้ามีสัดส่วน A4 จริง (794×1123 พิกเซล)',
    geo && Math.abs(geo.w - 794) <= 2 && Math.abs(geo.h - 1123) <= 2, JSON.stringify(geo));
  const ratio = geo ? geo.h / geo.w : 0;
  happy('อัตราส่วนด้าน = √2 ของกระดาษ A4', Math.abs(ratio - 1.4142) < 0.01, ratio.toFixed(4));

  const t = await body();
  happy('มีหัวจดหมายบริษัทบนกระดาษ', t.includes('บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด'), '');
  happy('มีบรรทัดวันที่ไทยใต้หัวจดหมาย', /วันที่ \d{1,2} \S+ 25\d\d/.test(t), '');
  happy('ทุกหน้ามีเลขหน้า', (await count('[data-testid="mtg-sheet"]')) === sheets && t.includes('หน้า'), '');
  happy('แถบบอกขอบกระดาษที่ใช้จริง', t.includes('ขอบกระดาษ A4'), '');
  await shot('04-ตัวอย่างหน้ากระดาษ');

  // เนื้อหาต้องไม่ถูกตัดกลางบรรทัด: กล่องที่ตัดหน้าสูงเท่าพื้นที่พิมพ์เป๊ะ ๆ
  // (250 มม. = 945 พิกเซล) และสไลด์ของแต่ละหน้าเลื่อนขึ้นไม่เท่ากับความสูงเต็ม
  // หน้าเสมอ — ถ้าเท่ากันทุกหน้าแปลว่าไม่ได้ถอยมาที่ขอบบรรทัดจริงเลย
  const win = await page.evaluate(() => {
    const s = [...document.querySelectorAll('[data-testid="mtg-sheet"]')];
    const h = Math.round(parseFloat(s[0].querySelector('div.overflow-hidden').style.height));
    const offs = s.map((x) => {
      const m = (x.querySelector('.mtg-paper')?.style.transform || '').match(/-?[\d.]+/);
      return m ? Math.abs(parseFloat(m[0])) : 0;
    });
    return { h, offs };
  });
  happy('พื้นที่พิมพ์สูง 945 พิกเซล (250 มม.)', Math.abs(win.h - 945) <= 2, String(win.h));
  const steps = win.offs.slice(1).map((v, i) => v - win.offs[i]);
  happy('ทุกหน้าเลื่อนไปข้างหน้าจริง ไม่ซ้ำที่เดิม', steps.every((s) => s > 50), JSON.stringify(steps));
  happy('จุดตัดหน้าอย่างน้อยหนึ่งจุดถอยมาที่ขอบบรรทัดจริง (ไม่ใช่ตัดตรงขอบพอดี)',
    steps.some((s) => s < win.h), `ขอบพิมพ์=${win.h} · ก้าว=${JSON.stringify(steps)}`);
}

suite('6. สิ่งที่ออกจากเครื่องพิมพ์ = หน้าที่เห็นในตัวอย่าง');
{
  const previewPages = await count('[data-testid="mtg-sheet"]');
  const printed = await page.evaluate(() => {
    const dlg = document.querySelector('[aria-label="ตัวอย่างก่อนพิมพ์"]');
    const b = dlg && [...dlg.querySelectorAll('button')].find((x) => x.innerText.includes('พิมพ์ / PDF'));
    if (b) { b.click(); return true; } return false;
  });
  happy('กดปุ่มพิมพ์ในตัวอย่างได้', printed, '');

  // รอให้กรอบพิมพ์ถูกสร้างและวาดเสร็จ (มันรอฟอนต์ก่อนสั่งพิมพ์)
  let pr = null;
  for (let i = 0; i < 40; i += 1) {
    pr = await page.evaluate(() => {
      const f = document.getElementById('mtg-print-frame');
      const d = f && f.contentDocument;
      if (!d || !d.body) return null;
      const sheets = [...d.querySelectorAll('.sheet')];
      if (!sheets.length) return null;
      const css = [...d.querySelectorAll('style')].map((x) => x.textContent).join('');
      return {
        calls: f.contentWindow.__printCalls || 0,
        sheets: sheets.length,
        qr: sheets.filter((x) => x.querySelector('img.qr')).length,
        pageNo: sheets.filter((x) => (x.querySelector('.pn')?.textContent || '').trim()).length,
        title: d.title,
        a4: css.includes('@page{size:A4;margin:0;}'),
        html: d.documentElement.outerHTML,
      };
    });
    if (pr && pr.calls > 0) break;
    await settle(500);
  }
  happy('เอกสารสำหรับพิมพ์ถูกสร้างและสั่งพิมพ์จริง', Boolean(pr) && pr.calls > 0, JSON.stringify(pr && { calls: pr.calls, sheets: pr.sheets }));
  happy('จำนวนหน้าที่ส่งเข้าเครื่องพิมพ์เท่ากับจำนวนหน้าในตัวอย่าง',
    pr?.sheets === previewPages, `พิมพ์=${pr?.sheets} ตัวอย่าง=${previewPages}`);
  happy('เอกสารพิมพ์ประกาศขนาดกระดาษ A4 ไว้ชัดเจน', pr?.a4 === true, '');
  happy('ทุกหน้าที่พิมพ์มี QR', pr?.qr === pr?.sheets, `qr=${pr?.qr}/${pr?.sheets}`);
  happy('ทุกหน้าที่พิมพ์มีเลขหน้า', pr?.pageNo === pr?.sheets, `pn=${pr?.pageNo}/${pr?.sheets}`);
  // <title> คือชื่อไฟล์ที่เบราว์เซอร์เสนอตอน "บันทึกเป็น PDF"
  happy('ชื่อเอกสารพิมพ์ = ชื่อไฟล์ PDF ที่ต้องการ',
    pr?.title === `${MARK} ประชุมความก้าวหน้า ครั้งที่ 1 12.3.${(Y + 543) % 100}`, pr?.title);

  // เรนเดอร์เอกสารพิมพ์เป็น PDF จริงด้วยเครื่องพิมพ์ของเบราว์เซอร์ แล้วนับหน้าใน
  // ไฟล์ที่ได้ — ข้อนี้คือข้อที่จับ "หน้าว่างแทรกสลับทุกหน้า" ได้ ซึ่งเป็นอาการ
  // ที่เกิดเมื่อกล่องหน้าสูงเกินกล่องกระดาษไปเสี้ยวพิกเซล
  const p2 = await browser.newPage();
  await p2.setContent(pr.html, { waitUntil: 'networkidle0' });
  const pdfPath = `${SHOTS}/พิมพ์จริง.pdf`;
  await p2.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  await p2.close();
  const raw = fs.readFileSync(pdfPath, 'latin1');
  const pdfPages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
  happy('ไฟล์ PDF ที่ได้มีจำนวนหน้าเท่ากับตัวอย่าง ไม่มีหน้าว่างแทรก',
    pdfPages === previewPages, `pdf=${pdfPages} ตัวอย่าง=${previewPages}`);
}

suite('6b. หน้ากระดาษ A4 — QR กันปลอมแปลงและชื่อไฟล์ PDF');
{
  const qr = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('[data-testid="mtg-sheet"] img')];
    return imgs.map((i) => ({
      w: Math.round(i.getBoundingClientRect().width / (parseFloat(getComputedStyle(i.closest('[data-testid="mtg-sheet"]')).transform.split(',')[0].replace('matrix(', '')) || 1)),
      svg: (i.getAttribute('src') || '').startsWith('data:image/svg+xml'),
    }));
  });
  happy('ทุกหน้ามี QR', qr.length === (await count('[data-testid="mtg-sheet"]')), `qr=${qr.length}`);
  happy('QR เป็นภาพเวกเตอร์ (คมพอให้สแกนจากกระดาษ)', qr.every((q) => q.svg), '');
  const t = await body();
  happy('บอกว่ามี QR ตรวจสอบความแท้ทุกหน้า', t.includes('มี QR ตรวจสอบความแท้ทุกหน้า'), '');

  const name = await textOf('[data-testid="mtg-pdf-name"]');
  // ชื่อไฟล์ที่ระบบจริงของลูกค้าใช้: "<ชื่อเรื่อง> d.m.yy" ปี พ.ศ. สองหลัก ไม่เติมศูนย์
  const wantSuffix = `12.3.${(Y + 543) % 100}`;
  happy('ชื่อไฟล์ PDF = <ชื่อเรื่อง> d.m.yy (พ.ศ. สองหลัก)',
    name === `${MARK} ประชุมความก้าวหน้า ครั้งที่ 1 ${wantSuffix}.pdf`, name);

  // QR ต้องพาไปหน้าตรวจสอบสาธารณะ ไม่ใช่ลิงก์ที่ต้องล็อกอิน
  const link = await page.evaluate(async () => {
    const r = await fetch(`/api/meetings/${new URLSearchParams(location.search).get('meeting')}/print`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('hr_access_token')}` },
    });
    return (await r.json()).data?.verifyUrl || '';
  });
  happy('ลิงก์ตรวจสอบเป็นเส้นทางสาธารณะของโมดูลประชุม (/mtg/<กุญแจ>)',
    /\/mtg\/[0-9a-f-]{36}$/.test(link), link);
  bad('ลิงก์ตรวจสอบไม่ใช่ id ของแถว (id ไม่ใช่ความลับ)',
    !link.includes(mLong), link);
  await shot('05-QR-บนกระดาษ');
  await page.keyboard.press('Escape');
  await settle(1000);
}

suite('7. หน้าตรวจสอบสาธารณะ — ไม่ต้องล็อกอิน และไม่หลุดเนื้อหา');
{
  const token = (await query('select verify_token from mtg_meetings where id = $1', [mLong])).rows[0].verify_token;
  // ล้างโทเค็นออกจากเบราว์เซอร์ก่อน — ต้องอ่านได้โดยไม่มีบัญชีใด ๆ เลย
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${APP}/mtg/${token}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(2200);
  const t = await body();
  happy('คนที่ไม่ได้ล็อกอินเปิดหน้าตรวจสอบได้', t.includes('เอกสารนี้ออกจากระบบจริง'),
    t.slice(0, 160).replace(/\n/g, ' | '));
  happy('หน้าตรวจสอบบอกชื่อเรื่อง โครงการ และวันประชุม',
    t.includes(`${MARK} ประชุมความก้าวหน้า ครั้งที่ 1`) && t.includes(`${MARK} โครงการเอ`)
      && t.includes('วันประชุม'), '');
  bad('หน้าตรวจสอบไม่แสดงเนื้อหาการประชุม', !t.includes('ย่อหน้าที่ 1'), '');
  bad('ไม่ถูกลากไปหน้าล็อกอิน', !page.url().includes('/login'), page.url());
  await shot('06-หน้าตรวจสอบสาธารณะ');

  await page.goto(`${APP}/mtg/00000000-0000-0000-0000-000000000000`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(2000);
  bad('กุญแจที่ไม่มีอยู่ขึ้นว่าตรวจสอบไม่สำเร็จ ไม่ใช่หน้าเปล่า',
    (await body()).includes('ตรวจสอบไม่สำเร็จ'), (await body()).slice(0, 120).replace(/\n/g, ' | '));

  // ฉบับที่ยังไม่เผยแพร่ต้องตอบเหมือนไม่มีอยู่ — บอกว่า "มีแต่ยังไม่เผยแพร่" ก็คือ
  // ยืนยันการมีอยู่ของฉบับร่างให้คนนอกรู้
  const draft = await mk({
    groupId: gA.id, title: `${MARK} ฉบับร่างไม่เผยแพร่`, meetingDate: iso(8, 9),
    content: `<p>${MARK} ร่าง</p>`, visible: false,
  });
  const dTok = (await query('select verify_token from mtg_meetings where id = $1', [draft])).rows[0].verify_token;
  await page.goto(`${APP}/mtg/${dTok}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(2000);
  bad('ฉบับที่ยังไม่เผยแพร่ตรวจสอบไม่ได้ (ตอบเหมือนไม่มีอยู่)',
    (await body()).includes('ตรวจสอบไม่สำเร็จ'), '');
  await call(`/meetings/${draft}`, { method: 'DELETE', user: A });
}

// ═══════════════════════════════════════════════════════════════════════════
suite('8. หัวจดหมายไม่ซ้ำ — ฉบับที่มีหัวของตัวเองต้องไม่ได้หัวสองหัว');
// ═══════════════════════════════════════════════════════════════════════════
{
  await as(A);
  happy('เปิดฉบับที่มีหัวบริษัทในเนื้อหาเองได้', await open(mOwnHead), '');
  await clickInDoc('พิมพ์ / PDF');
  await settle(2500);
  const heads = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="mtg-sheet"] .mtg-paper');
    if (!s) return -1;
    return (s.innerText.match(/บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด/g) || []).length;
  });
  happy('หัวบริษัทปรากฏครั้งเดียว ไม่ใช่สองครั้ง', heads === 1, `พบ ${heads} ครั้ง`);
  await page.keyboard.press('Escape');
  await settle(800);
}

// ═══════════════════════════════════════════════════════════════════════════
suite('9. แผงตั้งค่า — ขนาดตัวอักษรมีผลจริงและจำไว้');
// ═══════════════════════════════════════════════════════════════════════════
{
  // เข้าหน้าใหม่เองก่อน — หมวดก่อนหน้าเพิ่งปิดชั้นคลุมตัวอย่างหน้ากระดาษ และการ
  // พึ่งสภาพที่หมวดอื่นทิ้งไว้คือที่มาของข้อตรวจที่ล้มสลับไปมา
  await as(A);
  happy('เปิดฉบับไว้อ่านก่อน', await open(mShort), '');
  const sizeOf = () => page.evaluate(() => {
    const el = document.querySelector('[data-testid="mtg-content"]');
    return el ? Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10 : 0;
  });
  const base = await sizeOf();
  happy('เนื้อหาเริ่มที่ขนาดปกติ', Math.abs(base - 15) < 0.6, String(base));

  happy('เปิดแผงตั้งค่าจากปุ่มเฟืองได้', await clickLabel('ตั้งค่า'), '');
  await settle(1200);
  const s = await body();
  happy('แผงบอกว่าเข้าสู่ระบบโดยใคร', s.includes('เข้าสู่ระบบโดย') && s.includes(A.email), '');
  happy('มีหัวข้อการแสดงผล พร้อมภาษาและขนาดตัวอักษร',
    s.includes('การแสดงผล') && s.includes('ภาษา') && s.includes('ขนาดตัวอักษร'), '');
  happy('มีสามตัวเลือกขนาด เล็ก/ปกติ/ใหญ่',
    s.includes('เล็ก') && s.includes('ปกติ') && s.includes('ใหญ่'), '');
  happy('มีทางเข้าสิทธิ์โครงการสำหรับผู้ดูแล', s.includes('สิทธิ์โครงการ'), '');
  happy('มีหัวข้อเกี่ยวกับ พร้อมเวอร์ชันและผู้ดูแล',
    s.includes('เกี่ยวกับ') && s.includes('เวอร์ชัน') && s.includes('ผู้ดูแล'), '');
  // โมดูลนี้เป็นธีมสว่างล้วนเหมือน SOP ตัวสลับสว่าง/มืดผูกกับ E-Memo ซึ่งห้ามแตะ
  bad('ไม่มีตัวเลือกโหมดสีในแผงนี้ (โมดูลเป็นธีมสว่างล้วน)', !s.includes('โหมดสี'), '');
  await shot('07-แผงตั้งค่า');

  // เปลี่ยนเป็น "ใหญ่" แล้วข้อความในเอกสารต้องใหญ่ขึ้นจริง
  const big = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="mtg-size"]');
    const b = box && [...box.querySelectorAll('button')].find((x) => x.innerText.trim() === 'ใหญ่');
    if (b) { b.click(); return true; } return false;
  });
  happy('กดขนาด “ใหญ่” ได้', big, '');
  await settle(900);
  const large = await sizeOf();
  happy('ข้อความในเอกสารใหญ่ขึ้นจริง', large > base + 1, `${base} → ${large}`);

  const small = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="mtg-size"]');
    const b = box && [...box.querySelectorAll('button')].find((x) => x.innerText.trim() === 'เล็ก');
    if (b) { b.click(); return true; } return false;
  });
  happy('กดขนาด “เล็ก” ได้', small, '');
  await settle(900);
  const tiny = await sizeOf();
  happy('ข้อความในเอกสารเล็กลงจริง', tiny < base - 0.5, `${base} → ${tiny}`);
  await click('ปิด');
  await settle(800);

  // รีโหลดแล้วค่าต้องยังอยู่ — ของเขาเก็บต่อเครื่องใน localStorage เราก็เก็บที่นั่น
  await page.reload({ waitUntil: 'networkidle2' }).catch(() => {});
  await settle(2500);
  await waitText('พิมพ์ / PDF');
  const afterReload = await sizeOf();
  happy('รีโหลดแล้วขนาดที่เลือกไว้ยังอยู่', Math.abs(afterReload - tiny) < 0.6,
    `${tiny} → ${afterReload}`);
  // คืนค่าปกติ ไม่ทิ้งเครื่องไว้ในสภาพที่ข้อตรวจอื่นต้องเดา
  await page.evaluate(() => localStorage.setItem('mtg_reading_size', 'normal'));
}

// ═══════════════════════════════════════════════════════════════════════════
suite('10. สร้าง · แก้ไข · ย้ายโครงการ');
// ═══════════════════════════════════════════════════════════════════════════
const NEW_TITLE = `${MARK} ประชุมที่สร้างจากหน้าจอ`;
{
  await as(A);
  happy('กดเพิ่มการประชุมแล้วฟอร์มเปิด', await click('เพิ่มการประชุม'), '');
  await settle(1500);
  happy('กรอกโครงการและชื่อเรื่องในฟอร์มได้', await formFill(gA.id, NEW_TITLE), '');
  await fill('21/05/2569', '5/5/2569');
  await page.evaluate((mark) => {
    const ed = document.querySelector('[contenteditable="true"]');
    if (ed) { ed.innerHTML = `<p>${mark} มติ: อนุมัติสั่งเหล็กเพิ่มสี่สิบตัน</p>`; ed.dispatchEvent(new Event('input', { bubbles: true })); }
  }, MARK);
  await settle(700);
  happy('บันทึกฟอร์มได้', await click('บันทึก'), '');
  await settle(3000);
  const t = await body();
  happy('ฉบับใหม่เปิดขึ้นมาทันทีหลังบันทึก', t.includes(NEW_TITLE), t.slice(0, 140).replace(/\n/g, ' | '));
  // ช่องวันที่เป็นข้อความอิสระ เซิร์ฟเวอร์แปลงให้ — "5/5/2569" ต้องอ่านเป็น 5 พ.ค.
  happy('วันที่ที่พิมพ์แบบไทยถูกอ่านออกและแสดงเป็น พ.ศ.', t.includes('5 พ.ค. 2569'), '');
  const row = (await query('select group_id, meeting_date from mtg_meetings where title = $1', [NEW_TITLE])).rows[0];
  happy('บันทึกลงโครงการที่เลือกไว้จริง', row?.group_id === gA.id, String(row?.group_id));

  // แก้ไข: เปลี่ยนชื่อเรื่องและย้ายโครงการในการบันทึกครั้งเดียว (ของเขาย้ายได้ตอนแก้)
  happy('กดแก้ไขแล้วฟอร์มเปิดพร้อมค่าเดิม', await clickInDoc('แก้ไข'), '');
  await settle(1500);
  happy('เปลี่ยนโครงการและชื่อเรื่องในฟอร์มแก้ไขได้',
    await formFill(gB.id, `${NEW_TITLE} (แก้ไขแล้ว)`), '');
  await settle(600);
  happy('บันทึกการแก้ไขได้', await click('บันทึก'), '');
  await settle(3000);
  const t2 = await body();
  happy('ชื่อเรื่องที่แก้แล้วขึ้นบนเอกสาร', t2.includes(`${NEW_TITLE} (แก้ไขแล้ว)`), '');
  happy('เอกสารย้ายไปอยู่โครงการใหม่', t2.includes(`${MARK} โครงการบี`), '');
  const moved = (await query('select group_id from mtg_meetings where title like $1', [`${NEW_TITLE}%`])).rows[0];
  happy('ฐานข้อมูลบันทึกการย้ายจริง', moved?.group_id === gB.id, String(moved?.group_id));
  happy('การย้ายมีร่องรอยในประวัติการทำงาน', await clickInDoc('ประวัติการทำงาน'), '');
  happy('ประวัติบอกว่าย้ายโครงการ และปลายทางชื่ออะไร',
    await waitText('ย้ายโครงการ') && (await body()).includes(`${MARK} โครงการบี`),
    (await body()).slice(0, 200).replace(/\n/g, ' | '));
  await page.keyboard.press('Escape');
  await settle(800);
  await shot('08-สร้างแก้ไขย้าย');
}

// ═══════════════════════════════════════════════════════════════════════════
suite('11. ปักหมุด · ซ่อน/เผยแพร่ · จัดเก็บเข้าหลายโครงการ');
// ═══════════════════════════════════════════════════════════════════════════
{
  happy('เปิดฉบับที่จะทดสอบได้', await open(mShort), '');
  happy('กดปักหมุดในเอกสารได้', await clickInDoc('ปักหมุด'), '');
  await settle(2000);
  happy('เอกสารขึ้นป้ายปักหมุด', (await body()).includes('เอาหมุดออก'), '');
  happy('ฐานข้อมูลปักหมุดจริง',
    (await query('select pinned from mtg_meetings where id = $1', [mShort])).rows[0].pinned === true, '');

  // เผยแพร่/เก็บเป็นร่าง — ของเขามีคำสั่งนี้แยก (setVisibility) ของเราเคยมีแต่ช่องติ๊ก
  // ในฟอร์มแก้ไข ซึ่งบังคับให้ต้องเปิดฟอร์มทั้งฉบับเพื่อซ่อนเอกสารหนึ่งฉบับ
  happy('มีปุ่มเก็บเป็นฉบับร่างในแถบเครื่องมือเอกสาร', await clickInDoc('เก็บเป็นฉบับร่าง'), '');
  await settle(2200);
  happy('เอกสารขึ้นว่ายังไม่เผยแพร่', (await body()).includes('ยังไม่เผยแพร่'), '');
  happy('ฐานข้อมูลซ่อนเอกสารจริง',
    (await query('select visible from mtg_meetings where id = $1', [mShort])).rows[0].visible === false, '');
  happy('กดเผยแพร่กลับได้', await clickInDoc('เผยแพร่'), '');
  await settle(2200);
  happy('ฐานข้อมูลเผยแพร่กลับจริง',
    (await query('select visible from mtg_meetings where id = $1', [mShort])).rows[0].visible === true, '');
  happy('ทั้งการซ่อนและการเผยแพร่มีร่องรอย', await clickInDoc('ประวัติการทำงาน'), '');
  await settle(1500);
  const hist = await body();
  happy('ประวัติมีทั้ง “เก็บเป็นฉบับร่าง” และ “เผยแพร่”',
    hist.includes('เก็บเป็นฉบับร่าง') && hist.includes('เผยแพร่'), '');
  await page.keyboard.press('Escape');
  await settle(800);

  // จัดเก็บเข้าหลายโครงการ — เป็นการ "เพิ่มที่ให้หาเจอ" ไม่ใช่การย้าย
  happy('ฉบับที่พิมพ์เองก็มีทางเข้าจัดเก็บเข้าโครงการ', await clickInDoc('+ จัดเก็บเข้าโครงการ'), '');
  await settle(1200);
  const filed = await page.evaluate((gid) => {
    const doc = document.querySelector('article');
    const sel = doc && [...doc.querySelectorAll('select')].pop();
    if (!sel) return false;
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, gid);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, gB.id);
  happy('เลือกโครงการปลายทางได้', filed, '');
  await settle(2500);
  const tags = await query(
    'select count(*)::int n from mtg_meeting_tags where meeting_id = $1', [mShort]);
  happy('ฉบับนี้ถูกจัดเก็บเข้าโครงการที่สองแล้ว', tags.rows[0].n === 1, `n=${tags.rows[0].n}`);
  const homeStill = (await query('select group_id from mtg_meetings where id = $1', [mShort])).rows[0];
  happy('การจัดเก็บไม่ได้ย้ายเอกสารออกจากโครงการเดิม', homeStill.group_id === gA.id, '');
  happy('หน้าจอบอกว่าจัดเก็บเข้าโครงการไหนไว้',
    (await body()).includes(`${MARK} โครงการบี`), '');
  await shot('09-ปักหมุดเผยแพร่จัดเก็บ');
}

// ═══════════════════════════════════════════════════════════════════════════
suite('12. ไฟล์แนบ · ความเห็น');
// ═══════════════════════════════════════════════════════════════════════════
{
  happy('เปิดเอกสารที่จะแนบไฟล์', await open(mShort), '');
  const file = `${ROOT}/${MARK}-attach.txt`;
  fs.writeFileSync(file, `${MARK} ไฟล์แนบของชุดทดสอบ`);
  const input = await page.$('article input[type="file"]');
  happy('หน้าอ่านมีช่องแนบไฟล์ ไม่ต้องเข้าโหมดแก้ไขก่อน', Boolean(input), '');
  if (input) await input.uploadFile(file);
  // ไฟล์เดินทางไปที่เก็บจริง (Supabase Storage) ไม่ใช่ลงดิสก์ข้าง ๆ — จากเครื่อง
  // พัฒนาใช้เวลาได้หลายวินาที รอให้ชื่อไฟล์โผล่ ไม่ใช่รอเวลาที่เดาไว้
  const shown = await waitText(`${MARK}-attach.txt`, 30000);
  happy('ไฟล์แนบขึ้นบนเอกสาร', shown, (await body()).slice(0, 160).replace(/\n/g, ' | '));
  const atts = await query(
    `select count(*)::int n from mtg_attachments where meeting_id = $1 and kind = 'file'`, [mShort]);
  happy('ไฟล์ถูกเก็บจริง', atts.rows[0].n === 1, `n=${atts.rows[0].n}`);

  const commented = await page.evaluate((mark) => {
    const el = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('เขียนความเห็น'));
    if (!el) return false;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, `${mark} ขอให้ทบทวนงบอีกครั้ง`);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, MARK);
  happy('พิมพ์ความเห็นได้', commented, '');
  happy('ส่งความเห็นได้', await clickInDoc('ส่ง'), '');
  await settle(2500);
  happy('ความเห็นขึ้นบนเอกสาร', (await body()).includes(`${MARK} ขอให้ทบทวนงบอีกครั้ง`), '');
  happy('ความเห็นอยู่ในสายเวลาประวัติการทำงานด้วย', await clickInDoc('ประวัติการทำงาน'), '');
  await settle(1500);
  happy('สายเวลารวมความเห็นเข้ากับการแก้ไขในที่เดียว',
    (await body()).includes(`${MARK} ขอให้ทบทวนงบอีกครั้ง`), '');
  await page.keyboard.press('Escape');
  await settle(800);

  // ลบไฟล์แนบ
  const dropped = await page.evaluate(() => {
    const b = [...document.querySelectorAll('[title="ลบไฟล์แนบ"]')][0];
    if (b) { b.click(); return true; } return false;
  });
  happy('กดลบไฟล์แนบได้', dropped, '');
  await settle(1200);
  happy('ยืนยันการลบไฟล์แนบ', await clickInDialog(page, 'ลบ'), '');
  let left = null;
  for (let i = 0; i < 20; i += 1) {
    left = await query('select count(*)::int n from mtg_attachments where meeting_id = $1', [mShort]);
    if (left.rows[0].n === 0) break;
    await settle(700);
  }
  happy('ไฟล์แนบถูกลบจริง', left.rows[0].n === 0, `n=${left.rows[0].n}`);
  fs.rmSync(file, { force: true });
  await shot('10-แนบไฟล์และความเห็น');
}

// ═══════════════════════════════════════════════════════════════════════════
suite('13. ประวัติการทำงาน — ดูเวอร์ชันเก่าและกู้คืน');
// ═══════════════════════════════════════════════════════════════════════════
{
  const VER_TITLE = `${MARK} ฉบับที่จะถูกแก้หลายรอบ`;
  const vid = await mk({
    groupId: gA.id, title: VER_TITLE, meetingDate: iso(4, 4),
    content: `<p>${MARK} ข้อความรุ่นที่หนึ่ง</p>`, visible: true,
  });
  await call(`/meetings/${vid}`, { method: 'PATCH', user: A, body: { content: `<p>${MARK} ข้อความรุ่นที่สอง</p>` } });
  await call(`/meetings/${vid}`, { method: 'PATCH', user: A, body: { content: `<p>${MARK} ข้อความรุ่นที่สาม</p>` } });

  happy('เปิดฉบับที่ถูกแก้มาหลายรอบได้', await open(vid), '');
  happy('เนื้อหาปัจจุบันคือรุ่นที่สาม', (await body()).includes('ข้อความรุ่นที่สาม'), '');
  happy('เปิดลิ้นชักประวัติการทำงานได้', await clickInDoc('ประวัติการทำงาน'), '');
  await settle(1500);
  const h = await body();
  happy('ประวัติมีการแก้เนื้อหาสองครั้ง',
    (h.match(/แก้ไขเนื้อหา/g) || []).length >= 2, String((h.match(/แก้ไขเนื้อหา/g) || []).length));
  happy('มีปุ่มดูฉบับแรก', h.includes('ดูฉบับแรก'), '');
  happy('มีปุ่มกู้คืนคู่กับปุ่มดู', h.includes('กู้คืน'), '');

  happy('กดดูฉบับแรกได้', await click('ดูฉบับแรก'), '');
  await settle(1800);
  const prev = await body();
  happy('กล่องดูเวอร์ชันเก่าแสดงข้อความที่เคยเขียนไว้', prev.includes('ข้อความรุ่นที่หนึ่ง'), '');
  happy('ในกล่องนั้นมีปุ่มกู้คืนเนื้อหานี้ด้วย', prev.includes('กู้คืนเนื้อหานี้'), '');
  await shot('11-ดูเวอร์ชันเก่า');

  happy('กดกู้คืนเนื้อหานี้ได้', await click('กู้คืนเนื้อหานี้'), '');
  await settle(1500);
  happy('ถามยืนยันก่อนกู้คืน และบอกว่ากู้กลับได้',
    (await body()).includes('เนื้อหาปัจจุบันจะถูกเก็บเป็นเวอร์ชันไว้ก่อน'), '');
  happy('ยืนยันการกู้คืน', await clickInDialog(page, 'กู้คืน'), '');
  await settle(3000);
  const after = await body();
  happy('เนื้อหาปัจจุบันกลายเป็นข้อความของเวอร์ชันที่กู้มา', after.includes('ข้อความรุ่นที่หนึ่ง'), '');
  bad('ข้อความรุ่นที่สามไม่หายไปเฉย ๆ — ถูกเก็บเป็นเวอร์ชันแทน',
    (await query('select count(*)::int n from mtg_versions where meeting_id = $1', [vid])).rows[0].n === 3,
    String((await query('select count(*)::int n from mtg_versions where meeting_id = $1', [vid])).rows[0].n));
  happy('ชื่อเรื่องไม่ถูกเปลี่ยนตามการกู้คืน', after.includes(VER_TITLE), '');
  happy('การกู้คืนมีร่องรอยบอกว่ากู้มาจากครั้งไหน', await clickInDoc('ประวัติการทำงาน'), '');
  await settle(1500);
  happy('ประวัติเขียนว่ากู้คืนเนื้อหา จากฉบับก่อนแก้ครั้งที่ N',
    (await body()).includes('กู้คืนเนื้อหา') && (await body()).includes('จากฉบับก่อนแก้ครั้งที่'), '');
  await page.keyboard.press('Escape');
  await settle(800);

  // กู้คืนเวอร์ชันที่เนื้อหาเหมือนของปัจจุบันอยู่แล้ว ต้องไม่งอกเวอร์ชันเปล่าเพิ่ม
  // หลังกู้คืน v1 แล้ว เนื้อหาปัจจุบัน = ข้อความของ v1 ฉะนั้น "เวอร์ชันที่เหมือน
  // ปัจจุบัน" คือ seq 1 ไม่ใช่ seq 3 (seq 3 เป็นภาพของรุ่นที่สามที่ถูกเก็บไว้ตอนกู้)
  const dup = await call(`/meetings/${vid}/versions/1/restore`, { method: 'POST', user: A });
  bad('กู้คืนเวอร์ชันที่เหมือนเนื้อหาปัจจุบัน → 409 ไม่ใช่เวอร์ชันเปล่าเพิ่ม', dup.status === 409, String(dup.status));
  bad('กู้คืนเวอร์ชันที่ไม่มีอยู่ → 404',
    (await call(`/meetings/${vid}/versions/99/restore`, { method: 'POST', user: A })).status === 404, '');
  bad('คนที่แก้ไขไม่ได้ กู้คืนไม่ได้',
    (await call(`/meetings/${vid}/versions/2/restore`, { method: 'POST', user: C })).status === 403, '');
}

// ═══════════════════════════════════════════════════════════════════════════
suite('14. ค้นหา (รวมค้นในเนื้อหาเต็ม) และตัวกรองช่วงเวลา');
// ═══════════════════════════════════════════════════════════════════════════
{
  await as(A);
  const search = async (q) => {
    await page.evaluate((v) => {
      const el = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('ค้นหาการประชุม'));
      if (!el) return;
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, q);
    await settle(2500);
    return body();
  };
  const byTitle = await search(`${MARK} ประชุมติดตามผล`);
  happy('ค้นด้วยชื่อเรื่องเจอ', byTitle.includes(`${MARK} ประชุมติดตามผล ครั้งที่ 2`), '');
  // ค้นในเนื้อหาเต็ม: ข้อความนี้อยู่ในเนื้อความเท่านั้น ไม่มีในชื่อเรื่องและไม่อยู่
  // ใน 200 ตัวแรกที่เป็นสรุปย่อ — ถ้าไม่เจอแปลว่าค้นแค่ชื่อเรื่องกับสรุปย่อ
  const deep = await search('เสนอผู้จัดการโครงการภายในวันศุกร์');
  happy('ค้นเจอข้อความที่อยู่ลึกในเนื้อหา ไม่ใช่แค่ชื่อเรื่อง/สรุปย่อ',
    deep.includes(`${MARK} ประชุมความก้าวหน้า ครั้งที่ 1`), deep.slice(0, 140).replace(/\n/g, ' | '));
  const none = await search(`${MARK} คำที่ไม่มีอยู่จริงเลยแน่นอน`);
  happy('ไม่เจอก็บอกว่าไม่พบ ไม่ใช่รายการเปล่า', none.includes('ไม่พบการประชุมที่ตรงกับคำค้น'), '');
  await search('');
  await settle(1500);
  await shot('12-ค้นหา');

  // ตัวกรองช่วงเวลา — แถวที่ไม่มีวันที่ตกนอกทุกช่วงที่ไม่ใช่ "ทั้งหมด"
  const wk = await mk({
    groupId: gA.id, title: `${MARK} ประชุมของสัปดาห์นี้`,
    meetingDate: `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-${String(NOW.getDate()).padStart(2, '0')}`,
    content: `<p>${MARK} วันนี้</p>`, visible: true,
  });
  await as(A);
  happy('กดตัวกรอง “สัปดาห์นี้” ได้', await click('สัปดาห์นี้'), '');
  await settle(2000);
  const week = await body();
  happy('ช่วงสัปดาห์นี้เห็นฉบับของวันนี้', week.includes(`${MARK} ประชุมของสัปดาห์นี้`), '');
  bad('ช่วงสัปดาห์นี้ไม่เห็นฉบับของเดือนอื่น', !week.includes(`${MARK} ประชุมติดตามผล ครั้งที่ 2`), '');
  happy('กดกลับ “ทั้งหมด” แล้วเห็นครบ', await click('ทั้งหมด'), '');
  await settle(2000);
  happy('ทั้งหมดเห็นฉบับของเดือนอื่นกลับมา',
    (await body()).includes(`${MARK} ประชุมติดตามผล ครั้งที่ 2`), '');
  await call(`/meetings/${wk}`, { method: 'DELETE', user: A });
}

// ═══════════════════════════════════════════════════════════════════════════
suite('15. สิทธิ์การเข้าถึง — เปิด/ล็อก · รายชื่อผู้อ่าน · คัดลอกรายชื่อ');
// ═══════════════════════════════════════════════════════════════════════════
{
  await as(A);
  happy('เปิดแผงตั้งค่าได้', await clickLabel('ตั้งค่า'), '');
  await settle(1200);
  happy('เข้าแผงสิทธิ์โครงการจากแผงตั้งค่าได้', await click('สิทธิ์โครงการ'), '');
  await settle(3000);
  const acc = await body();
  happy('แผงสิทธิ์เห็นกลุ่มทดสอบทั้งสองกลุ่ม',
    acc.includes(`${MARK} โครงการเอ`) && acc.includes(`${MARK} โครงการบี`), '');
  happy('แผงอธิบายว่ากลุ่มที่ล็อกจะหายไปจากรายการ ไม่ใช่กดไม่ได้',
    acc.includes('ไม่ปรากฏในรายการ'), '');
  await shot('13-แผงสิทธิ์');

  // ล็อกทั้งสองกลุ่ม แล้วเพิ่มผู้อ่านในกลุ่มเอ
  // กรองแผงให้เหลือแต่กลุ่มทดสอบก่อนทำอะไร — แผงมีกลุ่มจริงของลูกค้า 11 กลุ่ม
  // อยู่ด้วย การไปกดชิปผิดแถวคือการล็อกโครงการจริงของเขา
  await page.evaluate((mark) => {
    const el = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('กรองโครงการ'));
    if (!el) return;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, mark);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, MARK);
  await settle(1200);
  // ตรวจในกล่องเท่านั้น: แถบข้างที่อยู่ข้างหลังกล่องยังมีชื่อโครงการจริงอยู่ครบ
  // และ body().innerText นับข้อความที่อยู่ข้างหลังด้วย
  const panelText = () => page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"]')].map((d) => d.innerText).join('\n'));
  happy('กรองแผงให้เหลือแต่กลุ่มทดสอบได้',
    !(await panelText()).includes('งบการเงินทุกโครงการ')
      && (await panelText()).includes(`${MARK} โครงการเอ`),
    (await panelText()).slice(0, 160).replace(/\n/g, ' | '));

  /** กดชิปสถานะของแถวนั้นเพื่อล็อก — ชิปเขียนว่า "เปิดให้อ่าน" ตอนยังไม่ล็อก */
  const lock = (name) => page.evaluate((n) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'เปิดให้อ่าน'
      && (x.closest('div.rounded-xl')?.innerText || '').includes(n));
    if (b) { b.click(); return true; } return false;
  }, name);
  happy('ล็อกกลุ่มเอได้', await lock(`${MARK} โครงการเอ`), '');
  await settle(2000);
  happy('ล็อกกลุ่มบีได้', await lock(`${MARK} โครงการบี`), '');
  await settle(2000);
  const locked = await query(
    'select visibility from mtg_groups where id = any($1) order by sort_order', [[gA.id, gB.id]]);
  happy('ทั้งสองกลุ่มถูกล็อกในฐานข้อมูล',
    locked.rows.every((r) => r.visibility === 'locked'), JSON.stringify(locked.rows));

  // กลุ่มที่ล็อกแต่ยังไม่มีใครถูกระบุชื่อต้องถูกเตือน
  happy('เตือนกลุ่มที่ล็อกไว้แต่ยังไม่มีรายชื่อผู้อ่าน',
    (await body()).includes('ยังไม่มีใคร') || (await body()).includes('ไม่มีรายชื่อ'),
    (await body()).slice(0, 200).replace(/\n/g, ' | '));

  // เพิ่มผู้อ่านผ่าน API (แผงมีช่องกรอกอยู่แล้วและทดสอบไว้ในชุดเดิม) แล้วตรวจว่า
  // การคัดลอกรายชื่อไปกลุ่มอื่นเป็นการ "เพิ่ม" จริง
  await call(`/meetings/groups/${gA.id}/guests`, { method: 'POST', user: A, body: { emails: [C.email] } });
  await as(A);
  await clickLabel('ตั้งค่า');
  await settle(1200);
  await click('สิทธิ์โครงการ');
  await settle(3000);
  await page.evaluate((mark) => {
    const el = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('กรองโครงการ'));
    if (!el) return;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, mark);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, MARK);
  await settle(1200);
  happy('แผงแสดงรายชื่อผู้อ่านที่ระบุไว้', (await body()).includes(C.email), '');
  happy('มีคำสั่งคัดลอกรายชื่อไปโครงการอื่น', await click('คัดลอกรายชื่อไปโครงการอื่น'), '');
  await settle(1500);
  const copyBox = await body();
  happy('กล่องคัดลอกบอกว่าเป็นการเพิ่ม ไม่ทับของเดิม', copyBox.includes('เพิ่มเข้าไป ไม่ทับของเดิม'), '');
  const ticked = await page.evaluate((mark) => {
    const box = [...document.querySelectorAll('label')].find((l) => l.innerText.includes(`${mark} โครงการบี`));
    const cb = box?.querySelector('input[type="checkbox"]');
    if (cb) { cb.click(); return true; } return false;
  }, MARK);
  happy('เลือกโครงการปลายทางได้', ticked, '');
  await settle(600);
  happy('กดคัดลอกได้', await click('คัดลอก'), '');
  await settle(3000);
  const copied = await query(
    'select count(*)::int n from mtg_group_guests where group_id = $1 and lower(email) = lower($2)',
    [gB.id, C.email]);
  happy('รายชื่อถูกคัดลอกไปกลุ่มปลายทางจริง', copied.rows[0].n === 1, `n=${copied.rows[0].n}`);
  await shot('14-คัดลอกรายชื่อ');

  // คนที่ไม่ได้ถูกระบุชื่อต้องไม่เห็นกลุ่มที่ล็อกเลย
  await query('delete from mtg_group_guests where group_id = any($1)', [[gA.id, gB.id]]);
  await as(C);
  await settle(1500);
  const outside = await body();
  bad('คนที่ไม่ถูกระบุชื่อไม่เห็นกลุ่มที่ล็อกในแถบข้าง', !outside.includes(`${MARK} โครงการ`), '');
  bad('และเปิดเอกสารในกลุ่มที่ล็อกไม่ได้',
    (await call(`/meetings/${mShort}`, { user: C })).status === 403, '');
  // ปลดล็อกคืน เพื่อให้ข้อตรวจการลบด้านล่างทำงานบนหน้าจอได้ตามปกติ
  await query(`update mtg_groups set visibility = 'public' where id = any($1)`, [[gA.id, gB.id]]);
}

// ═══════════════════════════════════════════════════════════════════════════
suite('16. ลบบันทึก');
// ═══════════════════════════════════════════════════════════════════════════
{
  await as(A);
  const delId = await mk({
    groupId: gA.id, title: `${MARK} ฉบับที่จะถูกลบ`, meetingDate: iso(5, 5),
    content: `<p>${MARK} เนื้อหาที่จะหายไป</p>`, visible: true,
  });
  happy('เปิดฉบับที่จะลบได้', await open(delId), '');
  happy('กดลบในเอกสารได้', await clickInDoc('ลบ'), '');
  await settle(1500);
  const ask = await body();
  happy('ถามยืนยัน และบอกว่าไฟล์แนบ/ความเห็น/ประวัติจะหายไปด้วย',
    ask.includes('ไฟล์แนบ') && ask.includes('ประวัติ'), ask.slice(0, 160).replace(/\n/g, ' | '));
  happy('ยืนยันการลบ', await clickInDialog(page, 'ลบ'), '');
  await settle(3000);
  const gone = await query('select count(*)::int n from mtg_meetings where id = $1', [delId]);
  happy('เอกสารถูกลบจริง', gone.rows[0].n === 0, `n=${gone.rows[0].n}`);
  bad('เปิดเอกสารที่ถูกลบแล้วได้ 404', (await call(`/meetings/${delId}`, { user: A })).status === 404, '');
  await shot('15-ลบบันทึก');
}

// ═══════════════════════════════════════════════════════════════════════════
suite('17. ข้อมูลจริงของลูกค้าไม่ถูกแตะ และไม่ทิ้งข้อมูลทดสอบไว้');
// ═══════════════════════════════════════════════════════════════════════════
{
  bad('ไม่มี error ค้างบนคอนโซลตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' / '));
  // 82 ฉบับ 9 กลุ่มของลูกค้าต้องยังอยู่ครบและไม่มีฉบับใดถูกปักหมุด/ซ่อนโดยชุดนี้
  const real = await query(
    `select count(*)::int n from mtg_meetings m
      where m.title not like $1 and m.content not like $1`, [`%${MARK}%`]);
  happy('บันทึกจริงของลูกค้ายังอยู่ครบ 82 ฉบับ', real.rows[0].n === 82, `n=${real.rows[0].n}`);
  // ทะเบียนของลูกค้ามี 9 โครงการ + กล่องรอจัดเก็บ 2 กล่อง = 11 แถว
  const realGroups = await query(
    `select count(*) filter (where not is_inbox)::int p, count(*) filter (where is_inbox)::int i
       from mtg_groups where code not like $1`, [`${MARK}%`]);
  happy('กลุ่มจริงของลูกค้ายังอยู่ครบ 9 โครงการ + 2 กล่องรอจัดเก็บ',
    realGroups.rows[0].p === 9 && realGroups.rows[0].i === 2, JSON.stringify(realGroups.rows[0]));

  await browser.close();
  await clean();
  const left = await query(
    'select (select count(*)::int from mtg_meetings where title like $1) a, (select count(*)::int from mtg_groups where code like $2) b',
    [`%${MARK}%`, `${MARK}%`]);
  happy('ลบบันทึกและกลุ่มของชุดทดสอบหมดแล้ว', left.rows[0].a === 0 && left.rows[0].b === 0,
    JSON.stringify(left.rows[0]));
}

process.exit(report(`${ROOT}/meetings-flows.json`) ? 1 : 0);
