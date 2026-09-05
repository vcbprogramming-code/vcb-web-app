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
const grp = (await query(
  `insert into mtg_groups (code, name, name_en, color, visibility, sort_order)
   values ($1,$2,$2,'#0ea5e9','public', 998) returning *`,
  [`${MARK}-1`, `${MARK} กลุ่มทดสอบ`])).rows[0];

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
  await settle(3000);
};
const click = (label) => page.evaluate((l) => {
  const el = [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim() === l)
    || [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim().includes(l));
  if (el) { el.click(); return true; } return false;
}, label);
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
  happy('เห็นหัวข้อรายงานการประชุม', t.includes('รายงานการประชุม'), '');
  happy('เห็นแถบกลุ่มให้กรอง', t.includes('ทุกกลุ่ม') && t.includes(MARK), '');
  happy('ผู้ดูแลเห็นปุ่มสิทธิ์การเข้าถึง', t.includes('สิทธิ์การเข้าถึง'), '');
  happy('ผู้ดูแลเห็นปุ่มเพิ่มรายงาน', t.includes('เพิ่มรายงาน'), '');
  bad('ไม่มี error ค้างบนคอนโซลตอนเปิดหน้า', errors.length === 0, errors.slice(0, 2).join(' / '));
  await shot('01-หน้าแรก');
}

// ── 2. เขียนรายงานการประชุมหนึ่งฉบับ ─────────────────────────────────────
const TITLE = `${MARK} ประชุมความก้าวหน้า ครั้งที่ 1`;
const DECISION = `${MARK} มติที่ประชุมคือให้สั่งเหล็กเพิ่มอีกสี่สิบตัน`;
suite('2. เขียนรายงานการประชุมได้จนจบ');
{
  happy('กดเพิ่มรายงานแล้วฟอร์มเปิด', await click('เพิ่มรายงาน'), '');
  await settle(1200);
  const form = await body();
  happy('ฟอร์มถามครบทั้งกลุ่ม ชื่อเรื่อง วันที่ และเนื้อหา',
    ['กลุ่ม', 'ชื่อเรื่อง', 'วันที่ประชุม', 'เนื้อหา'].every((k) => form.includes(k)), '');

  await page.evaluate((gid) => {
    const sel = document.querySelector('#mtg-form select');
    if (!sel) return;
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, gid);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }, grp.id);
  await fill('เช่น ประชุมความก้าวหน้าโครงการ', TITLE);
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
  happy('ฟอร์มปิดเองหลังบันทึก', !(await body()).includes('เพิ่มรายงานการประชุม'), '');
  happy('รายการบนหน้าจอขึ้นรายงานใหม่ทันที', (await body()).includes(TITLE), '');
  await shot('03-บันทึกแล้ว');
}

// ── 3. เปิดอ่านและค้นหา ───────────────────────────────────────────────────
suite('3. เปิดอ่านรายงานและค้นเจอจากเนื้อหา');
{
  happy('กดชื่อเรื่องแล้วเปิดอ่านได้', await click(TITLE), '');
  await settle(1800);
  const t = await body();
  happy('เห็นเนื้อหาที่บันทึกไว้', t.includes('สั่งเหล็กเพิ่มอีกสี่สิบตัน'), '');
  happy('เห็นผู้เข้าประชุมที่กรอกไว้', t.includes('ชวิน'), '');
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
  await settle(2200);
  happy('ค้นจากคำในเนื้อหาแล้วเจอรายงานฉบับนี้', (await body()).includes(TITLE), '');
  await shot('05-ค้นหา');
  await page.evaluate(() => {
    const i = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('ค้น'));
    if (!i) return;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, '');
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(1600);
}

// ── 4. แผงสิทธิ์การเข้าถึง ────────────────────────────────────────────────
suite('4. ล็อกกลุ่มแล้วคนนอกไม่เห็นกลุ่มนั้นเลย');
{
  happy('เปิดแผงสิทธิ์ได้', await click('สิทธิ์การเข้าถึง'), '');
  await settle(2000);
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
  happy('แผงเตือนว่ายังไม่มีผู้อ่านที่ระบุชื่อ', (await body()).includes('ยังไม่มีผู้อ่านที่ระบุชื่อ'), '');
  await shot('07-ล็อกแล้ว');

  // เพิ่มผู้บริหารเป็นผู้อ่านที่ระบุชื่อ
  await page.evaluate((email) => {
    const i = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('อีเมล'));
    if (!i) return;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, email);
    i.dispatchEvent(new Event('input', { bubbles: true }));
  }, C.email);
  await settle(400);
  happy('กดเพิ่มผู้อ่านได้', await click('เพิ่ม'), '');
  await settle(2500);
  const guests = (await query('select email from mtg_group_guests where group_id = $1', [grp.id])).rows;
  happy('อีเมลผู้อ่านถูกบันทึกไว้จริง', guests.some((g) => g.email === C.email), JSON.stringify(guests));
  happy('แผงแสดงอีเมลที่เพิ่งเพิ่ม', (await body()).includes(C.email), '');
  await shot('08-เพิ่มผู้อ่าน');
}

// ── 5. คนที่ไม่ได้ถูกระบุชื่อ ────────────────────────────────────────────
suite('5. คนที่ถูกระบุชื่อเห็น คนที่ไม่ถูกระบุไม่เห็น');
{
  await as(C);
  const t = await body();
  happy('ผู้ที่ถูกระบุชื่อยังเห็นกลุ่มที่ล็อก', t.includes(MARK), t.slice(0, 90).replace(/\n/g, ' | '));
  bad('ผู้บริหารไม่เห็นปุ่มจัดการสิทธิ์', !t.includes('สิทธิ์การเข้าถึง'), '');
  await shot('09-ผู้ที่ถูกระบุชื่อ');

  // ถอดชื่อออกแล้วกลุ่มต้องหายไปทั้งกลุ่ม
  await query('delete from mtg_group_guests where group_id = $1', [grp.id]);
  await as(C);
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
  happy('เปิดรายงานที่จะลบได้', opened, '');
  await settle(1600);
  happy('มีปุ่มลบให้ผู้มีสิทธิ์', await click('ลบ'), '');
  await settle(1400);
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
