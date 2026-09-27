/**
 * บันทึกงานฝ่ายบุคคล — รูปร่างเดียวกับระบบที่ลูกค้าใช้จริง
 *
 * ชุดนี้คู่กับ worklog-uat: ชุดนั้นตรวจความสามารถที่มาจากเอกสารเกณฑ์ตรวจรับ
 * ชุดนี้ตรวจว่าเมื่อปิดส่วนเสริมทั้งหมดแล้ว สิ่งที่เหลือตรงกับระบบ Apps Script
 * ที่พนักงานเปิดใช้อยู่ทุกวัน — ห้าหน้าจอ ทะเบียน 44/20 ตัวเลือกสองขั้นที่กรอง
 * ตามหมวดงานที่อนุญาต และแรงงาน-วันที่คำนวณเอง ไม่ใช่ตัวเลขที่ใครพิมพ์
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query, call, upload } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/worklog-live-shape`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin;
const MARK = 'ZZLS';
const d = new Date();
const TODAY = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const clean = async () => {
  await query('delete from work_logs where unit_id in (select id from units where code like $1)', [`${MARK}%`]);
  await query('delete from work_log_audit where unit_id in (select id from units where code like $1)', [`${MARK}%`]);
  await query('delete from employees where employee_code like $1', [`${MARK}%`]);
};
await clean();
const site = (await query(
  `insert into units (name, code, lock_days) values ($1,$2,30)
   on conflict (code) do update set lock_days = 30, name = excluded.name returning *`,
  [`${MARK} ไซต์ตรวจรูปร่าง`, `${MARK}-site`])).rows[0];
const emp = (await query(
  `insert into employees (unit_id, full_name, employee_code, kind, is_active)
   values ($1,$2,$3,'operation',true) returning *`,
  [site.id, `${MARK} ทดสอบ รูปร่าง`, `${MARK}-001`])).rows[0];
await query('insert into profile_units (profile_id, unit_id) values ($1,$2) on conflict do nothing', [A.id, site.id]);

// ── ทะเบียนและกติกาการนับ (ตรวจผ่าน API ก่อน เพราะเป็นฐานของทุกหน้าจอ) ─────
suite('ทะเบียนงานและหมวดงานตรงกับระบบจริง');
{
  const acts = (await call('/performance/activities', { user: A })).data || [];
  const cats = (await call('/performance/cost-categories', { user: A })).data || [];
  happy(`ประเภทงาน 44 รหัส (พบ ${acts.length})`, acts.length === 44, `${acts.length}`);
  happy(`หมวดงาน 20 หมวด (พบ ${cats.length})`, cats.length === 20, `${cats.length}`);

  const a1 = acts.find((x) => x.code === 'A-1');
  happy('A-1 คือ "งานผูก-ตัด-ดัดเหล็ก" ตามทะเบียนจริง', a1?.name === 'งานผูก-ตัด-ดัดเหล็ก', a1?.name || '—');
  happy('หมวดงาน 1 คือ "งานรื้อย้ายโครงสร้างเดิม"',
    cats.find((c) => c.code === '1')?.name === 'งานรื้อย้ายโครงสร้างเดิม',
    cats.find((c) => c.code === '1')?.name || '—');

  happy('A-1 ระบุหมวดงานที่ใช้ได้ 7 หมวด', (a1?.allowed_cost || '') === '5,7,8,9,15,17,19', a1?.allowed_cost || '—');
  const a6 = acts.find((x) => x.code === 'A-6');
  happy('A-6 ผูกหมวดเดียว จึงข้ามขั้นที่สอง',
    a6?.mapping === 'one-to-one' && a6?.fixed_cost === '3', `${a6?.mapping} / ${a6?.fixed_cost}`);
  const z = acts.filter((x) => x.code.startsWith('Z-'));
  happy('กลุ่ม Z ไม่ปฏิบัติงานมีสามรหัส', z.length === 3, z.map((x) => `${x.code} ${x.name}`).join(', '));
}

// ── แรงงาน-วันเป็นค่าที่คำนวณ ──────────────────────────────────────────────
suite('แรงงาน-วันคำนวณจากงานที่ลง ไม่ใช่ตัวเลขที่กรอก');
{
  const md = async () => (await query(
    'select coalesce(sum(manday),0)::float8 s from worklog_mandays where unit_id = $1', [site.id])).rows[0].s;
  const slots = async () => (await query(
    `select slot, work_code, cost_code, manday::float8 from worklog_slots where unit_id = $1 order by slot`,
    [site.id])).rows;

  // พนักงานทดสอบเป็นสายปฏิบัติการ ช่องงานหลักจึงเป็นคอลัมน์ team
  // (สายสนับสนุนใช้ detail) — ข้อกำหนดฟังก์ชัน §3.2.2 primaryField(kind)
  const SLOT1 = 'team';
  const save = (field, value) => call('/performance/cell', { method: 'POST', user: A,
    body: { site: site.code, eid: emp.id, date: TODAY, field, value } });

  happy('ยังไม่ลงงาน = 0 แรงงาน-วัน', (await md()) === 0, String(await md()));
  const r1 = await save(SLOT1, 'A-1 / 5');
  happy('ลงงานหลักได้', r1.status === 200, `${r1.status}`);
  happy('ลงงานหนึ่งช่อง = 1 แรงงาน-วัน', (await md()) === 1, String(await md()));

  await save('pm', 'A-14 / 10');
  happy('ลงสองช่องแล้วรวมยังเป็น 1 แรงงาน-วัน', (await md()) === 1, String(await md()));
  const s2 = await slots();
  happy('แบ่งเป็น 0.5 ต่อช่อง', s2.length === 2 && s2.every((x) => Number(x.manday) === 0.5),
    s2.map((x) => `${x.work_code}/${x.cost_code}=${x.manday}`).join(' '));
  happy('แยกรหัสงานและรหัสหมวดงานออกจากกันได้',
    s2[0].work_code === 'A-1' && s2[0].cost_code === '5', JSON.stringify(s2[0]));

  const totals = {};
  for (const g of ['cost', 'worktype', 'project', 'employee']) {
    totals[g] = (await call(`/performance/report/manday?from=${TODAY}&to=${TODAY}&groupBy=${g}`, { user: A })).data.total;
  }
  happy('รายงานทุกมุมมองได้ยอดรวมเท่ากัน', new Set(Object.values(totals)).size === 1, JSON.stringify(totals));

  await save('pm', '');
  happy('ลบงานเสริมแล้วกลับเป็น 1 แรงงาน-วัน', (await md()) === 1, String(await md()));
  await save(SLOT1, '');
  bad('ลบงานทั้งหมดแล้วไม่นับเป็นวันทำงาน', (await md()) === 0, String(await md()));
}

// ── ส่วนเสริมต้องปิดจริงที่ API ไม่ใช่แค่ซ่อนปุ่ม ──────────────────────────
suite('เส้นทางของส่วนเสริมปิดอยู่จริง');
{
  const boot = await call('/performance/bootstrap', { user: A });
  const off = Object.entries(boot.features || {}).filter(([, v]) => !v).map(([k]) => k);
  happy(`ส่วนเสริมปิดอยู่ ${off.length} รายการ`, off.length === 11, off.join(', '));
  for (const [m, p] of [['GET', '/performance/alerts'], ['GET', '/performance/manpower?from=2026-01-01&to=2026-12-31'],
    ['GET', '/performance/departments'], ['GET', '/performance/positions'],
    ['GET', '/performance/period-closes?site=' + site.code], ['GET', '/performance/attachments?site=' + site.code],
    ['GET', '/performance/import/employees/template.xlsx'],
    // ระบบจริงไม่มีหน้ารายงานแยก มีแต่ปุ่มดาวน์โหลด — ไฟล์ PDF ของหน้ารายงานจึงปิดด้วย
    ['GET', '/performance/report/manday.pdf?from=2026-01-01&to=2026-12-31']]) {
    const r = await call(p, { method: m, user: A });
    bad(`${p.split('?')[0]} ตอบ 404`, r.status === 404, `${r.status}`);
  }
  const day = await call('/performance/day', { method: 'POST', user: A,
    body: { site: site.code, eid: emp.id, date: TODAY, manDay: 1 } });
  bad('กรอกแรงงาน-วันเป็นตัวเลขไม่ได้อีก', day.status === 404, `${day.status}`);
  const half = await call('/performance/leave', { method: 'POST', user: A,
    body: { employeeId: emp.id, leaveType: 'sick', from: TODAY, to: TODAY, dayPart: 'first_half' } });
  bad('ยื่นลาครึ่งวันไม่ได้', half.status === 400, `${half.status}`);
}

// ── ดัชนีงาน: เพิ่ม/ลบ/นำเข้า ตามระบบจริง (รอบเทียบ 2026-09-27) ────────────
suite('ดัชนีงาน: ออกรหัสให้เอง · ลบจริงเมื่อไม่มีใครใช้ · ปิดใช้งานเมื่อมีคนใช้');
{
  // รหัสเว้นว่างได้ = เซิร์ฟเวอร์ออกเลขให้ (กันสองคนกดพร้อมกันได้รหัสซ้ำ)
  const newAct = await call('/performance/activities', { method: 'POST', user: A,
    body: { name: `${MARK} กิจกรรมทดสอบ`, category: `${MARK} หมวดทดสอบ`, description: 'คำอธิบายทดสอบ' } });
  const actCode = newAct.data?.code;
  happy('เพิ่มกิจกรรมโดยเว้นรหัสว่างได้ ระบบออกเลขให้',
    newAct.status === 201 && /^[A-Z]-\d+$/.test(actCode || ''), `${newAct.status} ${actCode}`);
  happy('คำอธิบายถูกเก็บและส่งกลับมา', newAct.data?.desc === 'คำอธิบายทดสอบ', newAct.data?.desc || '—');

  const newCat = await call('/performance/cost-categories', { method: 'POST', user: A,
    body: { name: `${MARK} หมวดงานทดสอบ` } });
  const catCode = newCat.data?.code;
  happy('เพิ่มหมวดงานโดยเว้นรหัสว่างได้ ระบบออกเลขถัดไปให้',
    newCat.status === 201 && /^\d+$/.test(catCode || ''), `${newCat.status} ${catCode}`);

  // ลงงานด้วยรหัสคู่นี้ก่อน แล้วสั่งลบ — ต้องถูกปิดใช้งานแทนการลบ
  await call('/performance/cell', { method: 'POST', user: A,
    body: { site: site.code, eid: emp.id, date: TODAY, field: 'team', value: `${actCode} / ${catCode}` } });
  const delUsedAct = await call(`/performance/activities/${encodeURIComponent(actCode)}`, { method: 'DELETE', user: A });
  happy('ลบกิจกรรมที่มีบันทึกอ้างอิง = ปิดใช้งานแทน ไม่ลบทิ้ง',
    delUsedAct.status === 200 && delUsedAct.data?.deactivated === true && delUsedAct.data?.deleted === false,
    JSON.stringify(delUsedAct.data));
  happy('บอกผู้ใช้ตรง ๆ ว่าทำไมไม่ลบ', /บันทึกงาน/.test(delUsedAct.data?.message || ''), delUsedAct.data?.message || '—');
  bad('บันทึกเดิมไม่ถูกลบตามไปด้วย',
    (await query('select count(*)::int n from work_logs where employee_id = $1 and ymd = $2 and deleted_at is null',
      [emp.id, TODAY])).rows[0].n === 1, '');
  const delUsedCat = await call(`/performance/cost-categories/${encodeURIComponent(catCode)}`, { method: 'DELETE', user: A });
  happy('ลบหมวดงานที่มีบันทึกอ้างอิง = ปิดใช้งานแทน',
    delUsedCat.status === 200 && delUsedCat.data?.deactivated === true, JSON.stringify(delUsedCat.data));

  // ล้างบันทึกแล้วลบซ้ำ — ไม่มีใครอ้างอิงอีก จึงลบจริงได้
  await call('/performance/cell', { method: 'POST', user: A,
    body: { site: site.code, eid: emp.id, date: TODAY, field: 'team', value: '' } });
  const delAct = await call(`/performance/activities/${encodeURIComponent(actCode)}`, { method: 'DELETE', user: A });
  happy('ไม่มีใครใช้แล้วลบจริงได้', delAct.data?.deleted === true, JSON.stringify(delAct.data));
  const delCat = await call(`/performance/cost-categories/${encodeURIComponent(catCode)}`, { method: 'DELETE', user: A });
  happy('หมวดงานที่ไม่มีใครใช้ลบจริงได้', delCat.data?.deleted === true, JSON.stringify(delCat.data));
  bad('ลบรหัสที่ไม่มีอยู่ตอบ 404',
    (await call('/performance/activities/ZZ-999', { method: 'DELETE', user: A })).status === 404, '');
  bad('ผู้ที่ไม่ใช่ผู้ดูแลระบบลบไม่ได้',
    (await call('/performance/activities/A-1', { method: 'DELETE', user: U.hr })).status === 403, '');
}

suite('ดัชนีงาน: เทมเพลตเปล่าและการนำเข้าทั้งสองชนิด');
{
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  for (const [kind, p] of [['กิจกรรม', '/performance/import/activities/template.xlsx'],
    ['หมวดงาน', '/performance/import/cost-categories/template.xlsx']]) {
    const res = await call(p, { user: A, raw: true });
    happy(`ดาวน์โหลดเทมเพลตเปล่าของ${kind}ได้`,
      res.status === 200 && (res.headers.get('content-type') || '').includes(XLSX),
      `${res.status} ${res.headers.get('content-type')}`);
  }

  // นำเข้าหมวดงานจากไฟล์จริง — ของเราเคยนำเข้าได้แต่แท็บกิจกรรม
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('หมวดงาน');
  ws.columns = [{ header: 'รหัส', key: 'code' }, { header: 'ชื่อหมวดงาน', key: 'name' },
    { header: 'ชื่อภาษาอังกฤษ', key: 'name_en' }];
  ws.addRow({ code: '991', name: `${MARK} หมวดนำเข้า หนึ่ง`, name_en: 'Imported one' });
  ws.addRow({ code: '992', name: `${MARK} หมวดนำเข้า สอง`, name_en: 'Imported two' });
  ws.addRow({ code: 'ไม่ใช่เลข', name: `${MARK} แถวเสีย` });   // ต้องถูกข้าม ไม่ล้มทั้งไฟล์
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const imp = await upload('/performance/import/cost-categories', A, 'หมวดงาน.xlsx', buf, XLSX);
  happy('นำเข้าหมวดงานได้ และรายงานเป็น เพิ่ม/อัปเดต/ข้าม',
    imp.status === 200 && imp.data?.added === 2 && imp.data?.skipped === 1, JSON.stringify(imp.data));
  const again = await upload('/performance/import/cost-categories', A, 'หมวดงาน.xlsx', buf, XLSX);
  happy('นำเข้าไฟล์เดิมซ้ำนับเป็น "อัปเดต" ไม่ใช่เพิ่มใหม่',
    again.data?.added === 0 && again.data?.updated === 2, JSON.stringify(again.data));
  await query("delete from cost_categories where code in ('991','992')");

  // ทะเบียนกลับมาเท่าระบบจริงครบ 44 / 20 หลังทดสอบ
  const acts = (await call('/performance/activities', { user: A })).data || [];
  const cats = (await call('/performance/cost-categories', { user: A })).data || [];
  happy('ทะเบียนกลับมาเป็น 44 / 20 หลังทดสอบลบและนำเข้า',
    acts.length === 44 && cats.length === 20, `${acts.length} / ${cats.length}`);
}

suite('ประวัติการแก้ไขอ่านออกได้เอง (ชื่อหน่วยงาน/พนักงาน ไม่ใช่ uuid)');
{
  await call('/performance/cell', { method: 'POST', user: A,
    body: { site: site.code, eid: emp.id, date: TODAY, field: 'team', value: 'A-1 / 5' } });
  const au = await call(`/performance/audit?site=${site.code}&limit=50`, { user: A });
  const row = (au.data || []).find((r) => r.employee_id === emp.id);
  happy('มีแถวประวัติของการบันทึกที่เพิ่งทำ', Boolean(row), `${(au.data || []).length} แถว`);
  happy('แถวบอกชื่อหน่วยงานและชื่อพนักงานมาด้วย',
    row?.site_name === site.name && row?.emp_name === emp.full_name,
    `${row?.site_name} / ${row?.emp_name}`);
  happy('แถวบอกผู้แก้ไขและค่าใหม่', Boolean(row?.actor_label) && Boolean(row?.after_val),
    `${row?.actor_label} · ${JSON.stringify(row?.after_val)}`);
  await call('/performance/cell', { method: 'POST', user: A,
    body: { site: site.code, eid: emp.id, date: TODAY, field: 'team', value: '' } });
}

// แต่ละชุดใช้โปรไฟล์ Chrome ของตัวเอง ไม่ใช้ร่วมกัน — ชุดที่ล้มกลางคันจะทิ้ง
// Chrome ที่ยังถือ lock ของโปรไฟล์ไว้ ชุดถัดไปที่ใช้โปรไฟล์เดียวกันจะค้างตามไป
// ทั้งที่ตัวเองไม่มีอะไรผิด (เกิดขึ้นจริงตอนรันรวมทั้งชุดบนเครื่องที่งานหนัก)
// ── หน้าจอ ────────────────────────────────────────────────────────────────
// โปรไฟล์ Chrome ใช้ครั้งเดียวแล้วทิ้ง — ชุดที่ล้มกลางคันทิ้งโปรไฟล์ที่เขียนค้าง
// ไว้ และ Chrome จะค้างตอนเปิดโปรไฟล์นั้นทุกครั้งหลังจากนั้น ชุดเดิมจึงล้มซ้ำ
// ไปเรื่อย ๆ ทั้งที่โค้ดไม่ได้ผิดอะไร (ไล่จนเจอเมื่อ 2026-09-05)
fs.rmSync(`${ROOT}/chrome-worklog-live-shape`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-worklog-live-shape`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
// 30 วินาทีของค่าเริ่มต้นตึงเกินไปเมื่อเครื่องรันงานอื่นอยู่ด้วย
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
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
const clickText = (label, sel = 'button, a, [role="tab"]') => page.evaluate((l, s) => {
  const el = [...document.querySelectorAll(s)].find((x) => x.innerText.trim() === l);
  if (el) { el.click(); return true; } return false;
}, label, sel);
// แท็บที่มีตัวนับต่อท้ายชิดกับชื่อ ("รออนุมัติ3") เทียบตรงตัวไม่ได้ — ตัดตัวเลข
// ท้ายออกก่อน แล้วยอมให้ชื่อขึ้นต้นตรงกันพอ
const clickTab = (label) => page.evaluate((l) => {
  const el = [...document.querySelectorAll('button')]
    .find((x) => x.innerText.trim().replace(/\s*\d+\+?$/, '').trim() === l);
  if (el) { el.click(); return true; } return false;
}, label);

suite('หน้าจอเหลือห้าหน้าเท่าระบบจริง');
{
  await as(A);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('button')]
    // แท็บการลามีตัวเลขคำขอที่รออนุมัติต่อท้าย ("การลา 3") — ตัดตัวเลขก่อนเทียบชื่อ
    .map((b) => b.innerText.trim().replace(/\s*\d+\+?$/, ''))
    .filter((x) => ['แดชบอร์ด', 'บันทึกงาน', 'แรงงาน-วัน', 'รายงาน', 'คำขอ', 'ดัชนีงาน', 'ตั้งค่า'].includes(x)));
  // เมนูเท่าระบบจริง: แดชบอร์ด · บันทึกงาน · คำขอ · ดัชนีงาน · ตั้งค่า
  happy(`เห็นแท็บ ${tabs.length} แท็บ`, tabs.length === 5, tabs.join(' · '));
  bad('ไม่มีแท็บ "แรงงาน-วัน" แล้ว', !tabs.includes('แรงงาน-วัน'), tabs.join(' · '));
  bad('ไม่มีแท็บ "รายงาน" แล้ว (ระบบจริงไม่มีหน้ารายงานแยก)', !tabs.includes('รายงาน'), tabs.join(' · '));
  await shot('01-แท็บ');

  await as(A, '/performance?tab=manday');
  const txt = await body();
  // แท็บหน้าแรกใช้ชื่อ "แดชบอร์ด" ตามระบบจริงแล้ว (คำว่า "ภาพรวม" ย้ายไปเป็นมุมมองย่อยในหน้าบันทึกงาน)
  bad('ลิงก์เก่า ?tab=manday ไม่พาไปหน้าว่าง', txt.includes('แดชบอร์ด') && !txt.includes('รวมวันนี้'), txt.slice(0, 120).replace(/\n/g, ' | '));
}

suite('ตัวเลือกสองขั้นกรองตามหมวดงานที่อนุญาต');
{
  await as(A);
  await page.evaluate((n) => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.text.includes(n)));
    if (!sel) return;
    const opt = [...sel.options].find((o) => o.text.includes(n));
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }, `${MARK} ไซต์ตรวจ`);
  await settle(2000);
  await clickText('บันทึกงาน');
  await settle(3000);
  // สลับไปมุมมองรายอาทิตย์ที่มีช่องให้คลิก
  await clickText('รายอาทิตย์');
  await settle(2500);
  // ช่องงานที่สองมีข้อความ "+ งานที่ 2" กำกับไว้ ใช้เป็นจุดคลิกที่แน่นอนกว่า
  // การเดา div ตัวแรกในเซลล์ ซึ่งเคยไปโดนคอลัมน์ชื่อพนักงานแทน
  const slot = (await page.evaluateHandle(() => [...document.querySelectorAll('tbody td div')]
    .find((x) => x.innerText.trim() === '+ งานที่ 2'))).asElement();
  happy('พบช่องลงงานในตารางรายอาทิตย์', Boolean(slot), '');
  if (slot) await slot.click();
  await settle(1400);
  const pickerOpen = await page.evaluate(() => [...document.querySelectorAll('div')]
    .some((d) => d.innerText.trim().startsWith('1/2') && d.innerText.includes('เลือกกิจกรรม')));
  happy('เปิดตัวเลือกจากช่องในตารางได้', pickerOpen, '');
  await shot('02-ขั้นที่หนึ่ง');

  // นับเฉพาะรายการในกล่องตัวเลือก — ตารางข้างหลังก็เป็น cursor-pointer เหมือนกัน
  // การนับทั้งหน้าจึงได้ตัวเลขที่ไม่มีความหมาย
  const boxRows = () => page.evaluate(() => {
    const box = [...document.querySelectorAll('div')].find((d) => (d.className || '').includes('z-[60]'));
    if (!box) return null;
    // หัวข้อของกล่องในขั้นที่สองก็เป็น cursor-pointer (กดเพื่อย้อนกลับ) จึงต้อง
    // คัดลูกศรย้อนกลับออก ไม่งั้นถูกนับเป็นรายการหนึ่ง
    return {
      head: box.innerText.split('\n').slice(0, 6).join(' ').trim(),
      codes: [...box.querySelectorAll('div.cursor-pointer')]
        .map((d) => (d.querySelector('span')?.innerText || '').trim())
        .filter((x) => x && x !== '‹'),
    };
  });
  const step1 = await boxRows();
  happy(`ขั้นที่หนึ่งแสดงทะเบียนงานครบ (${step1?.codes.length})`, step1?.codes.length === 44, `${step1?.codes.length}`);
  happy('เห็นรหัส A-1 ในรายการขั้นที่หนึ่ง', Boolean(step1?.codes.includes('A-1')), '');

  // ตัวเลือกผูกกับ onMouseDown — ส่ง mousedown ตรงที่แถว ไม่ใช่คลิกทั้งชุด
  // (คลิกเต็มรูปแบบทำให้ตัวจับคลิกนอกกล่องปิดกล่องไปก่อน)
  await page.evaluate(() => {
    const box = [...document.querySelectorAll('div')].find((d) => (d.className || '').includes('z-[60]'));
    const row = [...box.querySelectorAll('div.cursor-pointer')]
      .find((d) => (d.querySelector('span')?.innerText || '').trim() === 'A-1');
    row?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  });
  await settle(1200);
  const step2 = await boxRows();
  happy('เข้าสู่ขั้นที่สองพร้อมจำรหัสงานไว้', (step2?.head || '').includes('A-1'), step2?.head || '(ไม่พบหัวข้อ)');
  happy(`ขั้นที่สองเหลือเฉพาะหมวดที่ A-1 ใช้ได้ (พบ ${step2?.codes.length} จาก 20)`,
    step2?.codes.length === 7, (step2?.codes || []).join(','));
  happy('เหลือเฉพาะรหัสที่ทะเบียนอนุญาต',
    JSON.stringify(step2?.codes) === JSON.stringify(['5', '7', '8', '9', '15', '17', '19']),
    (step2?.codes || []).join(','));
  happy('หัวข้อบอกจำนวนหมวดที่ใช้ได้', (step2?.head || '').includes('7'), step2?.head || '');
  await shot('03-ขั้นที่สองกรองแล้ว');
}

suite('หน้าตั้งค่าและฟอร์มลาไม่มีส่วนเสริม');
{
  await as(A);
  await clickText('ตั้งค่า');
  await settle(3000);
  const st = await body();
  bad('ไม่มีทะเบียนแผนกและตำแหน่ง', !st.includes('ทะเบียนแผนกและตำแหน่ง'), '');
  bad('ไม่มีการนำเข้าพนักงานจาก Excel', !st.includes('นำเข้าทะเบียนพนักงานจาก Excel'), '');
  happy('ยังตั้งจำนวนวันล็อกย้อนหลังได้', st.includes('ล็อกการแก้ไขย้อนหลัง'), '');
  await shot('04-ตั้งค่า');

  await as(A, '/performance?tab=leave');
  const lv = await body();
  bad('ฟอร์มลาไม่มีช่วงเวลาที่ลา (ครึ่งวัน)', !lv.includes('ช่วงเวลาที่ลา'), '');
  bad('ฟอร์มลาไม่มีช่องแนบใบรับรองแพทย์', !lv.includes('ใบรับรองแพทย์'), '');
  happy('ยังยื่นคำขอลาได้ตามปกติ', lv.includes('ขอลาใหม่') && lv.includes('ส่งคำขอลา'), '');
  await shot('05-การลา');
}

suite('บทบาทเหลือสามระดับ');
{
  await as(A, '/settings?s=users');
  await settle(2000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('tr')].filter((r) => !r.innerText.includes('ผู้ดูแลระบบ'))
      .map((r) => [...r.querySelectorAll('button')].find((x) => x.innerText.trim() === 'แก้ไข')).find(Boolean);
    if (b) b.click();
  });
  await settle(2000);
  const roles = await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'admin'));
    return sel ? [...sel.options].map((o) => o.value) : [];
  });
  happy(`ช่องบทบาทมีสามระดับ (พบ ${roles.length})`, roles.length === 3, roles.join(', '));
  bad('ไม่มีบทบาทที่ไม่มีในระบบจริงหลงเหลือ',
    !roles.includes('recorder') && !roles.includes('verifier'), roles.join(', '));
  await shot('06-บทบาท');
}

// ── สิ่งที่ระบบจริงมีแต่ของเรายังไม่มี (รอบเทียบ 2026-09-27) ────────────────
suite('หน้าตั้งค่า: หัวข้อ · วิธีใช้งาน · ทางเข้าประวัติการแก้ไข');
{
  await as(A, '/performance?tab=settings');
  await settle(3000);
  const st = await body();
  happy('หัวข้อหน้าเป็น "การตั้งค่า · Settings"', st.includes('การตั้งค่า · Settings'), '');
  happy('บอกว่าค่าที่ตั้งเก็บไว้ในเครื่อง',
    st.includes('การตั้งค่าจะถูกเก็บไว้ในเครื่อง (แต่ละเครื่องอาจไม่เหมือนกัน)'), '');
  for (const h of ['การแสดงในตารางสัปดาห์', 'รูปแบบปี', 'มุมมองเริ่มต้นของแดชบอร์ด',
    'โครงการ / หน่วยงาน', 'หน่วยงานที่แสดง', 'ประวัติการแก้ไข', 'เกี่ยวกับระบบ']) {
    happy(`มีหัวข้อ "${h}"`, st.includes(h), '');
  }
  happy('ตัวเลือกรูปแบบปีมีทั้ง พ.ศ. และ ค.ศ.',
    st.includes('พุทธศักราช (2569)') && st.includes('คริสต์ศักราช (2026)'), '');
  happy('ตัวเลือกการแสดงในตารางใช้คำของเขา',
    st.includes('รหัส (A-1 / 5)') && st.includes('ชื่อกิจกรรม (เต็ม) / 5'), '');
  happy('ส่วนเกี่ยวกับระบบบอกอีเมลและบทบาท',
    st.includes(A.email) && /บทบาท/.test(st), '');
  await shot('07-ตั้งค่า-หัวข้อ');

  // กดตัวเลือกแรกในเครื่องที่ยังไม่มีค่าอะไรเก็บไว้ เคยทำให้หน้าพังทั้งหน้า
  // (perfPrefs.set คืนค่าที่ไม่มี hiddenSites หน้าตั้งค่าอ่าน .includes() ต่อแล้วระเบิด)
  const monthOnHead = () => page.evaluate(() => (document.body.innerText
    .match(/(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s+\d{4}/) || [])[0] || '');
  const beLabel = await monthOnHead();
  happy('เลือก "คริสต์ศักราช" ได้', await clickText('คริสต์ศักราช (2026)'), '');
  await settle(1200);
  const ceLabel = await monthOnHead();
  bad('เปลี่ยนค่าที่เก็บในเครื่องแล้วหน้าไม่พัง',
    !(await body()).includes('เกิดข้อผิดพลาดบางอย่าง'), '');
  happy('ป้ายเดือนบนหัวหน้าเปลี่ยนเป็น ค.ศ. ทันที',
    Boolean(ceLabel) && ceLabel !== beLabel && /\s20\d\d$/.test(ceLabel), `${beLabel} → ${ceLabel}`);
  happy('ค่าที่เก็บยังมีคีย์อื่นครบ ไม่ถูกเขียนทับทิ้ง',
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('hr_perf_prefs') || '{}');
      return Array.isArray(p.hiddenSites) && typeof p.cellNames === 'string' && typeof p.dashView === 'string';
    }), await page.evaluate(() => localStorage.getItem('hr_perf_prefs')));
  await clickText('พุทธศักราช (2569)');
  await settle(1000);
  happy('สลับกลับเป็น พ.ศ. ได้', (await monthOnHead()) === beLabel, `${await monthOnHead()} vs ${beLabel}`);

  // วิธีใช้งานหน้าบันทึกงาน — ห้าขั้นของเขา
  happy('มีปุ่มวิธีใช้งานหน้านี้', await clickText('วิธีใช้งานหน้านี้ (อ่านก่อนเริ่ม)'), '');
  await settle(1200);
  const how = await body();
  happy('เปิดคู่มือ "วิธีใช้งานหน้าบันทึกงาน"', how.includes('วิธีใช้งานหน้าบันทึกงาน'), '');
  for (const s of ['เลือกหน่วยงานและสัปดาห์', 'คลิกช่องว่างของพนักงาน', 'ไม่ต้องกดบันทึก',
    'ทำ 2 งานในวันเดียว', 'แก้ไข & ดูภาพรวม']) {
    happy(`คู่มือมีขั้น "${s}"`, how.includes(s), '');
  }
  happy('อธิบายการถ่วงน้ำหนักครึ่ง-ครึ่งไว้ในคู่มือ', how.includes('0.5 วันทำงาน'), '');
  await shot('08-วิธีใช้งาน');
  await page.keyboard.press('Escape');
  await settle(800);

  // ประวัติการแก้ไขต้องเข้าได้จากหน้าตั้งค่า โดยไม่ต้องเปิดธงฟีเจอร์ใด ๆ
  happy('มีปุ่มเปิดประวัติการแก้ไข', await clickText('เปิดประวัติการแก้ไข →'), '');
  // ประวัติ 1000 แถวใช้เวลาโหลดไม่แน่นอน — รอให้ตารางหรือข้อความว่างขึ้นจริง
  // ไม่ใช่รอเวลาคงที่ แล้วไปเจอสปินเนอร์แทนหัวตาราง
  await page.waitForFunction(() => document.querySelectorAll('th').length > 0
    || /ยังไม่มีประวัติการแก้ไข|โหลดไม่สำเร็จ/.test(document.body.innerText), { timeout: 60000 });
  await settle(600);
  const au = await body();
  happy('ช่องค้นหาใช้คำของเขา', await page.evaluate(() => [...document.querySelectorAll('input')]
    .some((i) => (i.placeholder || '') === 'ค้นหา อีเมล / ชื่อ / ค่า')), '');
  happy('มีตัวกรองหน่วยงานและช่อง', au.includes('ทุกหน่วยงาน') && au.includes('ทุกช่อง'), '');
  const cols = ['เวลา', 'ผู้แก้ไข', 'หน่วยงาน', 'พนักงาน', 'วันที่', 'ช่อง', 'เดิม', 'ใหม่'];
  const heads = await page.evaluate(() => [...document.querySelectorAll('th')].map((x) => x.innerText.trim()));
  happy(`หัวตารางครบแปดคอลัมน์ (พบ ${heads.length})`, cols.every((c) => heads.includes(c)), heads.join(' · '));
  // ตัวนับ N / M อยู่ข้างตัวกรอง
  happy('มีตัวนับจำนวนแถวที่กรองได้', /\d+\s*\/\s*\d+/.test(au), '');
  await shot('09-ประวัติการแก้ไข');
  // ค้นหาคำที่ไม่มีทางเจอ ต้องขึ้น "ไม่พบรายการ" ไม่ใช่ตารางเปล่า
  await page.evaluate(() => {
    const i = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').startsWith('ค้นหา อีเมล'));
    if (!i) return;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, 'ZZZไม่มีทางเจอZZZ');
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(900);
  happy('ค้นไม่เจอแล้วบอกว่า "ไม่พบรายการ"', (await body()).includes('ไม่พบรายการ'), '');
  await page.keyboard.press('Escape');
}

suite('ดัชนีงาน: ลบ · คำอธิบาย · เรียงคอลัมน์ · นำเข้าได้ทั้งสองแท็บ');
{
  await as(A, '/performance?tab=index');
  await settle(3200);
  const ix = await body();
  for (const h of ['รหัสงาน', 'ชื่อ', 'คำอธิบาย', 'หมวดหมู่']) {
    happy(`หัวคอลัมน์กิจกรรมมี "${h}"`, ix.includes(h), '');
  }
  happy('ปุ่มเพิ่มใช้คำของเขา', ix.includes('+ เพิ่มกิจกรรม'), '');
  happy('บอกว่าหัวคอลัมน์กดเรียงได้', ix.includes('คลิกหัวคอลัมน์เพื่อจัดเรียง'), '');
  const nDel = await page.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => b.innerText.trim() === 'ลบ').length);
  happy(`ทุกแถวมีปุ่มลบ (พบ ${nDel} ปุ่ม)`, nDel >= 44, `${nDel}`);

  // เรียงสามจังหวะ: กดหัวคอลัมน์รหัสแล้วลำดับต้องเปลี่ยน และกดครบสามครั้งกลับเดิม
  const codes = () => page.evaluate(() => [...document.querySelectorAll('tbody tr td:first-child')]
    .map((td) => td.innerText.trim()).slice(0, 5).join(','));
  const original = await codes();
  const clickHead = (label) => page.evaluate((l) => {
    const th = [...document.querySelectorAll('th')].find((x) => x.innerText.trim() === l);
    if (th) th.click();
  }, label);
  await clickHead('รหัสงาน'); await settle(600);
  const desc = await codes();
  happy('กดหัวคอลัมน์ครั้งแรกเรียงกลับทาง', desc !== original, `${original} → ${desc}`);
  await clickHead('รหัสงาน'); await settle(600);
  await clickHead('รหัสงาน'); await settle(600);
  happy('กดครบสามจังหวะกลับเป็นลำดับเดิม', (await codes()) === original, await codes());

  // นำเข้า: ต้องมีโมดัลแบบเขา และต้องมีทั้งสองแท็บ
  happy('มีปุ่มนำเข้าในแท็บกิจกรรม', await clickText('นำเข้า'), '');
  await settle(1400);
  const im = await body();
  happy('โมดัลชื่อ "นำเข้ารายการดัชนีงาน"', im.includes('นำเข้ารายการดัชนีงาน'), '');
  happy('มีหัวข้อวิธีนำเข้าและลำดับคอลัมน์', im.includes('วิธีนำเข้า') && im.includes('ลำดับคอลัมน์:'), '');
  happy('มีปุ่มเทมเพลตเปล่าและปุ่มเลือกไฟล์',
    im.includes('ดาวน์โหลดเทมเพลตเปล่า') && im.includes('เลือกไฟล์ที่กรอกแล้ว'), '');
  await shot('10-นำเข้าดัชนีงาน');
  await page.keyboard.press('Escape');
  await settle(800);

  await clickTab('หมวดงาน (Work Category)');
  await settle(1600);
  const cx = await body();
  // หัวตารางถูก CSS ทำเป็นตัวพิมพ์ใหญ่ (tbl-th uppercase) — เทียบแบบไม่สนตัวพิมพ์
  const cxHeads = await page.evaluate(() => [...document.querySelectorAll('th')].map((x) => x.innerText.trim().toLowerCase()));
  happy('แท็บหมวดงานใช้หัวคอลัมน์ของเขา',
    cxHeads.includes('รหัส') && cxHeads.includes('หมวดงาน (ไทย)')
      && cxHeads.includes('work category (english)'), cxHeads.join(' · '));
  happy('แท็บหมวดงานมีปุ่ม "+ เพิ่มหมวดงาน"', cx.includes('+ เพิ่มหมวดงาน'), '');
  happy('นำเข้าได้จากแท็บหมวดงานด้วย', await clickText('นำเข้า'), '');
  await settle(1400);
  happy('โมดัลชื่อ "นำเข้าหมวดงาน"', (await body()).includes('นำเข้าหมวดงาน'), '');
  await shot('11-นำเข้าหมวดงาน');
  await page.keyboard.press('Escape');
}

suite('คำขอ: หัวคอลัมน์ · ตัวกรองประวัติ · สรุปจำนวน');
{
  // แถวหัวคอลัมน์และบรรทัดสรุปของ "คำขอของฉัน" ขึ้นเฉพาะเมื่อมีคำขออยู่จริง
  // และ /leave/mine กรองด้วย requested_by = ตัวเอง ชุดนี้จึงต้องยื่นคำขอของ
  // ตัวเองก่อน ไม่ใช่พึ่งคำขอที่ค้างอยู่ในฐานข้อมูลจากที่อื่น — พึ่งของเดิมคือ
  // สาเหตุที่แปดข้อนี้ล้มทันทีที่ข้อมูลทดสอบเก่าถูกล้างออก (2026-09-27)
  const own = await call('/performance/leave', { method: 'POST', user: A,
    body: { employeeId: emp.id, leaveType: 'sick', from: '2027-03-01', to: '2027-03-02', reason: `${MARK} ตรวจหัวคอลัมน์` } });
  happy('ยื่นคำขอของตัวเองไว้ตรวจหัวคอลัมน์ได้', own.status === 201, `${own.status} ${own.error || ''}`);
  await as(A, '/performance?tab=leave');
  await settle(3500);
  const lv = await body();
  happy('หัวข้อหน้าเป็น "คำขอ" พร้อมคำบรรยายของเขา',
    lv.includes('ขอลาและติดตามสถานะคำขอของคุณ'), '');
  const heads = await page.evaluate(() => {
    const row = [...document.querySelectorAll('div')].find((d) => (d.className || '').includes('uppercase'));
    return row ? row.innerText.split('\n').map((x) => x.trim()).filter(Boolean) : [];
  });
  for (const c of ['ชื่อพนักงาน', 'หน่วยงาน', 'ช่วงวันที่ลา', 'วัน', 'ประเภทการลา', 'เหตุผล', 'สถานะ']) {
    happy(`แถวหัวคอลัมน์มี "${c}"`, heads.includes(c), heads.join(' · '));
  }
  happy('สรุปจำนวนบนรายการของฉัน', /รอดำเนินการ\s*\d+\s*·\s*อนุมัติแล้ว\s*\d+\s*·\s*ไม่อนุมัติ\s*\d+/.test(lv), '');
  happy('ช่องเหตุผลใช้ตัวอย่างของเขา', await page.evaluate(() => [...document.querySelectorAll('input')]
    .some((i) => (i.placeholder || '') === 'เช่น ลาป่วย ลากิจ ลาพักผ่อน')), '');
  happy('ช่องเลือกชื่อใช้คำว่า "— เลือกชื่อ —"', lv.includes('— เลือกชื่อ —'), '');

  await clickTab('รออนุมัติ');
  await settle(1500);
  happy('แท็บรออนุมัติบอกขอบเขตว่าทุกหน่วยงานในสิทธิ์',
    (await body()).includes('ทุกหน่วยงานในสิทธิ์ของคุณ'), '');
  await clickTab('ประวัติการพิจารณา');
  await settle(1500);
  const hist = await body();
  happy('ประวัติการพิจารณามีตัวกรองสามปุ่ม',
    hist.includes('ทั้งหมด') && hist.includes('อนุมัติแล้ว') && hist.includes('ไม่อนุมัติ'), '');
  happy('สรุปจำนวนบนประวัติการพิจารณา', /อนุมัติแล้ว\s*\d+\s*·\s*ไม่อนุมัติ\s*\d+/.test(hist), '');
  await shot('12-คำขอ');
}

suite('แดชบอร์ด: ป้ายวงแหวน · หน่วยวันทำงาน · หัวข้อหน้า');
{
  await as(A, '/performance?tab=dashboard');
  await settle(4000);
  const db = await body();
  happy('หัวข้อหน้าและคำบรรยายตามเขา',
    db.includes('ภาพรวมการบันทึกการทำงานรายหน่วยงาน'), '');
  happy('ป้ายข้างวงแหวนบอก "บันทึกครบ N / M ช่อง"',
    /บันทึกครบ\s*\d+\s*\/\s*\d+\s*ช่อง/.test(db.replace(/\n/g, ' ')), '');
  happy('ป้ายสถิติใช้คำของเขา',
    db.includes('พนักงาน') && db.includes('รายการใน') && db.includes('เริ่มบันทึกแล้ว'), '');
  happy('บอกความหมายของ "เริ่มบันทึกแล้ว"', db.includes('พนักงานที่ลงอย่างน้อย 1 วัน'), '');
  happy('บอกสัดส่วนสนับสนุน/ปฏิบัติการใต้จำนวนพนักงาน',
    /\d+\s*สนับสนุน\s*·\s*\d+\s*ปฏิบัติการ/.test(db.replace(/\n/g, ' ')), '');
  await shot('13-แดชบอร์ด');

  await clickText('กิจกรรมหลัก');
  await settle(2500);
  const top = await body();
  happy('มุมมองกิจกรรมหลักเปลี่ยนมุมขวาเป็นจำนวนรายการ',
    /\d+\s*รายการ/.test(top.replace(/\n/g, ' ')) && !/บันทึกครบ/.test(top), '');
  happy('แถวอันดับบอกหน่วยเป็น "วันทำงาน"',
    top.includes('วันทำงาน') || top.includes('ยังไม่มีบันทึกในเดือนนี้')
      || top.includes('ไม่ตรงกับดัชนี'), '');
  await shot('14-กิจกรรมหลัก');
}

suite('ตัวเลือกเดือนเป็นป็อปโอเวอร์แบบเขา (แท็บปี + ตารางเดือน)');
{
  await as(A, '/performance?tab=dashboard');
  await settle(3000);
  // ปุ่มกลางของตัวเลือกเดือนคือปุ่มที่มีชื่อเดือนไทยอยู่ข้างใน
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find((x) => /^(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s/.test(x.innerText.trim()));
    if (!b) return false;
    b.click();
    return true;
  });
  happy('กดปุ่มเดือนเปิดป็อปโอเวอร์ได้', opened, '');
  await settle(1000);
  const months = await page.evaluate(() => [...document.querySelectorAll('button')]
    .map((b) => b.innerText.trim())
    .filter((x) => /^(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)$/.test(x)));
  happy(`ป็อปโอเวอร์มีตารางเดือนครบ 12 ช่อง (พบ ${months.length})`, months.length === 12, months.join(','));
  const years = await page.evaluate(() => [...document.querySelectorAll('button')]
    .map((b) => b.innerText.trim()).filter((x) => /^25\d\d$/.test(x)));
  happy(`มีแท็บปีให้เลือก (พบ ${years.length})`, years.length >= 1, years.join(','));
  // เดือนอนาคตกดไม่ได้ — บันทึกล่วงหน้าเกินพรุ่งนี้ไม่ได้อยู่แล้ว
  const disabled = await page.evaluate(() => [...document.querySelectorAll('button[disabled]')]
    .filter((b) => /^(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)$/.test(b.innerText.trim())).length);
  bad('เดือนที่ยังไม่มาถึงกดไม่ได้', disabled > 0, `${disabled} เดือน`);
  await shot('15-ตัวเลือกเดือน');
  // ลูกศรเดินทีละเดือนยังต้องใช้ได้
  const label = () => page.evaluate(() => (document.body.innerText.match(/(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s+25\d\d/) || [])[0] || '');
  await page.keyboard.press('Escape');
  await settle(500);
  const before = await label();
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'เดือนก่อนหน้า');
    if (b) b.click();
  });
  await settle(2500);
  happy('ลูกศรถอยเดือนยังใช้ได้', (await label()) !== before, `${before} → ${await label()}`);
}

suite('หน้าบันทึกงาน: ป้ายกำกับช่อง · ไม่เลือกหน่วยงานให้เอง · ปุ่มส่งออกปุ่มเดียว');
{
  await as(A, '/performance?tab=entry');
  await settle(3200);
  const en = await body();
  happy('ไม่เลือกหน่วยงานให้อัตโนมัติ', en.includes('— เลือกหน่วยงาน —'), '');
  happy('หน้าว่างบอกวิธีเลือกหน่วยงาน',
    en.includes('เลือกหน่วยงานเพื่อเริ่มบันทึก') && en.includes('เปิดบันทึก'), '');
  happy('ช่องในแถบเครื่องมือมีป้ายกำกับ',
    en.includes('หน่วยงาน') && en.includes('เดือน'), '');
  // เลือกหน่วยงานแล้วป้าย "มุมมอง"/"สัปดาห์" ต้องขึ้น และปุ่มส่งออกต้องมีปุ่มเดียว
  await page.evaluate((n) => {
    const sel = document.querySelector('select[aria-label="เลือกไซต์งาน"]');
    const opt = [...sel.options].find((o) => o.text.includes(n));
    if (!opt) return;
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }, `${MARK} ไซต์ตรวจรูปร่าง`);
  await settle(3500);
  const en2 = await body();
  happy('มีป้าย "มุมมอง"', en2.includes('มุมมอง'), '');
  const xls = await page.evaluate(() => [...document.querySelectorAll('a, button')]
    .filter((b) => /Excel/.test(b.innerText)).map((b) => b.getAttribute('title') || b.innerText.trim()));
  happy(`ปุ่มส่งออก Excel เหลือปุ่มเดียว (พบ ${xls.length})`, xls.length === 1, xls.join(' | '));
  happy('คำอธิบายปุ่มส่งออกตรงกับของเขา',
    (xls[0] || '').includes('โดยคงรูปแบบเดิมไว้'), xls[0] || '');
  await shot('16-บันทึกงาน');
}

suite('ไม่มีข้อผิดพลาดซ่อนอยู่');
bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' | '));

suite('ไม่ทิ้งข้อมูลทดสอบไว้');
await clean();
await query('delete from units where code like $1', [`${MARK}%`]);
happy('ลบข้อมูลทดสอบหมดแล้ว',
  (await query('select count(*)::int n from employees where employee_code like $1', [`${MARK}%`])).rows[0].n === 0, '');

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
