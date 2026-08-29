/**
 * HR Work Log — the acceptance criteria driven the way a person drives them.
 *
 * The API suite proves the rules hold. This one proves someone can actually
 * reach them: a foreman keying a team on a phone, a verifier signing the day
 * off, an administrator importing a spreadsheet and reading which rows failed.
 * Everything here happens through the screen — clicks, typing, file pickers —
 * because a rule nobody can reach is not a feature.
 */
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query, call } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/worklog-uat`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const { admin: A, exec: C } = U;
const MARK = 'ZZUI2';
const d = new Date();
const TODAY = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ── ข้อมูลทดสอบ: ไซต์งานหนึ่งแห่งกับพนักงานหกคน ───────────────────────────
const site = (await query(
  `insert into units (name, code, lock_days) values ($1,$2,3)
   on conflict (code) do update set lock_days = 3, name = excluded.name returning *`,
  [`${MARK} ไซต์ทดสอบหน้างาน`, `${MARK}-site`])).rows[0];
await query("delete from work_log_attachments where unit_id in (select id from units where code like $1)", [`${MARK}%`]);
await query("delete from work_logs where unit_id in (select id from units where code like $1)", [`${MARK}%`]);
await query("delete from work_log_audit where unit_id in (select id from units where code like $1)", [`${MARK}%`]);
await query("delete from employees where employee_code like $1", [`${MARK}%`]);

const NAMES = ['สมชาย ก่อสร้าง', 'สมหญิง ทำงาน', 'ประยุทธ เหล็ก', 'วิชัย คอนกรีต', 'อนงค์ สำรวจ', 'ธนา ขนส่ง'];
const emps = [];
for (const [i, n] of NAMES.entries()) {
  emps.push((await query(
    `insert into employees (unit_id, full_name, employee_code, kind, is_active)
     values ($1,$2,$3,'operation',true) returning *`,
    [site.id, `${MARK} ${n}`, `${MARK}-${String(i + 1).padStart(3, '0')}`])).rows[0]);
}
// the recorder needs the site in scope; the verifier needs the right to sign
await query('insert into profile_units (profile_id, unit_id) values ($1,$2) on conflict do nothing', [A.id, site.id]);
await query('insert into profile_units (profile_id, unit_id) values ($1,$2) on conflict do nothing', [C.id, site.id]);
const execPermsBefore = (await query('select permissions from profiles where id = $1', [C.id])).rows[0].permissions;
await query(`update profiles set permissions = coalesce(permissions,'{}'::jsonb) || '{"performance":{"view":true,"edit":false,"verify":true}}'::jsonb where id = $1`, [C.id]);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-profile`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
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
/** Wait for text to appear rather than guessing how long a load takes — the
 *  verify screen loads four things and a fixed pause was a coin toss. */
const waitForText = async (needle, tries = 20) => {
  for (let i = 0; i < tries; i += 1) {
    if ((await body()).includes(needle)) return true;
    await settle(400);
  }
  return false;
};
const clickText = async (label, sel = 'button, a, [role="tab"]') => page.evaluate((l, s) => {
  const el = [...document.querySelectorAll(s)].find((x) => x.innerText.trim().includes(l));
  if (el) { el.click(); return true; }
  return false;
}, label, sel);
// React keeps <select> controlled, so assigning .value alone is discarded on the
// next render — the native setter is what makes React see the change.
const pickSite = async () => page.evaluate((name) => {
  const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.text.includes(name)));
  if (!sel) return false;
  const opt = [...sel.options].find((o) => o.text.includes(name));
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  setter.call(sel, opt.value);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, `${MARK} ไซต์ทดสอบ`);

// ── §3 บันทึกทั้งทีมในหน้าจอเดียว ─────────────────────────────────────────
suite('§3 ผู้บันทึกหน้างานกรอกทั้งทีมได้จากหน้าจอเดียว');
{
  await as(A);
  happy('เลือกไซต์งานทดสอบได้', await pickSite(), '');
  await settle(1800);
  happy('เปิดแท็บ "แรงงาน-วัน" ได้', await clickText('แรงงาน-วัน'), '');
  await settle(2800);
  const t0 = await body();
  happy('เห็นรายชื่อพนักงานของไซต์นี้', NAMES.slice(0, 3).every((n) => t0.includes(n)), '');
  happy('มีแถบบันทึกทั้งทีม', t0.includes('บันทึกทั้งทีม'), '');
  await shot('01-หน้าแรงงานวัน');

  happy('กด "เลือกทั้งหมด" ได้', await clickText('เลือกทั้งหมด'), '');
  await settle(600);
  const picked = await page.evaluate(() => [...document.querySelectorAll('tbody input[type=checkbox]')].filter((c) => c.checked).length);
  happy(`ติ๊กเลือกครบทุกคน (${picked})`, picked === 6, String(picked));

  happy('กด "บันทึกให้ทุกคนที่เลือก" ได้', await clickText('บันทึกให้ทุกคนที่เลือก'), '');
  await settle(3200);
  const rows = await query('select count(*)::int n from work_logs where unit_id = $1 and ymd = $2 and man_day = 1 and deleted_at is null', [site.id, TODAY]);
  happy('บันทึกลงระบบครบทั้งทีมในครั้งเดียว', rows.rows[0].n === 6, `${rows.rows[0].n} คน`);
  const t1 = await body();
  happy('หน้าจอสรุปรวมแรงงาน-วันของวันนั้น', t1.includes('6.00') || t1.includes('รวมวันนี้'), '');
  await shot('02-บันทึกทั้งทีมแล้ว');
}

// ── §11 แนบไฟล์ประกอบจากหน้าจอ ────────────────────────────────────────────
suite('§11 แนบไฟล์ประกอบการบันทึกได้จากหน้าจอ');
{
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d494844520000000100000001080600000' +
    '01f15c4890000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082', 'hex');
  const tmp = `${SHOTS}/หน้างาน.png`;
  fs.writeFileSync(tmp, png);
  const input = await page.$('tbody input[type=file]');
  happy('มีช่องแนบไฟล์ในตาราง', Boolean(input), '');
  if (input) {
    await input.uploadFile(tmp);
    await settle(3200);
  }
  const files = await query('select file_name from work_log_attachments where unit_id = $1 and ymd = $2', [site.id, TODAY]);
  happy('ไฟล์ถูกแนบและเก็บชื่อไทยถูกต้อง', files.rows.length === 1 && files.rows[0].file_name.includes('หน้างาน'), JSON.stringify(files.rows[0] || {}));
  const attId = (await query('select id from work_log_attachments where unit_id = $1 limit 1', [site.id])).rows[0]?.id;
  const open = attId ? await call(`/performance/attachments/${attId}/file`, { user: A, raw: true }) : { status: 0 };
  happy('เปิดไฟล์ที่แนบกลับมาได้', open.status === 200, `${open.status}`);
  await shot('03-แนบไฟล์');
}

// ── §3 ออฟไลน์แล้วข้อมูลไม่หาย ────────────────────────────────────────────
suite('§3 เน็ตหลุดระหว่างบันทึก ข้อมูลต้องไม่หายและไม่ซ้ำ');
{
  const target = emps[0];
  await page.setOfflineMode(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await settle(800);
  // key a different value while the connection is gone
  const typed = await page.evaluate((code) => {
    const row = [...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes(code));
    const inp = row?.querySelector('input[type=number]');
    if (!inp) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, '0.5');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    // React binds onBlur to focusout — a plain 'blur' does not bubble and the
    // handler never runs, so the save would never be attempted
    inp.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    return true;
  }, target.employee_code);
  happy('กรอกข้อมูลได้ขณะออฟไลน์', typed, '');
  await settle(2600);
  const t = await body();
  happy('หน้าจอบอกว่าออฟไลน์และเก็บข้อมูลไว้ให้', /ออฟไลน์|รอส่ง/.test(t), t.slice(0, 80));
  const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('vcb_worklog_queue') || '[]').length);
  happy('ข้อมูลที่กรอกถูกเก็บไว้ในเครื่อง ไม่หาย', queued > 0, `${queued} รายการ`);
  await shot('04-ออฟไลน์');

  await page.setOfflineMode(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await settle(4000);
  const after = await query('select man_day from work_logs where employee_id = $1 and ymd = $2 and deleted_at is null', [target.id, TODAY]);
  happy('กลับมาออนไลน์แล้วส่งให้อัตโนมัติ', Number(after.rows[0]?.man_day) === 0.5, String(after.rows[0]?.man_day));
  const dup = await query('select count(*)::int n from work_logs where employee_id = $1 and ymd = $2', [target.id, TODAY]);
  bad('ไม่เกิดรายการซ้ำหลังเชื่อมต่อใหม่', dup.rows[0].n === 1, `${dup.rows[0].n} รายการ`);
  const left = await page.evaluate(() => JSON.parse(localStorage.getItem('vcb_worklog_queue') || '[]').length);
  happy('คิวถูกล้างหลังส่งสำเร็จ', left === 0, `${left}`);
  await shot('05-กลับมาออนไลน์');
}

// ── §5 ผู้ตรวจสอบยืนยันข้อมูลจากหน้าจอ ────────────────────────────────────
suite('§5 ผู้ตรวจสอบกดยืนยันข้อมูลได้ และผู้บันทึกยืนยันเองไม่ได้');
{
  await as(A);
  await pickSite(); await settle(1200);
  await clickText('แรงงาน-วัน'); await settle(2600);
  await clickText('ยืนยันข้อมูลของวันนี้'); await settle(2600);
  const mine = await query('select count(*)::int n from work_logs where unit_id = $1 and ymd = $2 and verified_at is not null', [site.id, TODAY]);
  bad('ผู้บันทึกกดยืนยันแล้วงานของตัวเองไม่ถูกยืนยัน', mine.rows[0].n === 0, `${mine.rows[0].n}`);

  // a verifier cannot key data, so the module opens them on the overview — the
  // site picker only exists once they are on a screen that needs one
  await as(C);
  happy('ผู้ตรวจสอบเปิดแท็บแรงงาน-วันได้', await clickText('แรงงาน-วัน'), '');
  await settle(2000);
  happy('ผู้ตรวจสอบเลือกไซต์งานได้', await pickSite(), '');
  const seen = await waitForText('ยืนยันข้อมูลของวันนี้');
  happy('ผู้ตรวจสอบเห็นปุ่มยืนยัน', seen, (await body()).replace(/\n+/g, ' | ').slice(0, 300));
  await clickText('ยืนยันข้อมูลของวันนี้');
  await waitForText('ยืนยันแล้ว');
  await settle(1200);
  const done = await query('select count(*)::int n from work_logs where unit_id = $1 and ymd = $2 and verified_at is not null', [site.id, TODAY]);
  happy('ผู้ตรวจสอบยืนยันได้จริง', done.rows[0].n === 6, `${done.rows[0].n} รายการ`);
  happy('หน้าจอขึ้นสถานะ "ยืนยันแล้ว"', (await body()).includes('ยืนยันแล้ว'), '');
  await shot('06-ยืนยันแล้ว');
}

// ── §8 รายงาน PDF และ Excel จากหน้าจอ ─────────────────────────────────────
suite('§8 ดาวน์โหลดรายงานจากหน้าจอได้ทั้ง PDF และ Excel');
{
  await as(A);
  await pickSite(); await settle(1200);
  happy('เปิดแท็บ "รายงานและตรวจสอบ" ได้', await clickText('รายงานและตรวจสอบ'), '');
  await settle(3200);
  const t = await body();
  happy('เห็นยอดรวมแรงงาน-วัน', /รวมแรงงาน-วัน/.test(t), '');
  happy('มีปุ่มรายงาน PDF', t.includes('รายงานนี้เป็น PDF'), '');
  happy('มีปุ่มรายงานเดือน ทุกโครงการ', t.includes('ทุกโครงการ'), '');
  happy('เห็นประวัติการแก้ไข', t.includes('ประวัติการแก้ไข'), '');
  happy('เห็นรายการที่ต้องดำเนินการ', t.includes('รายการที่ต้องดำเนินการ') || t.includes('ยังไม่บันทึก'), '');
  await shot('07-รายงาน');

  const pdf = await call(`/performance/report/manday.pdf?from=${TODAY}&to=${TODAY}&groupBy=project`, { user: A, raw: true });
  happy('ไฟล์ PDF สร้างได้จริง', pdf.status === 200, `${pdf.status}`);
  const buf = Buffer.from(await pdf.arrayBuffer());
  happy('เป็นไฟล์ PDF จริง', buf.subarray(0, 4).toString() === '%PDF', buf.subarray(0, 8).toString());
  happy('ไฟล์ PDF มีเนื้อหา ไม่ใช่ไฟล์เปล่า', buf.length > 1500, `${buf.length} ไบต์`);
}

// ── §2 นำเข้าทะเบียนพนักงานจาก Excel ผ่านหน้าจอ ───────────────────────────
suite('§2 นำเข้าพนักงานจาก Excel และเห็นรายการที่ไม่ผ่าน');
{
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('พนักงาน');
  ws.columns = [
    { header: 'รหัสพนักงาน', key: 'code' }, { header: 'ชื่อ-สกุล', key: 'name' },
    { header: 'โครงการ', key: 'site' }, { header: 'ประเภท', key: 'kind' }, { header: 'สถานะ', key: 'status' },
  ];
  ws.addRow({ code: `${MARK}-101`, name: `${MARK} นำเข้า หนึ่ง`, site: site.code, kind: 'ปฏิบัติการ', status: 'ปฏิบัติงาน' });
  ws.addRow({ code: `${MARK}-102`, name: `${MARK} นำเข้า สอง`, site: site.code, kind: 'สนับสนุน', status: 'ปฏิบัติงาน' });
  ws.addRow({ code: `${MARK}-103`, name: `${MARK} นำเข้า สาม`, site: 'ไซต์ที่ไม่มีอยู่จริง', kind: 'ปฏิบัติการ', status: '' });
  ws.addRow({ code: `${MARK}-104`, name: '', site: site.code, kind: 'ปฏิบัติการ', status: '' });
  const xlsxPath = `${SHOTS}/พนักงานนำเข้า.xlsx`;
  await wb.xlsx.writeFile(xlsxPath);

  await as(A);
  await clickText('ตั้งค่า'); await settle(2600);
  const t = await body();
  happy('หน้าตั้งค่ามีส่วนนำเข้าจาก Excel', t.includes('นำเข้าทะเบียนพนักงานจาก Excel'), '');
  const input = await page.$('input[type=file]');
  happy('มีช่องเลือกไฟล์', Boolean(input), '');
  if (input) { await input.uploadFile(xlsxPath); await settle(1200); }

  happy('กด "ตรวจไฟล์ก่อน" ได้', await clickText('ตรวจไฟล์ก่อน'), '');
  await settle(3200);
  const t2 = await body();
  happy('รายงานว่าผ่าน 2 แถว', /ผ่านเงื่อนไข\s*2/.test(t2.replace(/\n/g, ' ')), '');
  happy('รายงานว่าไม่ผ่าน 2 แถว', /ไม่ผ่าน\s*2/.test(t2.replace(/\n/g, ' ')), '');
  happy('บอกเหตุผลที่ไม่ผ่านเป็นราย ๆ', t2.includes('ไม่พบโครงการ') && t2.includes('ไม่มีชื่อ'), '');
  const before = await query('select count(*)::int n from employees where employee_code like $1', [`${MARK}-1%`]);
  bad('ขั้นตอนตรวจไฟล์ยังไม่เขียนลงระบบ', before.rows[0].n === 0, `${before.rows[0].n}`);
  await shot('08-ตรวจไฟล์นำเข้า');

  happy('กด "นำเข้าจริง" ได้', await clickText('นำเข้าจริง'), '');
  await settle(3600);
  const after = await query('select count(*)::int n from employees where employee_code like $1', [`${MARK}-1%`]);
  happy('นำเข้าเฉพาะแถวที่ผ่านเงื่อนไข', after.rows[0].n === 2, `${after.rows[0].n} คน`);
  await shot('09-นำเข้าจริง');
}

// ── §1 บทบาทใหม่เห็นและทำได้ต่างกันจริง ───────────────────────────────────
suite('§1 บทบาทผู้บันทึกและผู้ตรวจสอบแยกหน้าที่กันจริง');
{
  await query('delete from profiles where email like $1', [`${MARK.toLowerCase()}-%@vcb.local`]);
  const rec = (await query(
    `insert into profiles (email, full_name, role, is_active) values ($1,$2,'recorder',true) returning *`,
    [`${MARK.toLowerCase()}-rec@vcb.local`, `${MARK} ผู้บันทึกหน้างาน`])).rows[0];
  await query('insert into profile_units (profile_id, unit_id) values ($1,$2) on conflict do nothing', [rec.id, site.id]);
  const ver = (await query(
    `insert into profiles (email, full_name, role, is_active) values ($1,$2,'verifier',true) returning *`,
    [`${MARK.toLowerCase()}-ver@vcb.local`, `${MARK} ผู้ตรวจสอบ`])).rows[0];
  await query('insert into profile_units (profile_id, unit_id) values ($1,$2) on conflict do nothing', [ver.id, site.id]);

  await as(rec);
  const tRec = await body();
  happy('ผู้บันทึกหน้างานเข้าโมดูลได้', tRec.includes('บันทึกงานฝ่ายบุคคล'), tRec.slice(0, 60));
  happy('ระบบแสดงบทบาทว่า "ผู้บันทึกข้อมูลหน้างาน"', tRec.includes('ผู้บันทึกข้อมูลหน้างาน'), '');
  await pickSite(); await settle(1000);
  await clickText('แรงงาน-วัน'); await settle(2600);
  bad('ผู้บันทึกไม่มีสิทธิ์ยืนยันข้อมูล',
    (await call('/performance/verify', { method: 'POST', user: rec, body: { site: site.code, from: TODAY, to: TODAY } })).status === 403, '');
  await shot('10-ผู้บันทึกหน้างาน');

  await as(ver);
  const tVer = await body();
  happy('ผู้ตรวจสอบเข้าโมดูลได้', tVer.includes('บันทึกงานฝ่ายบุคคล'), '');
  happy('ระบบแสดงบทบาทว่า "ผู้ตรวจสอบโครงการ"', tVer.includes('ผู้ตรวจสอบโครงการ'), '');
  bad('ผู้ตรวจสอบแก้ไขข้อมูลรายวันไม่ได้',
    (await call('/performance/day', { method: 'POST', user: ver, body: { site: site.code, eid: emps[1].id, date: TODAY, manDay: 1 } })).status === 403, '');
  happy('แต่ยืนยันข้อมูลได้',
    (await call('/performance/verify', { method: 'POST', user: ver, body: { site: site.code, from: TODAY, to: TODAY } })).status === 200, '');
  await shot('11-ผู้ตรวจสอบ');

  // the two temporary accounts are removed in the teardown — work_logs points at
  // whoever verified it, so the rows have to go first
}

// ── §13 ใช้งานบนมือถือหน้างานได้จริง ──────────────────────────────────────
suite('§13 หน้าจอบันทึกใช้งานบนมือถือได้จริง');
{
  // §5 verified today's rows earlier and a verified row is locked for editing —
  // release them so this section measures the phone, not the verification rule
  await call('/performance/verify', { method: 'POST', user: C, body: { site: site.code, from: TODAY, to: TODAY, undo: true } });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await as(A);
  await clickText('แรงงาน-วัน'); await settle(1500);
  await pickSite();
  await waitForText('แรงงาน-วัน');
  await settle(2500);
  const m = await page.evaluate(() => {
    const tapArea = (el) => {
      // what a finger actually hits: the control, or the label wrapping it
      let n = el;
      for (let i = 0; i < 3 && n; i += 1) {
        const r = n.getBoundingClientRect();
        if (r.height >= 40 && r.width >= 40) return r;
        n = n.parentElement;
      }
      return el.getBoundingClientRect();
    };
    const controls = [...document.querySelectorAll('input, select, button')]
      .filter((e) => e.getBoundingClientRect().width > 0);
    return {
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      offScreen: controls.filter((e) => e.getBoundingClientRect().right > window.innerWidth + 2).length,
      tooSmall: controls.filter((e) => { const r = tapArea(e); return r.height < 36; }).length,
      smallList: controls.filter((e) => { const r = tapArea(e); return r.height < 36; })
        .map((e) => `${e.tagName}:${(e.getAttribute('aria-label') || e.innerText || e.type || '').trim().slice(0, 20)}`),
      canType: Boolean(document.querySelector('input[type=number]')),
      hasBulk: document.body.innerText.includes('บันทึกทั้งทีม'),
    };
  });
  bad('หน้าไม่ล้นออกด้านข้างบนมือถือ', m.pageOverflow <= 2, `${m.pageOverflow}px`);
  bad('ไม่มีปุ่มหรือช่องกรอกหลุดออกนอกจอ', m.offScreen === 0, `${m.offScreen} ชิ้น`);
  bad('พื้นที่กดไม่เล็กกว่านิ้วสัมผัส', m.tooSmall === 0, (m.smallList || []).join(' | '));
  happy('ยังกรอกแรงงาน-วันได้บนมือถือ', m.canType, '');
  happy('ยังบันทึกทั้งทีมได้บนมือถือ', m.hasBulk, '');
  await shot('12-มือถือ');

  // key one value on the phone and check it lands
  const typed = await page.evaluate(() => {
    // the first number input on the page is the bulk bar's; the one that saves
    // on blur lives inside a person's card
    const card = [...document.querySelectorAll('.card-sm')].find((c) => c.querySelector('input[type=number]') && c.querySelector('input[type=checkbox]'));
    const inp = card?.querySelector('input[type=number]');
    if (!inp) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, '0.75');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    return true;
  });
  await settle(3000);
  const saved = await query(
    'select count(*)::int n from work_logs where unit_id = $1 and ymd = $2 and man_day = 0.75 and deleted_at is null', [site.id, TODAY]);
  happy('กรอกจากมือถือแล้วบันทึกลงระบบจริง', typed && saved.rows[0].n === 1, `${saved.rows[0].n}`);
  await page.setViewport({ width: 1440, height: 950 });
}

// ── ไม่มีข้อผิดพลาดค้าง ───────────────────────────────────────────────────
suite('ไม่มีข้อผิดพลาดซ่อนอยู่');
{
  const real = errors.filter((e) => !/favicon|ResizeObserver|Download the React DevTools/.test(e));
  bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', real.length === 0, real.slice(0, 2).join(' | '));
}

// ── เก็บกวาด ──────────────────────────────────────────────────────────────
suite('ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await browser.close();
  await query('delete from work_log_attachments where unit_id = $1', [site.id]);
  await query('delete from work_log_lines where work_log_id in (select id from work_logs where unit_id = $1)', [site.id]);
  await query('delete from work_logs where unit_id = $1', [site.id]);
  await query('delete from work_log_audit where unit_id = $1', [site.id]);
  await query('delete from period_closes where unit_id = $1', [site.id]);
  await query('delete from employee_away where employee_id in (select id from employees where unit_id = $1)', [site.id]);
  await query('delete from leave_requests where unit_id = $1', [site.id]);
  await query('delete from teams where unit_id = $1', [site.id]);
  await query('delete from employees where unit_id = $1', [site.id]);
  await query('delete from profile_units where unit_id = $1', [site.id]);
  await query('delete from units where id = $1', [site.id]);
  await query('delete from profile_units where profile_id in (select id from profiles where email like $1)', [`${MARK.toLowerCase()}-%@vcb.local`]);
  await query('delete from profiles where email like $1', [`${MARK.toLowerCase()}-%@vcb.local`]);
  await query('update profiles set permissions = $2 where id = $1', [C.id, execPermsBefore]);
  const left = await query('select count(*)::int n from units where code like $1', [`${MARK}%`]);
  happy('ลบข้อมูลทดสอบหมดแล้ว', left.rows[0].n === 0, `${left.rows[0].n}`);
}

process.exit(report(`${ROOT}/worklog-uat-ui.json`) ? 1 : 0);
