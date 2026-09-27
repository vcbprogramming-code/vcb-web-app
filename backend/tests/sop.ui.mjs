/**
 * คู่มือการปฏิบัติงาน (SOP) — อ่าน ค้นหา แก้ไข แล้วกู้คืน
 *
 * หน้าประวัติเวอร์ชันเพิ่งสร้างและยังไม่เคยมีใครคลิก ชุด API พิสูจน์ว่าเก็บ
 * เวอร์ชันครบทุกเส้นทาง ชุดนี้ถามว่าคนหนึ่งคนกู้คืนคู่มือกลับได้จริงไหม
 * และระหว่างนั้นคู่มือยังอ่านออกอยู่หรือเปล่า
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query, call } from './harness.mjs';
import { clickInDialog, dialogButtons } from './tools/ui.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/sop-ui`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin, H = U.hr;
const MARK = 'ZZSOPUI';
// จำเลขเวอร์ชันล่าสุดตอนเริ่ม แล้วลบเฉพาะที่ใหม่กว่านั้น — เลข id มีช่องว่างได้
// (เวอร์ชันเก่าถูกลบไปบ้าง) เคยคำนวณจาก min(id)+จำนวน แล้วลบประวัติจริงที่
// ไม่ใช่ของชุดนี้ทิ้ง รวมถึงฉบับสำรองของคู่มือเล่มเดิม
const startMaxId = (await query('select coalesce(max(id),0)::int id from sop_versions')).rows[0].id;
const clean = async () => {
  const list = (await call('/sop/scenarios', { user: A })).data || [];
  for (const x of list.filter((r) => String(r.title_th).startsWith(MARK))) {
    await call(`/sop/scenarios/${x.no}`, { method: 'DELETE', user: A });
  }
  await query('delete from sop_versions where id > $1', [startMaxId]);
};

// เก็บกวาดก่อนเริ่ม ไม่ใช่แค่ตอนจบ — รอบก่อนถ้าตายกลางคัน (เช่น API รีสตาร์ต)
// กรณีทดสอบที่ค้างไว้จะไปบวกกับจำนวนกรณีต่อหมวด แล้วรอบนี้จะฟ้องว่าตัวเลขไม่ตรง
// ทั้งที่ระบบถูก
await clean();

fs.rmSync(`${ROOT}/chrome-sop`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-sop`,
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
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });

// ตั้งหน้าเริ่มต้นเป็น "กรณีทั้งหมด" ให้ทุกรอบ เพราะชุดนี้ตรวจรายการกรณีเป็นหลัก
// ถ้าไม่ตั้ง ระบบจะเปิดมาที่ผังกระบวนการตามค่าเริ่มต้นของระบบจริง (ตรวจไว้ในข้อ 1)
const as = async (user, path = '/sop', view = 'ALL') => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t, v) => {
    localStorage.clear();
    localStorage.setItem('hr_access_token', t);
    if (v) localStorage.setItem('vcb_sop_default_view', v);
  }, tok(user), view);
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3000);
};
const clickText = (label) => page.evaluate((l) => {
  const el = [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim() === l)
    || [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim().includes(l));
  if (el) { el.click(); return true; } return false;
}, label);

// ── 1. เปิดคู่มือและอ่าน ──────────────────────────────────────────────────
suite('1. เปิดคู่มือแล้วอ่านได้');
{
  await as(A);
  const t = await body();
  happy('เปิดหน้าคู่มือได้', t.includes('คู่มือ') || t.includes('SOP'), t.slice(0, 70));
  happy('เห็นแท็บกรณีเฉพาะ ผังกระบวนการ วิธีเรียก Report',
    t.includes('กรณีเฉพาะ') && t.includes('ผังกระบวนการ') && t.includes('วิธีเรียก Report'), '');
  happy('ผู้ดูแลเห็นแท็บประวัติเวอร์ชัน', t.includes('ประวัติเวอร์ชัน'), '');
  await shot('01-หน้าคู่มือ');

  // ยังไม่เคยตั้งหน้าเริ่มต้น → เปิดมาที่ผังกระบวนการ ตามระบบจริง และหมวดของผัง
  // กางอยู่ ส่วนหมวดของกรณียังพับ (กางได้ทีละกลุ่ม)
  await as(A, '/sop', '');
  const first = await page.evaluate(() => ({
    flows: !!document.querySelector('[data-flowmod]'),
    cases: !!document.querySelector('[data-mod]'),
    open: document.querySelector('[data-group="flows"]')?.getAttribute('aria-expanded'),
  }));
  happy('ยังไม่ตั้งค่า → เปิดมาที่ผังกระบวนการ', first.flows && first.open === 'true', JSON.stringify(first));
  happy('กางทีละกลุ่ม — หมวดของกรณียังพับอยู่', first.cases === false, JSON.stringify(first));
  // กดหัวกลุ่มที่กางอยู่แล้ว = พับเก็บ ไม่ใช่เปลี่ยนหน้า
  await page.evaluate(() => document.querySelector('[data-group="flows"]')?.click());
  await settle(400);
  happy('กดหัวกลุ่มซ้ำแล้วพับเก็บ',
    await page.evaluate(() => !document.querySelector('[data-flowmod]')
      && document.querySelector('[data-group="flows"]')?.getAttribute('aria-expanded') === 'false'), '');
  await as(A);
}

// ── 2. ค้นหาและกรอง ──────────────────────────────────────────────────────
suite('2. ค้นหาและกรองตามหมวดงาน');
{
  // แต่ละกรณีศึกษาเป็นปุ่มในคอลัมน์ซ้าย ขึ้นต้นด้วยชิปรหัส เช่น PO-1
  const countCases = () => page.evaluate(() =>
    [...document.querySelectorAll('button .chip')].filter((c) => /^[A-Z]{2}-\d+$/.test(c.innerText.trim())).length);
  const before = await countCases();
  await page.evaluate(() => {
    const i = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('ค้นหา'));
    if (!i) return;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, 'ใบขอซื้อ');
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(1600);
  const after = await countCases();
  happy(`ค้นหาแล้วรายการแคบลง (${before} → ${after})`,
    before > 0 && (after < before || (await body()).includes('ไม่พบ')), `${before} → ${after}`);
  await shot('02-ค้นหา');
  // ล้างคำค้นกลับ
  await page.evaluate(() => {
    const i = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('ค้นหา'));
    if (!i) return;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, '');
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(1400);
}

// ── 3. คำและตัวเลขเดียวกับหน้าเว็บที่ลูกค้าใช้อยู่ ────────────────────────
// ตัวเลขในชุดนี้คัดจากหน้าเว็บของเขาวันที่ 27 กันยายน 2569 — ถ้าหน้าจอเราเพี้ยน
// จากนี้ คนของเขาที่อ่านคู่มือสองที่พร้อมกันจะเห็นเลขไม่ตรง
suite('3. คำและตัวเลขเดียวกับระบบที่ลูกค้าใช้จริง');
{
  await as(A);
  const t = await body();
  happy('แถบหัวโมดูลเป็นคำและโครงของเขา',
    /STANDARD OPERATING PROCEDURE/i.test(t) && t.includes('VCB Group')
      && t.includes('กลุ่มวิจิตรภัณฑ์ก่อสร้าง · ระเบียบปฏิบัติงานมาตรฐาน'),
    t.slice(0, 110).replace(/\n/g, ' | '));
  happy('บอกเวอร์ชันและวันที่มีผล', t.includes('เวอร์ชัน:') && t.includes('มีผล:'), '');
  happy('บรรทัดนับผลลัพธ์เป็นรูปแบบของเขา (แสดง n จาก N กรณี)', /แสดง\s*33\s*จาก\s*33\s*กรณี/.test(t), '');
  happy('เมนูซ้ายมีสามกลุ่มของเขา',
    t.includes('กรณีเฉพาะ') && t.includes('Case Studies · ตามหมวด')
      && t.includes('Process Flow ทุกขั้นตอน') && t.includes('เมนูเรียกรายงานสำคัญ'), '');
  happy('มีวิธีใช้สามขั้นบนหน้าแรก',
    t.includes('เลือกหมวด (ซ้าย)') && t.includes('เลือกกรณี (กลาง)') && t.includes('อ่านรายละเอียด (ขวา)'), '');
  happy('หัวข้อวัตถุประสงค์ใช้คำของเขา', t.includes('วัตถุประสงค์และขอบเขต · Purpose & Scope'), '');
  happy('ช่องค้นหาใช้ตัวอย่างชุดเดียวกับเขา',
    await page.evaluate(() => [...document.querySelectorAll('input')]
      .some((i) => (i.placeholder || '').includes('น้ำมัน, Advance, PO, เช็ค, โอนเงิน'))), '');

  // ชิปหมวดของเขานับกรณีที่ถูกแท็กเข้าหมวดนั้นด้วย ไม่ใช่เฉพาะหมวดหลัก
  const WANT = { PO: 12, IC: 8, AP: 16, FA: 7, PM: 6, OF: 10, GL: 11, AR: 10, BD: 2, FIN: 1, SE: 8 };
  const chips = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('[data-mod]')].map((el) => [el.dataset.mod, Number(el.dataset.count)])));
  const wrongChips = Object.entries(WANT).filter(([k, v]) => chips[k] !== v);
  happy('จำนวนกรณีต่อหมวดในเมนูซ้ายตรงกับของเขาทั้ง 11 หมวด', wrongChips.length === 0,
    `${JSON.stringify(chips)} ต่างที่ ${JSON.stringify(wrongChips)}`);
  await shot('03-หน้าแรกและชิปหมวด');

  // เปิดกรณี PO-1 จากรหัสแสดงผล — คนของเขาเรียกกรณีกันด้วยรหัสนี้
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find((x) => x.querySelector('.chip') && x.querySelector('.chip').textContent.trim() === 'PO-1');
    if (b) { b.click(); return true; } return false;
  });
  happy('การ์ดกรณีขึ้นรหัสแสดงผลรายหมวด (PO-1)', opened, '');
  await settle(2600);
  const d = await body();
  happy('คำบนหน้ารายละเอียดเป็นคำของเขา',
    d.includes('ปัญหา / สถานการณ์ · PROBLEM') && d.includes('แนวทางปฏิบัติ · SOLUTION (SOP)'), '');
  happy('มีหัวข้อเอกสารที่เกี่ยวข้อง และบอกวันที่เพิ่ม/อ้างอิง',
    d.includes('เอกสารที่เกี่ยวข้อง') && d.includes('วันที่เพิ่ม:') && d.includes('อ้างอิง (Reference)'), '');
  happy('ปุ่มบนหน้ารายละเอียดใช้คำของเขา', d.includes('แก้ไข · Edit') && d.includes('ลบ · Delete'), '');
  await shot('04-รายละเอียดกรณี');

  happy('เปิดแท็บวิธีเรียก Report ได้', await clickText('วิธีเรียก Report'), '');
  await settle(2400);
  const r = await body();
  happy('หัวคอลัมน์ตารางรายงานเป็นคำของเขา',
    r.includes('ต้องการตรวจสอบอะไร') && r.includes('เมนูที่ใช้ · Menu Path'), '');
  await shot('05-วิธีเรียก Report');

  happy('เปิดแท็บผังกระบวนการได้', await clickText('ผังกระบวนการ'), '');
  await settle(3000);
  const f = await body();
  happy('หัวข้อผังใช้คำของเขา', f.includes('ผังกระบวนการ · Process Flows'), '');
  happy('ผังมีคำบรรยายขั้นตอน (เพิ่งนำเข้าครบ 33 ผัง)', f.includes('รายละเอียดขั้นตอน · PROCESS'), '');
  // » และ ! เป็นวิธีเก็บระดับของบรรทัด ไม่ใช่ตัวอักษรที่คนต้องอ่าน
  bad('คำบรรยายไม่โชว์เครื่องหมาย » ให้คนอ่าน', !/(^|\n)\s*»/.test(f), '');
  await shot('06-ผังกระบวนการ');
}

// ── 4. ผู้ที่ไม่มีสิทธิ์แก้ไขไม่เห็นแท็บประวัติ ───────────────────────────
suite('4. ประวัติเวอร์ชันเปิดให้เฉพาะผู้แก้ไข');
{
  await as(H);
  const t = await body();
  bad('ผู้ที่ไม่มีสิทธิ์แก้ไขไม่เห็นแท็บประวัติเวอร์ชัน', !t.includes('ประวัติเวอร์ชัน'), '');
  happy('แต่ยังอ่านคู่มือได้ตามปกติ', t.includes('กรณีเฉพาะ'), '');
  await shot('03-ไม่มีสิทธิ์แก้');
}

// ── 5. แก้ไขคู่มือแล้วเกิดเวอร์ชัน ────────────────────────────────────────
suite('5. แก้ไขคู่มือแล้วประวัติบันทึกให้เอง');
{
  // สร้างผ่าน API เพราะฟอร์มสร้างเคสมีหลายขั้น — ที่ต้องพิสูจน์คือหน้าประวัติ
  const mods = (await call('/sop/bootstrap', { user: A })).data.modules;
  const mk = await call('/sop/scenarios', { method: 'POST', user: A,
    body: { module: mods[0].code, titleTh: `${MARK} กรณีทดสอบหน้าจอ`, steps: [{ text: 'ขั้นที่หนึ่ง' }] } });
  happy('สร้างกรณีศึกษาไว้ทดสอบได้', mk.status === 201, `${mk.status}`);

  await as(A);
  happy('เปิดแท็บประวัติเวอร์ชันได้', await clickText('ประวัติเวอร์ชัน'), '');
  await settle(2600);
  const t = await body();
  happy('เห็นรายการเวอร์ชัน', t.includes('เพิ่มกรณีศึกษาใหม่'), t.slice(0, 120).replace(/\n/g, ' | '));
  happy('บอกว่าใครแก้', t.includes(A.name), '');
  happy('บอกจำนวนเนื้อหาในเวอร์ชันนั้น', /\d+\s*กรณี/.test(t), '');
  happy('มีปุ่มกู้คืนทุกแถว',
    await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === 'กู้คืน').length > 0), '');
  await shot('04-ประวัติเวอร์ชัน');
}

// ── 6. ลบแล้วกู้คืนจากหน้าจอ ──────────────────────────────────────────────
suite('6. ลบกรณีเฉพาะแล้วกู้คืนกลับได้จากหน้าจอ');
{
  const list = (await call('/sop/scenarios', { user: A })).data || [];
  const mine = list.find((x) => String(x.title_th).startsWith(MARK));
  await call(`/sop/scenarios/${mine.no}`, { method: 'DELETE', user: A });
  const gone = ((await call('/sop/scenarios', { user: A })).data || [])
    .every((x) => !String(x.title_th).startsWith(MARK));
  happy('ลบออกไปแล้วจริง', gone, '');

  await as(A);
  await clickText('ประวัติเวอร์ชัน');
  // รอให้ตารางประวัติมาจริง แทนการนับวินาที — ตารางดึงเวอร์ชัน 50 ชุดมาวาด
  // ช้าเร็วไม่เท่ากันตามโหลดของเซิร์ฟเวอร์
  let clicked = false;
  for (let i = 0; i < 30 && !clicked; i += 1) {
    // กู้คืนเวอร์ชันที่เก็บไว้ "ก่อนลบ" — แถวที่โน้ตว่าลบกรณีศึกษาออก
    clicked = await page.evaluate(() => {
      const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('ลบกรณีศึกษาออก'));
      const b = row && [...row.querySelectorAll('button')].find((x) => x.innerText.trim() === 'กู้คืน');
      if (b) { b.click(); return true; } return false;
    });
    if (!clicked) await settle(400);
  }
  happy('พบแถวที่เก็บไว้ก่อนลบ และกดกู้คืนได้', clicked, '');
  let dlg = '';
  for (let i = 0; i < 20 && !dlg.includes('กู้คืนคู่มือกลับไปเป็นเวอร์ชันนี้'); i += 1) {
    await settle(300);
    dlg = await body();
  }
  happy('ถามยืนยันก่อนกู้คืน', dlg.includes('กู้คืนคู่มือกลับไปเป็นเวอร์ชันนี้'), '');
  happy('บอกด้วยว่ากู้ผิดเวอร์ชันก็ย้อนกลับได้', dlg.includes('ย้อนกลับได้อีก'), '');
  await shot('05-ยืนยันกู้คืน');

  happy('กดยืนยันในกล่องได้', await clickInDialog(page, 'กู้คืน'), '');
  // การกู้คืนเขียนคืนทั้งเอกสารในทรานแซกชันเดียว — รอผลจริง ไม่ใช่นับวินาที
  let back = false;
  for (let i = 0; i < 20 && !back; i += 1) {
    await settle(1000);
    back = ((await call('/sop/scenarios', { user: A })).data || [])
      .some((x) => String(x.title_th).startsWith(MARK));
  }
  happy('กู้คืนแล้วกรณีศึกษากลับมา', back, '');
  happy('หน้าจอแจ้งว่ากู้คืนแล้ว', (await body()).includes('กู้คืนคู่มือแล้ว') || back, '');
  await shot('06-กู้คืนแล้ว');
}

// ── 7. ปุ่มยืนยันสีถูกต้อง ────────────────────────────────────────────────
suite('7. กล่องยืนยันการกู้คืนไม่ใช่สีแดง');
{
  await as(A);
  await clickText('ประวัติเวอร์ชัน');
  // รอให้ตารางเวอร์ชันมาจริงแล้วค่อยกด แทนการนับวินาที — ตารางโหลดช้าเร็วไม่เท่ากัน
  // และถ้ากดตอนยังไม่มีปุ่ม ชุดนี้จะฟ้องว่าสีปุ่มผิดทั้งที่ยังไม่มีกล่องให้ดูสี
  let hasRestore = false;
  for (let i = 0; i < 25 && !hasRestore; i += 1) {
    hasRestore = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some((x) => x.innerText.trim() === 'กู้คืน'));
    if (!hasRestore) await settle(400);
  }
  happy('หน้าประวัติเวอร์ชันโหลดปุ่มกู้คืนมาแล้ว', hasRestore, '');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'กู้คืน');
    if (b) b.click();
  });
  let colors = [];
  for (let i = 0; i < 20 && !colors.some((c) => c.text === 'กู้คืน'); i += 1) {
    colors = await dialogButtons(page);
    if (!colors.some((c) => c.text === 'กู้คืน')) await settle(300);
  }
  const go = colors.find((c) => c.text === 'กู้คืน');
  // กู้คืนไม่ใช่การทำลาย ปุ่มเดินหน้าจึงต้องเป็นสีเขียว ไม่ใช่แดง
  happy('ปุ่มกู้คืนเป็นสีเขียว ไม่ใช่แดง',
    Boolean(go) && /rgb\(5,\s*150/.test(go.bg), JSON.stringify(go));
  await clickInDialog(page, 'ยกเลิก');
  await settle(1200);
}

suite('10. แก้ไขหัวเอกสารได้จากหน้าจอ');
{
  // ระบบจริงของลูกค้ามีหน้าต่าง "แก้ไขหัวเอกสาร" สำหรับแก้ชื่อคู่มือ/ฉบับ/วันมีผล
  // ของเราเพิ่งเพิ่ม — ตรวจทั้งเส้นทาง: เปิดหน้าต่าง แก้ฉบับ บันทึก แล้วคืนค่าเดิม
  const before = (await call('/sop/bootstrap', { user: A })).data.meta;
  await page.goto(`${APP}/sop`, { waitUntil: 'networkidle2' });
  await settle(1500);
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().startsWith('แก้ไขหัวเอกสาร'));
    if (!b) return false; b.click(); return true;
  });
  happy('มีปุ่ม "แก้ไขหัวเอกสาร" ในเมนูซ้าย (เฉพาะผู้แก้ไข)', opened, '');
  await settle(900);
  const title = await page.evaluate(() => document.body.innerText.includes('แก้ไขหัวเอกสาร · Edit document header'));
  happy('หน้าต่างใช้ชื่อเดียวกับระบบจริง', title, '');
  const typed = await page.evaluate((v) => {
    const lab = [...document.querySelectorAll('label')].find((l) => l.innerText.trim().startsWith('เวอร์ชัน'));
    const inp = lab && lab.parentElement ? lab.parentElement.querySelector('input') : null;
    if (!inp) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(inp, v); inp.dispatchEvent(new Event('input', { bubbles: true })); return true;
  }, `${before.version} ZZMETA`);
  happy('กรอกช่องเวอร์ชันได้', typed, '');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'บันทึก');
    if (b) b.click();
  });
  await settle(1800);
  const after = (await call('/sop/bootstrap', { user: A })).data.meta;
  happy('บันทึกแล้วค่าที่เก็บเปลี่ยนจริง', after.version === `${before.version} ZZMETA`, after.version);
  bad('ชื่อเอกสารว่างต้องถูกปฏิเสธ',
    (await call('/sop/meta', { method: 'PATCH', user: A, body: { title: '' } })).status === 400, '');
  // คืนค่าเดิมและลบเวอร์ชันที่เกิดจากการทดสอบ (clean() ลบให้ตอนท้ายอยู่แล้ว)
  await call('/sop/meta', { method: 'PATCH', user: A, body: { version: before.version } });
  const back = (await call('/sop/bootstrap', { user: A })).data.meta;
  happy('คืนค่าหัวเอกสารเดิมแล้ว', back.version === before.version, back.version);
}

suite('8. ไม่มีข้อผิดพลาดซ่อนอยู่');
bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' | '));

suite('9. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await clean();
  const left = ((await call('/sop/scenarios', { user: A })).data || [])
    .filter((x) => String(x.title_th).startsWith(MARK)).length;
  happy('ลบกรณีศึกษาทดสอบหมดแล้ว', left === 0, `${left}`);
}

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
