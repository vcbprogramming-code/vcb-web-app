/**
 * บันทึกงานฝ่ายบุคคล — รูปร่างเดียวกับระบบที่ลูกค้าใช้จริง
 *
 * ชุดนี้คู่กับ worklog-uat: ชุดนั้นตรวจความสามารถที่มาจากเอกสารเกณฑ์ตรวจรับ
 * ชุดนี้ตรวจว่าเมื่อปิดส่วนเสริมทั้งหมดแล้ว สิ่งที่เหลือตรงกับระบบ Apps Script
 * ที่พนักงานเปิดใช้อยู่ทุกวัน — ห้าหน้าจอ ทะเบียน 44/20 ตัวเลือกสองขั้นที่กรอง
 * ตามหมวดต้นทุนที่อนุญาต และแรงงาน-วันที่คำนวณเอง ไม่ใช่ตัวเลขที่ใครพิมพ์
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query, call } from './harness.mjs';

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
suite('ทะเบียนงานและหมวดต้นทุนตรงกับระบบจริง');
{
  const acts = (await call('/performance/activities', { user: A })).data || [];
  const cats = (await call('/performance/cost-categories', { user: A })).data || [];
  happy(`ประเภทงาน 44 รหัส (พบ ${acts.length})`, acts.length === 44, `${acts.length}`);
  happy(`หมวดต้นทุน 20 หมวด (พบ ${cats.length})`, cats.length === 20, `${cats.length}`);

  const a1 = acts.find((x) => x.code === 'A-1');
  happy('A-1 คือ "งานผูก-ตัด-ดัดเหล็ก" ตามทะเบียนจริง', a1?.name === 'งานผูก-ตัด-ดัดเหล็ก', a1?.name || '—');
  happy('หมวดต้นทุน 1 คือ "งานรื้อย้ายโครงสร้างเดิม"',
    cats.find((c) => c.code === '1')?.name === 'งานรื้อย้ายโครงสร้างเดิม',
    cats.find((c) => c.code === '1')?.name || '—');

  happy('A-1 ระบุหมวดต้นทุนที่ใช้ได้ 7 หมวด', (a1?.allowed_cost || '') === '5,7,8,9,15,17,19', a1?.allowed_cost || '—');
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
  happy('แยกรหัสงานและรหัสหมวดต้นทุนออกจากกันได้',
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
  happy(`ส่วนเสริมปิดอยู่ ${off.length} รายการ`, off.length === 10, off.join(', '));
  for (const [m, p] of [['GET', '/performance/alerts'], ['GET', '/performance/manpower?from=2026-01-01&to=2026-12-31'],
    ['GET', '/performance/departments'], ['GET', '/performance/positions'],
    ['GET', '/performance/period-closes?site=' + site.code], ['GET', '/performance/attachments?site=' + site.code],
    ['GET', '/performance/import/employees/template.xlsx']]) {
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

// แต่ละชุดใช้โปรไฟล์ Chrome ของตัวเอง ไม่ใช้ร่วมกัน — ชุดที่ล้มกลางคันจะทิ้ง
// Chrome ที่ยังถือ lock ของโปรไฟล์ไว้ ชุดถัดไปที่ใช้โปรไฟล์เดียวกันจะค้างตามไป
// ทั้งที่ตัวเองไม่มีอะไรผิด (เกิดขึ้นจริงตอนรันรวมทั้งชุดบนเครื่องที่งานหนัก)
// ── หน้าจอ ────────────────────────────────────────────────────────────────
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

suite('หน้าจอเหลือห้าหน้าเท่าระบบจริง');
{
  await as(A);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('button')]
    .map((b) => b.innerText.trim())
    .filter((x) => ['ภาพรวม', 'ลงบันทึกรายวัน', 'แรงงาน-วัน', 'รายงาน', 'การลา', 'ทะเบียนงาน', 'ตั้งค่า'].includes(x)));
  happy(`เห็นแท็บ ${tabs.length} แท็บ`, tabs.length === 6, tabs.join(' · ')); // 5 + ทะเบียนงาน (admin)
  bad('ไม่มีแท็บ "แรงงาน-วัน" แล้ว', !tabs.includes('แรงงาน-วัน'), tabs.join(' · '));
  await shot('01-แท็บ');

  await as(A, '/performance?tab=manday');
  const txt = await body();
  bad('ลิงก์เก่า ?tab=manday ไม่พาไปหน้าว่าง', txt.includes('ภาพรวม') && !txt.includes('รวมวันนี้'), txt.slice(0, 120).replace(/\n/g, ' | '));
}

suite('ตัวเลือกสองขั้นกรองตามหมวดต้นทุนที่อนุญาต');
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
  await clickText('ลงบันทึกรายวัน');
  await settle(3000);
  // สลับไปมุมมองรายสัปดาห์ที่มีช่องให้คลิก
  await clickText('รายสัปดาห์');
  await settle(2500);
  // ช่องงานที่สองมีข้อความ "+ งานที่ 2" กำกับไว้ ใช้เป็นจุดคลิกที่แน่นอนกว่า
  // การเดา div ตัวแรกในเซลล์ ซึ่งเคยไปโดนคอลัมน์ชื่อพนักงานแทน
  const slot = (await page.evaluateHandle(() => [...document.querySelectorAll('tbody td div')]
    .find((x) => x.innerText.trim() === '+ งานที่ 2'))).asElement();
  happy('พบช่องลงงานในตารางรายสัปดาห์', Boolean(slot), '');
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

suite('ไม่มีข้อผิดพลาดซ่อนอยู่');
bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' | '));

suite('ไม่ทิ้งข้อมูลทดสอบไว้');
await clean();
await query('delete from units where code like $1', [`${MARK}%`]);
happy('ลบข้อมูลทดสอบหมดแล้ว',
  (await query('select count(*)::int n from employees where employee_code like $1', [`${MARK}%`])).rows[0].n === 0, '');

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
