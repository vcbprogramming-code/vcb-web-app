/**
 * หน้าหลัก (Portal) — ประตูทางเข้าที่ทุกคนเห็นก่อนเสมอ
 *
 * ทุกคนในบริษัทเปิดหน้านี้ก่อนเข้าโมดูลใด ๆ ถ้าหน้านี้เพี้ยน คนจะเข้าใจว่า
 * ทั้งระบบเพี้ยน ชุดนี้กดของจริงบนหน้านี้: ค้นหาแอป เปิดแอป อ่านประกาศ
 * ปิดแถบประกาศ ปฏิทินวันหยุด กล่องช่วยเหลือ และเมนูบนมือถือ
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/portal-ui`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin, C = U.exec;
const MARK = 'ZZPORTAL';
const clean = () => query('delete from announcements where title like $1', [`${MARK}%`]);
await clean();

fs.rmSync(`${ROOT}/chrome-portal`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-portal`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 1600) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0].slice(0, 150)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().split('\n')[0].slice(0, 150));
});

const as = async (user, path = '/') => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(2600);
};
const click = (label) => page.evaluate((l) => {
  const el = [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim() === l)
    || [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim().includes(l));
  if (el) { el.click(); return true; } return false;
}, label);
const typeSearch = (v) => page.evaluate((val) => {
  const i = [...document.querySelectorAll('input[type=search], input')].find((x) => (x.placeholder || '').includes('ค้นหาแอป'));
  if (!i) return false;
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, val);
  i.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, v);

// ── 1. เปิดหน้าหลัก ───────────────────────────────────────────────────────
suite('1. เปิดหน้าหลักแล้วเห็นทุกอย่างที่ต้องเห็น');
{
  await as(A);
  const t = await body();
  happy('หน้าไม่ล้ม', !t.includes('เกิดข้อผิดพลาดบางอย่าง'), t.slice(0, 70).replace(/\n/g, ' | '));
  happy('ทักทายด้วยชื่อผู้ใช้', t.includes('ทนงศักดิ์') || t.includes(A.name.split(' ')[0]), '');
  happy('เห็นรายการแอปพลิเคชัน', t.includes('แอปพลิเคชัน'), '');
  happy('เห็นเมนูช่วยเหลือ', t.includes('ช่วยเหลือ'), '');
  happy('บอกจำนวนแอปที่แสดงอยู่', /\d+ รายการ/.test(t), '');
  bad('ไม่มี error ตอนเปิดหน้า', errors.length === 0, errors.slice(0, 2).join(' / '));
  await shot('01-หน้าหลัก');
}

// ── 2. ค้นหาแอป ──────────────────────────────────────────────────────────
suite('2. ค้นหาแอปแล้วรายการแคบลงจริง');
{
  const count = () => page.evaluate(() => {
    const m = document.body.innerText.match(/(\d+) รายการ/);
    return m ? Number(m[1]) : -1;
  });
  const before = await count();
  happy('มีช่องค้นหาแอป', await typeSearch('ประชุม'), '');
  await settle(1200);
  const after = await count();
  happy(`ค้นแล้วเหลือน้อยลง (${before} → ${after})`, before > 0 && after > 0 && after < before, `${before} → ${after}`);
  happy('ผลที่เหลือคือแอปที่ค้น', (await body()).includes('รายงานการประชุม'), '');
  await shot('02-ค้นหาแอป');

  await typeSearch('ไม่มีแอปชื่อนี้แน่นอน');
  await settle(1200);
  happy('ค้นไม่เจอแล้วบอกให้รู้ ไม่ใช่หน้าว่าง', (await body()).includes('ไม่พบแอป'), '');
  await shot('03-ค้นไม่เจอ');
  await typeSearch('');
  await settle(1000);
}

// ── 3. เปิดแอปจากหน้าหลัก ────────────────────────────────────────────────
suite('3. กดการ์ดแล้วเข้าแอปได้จริง');
{
  const went = await page.evaluate(() => {
    const card = [...document.querySelectorAll('button, a')].find((x) => x.innerText.includes('คู่มือปฏิบัติงาน') || x.innerText.includes('SOP'));
    if (card) { card.click(); return true; } return false;
  });
  happy('กดการ์ดแอปได้', went, '');
  await settle(3000);
  happy('เข้าไปถึงหน้าแอปจริง', page.url().includes('/sop'), page.url());
  await shot('04-เข้าแอป');
  await as(A);
}

// ── 4. ประกาศจากผู้ดูแล ──────────────────────────────────────────────────
suite('4. ประกาศที่ปักหมุดขึ้นเป็นแถบให้อ่าน และปิดได้');
{
  await query(
    `insert into announcements (title, body, pinned, is_active, starts_at)
     values ($1, $2, true, true, now() - interval '1 day')`,
    [`${MARK} ประกาศทดสอบ`, 'ทดสอบการแสดงประกาศบนหน้าหลัก']);
  await as(A);
  const t = await body();
  happy('ประกาศที่ปักหมุดขึ้นบนหน้าหลัก', t.includes(`${MARK} ประกาศทดสอบ`), t.slice(0, 100).replace(/\n/g, ' | '));
  await shot('05-ประกาศ');

  const dismissed = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '').includes('ปิดแถบประกาศ'));
    if (b) { b.click(); return true; } return false;
  });
  happy('มีปุ่มปิดแถบประกาศ', dismissed, '');
  await settle(1200);
  // ปิดแล้วประกาศย้ายลงไปอยู่ในการ์ดด้านล่างตามที่ออกแบบไว้ — ที่ต้องหายคือ
  // "แถบเด่น" ซึ่งดูจากปุ่มปิดที่อยู่ในแถบนั้น ไม่ใช่ดูจากข้อความทั้งหน้า
  const bannerGone = async () => !(await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') || '').includes('ปิดแถบประกาศ'))));
  bad('ปิดแล้วแถบเด่นหายไปจริง', await bannerGone(), '');
  happy('ประกาศยังอ่านย้อนหลังได้ในการ์ดด้านล่าง', (await body()).includes(`${MARK} ประกาศทดสอบ`), '');
  await shot('06-ปิดประกาศ');

  // ปิดแล้วต้องจำไว้ ไม่ใช่เด้งกลับมาทุกครั้งที่เปิดหน้า
  await page.reload({ waitUntil: 'networkidle2' });
  await settle(2600);
  bad('เปิดหน้าใหม่แล้วแถบที่ปิดไปไม่เด้งกลับมา', await bannerGone(), '');
  await shot('07-เปิดใหม่');
}

// ── 5. ปฏิทินวันหยุด ─────────────────────────────────────────────────────
suite('5. ปฏิทินวันหยุดเลื่อนเดือนได้');
{
  await as(A);
  const t = await body();
  const hasCal = /มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม/.test(t);
  happy('เห็นปฏิทินบนหน้าหลัก', hasCal, '');
  // อ่านชื่อเดือนจากป้ายในปฏิทินเอง ไม่ใช่จากทั้งหน้า — นาฬิกาบนหน้าหลักก็
  // พิมพ์ชื่อเดือนเหมือนกัน ถ้าอ่านรวมจะได้ค่าของนาฬิกามาแทน
  const monthNow = () => page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => (b.getAttribute('aria-label') || '').includes('เดือนถัดไป'));
    const label = btn?.previousElementSibling;
    return label ? label.innerText.trim() : '';
  });
  const m1 = await monthNow();
  const moved = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '').includes('เดือนถัดไป'));
    if (b) { b.click(); return true; } return false;
  });
  happy('มีปุ่มเลื่อนไปเดือนถัดไป', moved, '');
  await settle(1000);
  const m2 = await monthNow();
  happy(`กดแล้วเปลี่ยนเดือนจริง (${m1} → ${m2})`, m1 !== '' && m2 !== '' && m1 !== m2, `${m1} → ${m2}`);
  await shot('08-ปฏิทิน');
}

// ── 6. กล่องช่วยเหลือ ────────────────────────────────────────────────────
suite('6. กล่องช่วยเหลือเปิดอ่านได้');
{
  happy('กดเมนูช่วยเหลือได้', await click('ช่วยเหลือ / แจ้งปัญหา'), '');
  await settle(1400);
  const t = await body();
  happy('กล่องช่วยเหลือมีเนื้อหาให้อ่าน', t.includes('ช่วยเหลือ') && t.length > 200, '');
  await shot('09-ช่วยเหลือ');
  await page.keyboard.press('Escape');
  await settle(900);
}

// ── 7. คนละบทบาทเห็นแอปไม่เท่ากัน ────────────────────────────────────────
suite('7. ผู้บริหารเห็นเฉพาะแอปที่ตัวเองเข้าได้');
{
  await as(C);
  const t = await body();
  happy('ผู้บริหารเปิดหน้าหลักได้', !t.includes('เกิดข้อผิดพลาดบางอย่าง'), t.slice(0, 60).replace(/\n/g, ' | '));
  happy('ยังเห็นรายการแอป', /\d+ รายการ/.test(t), '');
  bad('ไม่เห็นเมนูผู้ดูแลระบบ', !t.includes('ผู้ดูแลระบบ') || !t.includes('จัดการผู้ใช้'), '');
  await shot('10-ผู้บริหาร');
}

// ── 8. ไม่มีข้อผิดพลาดซ่อนอยู่ ───────────────────────────────────────────
suite('8. ไม่มีข้อผิดพลาดซ่อนอยู่');
{
  bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' / '));
}

// ── 9. เก็บกวาด ──────────────────────────────────────────────────────────
suite('9. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await clean();
  const left = (await query('select count(*)::int n from announcements where title like $1', [`${MARK}%`])).rows[0].n;
  happy('ลบประกาศทดสอบหมดแล้ว', left === 0, `${left}`);
}

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
