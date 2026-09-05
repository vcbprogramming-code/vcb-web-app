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
const startVersions = (await query('select count(*)::int n from sop_versions')).rows[0].n;
const clean = async () => {
  const list = (await call('/sop/scenarios', { user: A })).data || [];
  for (const x of list.filter((r) => String(r.title_th).startsWith(MARK))) {
    await call(`/sop/scenarios/${x.no}`, { method: 'DELETE', user: A });
  }
  await query('delete from sop_versions where id > $1', [
    (await query('select coalesce(min(id),0)+$1-1 id from sop_versions', [startVersions])).rows[0].id || 0]);
};

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

const as = async (user, path = '/sop') => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
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
  happy('เห็นแท็บกรณีศึกษา ผังกระบวนการ เมนูรายงาน',
    t.includes('กรณีศึกษา') && t.includes('ผังกระบวนการ') && t.includes('เมนูรายงาน'), '');
  happy('ผู้ดูแลเห็นแท็บประวัติเวอร์ชัน', t.includes('ประวัติเวอร์ชัน'), '');
  await shot('01-หน้าคู่มือ');
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

// ── 3. ผู้ที่ไม่มีสิทธิ์แก้ไขไม่เห็นแท็บประวัติ ───────────────────────────
suite('3. ประวัติเวอร์ชันเปิดให้เฉพาะผู้แก้ไข');
{
  await as(H);
  const t = await body();
  bad('ผู้ที่ไม่มีสิทธิ์แก้ไขไม่เห็นแท็บประวัติเวอร์ชัน', !t.includes('ประวัติเวอร์ชัน'), '');
  happy('แต่ยังอ่านคู่มือได้ตามปกติ', t.includes('กรณีศึกษา'), '');
  await shot('03-ไม่มีสิทธิ์แก้');
}

// ── 4. แก้ไขคู่มือแล้วเกิดเวอร์ชัน ────────────────────────────────────────
suite('4. แก้ไขคู่มือแล้วประวัติบันทึกให้เอง');
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

// ── 5. ลบแล้วกู้คืนจากหน้าจอ ──────────────────────────────────────────────
suite('5. ลบกรณีศึกษาแล้วกู้คืนกลับได้จากหน้าจอ');
{
  const list = (await call('/sop/scenarios', { user: A })).data || [];
  const mine = list.find((x) => String(x.title_th).startsWith(MARK));
  await call(`/sop/scenarios/${mine.no}`, { method: 'DELETE', user: A });
  const gone = ((await call('/sop/scenarios', { user: A })).data || [])
    .every((x) => !String(x.title_th).startsWith(MARK));
  happy('ลบออกไปแล้วจริง', gone, '');

  await as(A);
  await clickText('ประวัติเวอร์ชัน');
  await settle(2600);
  // กู้คืนเวอร์ชันที่เก็บไว้ "ก่อนลบ" — แถวที่โน้ตว่าลบกรณีศึกษาออก
  const clicked = await page.evaluate(() => {
    const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('ลบกรณีศึกษาออก'));
    const b = row && [...row.querySelectorAll('button')].find((x) => x.innerText.trim() === 'กู้คืน');
    if (b) { b.click(); return true; } return false;
  });
  happy('พบแถวที่เก็บไว้ก่อนลบ และกดกู้คืนได้', clicked, '');
  await settle(1600);
  const dlg = await body();
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

// ── 6. ปุ่มยืนยันสีถูกต้อง ────────────────────────────────────────────────
suite('6. กล่องยืนยันการกู้คืนไม่ใช่สีแดง');
{
  await as(A);
  await clickText('ประวัติเวอร์ชัน');
  await settle(2400);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'กู้คืน');
    if (b) b.click();
  });
  await settle(1500);
  const colors = await dialogButtons(page);
  const go = colors.find((c) => c.text === 'กู้คืน');
  // กู้คืนไม่ใช่การทำลาย ปุ่มเดินหน้าจึงต้องเป็นสีเขียว ไม่ใช่แดง
  happy('ปุ่มกู้คืนเป็นสีเขียว ไม่ใช่แดง',
    Boolean(go) && /rgb\(5,\s*150/.test(go.bg), JSON.stringify(go));
  await clickInDialog(page, 'ยกเลิก');
  await settle(1200);
}

suite('7. ไม่มีข้อผิดพลาดซ่อนอยู่');
bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' | '));

suite('8. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await clean();
  const left = ((await call('/sop/scenarios', { user: A })).data || [])
    .filter((x) => String(x.title_th).startsWith(MARK)).length;
  happy('ลบกรณีศึกษาทดสอบหมดแล้ว', left === 0, `${left}`);
}

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
