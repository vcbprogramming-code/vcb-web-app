/**
 * หน้าลงบันทึกรายวัน — สิ่งที่คนกรอกต้องเห็นและกดได้จริงบนหน้าจอ
 *
 * ทุกข้อมาจากการเทียบกับหน้าจอจริงของลูกค้า (HR DAILY WORK LOG) ที่ผู้ใช้ชี้ว่า
 * ของเขาทำได้แต่ของเราไม่มี ข้อที่หนักที่สุดคือกล่องเลือกกิจกรรมเคยไปโผล่มุมซ้ายบน
 * ของจอเสมอ เพราะช่องที่คลิกถูกสร้างใหม่ทิ้งของเดิมก่อนกล่องจะวัดตำแหน่งได้
 */
import puppeteer from 'puppeteer-core';
import { call, suite, happy, bad, report, U, tok, APP, warm, query } from './harness.mjs';

await warm();
const A = U.admin;
const MARK = 'ZZUX';
const ROOT = '/private/tmp/claude-501/-Users-pok-Desktop-Jobs--------------------/433cbf75-c00f-4cb4-a565-7affda174a77/scratchpad/check';

const clean = async () => {
  const units = (await query('select id from units where name like $1', [`${MARK}%`])).rows.map((r) => r.id);
  if (units.length) {
    const emps = (await query('select id from employees where unit_id = any($1)', [units])).rows.map((r) => r.id);
    await query('delete from leave_requests where employee_id = any($1)', [emps]);
    await query('delete from employee_away where employee_id = any($1)', [emps]);
    await query('delete from work_log_audit where unit_id = any($1)', [units]);
    await query('delete from work_logs where unit_id = any($1)', [units]);
    await query('delete from employees where unit_id = any($1)', [units]);
    await query('delete from units where id = any($1)', [units]);
  }
};
await clean();

const site = (await call('/performance/sites', { method: 'POST', user: A, body: { name: `${MARK} ไซต์ทดสอบหน้าจอ` } })).data;
const emp = (await call('/performance/employees', { method: 'POST', user: A,
  body: { site: site.key, fullName: `${MARK} พนักงาน`, kind: 'operation' } })).data;
const boot = await call(`/performance/site-month?site=${site.key}&year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`, { user: A });
const TODAY = boot.today;
const [Y, M] = TODAY.split('-').map(Number);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', userDataDir: `${ROOT}/chrome-ux`, defaultViewport: { width: 1440, height: 900 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0];
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

const open = async () => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((tk) => { localStorage.clear(); localStorage.setItem('hr_access_token', tk); }, tok(A));
  await page.goto(`${APP}/performance?tab=entry`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2500));
  // เลือกไซต์ทดสอบ แล้วเข้ามุมมองรายสัปดาห์
  await page.select('select[aria-label="เลือกไซต์งาน"]', site.key).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'รายสัปดาห์');
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
};
const bodyText = () => page.evaluate(() => document.body.innerText);
/** พิกัดของกล่องเลือกกิจกรรม (null = ไม่ได้เปิดอยู่) */
const pickerBox = () => page.evaluate(() => {
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('ค้นหา'));
  if (!inp) return null;
  let box = inp; while (box && getComputedStyle(box).position !== 'fixed') box = box.parentElement;
  if (!box) return null;
  const r = box.getBoundingClientRect();
  return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) };
});
/** คลิกช่องของวันที่กำหนด แล้วคืนพิกัดของช่องนั้น */
const clickCell = (date, slot = 0) => page.evaluate((d, s) => {
  const cells = [...document.querySelectorAll(`td[data-cell="${d}"] [data-slot]`)];
  const el = cells[s];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  el.click();
  return { left: Math.round(r.left), top: Math.round(r.top), bottom: Math.round(r.bottom) };
}, date, slot);

await open();

suite('1. กล่องเลือกกิจกรรมโผล่ตรงช่องที่คลิก');
{
  const cell = await clickCell(TODAY);
  happy('คลิกช่องของวันนี้ได้', Boolean(cell), JSON.stringify(cell));
  await new Promise((r) => setTimeout(r, 800));
  const box = await pickerBox();
  happy('กล่องเปิดขึ้น', Boolean(box), JSON.stringify(box));
  if (cell && box) {
    // ชิดขอบซ้ายของช่อง (เผื่อกรณีถูกดันเข้ามาเมื่อชนขอบจอ)
    const clamped = await page.evaluate(() => window.innerWidth - Math.min(560, window.innerWidth - 16) - 8);
    happy('อยู่แนวเดียวกับช่องในแนวนอน (หรือถูกดันให้พอดีจอ)',
      Math.abs(box.left - cell.left) <= 40 || Math.abs(box.left - clamped) <= 2, `ช่อง ${cell.left} · กล่อง ${box.left}`);
    // ต้องอยู่ติดกับช่อง ไม่ใช่ลอยไปมุมจอ
    const near = box.top >= cell.bottom - 8 ? box.top - cell.bottom : cell.top - box.bottom;
    happy('อยู่ติดกับช่องในแนวตั้ง', near <= 24, `ห่าง ${near}px`);
    bad('ไม่ไปกองมุมซ้ายบนของจอ', !(box.left <= 12 && box.top <= 12), JSON.stringify(box));
  }
  await page.keyboard.press('Escape');
}

suite('2. คำอธิบายสีและป้ายสถานะการบันทึก');
{
  const txt = await bodyText();
  for (const label of ['วันหยุด', 'วันนี้', 'บันทึกแล้ว']) happy(`คำอธิบายสีมี "${label}"`, txt.includes(label), '');
  happy('คำอธิบายสีบอกเงื่อนไขการล็อก', /ล็อก \(อ่านอย่างเดียว/.test(txt), '');
  happy('ป้ายสถานะเริ่มที่ "พร้อมแก้ไข"', txt.includes('พร้อมแก้ไข'), '');
  happy('ป้ายสัปดาห์บอกเดือนด้วย', /สัปดาห์[\s\S]{0,40}(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)/.test(txt), '');
  happy('ช่องว่างที่กรอกได้มีเครื่องหมายให้เห็น', txt.includes('+ งานที่ 2'), '');
}

suite('3. เลือกกิจกรรมแล้วบันทึกจริง และป้ายสถานะเปลี่ยน');
{
  await clickCell(TODAY);
  await new Promise((r) => setTimeout(r, 800));
  // เลือกกิจกรรมตัวแรกในรายการ แล้วเลือกหมวดต้นทุนถ้ามีขั้นที่สอง
  const pickFirst = () => page.evaluate(() => {
    const row = [...document.querySelectorAll('[data-pick-code]')][0];
    if (!row) return null;
    // แถวในกล่องผูกกับ mousedown (กันกล่องปิดก่อนเลือก) — .click() อย่างเดียวไม่ทำงาน
    row.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    return row.getAttribute('data-pick-code');
  });
  const step1 = await pickFirst();
  await new Promise((r) => setTimeout(r, 900));
  const step2 = await pickFirst();     // null = งานนี้ใช้หมวดเดียว ไม่ต้องเลือกต่อ
  await new Promise((r) => setTimeout(r, 1800));
  happy('เลือกกิจกรรมจากกล่องได้', Boolean(step1), `${step1} → ${step2}`);
  const saved = (await query('select team from work_logs where employee_id = $1 and ymd = $2 and deleted_at is null', [emp.eid, TODAY])).rows[0];
  happy('ค่าที่เลือกถูกบันทึกลงระบบ', Boolean(saved?.team), JSON.stringify(saved || null));
  happy('ป้ายสถานะขึ้นว่าบันทึกแล้ว', (await bodyText()).includes('บันทึกแล้ว'), '');
  await page.keyboard.press('Escape');   // ปิดกล่องก่อนเข้าชุดถัดไป
  await new Promise((r) => setTimeout(r, 400));
}

suite('4. โหมดแก้ย้อนหลังของผู้ดูแลระบบ (เปิด/ปิดแบบระบบจริง)');
{
  const old = new Date(Y, M - 1, 1);
  const oldIso = `${Y}-${String(M).padStart(2, '0')}-01`;
  const lockedDate = oldIso < TODAY ? oldIso : TODAY;   // วันที่ 1 ของเดือนนี้ย่อมเลยกำหนดแล้ว
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('ความครบถ้วน')); if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 600));
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'รายสัปดาห์'); if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 900));
  // เลื่อนไปสัปดาห์แรกของเดือน
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => { const b = document.querySelector('button[aria-label="สัปดาห์ก่อนหน้า"]'); if (b && !b.disabled) b.click(); });
    await new Promise((r) => setTimeout(r, 250));
  }
  const before = await clickCell(lockedDate);
  await new Promise((r) => setTimeout(r, 700));
  bad('โหมดปิดอยู่ → คลิกช่องที่ล็อกแล้วไม่เปิดกล่อง', !(await pickerBox()), JSON.stringify(before));
  happy('มีปุ่มเปิดโหมดแก้ย้อนหลัง', (await bodyText()).includes('แก้ไขย้อนหลัง'), '');
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('แก้ไขย้อนหลัง')); if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 500));
  happy('เปิดแล้วป้ายเปลี่ยนเป็น "เปิดอยู่"', (await bodyText()).includes('แก้ไขย้อนหลังเปิดอยู่'), '');
  await clickCell(lockedDate);
  await new Promise((r) => setTimeout(r, 800));
  happy('เปิดโหมดแล้วคลิกช่องที่ล็อกได้', Boolean(await pickerBox()), '');
  await page.keyboard.press('Escape');
}

suite('5. ตัวเลขคำขอลาที่รออนุมัติขึ้นบนแท็บการลา');
{
  const r = await call('/performance/leave', { method: 'POST', user: A,
    body: { employeeId: emp.eid, leaveType: 'sick', from: TODAY, to: TODAY, reason: `${MARK} ทดสอบ` } });
  happy('ยื่นคำขอลาทดสอบได้', [200, 201].includes(r.status), `${r.status} ${r.error || ''}`);
  const pend = await call('/performance/leave/pending', { user: A });
  const apiCount = (pend.rows || pend.data || []).length;
  await open();
  const badge = await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith('การลา'));
    const m = tab && tab.innerText.match(/(\d+)/);
    return m ? Number(m[1]) : 0;
  });
  happy('ตัวเลขบนแท็บตรงกับจำนวนคำขอที่รออนุมัติ', badge === apiCount && apiCount > 0, `หน้าจอ ${badge} · API ${apiCount}`);
}

suite('6. ไม่มีข้อผิดพลาดบนหน้าจอ และเก็บกวาดข้อมูลทดสอบ');
{
  bad('ไม่มี error ในคอนโซลระหว่างทดสอบ', errors.length === 0, errors.slice(0, 2).join(' · '));
  await browser.close();
  await clean();
  const left = (await query('select count(*)::int n from units where name like $1', [`${MARK}%`])).rows[0].n;
  happy('ลบข้อมูลทดสอบหมดแล้ว', left === 0, `${left}`);
}

process.exit(report() ? 1 : 0);
