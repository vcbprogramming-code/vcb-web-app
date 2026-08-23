/**
 * ระบบลางาน on screen: file one, decide it, and see it land in the work log.
 *
 * The API suite proves the rules. This one asks whether a person can actually
 * get through the task — find the tab, pick a name, and be told what happened.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { call, suite, happy, bad, report, U, warm, APP, tok, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/leave`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();
const { admin: A, hr: H } = U;
const MARK = 'ZZTEST';

// one employee to file leave for, on a site the tester can see
const unit = (await query('select id, code, name from units where code is not null order by code limit 1')).rows[0];
const emp = (await query(
  `insert into employees (full_name, employee_code, unit_id, is_active, kind)
   values ($1,'ZZUI1',$2,true,'operation') returning id`, [`${MARK} พนักงานทดสอบลา`, unit.id])).rows[0];

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-profile`,
  defaultViewport: { width: 1440, height: 1000 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
const settle = (ms = 2500) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const as = async (u) => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(u));
  await page.goto(`${APP}/performance`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3800);
};
const clickText = (t) => page.evaluate((x) => {
  const el = [...document.querySelectorAll('button')].filter((b) => b.innerText.trim().includes(x))
    .sort((a, b) => a.innerText.length - b.innerText.length)[0];
  if (el) { el.click(); return true; } return false;
}, t);

let reqId = null;

// ── 1. ยื่นคำขอจากหน้าจอ ───────────────────────────────────────────────────
suite('1. ยื่นคำขอลาจากหน้าจอ');
{
  await as(A);
  happy('มีแท็บ "การลา" ในโมดูล', (await body()).includes('การลา'), '');
  await clickText('การลา');
  await settle(3000);
  const t = await body();
  happy('เห็นฟอร์มขอลาใหม่', t.includes('ขอลาใหม่'), '');
  happy('มีให้เลือกประเภทการลา', t.includes('ประเภทการลา'), '');
  await shot('01-ฟอร์มขอลา');

  // pick the site that has our test employee, then fill the form
  await page.evaluate((code) => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === code));
    if (sel) { sel.value = code; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  }, unit.code);
  await settle(2500);

  const filled = await page.evaluate((empId) => {
    const set = (el, v) => {
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const empSel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === empId));
    if (!empSel) return false;
    set(empSel, empId);
    const dates = [...document.querySelectorAll('input[type="date"]')];
    if (dates.length < 2) return false;
    set(dates[0], '2027-03-01');
    set(dates[1], '2027-03-03');
    return true;
  }, emp.id);
  happy('เลือกพนักงานและช่วงวันที่ได้', filled, '');
  await settle(800);
  happy('บอกจำนวนวันรวมให้เห็น', (await body()).includes('รวม 3 วัน'), '');

  await clickText('ส่งคำขอลา');
  await settle(3500);
  const after = await body();
  happy('ส่งแล้วขึ้นในรายการคำขอของฉัน', after.includes(`${MARK} พนักงานทดสอบลา`), '');
  happy('สถานะเป็นรออนุมัติ', after.includes('รออนุมัติ'), '');
  await shot('02-ส่งคำขอแล้ว');

  const row = await query(`select id from leave_requests where employee_id = $1 order by requested_at desc limit 1`, [emp.id]);
  reqId = row.rows[0]?.id;
  happy('บันทึกลงฐานข้อมูลจริง', Boolean(reqId), '');
}

// ── 2. ผู้อนุมัติเห็นและตัดสิน ─────────────────────────────────────────────
suite('2. ผู้อนุมัติเห็นคิวและตัดสินได้');
{
  await as(A);
  await clickText('การลา');
  await settle(3000);
  const t = await body();
  happy('ผู้ดูแลเห็นแท็บรออนุมัติ', t.includes('รออนุมัติ'), '');
  happy('เห็นคำขอที่เพิ่งยื่น', t.includes(`${MARK} พนักงานทดสอบลา`), '');
  await shot('03-คิวรออนุมัติ');

  await clickText('รออนุมัติ');
  await settle(2000);
  const hasBtn = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'อนุมัติ'));
  happy('มีปุ่มอนุมัติและไม่อนุมัติ', hasBtn, '');
}

// ── 3. อนุมัติแล้วเข้าตารางงาน ─────────────────────────────────────────────
suite('3. อนุมัติแล้ววันลาเข้าตารางงาน');
{
  await call(`/performance/leave/${reqId}/decide`, { method: 'POST', user: A, body: { approve: true } });
  const away = await query('select ymd from employee_away where leave_request_id = $1', [reqId]);
  happy('เขียนวันลาลงตารางงาน 3 วัน', away.rows.length === 3, `${away.rows.length}`);

  await as(A);
  await clickText('การลา');
  await settle(2800);
  await clickText('ประวัติการพิจารณา');
  await settle(2000);
  happy('ขึ้นในประวัติการพิจารณาว่าอนุมัติแล้ว', (await body()).includes('อนุมัติแล้ว'), '');
  await shot('04-ประวัติ');
}

// ── 3b. ปุ่มใบลาบนหน้าจอ ───────────────────────────────────────────────────
suite('3b. ปุ่มใบลาอยู่บนทุกแถว');
{
  await as(A);
  await clickText('การลา');
  await settle(3000);
  const has = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'ใบลา'));
  happy('มีปุ่มใบลาให้กดพิมพ์', has, '');
  await shot('06-ปุ่มใบลา');
}

// ── 4. หน้าผูกหัวหน้า-ลูกน้อง ──────────────────────────────────────────────
suite('4. หน้าตั้งค่าหัวหน้า-ลูกน้อง');
{
  await as(A);
  await clickText('ตั้งค่า');
  await settle(3000);
  const t = await body();
  happy('มีส่วนตั้งค่าผู้อนุมัติการลา', t.includes('ผู้อนุมัติการลา'), '');
  happy('อธิบายวิธีใช้ให้ผู้ดูแลเข้าใจ', t.includes('เลือกหัวหน้าหนึ่งคน'), '');
  happy('เตือนว่ามีพนักงานที่ยังไม่มีหัวหน้า', /ยังไม่มีหัวหน้า/.test(t), '');
  await shot('05-ผูกหัวหน้า');
}

await browser.close();
await query('delete from leave_requests where employee_id = $1', [emp.id]);
await query('delete from employees where id = $1', [emp.id]);
const left = await query('select count(*)::int n from employees where full_name like $1', [`%${MARK}%`]);
suite('5. เก็บกวาด');
happy('ลบข้อมูลทดสอบแล้ว', left.rows[0].n === 0, `${left.rows[0].n}`);

process.exit(report(`${ROOT}/leave.ui.json`) ? 1 : 0);
