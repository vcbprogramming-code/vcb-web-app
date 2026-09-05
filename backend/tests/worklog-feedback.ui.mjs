/**
 * HR Work Log — the seven things the client found while clicking through the
 * module, each proved fixed the same way they were found: by clicking.
 *
 * They were all invisible to the API suite, because every one of them is a
 * screen problem — a value that did not refresh, a count with nothing behind
 * it, a locked month that still looked open, a log that printed JSON at a
 * person. So this suite reads the DOM, the computed colours and the files that
 * land on disk, not the responses.
 */
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, API, tok, query, call } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/worklog-feedback`;
const DL = `${SHOTS}/downloads`;
fs.rmSync(DL, { recursive: true, force: true });
fs.mkdirSync(DL, { recursive: true });
await warm();

// ชุดนี้ตรวจความสามารถที่มาจาก "เอกสารเกณฑ์ตรวจรับ" ซึ่งตอนนี้ปิดไว้เป็นค่า
// เริ่มต้น เพราะระบบที่ลูกค้าใช้จริงไม่มี — โค้ดยังอยู่ครบและเปิดกลับได้
// ต้องรัน API ด้วย WORKLOG_FEATURES=all จึงจะทดสอบส่วนนี้ได้
{
  const boot = await call('/performance/bootstrap', { user: U.admin });
  const need = ['verify','periodClose','mandayEntry','attachments','employeeImport','leaveAttachment'];
  const off = need.filter((f) => !boot.features?.[f]);
  if (off.length) {
    console.log(`\nข้าม ${off.length} ความสามารถที่ปิดอยู่: ${off.join(', ')}`);
    console.log('ตั้ง WORKLOG_FEATURES=all ที่ฝั่ง API แล้วรันใหม่เพื่อทดสอบส่วนนี้');
    // พิมพ์บรรทัดสรุปด้วย ไม่งั้นตัวรันรวมอ่านผลไม่เจอแล้วนับว่าชุดนี้ล้ม
    process.exit(report());
  }
}

const { admin: A } = U;
const MARK = 'ZZFB';
const d = new Date();
const TODAY = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const YM = TODAY.slice(0, 7);

// ── ข้อมูลทดสอบ ───────────────────────────────────────────────────────────
const clean = async () => {
  await query('delete from work_log_attachments where unit_id in (select id from units where code like $1)', [`${MARK}%`]);
  await query('delete from work_log_audit where unit_id in (select id from units where code like $1)', [`${MARK}%`]);
  await query('delete from work_logs where unit_id in (select id from units where code like $1)', [`${MARK}%`]);
  await query('delete from leave_requests where employee_id in (select id from employees where employee_code like $1)', [`${MARK}%`]);
  await query('delete from employee_away where employee_id in (select id from employees where employee_code like $1)', [`${MARK}%`]);
  await query('delete from period_closes where unit_id in (select id from units where code like $1)', [`${MARK}%`]);
  await query('delete from employees where employee_code like $1', [`${MARK}%`]);
};
await clean();

const site = (await query(
  `insert into units (name, code, lock_days) values ($1,$2,3)
   on conflict (code) do update set lock_days = 3, name = excluded.name returning *`,
  [`${MARK} ไซต์ตรวจข้อเสนอแนะ`, `${MARK}-site`])).rows[0];
const NAMES = ['กิตติ ปูน', 'มานะ เหล็ก', 'ชูใจ สำรวจ', 'ปรีชา ไฟฟ้า'];
const emps = [];
for (const [i, n] of NAMES.entries()) {
  emps.push((await query(
    `insert into employees (unit_id, full_name, employee_code, kind, is_active)
     values ($1,$2,$3,'operation',true) returning *`,
    [site.id, `${MARK} ${n}`, `${MARK}-${String(i + 1).padStart(3, '0')}`])).rows[0]);
}
await query('insert into profile_units (profile_id, unit_id) values ($1,$2) on conflict do nothing', [A.id, site.id]);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-profile`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
const settle = (ms = 2200) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const as = async (user, path = '/performance') => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((tk) => { localStorage.clear(); localStorage.setItem('hr_access_token', tk); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3200);
};
const waitForText = async (needle, tries = 25) => {
  for (let i = 0; i < tries; i += 1) {
    if ((await body()).includes(needle)) return true;
    await settle(400);
  }
  return false;
};
const clickText = async (label, sel = 'button, a, [role="tab"], label') => page.evaluate((l, s) => {
  const el = [...document.querySelectorAll(s)].find((x) => x.innerText.trim().includes(l));
  if (el) { el.click(); return true; }
  return false;
}, label, sel);
const pickSite = async () => page.evaluate((name) => {
  const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.text.includes(name)));
  if (!sel) return false;
  const opt = [...sel.options].find((o) => o.text.includes(name));
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, `${MARK} ไซต์ตรวจ`);
const openManday = async () => {
  await as(A);
  await pickSite(); await settle(1600);
  await clickText('แรงงาน-วัน'); await settle(2800);
};
const waitFile = async (tries = 25) => {
  for (let i = 0; i < tries; i += 1) {
    const f = fs.readdirSync(DL).filter((x) => !x.endsWith('.crdownload'));
    if (f.length) return f;
    await settle(400);
  }
  return [];
};

// ── ข้อ 2 กดบันทึกทั้งทีมแล้วทุกช่องต้องขึ้นค่าใหม่ ─────────────────────────
suite('ข้อ 2 บันทึกทั้งทีมแล้วช่องแรงงาน-วันอัปเดตครบทุกคน');
{
  await openManday();
  const roster = await body();
  happy('เห็นรายชื่อพนักงานของไซต์นี้', NAMES.every((n) => roster.includes(n)), '');
  happy('กด "เลือกทั้งหมด" ได้', await clickText('เลือกทั้งหมด'), '');
  await settle(700);
  happy('กด "บันทึกให้ทุกคนที่เลือก" ได้', await clickText('บันทึกให้ทุกคนที่เลือก'), '');
  await settle(3600);

  const saved = await query(
    'select count(*)::int n from work_logs where unit_id = $1 and ymd = $2 and man_day = 1 and deleted_at is null',
    [site.id, TODAY]);
  happy('บันทึกลงระบบครบทั้งทีม', saved.rows[0].n === NAMES.length, `${saved.rows[0].n} คน`);

  // นี่คือจุดที่ผู้ใช้เจอปัญหา — ฐานข้อมูลถูกแล้วแต่หน้าจอยังว่างอยู่
  const shown = await page.evaluate(() =>
    [...document.querySelectorAll('table tbody input[type=number]')].map((i) => i.value));
  happy(`ทุกช่องบนหน้าจอขึ้นค่า 1 ครบ ${shown.length} ช่อง`,
    shown.length >= NAMES.length && shown.every((v) => Number(v) === 1), shown.join(' · '));
  await shot('01-บันทึกทั้งทีม-ค่าขึ้นครบ');
}

// ── ข้อ 4 แนบไฟล์แล้วต้องเปิดและดาวน์โหลดได้ ────────────────────────────────
suite('ข้อ 4 ไฟล์ที่แนบในหน้าแรงงาน-วัน เปิดและดาวน์โหลดได้');
{
  const tmp = `${SHOTS}/ใบส่งของ.txt`;
  fs.writeFileSync(tmp, 'หลักฐานการทำงานประจำวัน');
  const input = await page.$('table tbody input[type=file]');
  happy('มีช่องแนบไฟล์ในแถวพนักงาน', Boolean(input), '');
  if (input) { await input.uploadFile(tmp); }
  happy('ระบบรับไฟล์แล้ว', await waitForText('แนบไฟล์แล้ว'), '');
  await settle(2200);

  const stored = await query('select * from work_log_attachments where unit_id = $1 order by created_at desc limit 1', [site.id]);
  happy('ไฟล์ถูกเก็บพร้อมชื่อไทย', stored.rows[0]?.file_name === 'ใบส่งของ.txt', stored.rows[0]?.file_name || '—');

  // ตัวเลขจำนวนไฟล์ต้องกดได้ ไม่ใช่ตัวหนังสือเฉย ๆ
  const clickable = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('table tbody button')]
      .filter((b) => b.querySelector('svg') && /^\d+$/.test(b.innerText.trim()));
    if (!btns.length) return false;
    btns[0].click(); return true;
  });
  happy('ตัวเลขจำนวนไฟล์กดได้ (ไม่ใช่แค่ตัวเลข)', clickable, '');
  await settle(900);
  happy('กดแล้วเห็นชื่อไฟล์ที่แนบไว้', (await body()).includes('ใบส่งของ.txt'), '');
  await shot('02-รายการไฟล์แนบ');

  const dl = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.title === 'ดาวน์โหลด');
    if (btn) { btn.click(); return true; } return false;
  });
  happy('มีปุ่มดาวน์โหลดในรายการไฟล์', dl, '');
  const files = await waitFile();
  happy('ไฟล์ถูกดาวน์โหลดลงเครื่องจริง', files.some((f) => f.includes('ใบส่งของ')), files.join(', ') || 'ไม่มีไฟล์');

  const removed = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'ลบ');
    if (b) { b.click(); return true; } return false;
  });
  happy('มีปุ่มลบไฟล์ที่แนบผิด', removed, '');
  await settle(900);
}

// ── ข้อ 3 ปุ่มยืนยันเขียว ปุ่มยกเลิกแดง ─────────────────────────────────────
suite('ข้อ 3 สีปุ่มยืนยันกับยกเลิกแยกกันชัดเจน');
{
  const rgb = (v) => (String(v).match(/\d+/g) || []).map(Number);
  const isRed = (v) => { const [r, g, b] = rgb(v); return r > 120 && r > g + 40 && r > b + 40; };
  const isGreen = (v) => { const [r, g, b] = rgb(v); return g > 90 && g > r + 30 && g > b + 30; };
  // อ่านสีจากปุ่มในกล่องยืนยันเท่านั้น — หน้าจอข้างหลังก็มีปุ่มชื่อเดียวกันอยู่
  const dialogButtons = () => page.evaluate(() => {
    const dlg = [...document.querySelectorAll('div')]
      .filter((x) => [...x.querySelectorAll('button')].some((b) => b.innerText.trim() === 'ยกเลิก'))
      .sort((a, b) => a.querySelectorAll('button').length - b.querySelectorAll('button').length)[0];
    if (!dlg) return [];
    return [...dlg.querySelectorAll('button')].filter((b) => b.innerText.trim()).map((b) => {
      const c = getComputedStyle(b);
      return { text: b.innerText.trim(), bg: c.backgroundColor, fg: c.color, border: c.borderTopColor };
    });
  });

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'ยกเลิก');
    if (b) b.click();
  });
  await openManday();

  // ก) กล่องยืนยันทั่วไป — เดินหน้าเขียว ถอยหลังแดง
  happy('กล่องยืนยันปิดงวดเปิดขึ้นมา', (await clickText('ปิดงวด')) && (await waitForText('แก้ไขไม่ได้อีก')), '');
  await settle(900);
  const b1 = await dialogButtons();
  const go1 = b1.find((x) => x.text === 'ปิดงวด');
  const no1 = b1.find((x) => x.text === 'ยกเลิก');
  happy('ปุ่ม "ปิดงวด" เป็นสีเขียว', Boolean(go1) && isGreen(go1.bg), JSON.stringify(go1));
  happy('ปุ่ม "ยกเลิก" เป็นสีแดง', Boolean(no1) && (isRed(no1.fg) || isRed(no1.border)), JSON.stringify(no1));
  await shot('03a-สีปุ่มยืนยันทั่วไป');
  await clickText('ยกเลิก');
  await settle(1000);
  const notClosed = await query('select count(*)::int n from period_closes where unit_id = $1', [site.id]);
  bad('กดยกเลิกแล้วไม่ปิดงวด', notClosed.rows[0].n === 0, `${notClosed.rows[0].n}`);

  // ข) กล่องยืนยันของงานที่ลบทิ้ง — สีแดงต้องอยู่ที่ปุ่มเดียว ไม่ใช่ทั้งสองปุ่ม
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('table tbody button')].find((x) => /^\d+$/.test(x.innerText.trim()));
    if (b) b.click();
  });
  await settle(700);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'ลบ');
    if (b) b.click();
  });
  happy('กล่องยืนยันการลบเปิดขึ้นมา', await waitForText('ลบไฟล์แนบ'), '');
  await settle(900);
  const b2 = await dialogButtons();
  const go2 = b2.find((x) => x.text === 'ลบ');
  const no2 = b2.find((x) => x.text === 'ยกเลิก');
  happy('ปุ่มลบเป็นสีแดงเต็มใบ', Boolean(go2) && isRed(go2.bg), JSON.stringify(go2));
  bad('ไม่มีปุ่มแดงสองปุ่มให้สับสน', Boolean(no2) && !isRed(no2.bg) && !isRed(no2.fg), JSON.stringify(no2));
  happy('สองปุ่มต่างกันชัดเจน', Boolean(go2) && Boolean(no2) && go2.bg !== no2.bg, '');
  await shot('03b-สีปุ่มยืนยันการลบ');
  await clickText('ยกเลิก');
  await settle(900);
  const still = await query('select count(*)::int n from work_log_attachments where unit_id = $1', [site.id]);
  bad('กดยกเลิกแล้วไม่ลบไฟล์', still.rows[0].n === 1, `${still.rows[0].n} ไฟล์`);
}

// ── ข้อ 5 ปิดงวดแล้วต้องแก้ไขไม่ได้จริง ─────────────────────────────────────
suite('ข้อ 5 ปิดงวดแล้วหน้าจอต้องแก้ไขไม่ได้');
{
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'ยกเลิก'); if (b) b.click(); });
  await settle(800);
  await query(
    `insert into period_closes (unit_id, ym, closed_by) values ($1,$2,$3)
     on conflict (unit_id, ym) do nothing`, [site.id, YM, A.id]);
  await openManday();

  happy('หน้าจอบอกว่าปิดงวดแล้ว', (await body()).includes('ปิดงวดแล้ว'), '');
  happy('มีคำอธิบายว่าทำอย่างไรต่อ', (await body()).includes('ต้องเปิดงวดคืนก่อน'), '');
  const state = await page.evaluate(() => {
    const nums = [...document.querySelectorAll('table tbody input[type=number]')];
    const sels = [...document.querySelectorAll('table tbody select')];
    const save = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('บันทึกให้ทุกคนที่เลือก'));
    return {
      nums: nums.length, numsOff: nums.filter((i) => i.disabled).length,
      sels: sels.length, selsOff: sels.filter((i) => i.disabled).length,
      saveOff: save ? save.disabled : null,
    };
  });
  bad(`ช่องแรงงาน-วันถูกล็อกทุกช่อง (${state.numsOff}/${state.nums})`, state.nums > 0 && state.numsOff === state.nums, JSON.stringify(state));
  bad(`ช่องสถานะถูกล็อกทุกช่อง (${state.selsOff}/${state.sels})`, state.sels > 0 && state.selsOff === state.sels, JSON.stringify(state));
  bad('ปุ่มบันทึกทั้งทีมถูกปิด', state.saveOff === true, String(state.saveOff));
  await shot('04-ปิดงวดแล้วแก้ไม่ได้');

  // และเซิร์ฟเวอร์ก็ต้องปฏิเสธ ไม่ใช่ล็อกแค่หน้าจอ
  const before = await query('select man_day from work_logs where unit_id = $1 and employee_id = $2 and ymd = $3', [site.id, emps[0].id, TODAY]);
  const res = await page.evaluate(async (a) => {
    const r = await fetch('/api/performance/day', {
      method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${a.tk}` },
      body: JSON.stringify({ site: a.site, eid: a.eid, date: a.date, manDay: 0.25 }),
    });
    return r.status;
  }, { tk: tok(A), site: site.code, eid: emps[0].id, date: TODAY });
  bad('เซิร์ฟเวอร์ปฏิเสธการบันทึกในงวดที่ปิดแล้ว', res >= 400, `HTTP ${res}`);
  const after = await query('select man_day from work_logs where unit_id = $1 and employee_id = $2 and ymd = $3', [site.id, emps[0].id, TODAY]);
  bad('ค่าเดิมไม่ถูกเปลี่ยน', String(before.rows[0]?.man_day) === String(after.rows[0]?.man_day), `${before.rows[0]?.man_day} → ${after.rows[0]?.man_day}`);

  await query('delete from period_closes where unit_id = $1 and ym = $2', [site.id, YM]);
}

// ── ข้อ 6 ไฟล์แนบใบลา และใครเป็นผู้อนุมัติ ─────────────────────────────────
suite('ข้อ 6 ใบรับรองแพทย์เปิด/ดาวน์โหลดได้ และรู้ว่าใครอนุมัติ');
{
  // ยื่นใบลาพร้อมไฟล์แนบแบบ multipart เหมือนที่หน้าจอส่ง
  const fd = new FormData();
  fd.append('file', new Blob([Buffer.from('ใบรับรองแพทย์ตัวอย่าง')], { type: 'text/plain' }), 'ใบรับรองแพทย์.txt');
  fd.append('employeeId', emps[1].id);
  fd.append('leaveType', 'sick');
  fd.append('from', TODAY); fd.append('to', TODAY);
  fd.append('reason', `${MARK} ไปโรงพยาบาล`);
  const res = await fetch(`${API}/performance/leave`, {
    method: 'POST', headers: { Authorization: `Bearer ${tok(A)}` }, body: fd,
  });
  happy('ยื่นใบลาพร้อมไฟล์แนบได้', res.status === 200 || res.status === 201, `HTTP ${res.status}`);
  const leave = (await query(
    'select * from leave_requests where employee_id = $1 order by requested_at desc limit 1', [emps[1].id])).rows[0];
  happy('ใบลามีไฟล์แนบติดมาด้วย', Boolean(leave?.attachment_url), leave?.attachment_name || '—');

  await as(A, '/performance?tab=leave');
  await waitForText('คำขอของฉัน');
  await settle(1500);
  const txt = await body();
  happy('หน้าการลาแสดงชื่อไฟล์แนบ ไม่ใช่ซ่อนไว้', txt.includes('ใบรับรองแพทย์.txt'), '');
  happy('บอกว่าใครเป็นผู้อนุมัติคำขอนี้', /รอ\s.+\sอนุมัติ/.test(txt.replace(/\n/g, ' ')),
    (txt.split('\n').find((l) => l.startsWith('รอ')) || '—'));
  await shot('05-ใบลามีไฟล์แนบและชื่อผู้อนุมัติ');

  fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.title === 'ดาวน์โหลดไฟล์แนบ');
    if (b) { b.click(); return true; } return false;
  });
  happy('มีปุ่มดาวน์โหลดไฟล์แนบของใบลา', clicked, '');
  const got = await waitFile();
  happy('ดาวน์โหลดใบรับรองแพทย์ได้จริง', got.some((f) => f.includes('ใบรับรองแพทย์')), got.join(', ') || 'ไม่มีไฟล์');

  const opened = await page.evaluate(() => Boolean(
    [...document.querySelectorAll('button')].find((x) => x.title === 'เปิดไฟล์แนบ')));
  happy('มีปุ่มเปิดดูไฟล์แนบในหน้าจอเดียวกัน', opened, '');

  // อนุมัติแล้วต้องบอกชื่อคนอนุมัติ ไม่ใช่แค่สถานะ
  await query(
    `update leave_requests set status='approved', decided_by=$2, decided_at=now() where id=$1`, [leave.id, A.id]);
  await as(A, '/performance?tab=leave');
  await waitForText('คำขอของฉัน'); await settle(1500);
  const t2 = await body();
  happy('หลังอนุมัติแล้วบอกชื่อผู้อนุมัติและวันที่', t2.includes('อนุมัติแล้ว') && t2.includes(A.name), '');
  await shot('06-ใบลาอนุมัติแล้วรู้ว่าใครอนุมัติ');
}

// ── ข้อ 7 ประวัติการแก้ไขต้องอ่านรู้เรื่อง ─────────────────────────────────
suite('ข้อ 7 ค่าเดิม → ค่าใหม่ ในประวัติอ่านเข้าใจได้');
{
  // ต้องมีรายการ "แก้ไข" จริงเสียก่อน ประวัติของการสร้างครั้งแรกไม่มีค่าเดิมให้เทียบ
  await openManday();
  await page.evaluate(() => {
    const box = document.querySelector('table tbody input[type=number]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(box, '0.5');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new Event('focusout', { bubbles: true }));
  });
  await settle(3000);

  await clickText('รายงาน'); await settle(3000);
  happy('เปิดแท็บรายงานได้', (await body()).includes('ประวัติการแก้ไข') || (await body()).includes('ผู้ทำรายการ'), '');

  const cells = await page.evaluate(() => {
    const table = [...document.querySelectorAll('table')]
      .find((tb) => [...tb.querySelectorAll('th')].some((h) => h.innerText.includes('ค่าเดิม')));
    if (!table) return null;
    const heads = [...table.querySelectorAll('th')].map((h) => h.innerText.trim());
    const i = heads.findIndex((h) => h.includes('ค่าเดิม'));
    return [...table.querySelectorAll('tbody tr')].slice(0, 12)
      .map((r) => r.children[i]?.innerText.trim() || '').filter(Boolean);
  });
  happy('พบคอลัมน์ค่าเดิม/ค่าใหม่', Array.isArray(cells) && cells.length > 0, `${cells?.length ?? 0} แถว`);
  const raw = (cells || []).filter((c) => /[{}"]|null|undefined/.test(c));
  bad('ไม่มี JSON ดิบโผล่ให้ผู้ใช้เห็น', raw.length === 0, raw.slice(0, 2).join(' | '));
  const thai = (cells || []).some((c) => /แรงงาน-วัน|สถานะการทำงาน|จำนวนรายการ|งวดเดือน|ชั่วโมง|ทีม/.test(c));
  happy('อธิบายเป็นชื่อฟิลด์ภาษาไทย', thai, (cells || []).slice(0, 3).join(' | '));
  const arrow = (cells || []).some((c) => c.includes('→'));
  happy('แสดงเป็น "ค่าเดิม → ค่าใหม่"', arrow, (cells || []).find((c) => c.includes('→')) || '—');
  await shot('07-ประวัติอ่านรู้เรื่อง');
}

// ── ข้อ 1 นำเข้าแล้วต้องรู้ว่าคนที่เพิ่มมาอยู่ตรงไหน ────────────────────────
suite('ข้อ 1 นำเข้าพนักงานแล้วรู้ว่าไปอยู่โครงการไหน และไปดูต่อได้');
{
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('พนักงาน');
  ws.columns = [{ header: 'รหัสพนักงาน', key: 'code' }, { header: 'ชื่อ-สกุล', key: 'name' },
    { header: 'โครงการ', key: 'site' }, { header: 'ประเภท', key: 'kind' }, { header: 'สถานะ', key: 'status' }];
  ws.addRow({ code: `${MARK}-901`, name: `${MARK} สมปอง นำเข้า`, site: site.code, kind: 'ปฏิบัติการ', status: 'ปฏิบัติงาน' });
  ws.addRow({ code: `${MARK}-902`, name: `${MARK} วิภา นำเข้า`, site: site.code, kind: 'สนับสนุน', status: 'ปฏิบัติงาน' });
  const xlsx = `${SHOTS}/นำเข้าพนักงาน.xlsx`;
  await wb.xlsx.writeFile(xlsx);

  await as(A);
  await clickText('ตั้งค่า'); await settle(3000);
  const fileInput = await page.$('input[accept=".xlsx"]');
  happy('มีช่องเลือกไฟล์นำเข้า', Boolean(fileInput), '');
  if (fileInput) { await fileInput.uploadFile(xlsx); await settle(1200); }

  happy('กด "ตรวจไฟล์ก่อน" ได้', await clickText('ตรวจไฟล์ก่อน'), '');
  await settle(3000);
  happy('ขั้นตอนตรวจไฟล์บอกล่วงหน้าว่าจะเข้าโครงการไหน',
    (await body()).includes('รายชื่อเหล่านี้จะเข้าโครงการ') && (await body()).includes(site.name), '');
  await shot('08-ตรวจไฟล์บอกปลายทาง');

  happy('กด "นำเข้าจริง" ได้', await clickText('นำเข้าจริง'), '');
  await settle(4000);
  const added = await query('select count(*)::int n from employees where employee_code like $1', [`${MARK}-9%`]);
  happy('นำเข้าเข้าระบบจริง', added.rows[0].n === 2, `${added.rows[0].n} คน`);

  const after = await body();
  happy('บอกว่ารายชื่อที่นำเข้าอยู่โครงการไหน', after.includes('รายชื่อที่นำเข้าอยู่ในโครงการเหล่านี้'), '');
  happy('ระบุชื่อโครงการปลายทาง', after.includes(site.name), '');
  happy('แสดงตัวอย่างชื่อคนที่เพิ่งเพิ่ม', after.includes('สมปอง นำเข้า'), '');
  await shot('09-นำเข้าแล้วบอกปลายทาง');

  // และต้องกดไปดูต่อได้ ไม่ใช่ให้ไปหาเอง
  happy('มีปุ่ม "ไปดูรายชื่อพนักงาน"', await clickText('ไปดูรายชื่อพนักงาน'), '');
  await settle(3500);
  const list = await body();
  happy('พาไปยังหน้ารายชื่อของโครงการนั้นจริง',
    list.includes('สมปอง นำเข้า') || list.includes('วิภา นำเข้า'), list.slice(0, 200).replace(/\n/g, ' | '));
  await shot('10-ไปดูรายชื่อที่นำเข้า');
}

suite('ไม่มีข้อผิดพลาดซ่อนอยู่');
bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' | '));

suite('ไม่ทิ้งข้อมูลทดสอบไว้');
await clean();
await query('delete from units where code like $1', [`${MARK}%`]);
const left = await query('select count(*)::int n from employees where employee_code like $1', [`${MARK}%`]);
happy('ลบข้อมูลทดสอบหมดแล้ว', left.rows[0].n === 0, `${left.rows[0].n}`);

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
