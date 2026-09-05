/**
 * ปฐมนิเทศฝั่ง HR — ติดตามพนักงานใหม่ 30-60-90 วัน และประเมินทดลองงาน
 *
 * ฝั่งพนักงาน (โปรแกรม 90 วันที่พนักงานเดินเอง) มีชุดทดสอบของตัวเองแล้ว
 * ชุดนี้เป็นอีกครึ่งที่ HR ใช้จริง: เพิ่มพนักงานใหม่ ติ๊กงานตามเฟส ดูความ
 * คืบหน้าขยับ แล้วกรอกแบบประเมินทดลองงานจนได้ผลสรุป
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/onboarding-hr-ui`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin;
const MARK = 'ZZOBHR';
const clean = async () => {
  await query(`delete from newhire_journey_tasks where journey_id in
     (select id from newhire_journeys where full_name like $1)`, [`${MARK}%`]).catch(() => {});
  await query('delete from newhire_journeys where full_name like $1', [`${MARK}%`]);
};
await clean();

fs.rmSync(`${ROOT}/chrome-obhr`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-obhr`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 1800) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0].slice(0, 150)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().split('\n')[0].slice(0, 150));
});

const as = async (user, path = '/onboarding') => {
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
const fillByLabel = (label, value) => page.evaluate(([l, v]) => {
  const wrap = [...document.querySelectorAll('label')].find((x) => x.innerText.trim().startsWith(l));
  const el = wrap?.parentElement?.querySelector('input, textarea, select');
  if (!el) return false;
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
    : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  return true;
}, [label, value]);

const NAME = `${MARK} พนักงานใหม่ทดสอบ`;

// ── 1. เปิดหน้าฝั่ง HR ────────────────────────────────────────────────────
suite('1. เปิดหน้าปฐมนิเทศฝั่ง HR ได้');
{
  await as(A);
  const t = await body();
  happy('หน้าไม่ล้ม', !t.includes('เกิดข้อผิดพลาดบางอย่าง'), t.slice(0, 70).replace(/\n/g, ' | '));
  happy('มีแท็บพนักงานใหม่ คลังข้อมูล และแผน 30-60-90',
    ['พนักงานใหม่', 'คลังข้อมูล', 'แผน 30-60-90'].every((k) => t.includes(k)), '');
  bad('ไม่มี error ตอนเปิดหน้า', errors.length === 0, errors.slice(0, 2).join(' / '));
  await shot('01-หน้าแรก');
}

// ── 2. เพิ่มพนักงานใหม่ ──────────────────────────────────────────────────
suite('2. เพิ่มพนักงานใหม่แล้วได้แผนติดตามอัตโนมัติ');
{
  happy('กดเพิ่มพนักงานใหม่ได้', await click('เพิ่มพนักงานใหม่'), '');
  await settle(1400);
  happy('ฟอร์มขอชื่อและวันเริ่มงาน', (await body()).includes('ชื่อ-นามสกุล') && (await body()).includes('วันเริ่มงาน'), '');
  await fillByLabel('ชื่อ-นามสกุล', NAME);
  await fillByLabel('ตำแหน่ง', 'ช่างเทคนิค');
  await settle(500);
  await shot('02-ฟอร์มพนักงานใหม่');
  happy('กดสร้างแผนติดตามได้', await click('สร้างแผนติดตาม'), '');
  await settle(3200);

  const j = (await query('select * from newhire_journeys where full_name = $1', [NAME])).rows[0];
  happy('บันทึกพนักงานใหม่ลงระบบจริง', !!j, '');
  happy('วันเริ่มงานเป็นวันนี้ ไม่ใช่เมื่อวาน', (() => {
    if (!j?.start_date) return false;
    const d = new Date(j.start_date); const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  })(), String(j?.start_date));
  const tasks = (await query('select count(*)::int n from newhire_journey_tasks where journey_id = $1', [j?.id]))
    .rows[0]?.n ?? 0;
  happy('สร้างรายการงานตามแผนให้อัตโนมัติ', tasks > 0, `${tasks} งาน`);
  happy('รายชื่อบนหน้าจอขึ้นพนักงานใหม่', (await body()).includes(NAME), '');
  await shot('03-รายชื่อ');
}

// ── 3. เปิดแผนติดตามและติ๊กงาน ───────────────────────────────────────────
suite('3. ติ๊กงานแล้วความคืบหน้าขยับตาม');
{
  happy('กดชื่อเพื่อเปิดแผนติดตามได้', await click(NAME), '');
  await settle(2600);
  const t = await body();
  happy('เห็นแผนแบ่งเป็น 30 / 60 / 90 วัน',
    t.includes('30 วัน') && t.includes('60 วัน') && t.includes('90 วัน'), '');
  happy('เห็นเปอร์เซ็นต์ความคืบหน้า', /\d+%/.test(t), '');
  await shot('04-แผนติดตาม');

  const pct = () => page.evaluate(() => Number((document.body.innerText.match(/(\d+)%/) || [])[1] ?? -1));
  const before = await pct();
  const ticked = await page.evaluate(() => {
    const box = [...document.querySelectorAll('input[type=checkbox]')].find((c) => !c.checked);
    if (!box) return false;
    box.click(); return true;
  });
  happy('ติ๊กงานแรกได้', ticked, '');
  await settle(2600);
  const after = await pct();
  happy(`ความคืบหน้าเพิ่มขึ้นจริง (${before}% → ${after}%)`, after > before, `${before} → ${after}`);
  const done = (await query(
    `select count(*)::int n from newhire_journey_tasks where journey_id =
       (select id from newhire_journeys where full_name = $1) and done = true`, [NAME])).rows[0].n;
  happy('บันทึกลงระบบว่าทำงานนั้นแล้ว', done === 1, `${done} งาน`);
  await shot('05-ติ๊กงาน');

  // ติ๊กออกก็ต้องกลับมาเหมือนเดิม
  await page.evaluate(() => {
    const box = [...document.querySelectorAll('input[type=checkbox]')].find((c) => c.checked);
    if (box) box.click();
  });
  await settle(2600);
  const back = await pct();
  happy(`ติ๊กออกแล้วความคืบหน้าลดกลับ (${after}% → ${back}%)`, back === before, `${after} → ${back}`);
}

// ── 4. แบบประเมินทดลองงาน ────────────────────────────────────────────────
suite('4. กรอกแบบประเมินทดลองงานแล้วบันทึกได้');
{
  const t = await body();
  happy('เห็นแบบประเมินทดลองงาน', t.includes('แบบประเมินทดลองงาน'), '');
  happy('มีคะแนนรายด้านให้ให้คะแนน', t.includes('คะแนนรายด้าน'), '');
  await fillByLabel('ผู้ประเมิน', `${MARK} หัวหน้างาน`);
  // ให้คะแนน 4 ทุกด้าน
  const scored = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('div')].filter((d) => d.className.includes('rounded-lg')
      && [...d.querySelectorAll('button')].map((b) => b.innerText.trim()).join('') === '12345');
    rows.forEach((r) => { const b = [...r.querySelectorAll('button')].find((x) => x.innerText.trim() === '4'); if (b) b.click(); });
    return rows.length;
  });
  happy(`ให้คะแนนได้ครบทุกด้าน (${scored} ด้าน)`, scored === 5, `${scored}`);
  await fillByLabel('จุดเด่น', 'เรียนรู้เร็ว');
  await fillByLabel('สิ่งที่ควรพัฒนา', 'ความละเอียด');
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'pass'));
    if (!sel) return;
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, 'pass');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle(600);
  await shot('06-กรอกประเมิน');
  happy('กดบันทึกผลประเมินได้', await click('บันทึกผลประเมิน'), '');
  await settle(3000);

  const j = (await query('select * from newhire_journeys where full_name = $1', [NAME])).rows[0];
  const scores = typeof j.review_scores === 'string' ? JSON.parse(j.review_scores) : j.review_scores;
  happy('ผลประเมินถูกบันทึกลงระบบ', !!j.review_reviewed_at || !!j.review_result, `${j.review_result}`);
  happy('บันทึกผู้ประเมินไว้', String(j.review_reviewer || '').includes(MARK), `${j.review_reviewer}`);
  happy('บันทึกผลสรุปว่าผ่านทดลองงาน', j.review_result === 'pass', `${j.review_result}`);
  happy('บันทึกคะแนนรายด้านครบห้าด้าน', Object.keys(scores || {}).length === 5, JSON.stringify(scores || {}));
  happy('บันทึกจุดเด่นที่พิมพ์ไว้', String(j.review_strengths || '').includes('เรียนรู้เร็ว'), `${j.review_strengths}`);
  happy('หน้าจอขึ้นผลล่าสุดให้เห็น', (await body()).includes('ผ่านทดลองงาน'), '');
  await shot('07-บันทึกประเมิน');
}

// ── 5. คลังข้อมูลและแผนมาตรฐาน ───────────────────────────────────────────
suite('5. คลังข้อมูลและแผนมาตรฐานเปิดใช้ได้');
{
  await as(A);
  happy('เปิดแท็บคลังข้อมูลได้', await click('คลังข้อมูล'), '');
  await settle(2400);
  const t = await body();
  happy('หน้าคลังข้อมูลไม่ล้ม', !t.includes('เกิดข้อผิดพลาดบางอย่าง'), t.slice(0, 60).replace(/\n/g, ' | '));
  await shot('08-คลังข้อมูล');

  happy('เปิดแท็บแผน 30-60-90 ได้', await click('แผน 30-60-90'), '');
  await settle(2400);
  const t2 = await body();
  happy('เห็นแผนแบ่งตามช่วงวัน', /30|60|90/.test(t2), '');
  happy('หน้าแผนไม่ล้ม', !t2.includes('เกิดข้อผิดพลาดบางอย่าง'), '');
  await shot('09-แผนมาตรฐาน');
}

// ── 6. ไม่มีข้อผิดพลาดซ่อนอยู่ ───────────────────────────────────────────
suite('6. ไม่มีข้อผิดพลาดซ่อนอยู่');
{
  bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' / '));
}

// ── 7. เก็บกวาด ──────────────────────────────────────────────────────────
suite('7. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await clean();
  const left = (await query('select count(*)::int n from newhire_journeys where full_name like $1', [`${MARK}%`])).rows[0].n;
  happy('ลบพนักงานทดสอบหมดแล้ว', left === 0, `${left}`);
}

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
