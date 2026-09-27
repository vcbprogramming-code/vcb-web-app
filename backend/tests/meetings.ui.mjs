/**
 * รายงานการประชุม — เดินทั้งเส้นทางบนหน้าจอจริง
 *
 * โมดูลนี้มีชุดทดสอบฝั่ง API อยู่แล้วสองชุด และผ่านทั้งคู่ แต่ไม่เคยมีใครเปิด
 * หน้าจอมันเลยหลังเพิ่มแผงสิทธิ์การเข้าถึง — ผลคือหน้าล้มทั้งหน้าตั้งแต่
 * ข้อมูลมาถึง (useState ถูกประกาศใต้ทางออกก่อนกำหนด จำนวน hook จึงเปลี่ยน)
 * ชุดนี้จึงมีไว้ให้ความพังแบบนั้นถูกจับได้ตั้งแต่ครั้งแรก
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query, call } from './harness.mjs';
import { clickInDialog } from './tools/ui.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/meetings-ui`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin;      // ผู้ดูแล — จัดการสิทธิ์ได้
const C = U.exec;       // ผู้บริหาร — อ่านได้อย่างเดียว
const MARK = 'ZZMTGUI';

const clean = async () => {
  await query('delete from mtg_group_guests where group_id in (select id from mtg_groups where code like $1)', [`${MARK}%`]);
  await query('delete from mtg_meetings where title like $1 or content like $1', [`%${MARK}%`]);
  await query('delete from mtg_groups where code like $1', [`${MARK}%`]);
};
await clean();

// กลุ่มของชุดทดสอบเอง จะได้ไม่ไปยุ่งกับกลุ่มจริงของลูกค้า
const GRP_EN = `${MARK} Test Project EN`;
const grp = (await query(
  `insert into mtg_groups (code, name, name_en, color, visibility, sort_order)
   values ($1,$2,$3,'#0ea5e9','public', 998) returning *`,
  [`${MARK}-1`, `${MARK} กลุ่มทดสอบ`, GRP_EN])).rows[0];

fs.rmSync(`${ROOT}/chrome-mtg`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-mtg`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 2000) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
/** รอจนข้อความโผล่บนจอ (สูงสุด 12 วินาที) แล้วคืนว่าเจอหรือไม่ */
const waitText = async (needle, ms = 12000) => {
  const until = Date.now() + ms;
  for (;;) {
    if ((await body()).includes(needle)) return true;
    if (Date.now() > until) return false;
    await settle(300);
  }
};
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0].slice(0, 160)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().split('\n')[0].slice(0, 160));
});

const as = async (user, path = '/meetings') => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  // รอจนแถบข้างมาถึงจริง ไม่ใช่รอเวลาคงที่: ฐานข้อมูลมีการประชุมจริง 82 ฉบับแล้ว
  // รายการจึงใช้เวลานานกว่าตอนที่ตารางยังว่าง และการทดสอบก็ล้มสลับข้อไปเรื่อย
  await settle(1200);
  if (path.startsWith('/meetings')) await waitText('ทุกการประชุม');
  await settle(800);
};
/** ปุ่มที่เป็นไอคอนล้วน (ปิด, เฟืองตั้งค่า) ไม่มีข้อความให้จับ — หาด้วย aria-label
 *  รอให้โผล่ก่อนกดด้วยเหตุผลเดียวกับ click() ข้างล่าง */
const clickLabelOnce = (aria) => page.evaluate((a) => {
  const el = document.querySelector(`[aria-label="${a}"]`);
  if (el) { el.click(); return true; } return false;
}, aria);
const clickLabel = async (aria, ms = 8000) => {
  const until = Date.now() + ms;
  for (;;) {
    if (await clickLabelOnce(aria)) return true;
    if (Date.now() > until) return false;
    await settle(300);
  }
};
const hasLabel = (aria) => page.evaluate((a) => !!document.querySelector(`[aria-label="${a}"]`), aria);
const clickOnce = (label) => page.evaluate((l) => {
  const el = [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim() === l)
    || [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim().includes(l));
  if (el) { el.click(); return true; } return false;
}, label);
/** กดปุ่ม โดยรอให้มันโผล่ก่อน (สูงสุด 8 วินาที)
 *
 *  ฐานข้อมูลจริงมีการประชุม 82 ฉบับแล้ว ทุกครั้งที่ทำอะไรกับเอกสาร รายการจะ
 *  โหลดใหม่ทั้งรายการ ซึ่งกินเวลานานกว่าตอนฐานข้อมูลมีสองสามแถว การกดทันที
 *  หลังคำสั่งก่อนหน้าจึงไปตกในจังหวะที่หน้ากำลังวาดใหม่ แล้วชุดทดสอบก็ล้ม
 *  สลับไปมาคนละข้อทุกรอบ — รอปุ่มก่อนกด ไม่ใช่ยืดเวลา settle ให้นานขึ้นเรื่อย ๆ */
const click = async (label, ms = 8000) => {
  const until = Date.now() + ms;
  for (;;) {
    if (await clickOnce(label)) return true;
    if (Date.now() > until) return false;
    await settle(300);
  }
};
/** กดปุ่มที่อยู่ "ในเอกสารที่เปิดอยู่" เท่านั้น
 *
 *  ตอนนี้ฐานข้อมูลมีบันทึกจริงของลูกค้าอยู่ด้วย และชื่อปุ่มบางชื่อ ("ปักหมุด")
 *  ไปโผล่เป็นข้อความในแถวรายการของบันทึกจริงได้ ถ้าปุ่มในเอกสารยังไม่ทันวาด
 *  การกดแบบเลือกทั้งหน้าจะไปโดนแถวของลูกค้าแทน แล้วชุดทดสอบก็กลายเป็นคนไป
 *  แก้ข้อมูลจริง — เกิดขึ้นมาแล้วหนึ่งครั้ง (ปักหมุด/เอาหมุดออกบันทึกของลูกค้า)
 */
const clickInDoc = async (label, ms = 8000) => {
  const until = Date.now() + ms;
  for (;;) {
    const hit = await page.evaluate((l) => {
      const doc = document.querySelector('article');
      if (!doc) return false;
      const el = [...doc.querySelectorAll('button, a')].find((x) => x.innerText.trim() === l)
        || [...doc.querySelectorAll('button, a')].find((x) => x.innerText.trim().includes(l));
      if (el) { el.click(); return true; } return false;
    }, label);
    if (hit) return true;
    if (Date.now() > until) return false;
    await settle(300);
  }
};
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

// ── 1. หน้าเปิดได้จริง ────────────────────────────────────────────────────
suite('1. เปิดหน้ารายงานการประชุมแล้วใช้งานได้');
{
  await as(A);
  const t = await body();
  happy('หน้าไม่ล้ม', !t.includes('เกิดข้อผิดพลาดบางอย่าง'), t.slice(0, 80).replace(/\n/g, ' | '));
  happy('เห็นหัวข้อรายงานการประชุมในแถบหัวน้ำเงิน',
    t.includes('รายงานการประชุม') && t.includes('VCB Group'), '');
  // แถบข้างเป็นสารบัญโครงการแบบระบบจริง: แถวรวมชื่อ "ทุกการประชุม" และแถว
  // โครงการต้องมีชื่ออังกฤษเป็นบรรทัดรอง (name_en มีในฐานข้อมูลแต่เดิมไม่เคยแสดง)
  happy('เห็นแถบข้างโครงการให้เลือก', t.includes('โครงการ') && t.includes('ทุกการประชุม'), '');
  happy('แถวรวมมีบรรทัดรองภาษาอังกฤษ', t.includes('All meetings'), '');
  // ระบบของลูกค้าไม่ขึ้นโครงการที่ยังไม่มีบันทึกในแถบข้าง (ทะเบียนเขามี 9 โครงการ
  // แต่จอมี 8 — Business Development ที่ยังว่างไม่ขึ้น) ของเราทำแบบเดียวกัน
  // กลุ่มยังอยู่ในทะเบียน เลือกได้ในฟอร์ม และจะโผล่ในแถบข้างทันทีที่มีบันทึกแรก
  bad('โครงการที่ยังไม่มีบันทึก ไม่ขึ้นในแถบข้าง', !t.includes(GRP_EN), '');
  happy('มีตัวกรองช่วงเวลาพร้อมจำนวน',
    t.includes('ทั้งหมด') && t.includes('สัปดาห์นี้') && t.includes('เดือนนี้'), '');
  happy('หัวรายการนับเป็น “รายการ” ไม่ใช่ “ฉบับ”', t.includes('รายการ') && !/\d+\s*ฉบับ/.test(t), '');
  // กล่องรอจัดเก็บต้องขึ้นแม้ยังไม่มีอะไรเข้ามา คนที่จะต่อ Fathom ต้องเห็นปลายทาง
  happy('กล่องรอจัดเก็บขึ้นทั้งที่จำนวนเป็นศูนย์ และคงคำนำหน้าไว้',
    t.includes('กล่องรอจัดเก็บ · Fathom') && t.includes('กล่องรอจัดเก็บ · Transkriptor'), '');
  happy('ผู้ดูแลเห็นปุ่มเพิ่มโครงการในแถบข้าง', t.includes('เพิ่มโครงการ'), '');
  // ปุ่มเฟืองเปิด "แผงตั้งค่า" ของโมดูลแบบระบบจริงของลูกค้า (ภาษา ขนาดตัวอักษร
  // เกี่ยวกับ) และสิทธิ์โครงการเป็นรายการหนึ่งข้างใน จึงไม่ใช่ปุ่มของผู้ดูแลอีก
  happy('เห็นปุ่มเฟืองตั้งค่าในแถบหัว', await hasLabel('ตั้งค่า'), '');
  happy('ผู้ดูแลเห็นปุ่มเพิ่มการประชุม', t.includes('เพิ่มการประชุม'), '');
  bad('ไม่มี error ค้างบนคอนโซลตอนเปิดหน้า', errors.length === 0, errors.slice(0, 2).join(' / '));
  await shot('01-หน้าแรก');
}

// ── 2. เขียนรายงานการประชุมหนึ่งฉบับ ─────────────────────────────────────
const TITLE = `${MARK} ประชุมความก้าวหน้า ครั้งที่ 1`;
const DECISION = `${MARK} มติที่ประชุมคือให้สั่งเหล็กเพิ่มอีกสี่สิบตัน`;
suite('2. เขียนรายงานการประชุมได้จนจบ');
{
  happy('กดเพิ่มการประชุมแล้วฟอร์มเปิด', await click('เพิ่มการประชุม'), '');
  await settle(1200);
  const form = await body();
  happy('ฟอร์มถามครบทั้งโครงการ ชื่อเรื่อง วันที่ และเนื้อหา',
    ['โครงการ', 'ชื่อเรื่อง', 'วันที่ประชุม', 'เนื้อหา'].every((k) => form.includes(k)), '');
  // ช่องวันที่เป็นข้อความอิสระ ไม่ใช่ type="date" ที่บังคับปีคริสต์ศักราช
  happy('ช่องวันที่รับข้อความอิสระและบอกตัวอย่างเป็น พ.ศ.', form.includes('21/05/2569'), '');
  happy('ตัวแก้ไขมีย้อนกลับ ระดับหัวข้อ และขีดฆ่า',
    form.includes('ข้อความปกติ') && form.includes('หัวข้อ 1'), '');

  // ปุ่มลิงก์เคยเรียก window.prompt ซึ่งเป็นกล่องของเบราว์เซอร์ ไม่ใช่ของแอป
  // และถ้ามันโผล่มา หน้าจอทั้งหน้าจะค้างรอจนกว่าจะกดปิด
  happy('กดปุ่มลิงก์แล้วได้กล่องของแอป ไม่ใช่กล่องของเบราว์เซอร์', await click('ลิงก์'), '');
  await settle(900);
  const link = await body();
  happy('กล่องเพิ่มลิงก์มีช่อง “ลิงก์ URL” และปุ่ม “เพิ่ม”',
    link.includes('เพิ่มลิงก์') && link.includes('ลิงก์ URL'), '');
  await shot('02ก-กล่องเพิ่มลิงก์');
  // Escape ต้องปิดแค่กล่องลิงก์ ไม่ใช่ปิดฟอร์มทั้งฉบับแล้วเนื้อหาที่พิมพ์หายไป
  await page.keyboard.press('Escape');
  await settle(900);
  const after = await body();
  bad('Escape ปิดเฉพาะกล่องลิงก์ ฟอร์มการประชุมยังอยู่',
    !after.includes('ลิงก์ URL') && after.includes('ผู้เข้าประชุม'), '');

  await page.evaluate((gid) => {
    const sel = document.querySelector('#mtg-form select');
    if (!sel) return;
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, gid);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }, grp.id);
  await fill('เช่น ประชุมความก้าวหน้าโครงการ', TITLE);
  await fill('21/05/2569', '15/09/2569');
  await fill('เช่น 09:00', '09:00 – 11:00');
  await fill('คั่นชื่อด้วยเครื่องหมายจุลภาค', 'ทนงศักดิ์, ชวิน');
  // ช่องเนื้อหาเป็นพื้นที่พิมพ์อิสระ (contentEditable) ไม่ใช่ textarea — ต้อง
  // พิมพ์เข้าไปจริงเพื่อให้ onInput ทำงาน การยัดค่าใส่ตรง ๆ ไม่มีผล
  const typed = await page.evaluate(() => {
    const el = document.querySelector('#mtg-form [contenteditable="true"], [role="textbox"][contenteditable]');
    if (!el) return false;
    el.focus(); return true;
  });
  happy('มีพื้นที่พิมพ์เนื้อหาการประชุม', typed, '');
  await page.keyboard.type(DECISION);
  await page.keyboard.press('Enter');
  await page.keyboard.type('ผู้รับผิดชอบ: ฝ่ายจัดซื้อ');
  await page.evaluate(() => document.querySelector('#mtg-form [contenteditable="true"]')?.blur());
  await settle(500);
  await shot('02-กรอกฟอร์ม');

  happy('กดบันทึกได้', await click('บันทึก'), '');
  await settle(3000);
  const saved = (await query('select * from mtg_meetings where title = $1', [TITLE])).rows[0];
  happy('รายงานถูกบันทึกลงฐานข้อมูลจริง', !!saved, '');
  happy('บันทึกกลุ่มที่เลือกไว้ถูกต้อง', saved?.group_id === grp.id, '');
  happy('บันทึกเนื้อหาที่พิมพ์ไว้ครบ', String(saved?.content || '').includes('สั่งเหล็กเพิ่มอีกสี่สิบตัน'), '');
  happy('ฟอร์มปิดเองหลังบันทึก', !(await body()).includes('ผู้เข้าประชุม\nคั่นชื่อ'), '');
  // วันที่ที่พิมพ์แบบไทยต้องถูกแปลงเป็นวันที่จริงฝั่งเซิร์ฟเวอร์
  const savedIso = saved?.meeting_date
    ? `${saved.meeting_date.getFullYear()}-${String(saved.meeting_date.getMonth() + 1).padStart(2, '0')}-${String(saved.meeting_date.getDate()).padStart(2, '0')}`
    : '';
  happy('วันที่แบบ พ.ศ. ที่พิมพ์เอง ถูกแปลงเป็นวันที่จริง', savedIso === '2026-09-15', savedIso);
  happy('และเก็บข้อความวันที่ตามที่พิมพ์ไว้ด้วย', saved?.date_label === '15/09/2569', saved?.date_label);
  happy('ได้คีย์กันนำเข้าซ้ำแบบ manual-<ts>', /^manual-\d+/.test(String(saved?.meeting_key || '')), saved?.meeting_key);
  happy('รายการบนหน้าจอขึ้นรายงานใหม่ทันที', await waitText(TITLE), '');
  await shot('03-บันทึกแล้ว');
}

// ── 3. เปิดอ่านและค้นหา ───────────────────────────────────────────────────
suite('3. เปิดอ่านรายงานและค้นเจอจากเนื้อหา');
{
  happy('กดชื่อเรื่องแล้วเปิดอ่านได้', await click(TITLE), '');
  happy('เห็นเนื้อหาที่บันทึกไว้', await waitText('สั่งเหล็กเพิ่มอีกสี่สิบตัน'), '');
  happy('เห็นผู้เข้าประชุมที่กรอกไว้', await waitText('ชวิน'), '');
  await shot('04-เปิดอ่าน');

  // ค้นด้วยคำที่อยู่ในเนื้อหา ไม่ใช่ในชื่อเรื่อง — คนมาที่นี่เพื่อหามติ
  const ok = await page.evaluate(() => {
    const i = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('ค้น'));
    if (!i) return false;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, 'สี่สิบตัน');
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  });
  happy('มีช่องค้นหาให้ใช้', ok, '');
  happy('ค้นจากคำในเนื้อหาแล้วเจอรายงานฉบับนี้', await waitText(TITLE), '');
  await shot('05-ค้นหา');
  await page.evaluate(() => {
    const i = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('ค้น'));
    if (!i) return;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, '');
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(1600);
}

// ── 3ก. แถบเครื่องมือหน้าเอกสาร และประวัติการทำงาน ───────────────────────
suite('3ก. แถบเครื่องมือครบ และประวัติการทำงานรวมทุกอย่างในสายเวลาเดียว');
{
  happy('เอกสารโหลดเสร็จ', await waitText('พิมพ์ / PDF'), '');
  const t = await body();
  happy('มีปุ่มครบตามระบบจริง',
    ['ปักหมุด', 'แก้ไข', 'ประวัติการทำงาน', 'คัดลอกลิงก์', 'พิมพ์ / PDF'].every((k) => t.includes(k)),
    ['ปักหมุด', 'แก้ไข', 'ประวัติการทำงาน', 'คัดลอกลิงก์', 'พิมพ์ / PDF'].filter((k) => !t.includes(k)).join(' / '));
  happy('หัวข้อผู้เข้าประชุมบอกจำนวน', /ผู้เข้าประชุม\s*·\s*2/.test(t), '');
  happy('มีปุ่มแนบไฟล์ในหน้าอ่าน ไม่ต้องเข้าโหมดแก้ไข', t.includes('แนบไฟล์'), '');
  happy('วันที่แสดงแบบ “15 ก.ย. 2569” และเวลาต่อท้าย น.',
    t.includes('15 ก.ย. 2569') && /น\./.test(t), '');

  // ปักหมุดต้องถูกบันทึกเป็นประวัติการทำงาน ไม่ใช่เปลี่ยนค่าแล้วเงียบ
  happy('กดปักหมุดได้', await clickInDoc('ปักหมุด'), '');
  await settle(2500);
  const pinned = (await query('select pinned from mtg_meetings where title = $1', [TITLE])).rows[0];
  happy('ปักหมุดถูกบันทึกจริง', pinned?.pinned === true, String(pinned?.pinned));
  const audited = (await query(
    `select action from mtg_audit where meeting_id = (select id from mtg_meetings where title = $1)`,
    [TITLE])).rows;
  happy('การปักหมุดถูกบันทึกลงประวัติการทำงาน', audited.some((r) => r.action === 'pin'),
    audited.map((r) => r.action).join(','));

  happy('เปิดแผงประวัติการทำงานได้', await click('ประวัติการทำงาน'), '');
  await settle(1800);
  const h = await body();
  happy('แผงปักแถวฉบับแรกไว้บนสุด', h.includes('ฉบับแรก'), '');
  happy('สายเวลามีรายการปักหมุด', h.includes('ปักหมุด'), '');
  happy('มีช่องเขียนความเห็นอยู่ล่างสุดของแผง',
    await page.evaluate(() => {
      const d = document.querySelector('[aria-label="ประวัติการทำงาน"] form input');
      return !!d && (d.placeholder || '').includes('เขียนความเห็น');
    }), '');
  await shot('04ก-ประวัติการทำงาน');
  await page.keyboard.press('Escape');
  await settle(1200);
  bad('กด Escape แล้วลิ้นชักปิด ไม่ค้างทับหน้าจอ',
    !(await page.evaluate(() => !!document.querySelector('[aria-label="ประวัติการทำงาน"]'))), '');
  await clickInDoc('เอาหมุดออก');
  await settle(2000);
}

// ── 3ข. แดชบอร์ดการประชุมล่าสุด ──────────────────────────────────────────
suite('3ข. ปิดเอกสารแล้วเห็นการ์ดการประชุมล่าสุด');
{
  happy('ปิดเอกสารได้', await clickLabel('ปิดเอกสาร'), '');
  happy('เห็นหัวข้อการประชุมล่าสุด', await waitText('การประชุมล่าสุด'), (await body()).slice(0, 140).replace(/\n/g, ' | '));
  const t = await body();
  happy('การ์ดมีลิงก์อ่านบันทึก', t.includes('อ่านบันทึก'), '');
  happy('การ์ดขึ้นชื่อการประชุมที่เพิ่งเขียน', await waitText(TITLE), '');
  await shot('05ก-การประชุมล่าสุด');

  happy('พอมีบันทึกแล้ว โครงการโผล่ในแถบข้าง', await waitText(`${MARK} กลุ่มทดสอบ`), '');
  happy('แถวโครงการแสดงชื่ออังกฤษเป็นบรรทัดรอง', (await body()).includes(GRP_EN), '');

  // เลือกโครงการเดียว → ฉบับล่าสุดของโครงการนั้น พร้อมปุ่มคัดลอกลิงก์ฉบับล่าสุด
  happy('เลือกโครงการในแถบข้างได้', await page.evaluate((mark) => {
    const row = [...document.querySelectorAll('aside [role="button"]')]
      .find((n) => n.innerText.includes(mark));
    if (row) { row.click(); return true; } return false;
  }, MARK), '');
  happy('เห็นการ์ดฉบับล่าสุดของโครงการนั้น',
    (await waitText('การประชุมล่าสุด')) && (await waitText(TITLE)), '');
  happy('การ์ดดึงบทสรุปจากเนื้อหามาแสดง', await waitText('สั่งเหล็กเพิ่มอีกสี่สิบตัน'), '');
  happy('มีปุ่มคัดลอกลิงก์ฉบับล่าสุด', await waitText('คัดลอกลิงก์ฉบับล่าสุด'), '');
  await shot('05ข-ฉบับล่าสุดของโครงการ');
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('aside [role="button"]')]
      .find((n) => n.innerText.includes('ทุกการประชุม'));
    if (row) row.click();
  });
  await settle(2000);
}

// ── 4. แผงสิทธิ์การเข้าถึง ────────────────────────────────────────────────
suite('4. ล็อกกลุ่มแล้วคนนอกไม่เห็นกลุ่มนั้นเลย');
{
  // ทางเข้าแผงสิทธิ์ย้ายไปอยู่ในแผงตั้งค่า (เฟือง → สิทธิ์โครงการ) ตามของเขา
  happy('เปิดแผงตั้งค่าได้', await clickLabel('ตั้งค่า'), '');
  await settle(1200);
  happy('เปิดแผงสิทธิ์จากแผงตั้งค่าได้', await click('สิทธิ์โครงการ'), '');
  await settle(3500);
  const t = await body();
  happy('แผงบอกชัดว่ากลุ่มที่ล็อกจะหายไป ไม่ใช่กดไม่ได้', t.includes('ไม่ปรากฏในรายการ'), '');
  happy('เห็นกลุ่มทดสอบในแผง', t.includes(MARK), '');
  await shot('06-แผงสิทธิ์');

  // กลุ่มเปิดอยู่ กดชิปเพื่อล็อก — ทางนี้ไม่ต้องยืนยัน เพราะไม่ได้เผยแพร่อะไร
  const locked = await page.evaluate((mark) => {
    const box = [...document.querySelectorAll('div')].find((d) => d.className.includes('rounded-xl')
      && d.innerText.startsWith(mark) && [...d.querySelectorAll('button')].some((b) => b.innerText.trim() === 'เปิดให้อ่าน'));
    const b = box && [...box.querySelectorAll('button')].find((x) => x.innerText.trim() === 'เปิดให้อ่าน');
    if (b) { b.click(); return true; } return false;
  }, MARK);
  happy('กดล็อกกลุ่มได้จากแผง', locked, '');
  await settle(2500);
  const g2 = (await query('select visibility from mtg_groups where id = $1', [grp.id])).rows[0];
  happy('กลุ่มถูกล็อกจริงในฐานข้อมูล', g2.visibility === 'locked', g2.visibility);
  happy('แผงเตือนว่ายังไม่มีผู้อ่านที่ระบุชื่อ', await waitText('ยังไม่มีผู้อ่านที่ระบุชื่อ'), '');
  // หัวข้อรายชื่อบอกจำนวน และมีทางคัดลอกรายชื่อไปโครงการอื่นเมื่อมีคนแล้ว
  happy('หัวข้อรายชื่อบอกจำนวน', (await body()).includes('ใครเห็นได้ (0)'), '');
  await shot('07-ล็อกแล้ว');

  // เพิ่มผู้บริหารเป็นผู้อ่านที่ระบุชื่อ
  // ช่องกรองด้านบนก็มีคำว่า "อีเมล" อยู่ในคำใบ้ — เจาะจงช่องเพิ่มผู้อ่าน ไม่งั้น
  // อีเมลจะตกลงไปในช่องกรองแล้วรายการก็ว่างเปล่าโดยไม่มีอะไรบอก
  happy('พิมพ์อีเมลลงช่องเพิ่มผู้อ่านได้', await page.evaluate((email) => {
    const i = [...document.querySelectorAll('input')]
      .find((x) => (x.placeholder || '').includes('วางหลายรายการ'));
    if (!i) return false;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, email);
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, C.email), '');
  await settle(400);
  // และช่องกรองต้องกรองได้จริง
  happy('ช่องกรองโครงการทำงาน', await page.evaluate((mark) => {
    const f = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('กรองโครงการ'));
    if (!f) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(f, mark); f.dispatchEvent(new Event('input', { bubbles: true }));
    const only = document.body.innerText.split('เปิดให้อ่าน').length;
    set.call(f, ''); f.dispatchEvent(new Event('input', { bubbles: true }));
    return only <= 2;
  }, MARK), '');
  await settle(400);
  happy('กดเพิ่มผู้อ่านได้', await click('เพิ่ม'), '');
  await waitText(C.email);
  const guests = (await query('select email from mtg_group_guests where group_id = $1', [grp.id])).rows;
  happy('อีเมลผู้อ่านถูกบันทึกไว้จริง', guests.some((g) => g.email === C.email), JSON.stringify(guests));
  happy('แผงแสดงอีเมลที่เพิ่งเพิ่ม', await waitText(C.email), '');
  happy('มีปุ่มคัดลอกรายชื่อไปโครงการอื่นเมื่อมีผู้อ่านแล้ว',
    await waitText('คัดลอกรายชื่อไปโครงการอื่น'), '');
  await shot('08-เพิ่มผู้อ่าน');
}

// ── 5. คนที่ไม่ได้ถูกระบุชื่อ ────────────────────────────────────────────
suite('5. คนที่ถูกระบุชื่อเห็น คนที่ไม่ถูกระบุไม่เห็น');
{
  await as(C);
  happy('ผู้ที่ถูกระบุชื่อยังเห็นกลุ่มที่ล็อก', await waitText(MARK), (await body()).slice(0, 140).replace(/\n/g, ' | '));
  const t = await body();
  // ปุ่มเฟืองเห็นได้ทุกคน (ภาษา/ขนาดตัวอักษรเป็นของทุกคน) แต่รายการ "สิทธิ์โครงการ"
  // ข้างในต้องไม่มีให้คนที่จัดการสิทธิ์ไม่ได้ — ปุ่มที่กดแล้ว 403 ก็คือรั่วอยู่แล้ว
  happy('ผู้บริหารเห็นปุ่มเฟืองตั้งค่า', await hasLabel('ตั้งค่า'), '');
  {
    await clickLabel('ตั้งค่า');
    await settle(1200);
    bad('แต่ในแผงตั้งค่าไม่มีทางเข้าสิทธิ์โครงการ', !(await body()).includes('สิทธิ์โครงการ'), '');
    await click('ปิด');
    await settle(600);
  }
  await shot('09-ผู้ที่ถูกระบุชื่อ');

  // ถอดชื่อออกแล้วกลุ่มต้องหายไปทั้งกลุ่ม
  await query('delete from mtg_group_guests where group_id = $1', [grp.id]);
  await as(C);
  // รอให้แถบข้างวาดจนถึงส่วนท้าย (กล่องรอจัดเก็บ) ก่อนจะสรุปว่ากลุ่มหายไปแล้ว —
  // การอ่านหน้าจอตอนที่รายการโครงการยังไม่ขึ้น ก็ "ไม่เห็น" ทุกกลุ่มอยู่แล้ว
  await waitText('กล่องรอจัดเก็บ · Fathom');
  const t2 = await body();
  bad('ถอดชื่อออกแล้วกลุ่มที่ล็อกหายไปจากรายการ', !t2.includes(MARK), t2.slice(0, 90).replace(/\n/g, ' | '));
  bad('และรายงานในกลุ่มนั้นก็ไม่โผล่ในรายการ', !t2.includes(TITLE), '');
  await shot('10-คนนอกไม่เห็น');
}

// ── 6. ลบรายงาน ──────────────────────────────────────────────────────────
suite('6. ลบรายงานแล้วถามยืนยันด้วยกล่องสีแดง');
{
  await as(A);
  await settle(1200);
  const opened = await click(TITLE);
  happy('เปิดรายงานที่จะลบได้', opened && await waitText('พิมพ์ / PDF'), '');
  happy('มีปุ่มลบให้ผู้มีสิทธิ์', await click('ลบ'), '');
  await waitText('ลบรายงานการประชุม');
  const t = await body();
  happy('ถามยืนยันก่อนลบ', t.includes('ลบรายงานการประชุม'), '');
  happy('บอกด้วยว่าไฟล์แนบและความเห็นจะถูกลบไปด้วย', t.includes('ไฟล์แนบ'), '');
  await shot('11-ยืนยันลบ');
  happy('กดยืนยันในกล่องได้', await clickInDialog(page, 'ลบ'), '');
  await settle(3000);
  const left = (await query('select count(*)::int n from mtg_meetings where title = $1', [TITLE])).rows[0].n;
  happy('ลบออกจากฐานข้อมูลจริง', left === 0, `${left}`);
  happy('รายการบนหน้าจอไม่เหลือรายงานฉบับนั้น', !(await body()).includes(TITLE), '');
  await shot('12-ลบแล้ว');
}

// ── 7. ไม่มีข้อผิดพลาดซ่อนอยู่ ───────────────────────────────────────────
suite('7. ไม่มีข้อผิดพลาดซ่อนอยู่');
{
  bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' / '));
}

// ── 8. เก็บกวาด ──────────────────────────────────────────────────────────
suite('8. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await clean();
  const left = (await query('select count(*)::int n from mtg_groups where code like $1', [`${MARK}%`])).rows[0].n;
  happy('ลบกลุ่มและรายงานทดสอบหมดแล้ว', left === 0, `${left}`);
}

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
