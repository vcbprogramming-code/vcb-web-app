/**
 * วงเงินสินเชื่อ — the screens nobody has ever opened.
 *
 * The module was built with Module 3 and gated off before anyone used it, so
 * these four tabs have never been driven by a person. Before it goes live the
 * screens have to render with real figures, the arithmetic on the page has to
 * match the arithmetic in the database, and the people who must not see money
 * must not see it — including the nav card that would tell them it exists.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query, call, TEST_PROJECT } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/credit-ui`;
fs.mkdirSync(SHOTS, { recursive: true });

await warm();
const { admin: A, exec: C, hr: H } = U;
const MARK = 'ZZUI';
const project = (await query('select id, name from projects where code = $1', [TEST_PROJECT])).rows[0];
const made = { fac: [], led: [] };

// real figures to read off the screen: a 5,000,000 facility with 2,000,000 drawn
const fac = await call('/credit/facilities', { method: 'POST', user: A, body: {
  projectId: project.id, company: `${MARK} ทดสอบหน้าจอ`, bank: 'ธนาคารกรุงเทพ',
  facilityNo: 1, limit: 5000000, notes: MARK } });   // 1 = หนังสือค้ำประกันสัญญา 5% (กล่อง BG)
made.fac.push(fac.data.id);
const led = await call('/credit/ledger', { method: 'POST', user: A, body: {
  facilityId: fac.data.id, amount: 2000000, startDate: '2026-08-01',
  dueDate: '2026-12-31', ref: `${MARK}-L1` } });
made.led.push(led.data.id);
// แต่ละชุดใช้โปรไฟล์ Chrome ของตัวเอง ไม่ใช้ร่วมกัน — ชุดที่ล้มกลางคันจะทิ้ง
// Chrome ที่ยังถือ lock ของโปรไฟล์ไว้ ชุดถัดไปที่ใช้โปรไฟล์เดียวกันจะค้างตามไป
// ทั้งที่ตัวเองไม่มีอะไรผิด (เกิดขึ้นจริงตอนรันรวมทั้งชุดบนเครื่องที่งานหนัก)

// โปรไฟล์ Chrome ใช้ครั้งเดียวแล้วทิ้ง — ชุดที่ล้มกลางคันทิ้งโปรไฟล์ที่เขียนค้าง
// ไว้ และ Chrome จะค้างตอนเปิดโปรไฟล์นั้นทุกครั้งหลังจากนั้น ชุดเดิมจึงล้มซ้ำ
// ไปเรื่อย ๆ ทั้งที่โค้ดไม่ได้ผิดอะไร (ไล่จนเจอเมื่อ 2026-09-05)
fs.rmSync(`${ROOT}/chrome-credit`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false,
  userDataDir: `${ROOT}/chrome-credit`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
// 30 วินาทีของค่าเริ่มต้นตึงเกินไปเมื่อเครื่องรันงานอื่นอยู่ด้วย
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 2500) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const as = async (user, path) => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3500);
};
/** รอจนกว่าข้อความจะโผล่บนหน้า (หรือหมดเวลา) แล้วคืนว่าเจอหรือไม่ */
const waitForText = async (needle, ms = 12000) => {
  const until = Date.now() + ms;
  for (;;) {
    if ((await body()).includes(needle)) return true;
    if (Date.now() > until) return false;
    await settle(500);
  }
};
const clickText = async (label) => page.evaluate((l) => {
  const el = [...document.querySelectorAll('button, a, [role="tab"]')].find((x) => x.innerText.trim().includes(l));
  if (el) el.click();
  return Boolean(el);
}, label);

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
// A console error for a failed request carries no URL, so the request itself is
// what gets judged — otherwise a cold favicon reads as an application error.
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });

// ── 1. เปิดโมดูลได้จริง ────────────────────────────────────────────────────
suite('1. โมดูลเปิดใช้งานแล้ว');
{
  await as(A, '/');
  const t = await body();
  happy('การ์ดวงเงินสินเชื่อขึ้นที่หน้าแรก', t.includes('วงเงินสินเชื่อ'), '');
  bad('ไม่ขึ้นป้ายว่ายังไม่เปิดใช้งาน', !/วงเงินสินเชื่อ[\s\S]{0,120}(เร็ว ๆ นี้|ยังไม่เปิด)/.test(t), '');
  await shot('01-หน้าแรก');

  await as(A, '/credit');
  const c = await body();
  happy('เปิดหน้าวงเงินสินเชื่อได้', !c.includes('ไม่พบหน้า') && !c.includes('ยังไม่เปิดใช้งาน'), c.slice(0, 60));
  happy('เห็นวงเงินที่เพิ่งสร้าง', c.includes(`${MARK} ทดสอบหน้าจอ`), '');
  happy('เห็นชื่อธนาคารเจ้าของวงเงิน', c.includes('ธนาคารกรุงเทพ'), '');
  await shot('02-หน้าวงเงิน');
}

// ── 2. ตัวเลขบนหน้าจอตรงกับฐานข้อมูล ───────────────────────────────────────
suite('2. ตัวเลขบนหน้าจอต้องตรงกับความจริง');
{
  const t = await body();
  happy('แสดงวงเงิน 5,000,000', t.includes('5,000,000'), '');
  happy('แสดงยอดใช้ไป 2,000,000', t.includes('2,000,000'), '');
  happy('แสดงคงเหลือ 3,000,000', t.includes('3,000,000'), '');
  const api = ((await call('/credit/facilities', { user: A })).data || []).find((x) => x.id === fac.data.id);
  happy('คงเหลือที่ฝั่งข้อมูลก็ตรงกัน', Number(api.available) === 3000000, String(api.available));
  bad('ไม่มีตัวเลขที่เป็น NaN หรือ undefined บนหน้าจอ', !/NaN|undefined|\[object/.test(t), '');
}

// ── 3. ครบทั้งสี่แท็บ ──────────────────────────────────────────────────────
suite('3. ทุกแท็บเปิดได้ ไม่มีจอขาว');
// ชื่อแท็บเปลี่ยนให้ตรงกับระบบจริงของลูกค้าแล้ว รวมวงเล็บอังกฤษที่เขาพ่วงไว้
// (ฝ่ายการเงินเรียกแท็บพวกนี้ด้วยคำอังกฤษเวลาคุยกับธนาคาร) และเพิ่มมาอีกสามแท็บ
for (const tab of ['วงเงินสินเชื่อ (Facilities)', 'รายการสินเชื่อ (Credit Ledger)', 'สรุปค่าใช้จ่าย (Cost summary)',
  'แผนการเงิน (T-bar)', 'หักค่างานตามจริง', 'ผลต่าง (Variance)']) {
  // ทางเข้าคำขอสินเชื่อไม่ได้เป็นแท็บอีกแล้ว — ย้ายไปเป็นปุ่มใต้แถบตัวกรอง ซึ่ง
  // ซ่อนไปพร้อมแถบบนแท็บวางแผน ชุด 3ง จึงพิสูจน์ทางเข้านั้นแยกต่างหากตั้งแต่กด
  // จนบันทึกสำเร็จ แทนที่จะเช็กแค่ว่าปุ่มโผล่อยู่ตอนไหนก็ได้
  // กดที่แถบแท็บโดยตรง — ชื่อแท็บบางชื่อไปตรงกับหัวข้อในหน้าด้วย
  const found = await page.evaluate((label) => {
    const tabs = [...document.querySelectorAll('button')].filter((b) => b.className.includes('border-b-2'));
    const el = tabs.find((b) => b.innerText.trim() === label)
      || [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === label)
      || [...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith(label));
    if (el) { el.click(); return true; } return false;
  }, tab);
  await settle(2200);
  const t = await body();
  happy(`แท็บ "${tab}" เปิดได้`, found && t.trim().length > 120, found ? `${t.trim().length} ตัวอักษร` : 'ไม่พบแท็บ');
  // "500" alone would match ฿5,000,000, so match the wording of a real failure
  const err = t.match(/(เกิดข้อผิดพลาด|Something went wrong|Internal Server Error|Failed to fetch|ไม่มีสิทธิ์)/);
  bad(`แท็บ "${tab}" ไม่ขึ้นข้อความผิดพลาด`, !err, err ? err[0] : '');
  await shot(`03-แท็บ-${tab}`);
  // ปุ่มคำขอเปิดเป็นจอซ้อน ต้องปิดก่อน ไม่งั้นบังแท็บถัดไป
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.innerText.trim() === 'ปิด');
    if (b) b.click();
  });
  await settle(900);
}

// ── 3ข. แท็บรายการสินเชื่อ เขียนคำและคอลัมน์แบบระบบจริง ───────────────────
// เทียบกับ txnTable() ของเขา: สิบสองคอลัมน์ · บรรทัดนับรายการ · ยอดรวมท้ายตาราง
// · ปุ่มดู/แก้ไข/ลบ · จอรายละเอียดสิบสามแถว
suite('3ข. แท็บรายการสินเชื่อตรงกับระบบจริง');
{
  const openTab = (label) => page.evaluate((l) => {
    const el = [...document.querySelectorAll('button')].filter((b) => b.className.includes('border-b-2'))
      .find((b) => b.innerText.trim() === l);
    if (el) { el.click(); return true; } return false;
  }, label);
  await as(A, '/credit');
  happy('เปิดแท็บรายการสินเชื่อได้', await openTab('รายการสินเชื่อ (Credit Ledger)'), '');
  await settle(3000);

  const head = await page.evaluate(() => [...document.querySelectorAll('table thead th')].map((x) => x.innerText.trim()));
  happy('คอลัมน์ครบสิบสองตามลำดับของเขา',
    head.join('|') === '#|วันที่|บริษัท|โครงการ|ประเภท|เลขที่เอกสาร|รายละเอียด / ผู้รับผลประโยชน์|จำนวนเงิน|เริ่ม|ครบ|สถานะ|',
    head.join('|'));

  const t = await body();
  happy('มีบรรทัดบอกว่าแสดงกี่รายการจากทั้งหมด', /แสดง \d+ \/ \d+ รายการ/.test(t), (t.match(/แสดง \d+ \/ \d+ รายการ/) || ['ไม่พบ'])[0]);
  happy('ท้ายตารางรวมยอดค้างชำระ', t.includes('รวมยอดค้างชำระ'), '');
  happy('เห็นรายการที่เพิ่งสร้าง (2,000,000)', t.includes('2,000,000'), '');

  // ช่องกรองสถานะ: มี "รออนุมัติ (ใหม่/เสนอ)" และต้องไม่มีคำในฐานข้อมูลอย่าง void
  const statusOpts = await page.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === 'สถานะ');
    return s ? [...s.options].map((o) => o.text) : [];
  });
  happy('ช่องสถานะมีตัวเลือกรออนุมัติ (ใหม่/เสนอ)', statusOpts.includes('รออนุมัติ (ใหม่/เสนอ)'), statusOpts.join(', '));
  bad('ช่องสถานะไม่มีคำ void ให้ผู้ใช้เห็น', !statusOpts.some((o) => /void/i.test(o)), statusOpts.join(', '));

  // กรองด้วยระยะเวลาแล้วต้องขึ้นป้ายว่ากำลังแสดงเฉพาะอะไร
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === 'ระยะเวลา');
    if (s) { s.value = 'thisMonth'; s.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await settle(2200);
  happy('กรองระยะเวลาแล้วขึ้นป้าย "แสดงเฉพาะ:"', (await body()).includes('แสดงเฉพาะ:'), '');
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === 'ระยะเวลา');
    if (s) { s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await settle(2200);

  // จอรายละเอียด: สิบสามแถว พร้อมปุ่มลบ/แก้ไข
  const viewed = await page.evaluate(() => {
    const b = [...document.querySelectorAll('tbody button')].find((x) => (x.title || '') === 'ดู');
    if (b) { b.click(); return true; } return false;
  });
  happy('ปุ่มดูเปิดจอรายละเอียดรายการสินเชื่อ', viewed, '');
  await settle(1600);
  const det = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return { title: dlg?.querySelector('h3')?.innerText.trim() || '',
      rows: dlg ? [...dlg.querySelectorAll('dt')].map((x) => x.innerText.trim()) : [],
      btns: dlg ? [...dlg.querySelectorAll('button')].map((x) => x.innerText.trim()).filter(Boolean) : [] };
  });
  happy('หัวจอคือ "รายละเอียดรายการสินเชื่อ"', det.title === 'รายละเอียดรายการสินเชื่อ', det.title);
  happy('มีสิบสามแถวตามของเขา', det.rows.length === 13, `${det.rows.length} แถว: ${det.rows.join(', ')}`);
  happy('ลำดับแถวเริ่มที่วันที่ขอ จบที่หมายเหตุ',
    det.rows[0] === 'วันที่ขอ' && det.rows[12] === 'หมายเหตุ', `${det.rows[0]} … ${det.rows[12]}`);
  happy('มีปุ่มลบและแก้ไขอยู่ในจอรายละเอียด',
    det.btns.includes('ลบ') && det.btns.includes('แก้ไข'), det.btns.join(' / '));
  await shot('03ข-รายละเอียดรายการ');

  // ฟอร์มแก้ไขคำขอ: ช่องสถานะสี่ค่า
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const b = dlg && [...dlg.querySelectorAll('button')].find((x) => x.innerText.trim() === 'แก้ไข');
    if (b) b.click();
  });
  await settle(1800);
  const ed = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const s = dlg && [...dlg.querySelectorAll('select')].find((x) => (x.title || '') === 'สถานะ');
    return { title: dlg?.querySelector('h3')?.innerText.trim() || '', opts: s ? [...s.options].map((o) => o.text) : [] };
  });
  happy('หัวฟอร์มคือ "แก้ไขคำขอ"', ed.title === 'แก้ไขคำขอ', ed.title);
  happy('ช่องสถานะมีสี่ค่าตามของเขา',
    ed.opts.join('|') === 'คำขอใหม่|อยู่ระหว่างเสนออนุมัติ|อนุมัติแล้ว|ชำระแล้ว (ปิดรายการ)', ed.opts.join('|'));
  await shot('03ค-แก้ไขคำขอ');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'ยกเลิก');
    if (b) b.click();
  });
  await settle(1200);

  // แท็บสรุปค่าใช้จ่าย: หัวแผงตามชื่อของเขา
  happy('เปิดแท็บสรุปค่าใช้จ่ายได้', await openTab('สรุปค่าใช้จ่าย (Cost summary)'), '');
  await settle(2600);
  happy('หัวแผงคือ "สรุปหมวดค่าใช้จ่าย"', (await body()).includes('สรุปหมวดค่าใช้จ่าย'), '');
  await shot('03ง-สรุปค่าใช้จ่าย');
}

// ── 3ค. โครงหน้าจอแบบเดียวกับระบบที่ลูกค้าใช้อยู่ ────────────────────────
// แถบหัวน้ำเงิน · แถบตัวกรองชุดเดียวใต้แท็บ · ปุ่มสามปุ่มชิดขวาใต้ตัวกรอง
suite('3ค. โครงหน้าจอตรงกับระบบจริง');
{
  await as(A, '/credit');
  const hdr = await page.evaluate(() => {
    const h = [...document.querySelectorAll('header')].find((x) => x.innerText.includes('VCB Group')
      && /CREDIT FACILITY MANAGER/i.test(x.innerText));
    if (!h) return null;
    const bg = getComputedStyle(h).backgroundColor;
    return { text: h.innerText.replace(/\n/g, ' | '), bg, gear: Boolean(h.querySelector('button[title]')) };
  });
  happy('มีแถบหัวโมดูลชื่อ VCB Group · CREDIT FACILITY MANAGER', Boolean(hdr), hdr?.text || 'ไม่พบ');
  happy('แถบหัวเป็นพื้นน้ำเงินเข้ม', hdr?.bg === 'rgb(31, 56, 100)', hdr?.bg || '');
  happy('บรรทัดล่างบอกชื่อกลุ่มบริษัทและงานของโมดูล',
    (hdr?.text || '').includes('กลุ่มวิจิตรภัณฑ์ก่อสร้าง · ติดตามวงเงินสินเชื่อทุกโครงการ'), '');
  happy('ปุ่มตั้งค่าอยู่บนแถบหัว', hdr?.gear === true, '');

  // แถบตัวกรอง: ห้าช่องบนแท็บวงเงิน (ช่องสถานะโผล่เฉพาะแท็บรายการ เหมือนของเขา)
  const barOf = () => page.evaluate(() => {
    const titles = ['บริษัท', 'ประเภทวงเงิน', 'โครงการ', 'สถานะ', 'ระยะเวลา'];
    const sels = [...document.querySelectorAll('select')].filter((x) => titles.includes(x.title || ''));
    return { fields: sels.map((x) => x.title),
      search: Boolean([...document.querySelectorAll('input')].find((x) => (x.title || '').startsWith('ค้นหา'))) };
  });
  const fac = await barOf();
  happy('แท็บวงเงินมีตัวกรองห้าช่อง (บริษัท · ประเภท · โครงการ · ระยะเวลา · ค้นหา)',
    fac.fields.join('|') === 'บริษัท|ประเภทวงเงิน|โครงการ|ระยะเวลา' && fac.search, fac.fields.join('|'));

  const btns = await page.evaluate(() => [...document.querySelectorAll('button')]
    .map((b) => b.innerText.trim().replace(/\s+\d+$/, '')).filter(Boolean));
  for (const label of ['เพิ่มคำขอสินเชื่อ', 'บันทึกการใช้วงเงิน', 'ส่งออก Excel']) {
    happy(`มีปุ่ม "${label}" ใต้แถบตัวกรอง`, btns.includes(label), '');
  }
  await shot('03ค-โครงหน้าจอ');

  // ตัวกรองเป็นชุดเดียว: ตั้งที่แท็บวงเงินแล้วสลับแท็บต้องยังอยู่
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === 'ประเภทวงเงิน');
    if (s) { s.value = '7'; s.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await settle(2000);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button')].filter((b) => b.className.includes('border-b-2'))
      .find((b) => b.innerText.trim() === 'รายการสินเชื่อ (Credit Ledger)');
    if (el) el.click();
  });
  await settle(2400);
  const kept = await page.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === 'ประเภทวงเงิน');
    return s ? s.value : '';
  });
  happy('ตัวกรองเป็นชุดเดียว สลับแท็บแล้วยังอยู่', kept === '7', kept);
  const led = await barOf();
  happy('แท็บรายการเพิ่มช่องสถานะขึ้นมา', led.fields.includes('สถานะ'), led.fields.join('|'));

  // แท็บวางแผนไม่มีอะไรให้กรอง แถบต้องหายทั้งแถบ เหมือน showBar ของเขา
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button')].filter((b) => b.className.includes('border-b-2'))
      .find((b) => b.innerText.trim() === 'ผลต่าง (Variance)');
    if (el) el.click();
  });
  await settle(2400);
  const gone = await barOf();
  // แท็บผลต่างมีช่องเลือกโครงการของตัวเองอยู่แล้ว (เทียบทีละโครงการ) สิ่งที่ต้อง
  // หายไปคือแถบร่วม ซึ่งมีช่องบริษัทกับระยะเวลาที่แท็บนั้นไม่มีวันมีเอง
  bad('แท็บผลต่างไม่มีแถบตัวกรองร่วม',
    !gone.fields.includes('บริษัท') && !gone.fields.includes('ระยะเวลา') && !gone.search, gone.fields.join('|'));
}

// ── 3ง. เปิดคำขอสินเชื่อจากปุ่มใต้ตัวกรอง แล้วบันทึกได้จริง ──────────────
// ปุ่มนี้แทนปุ่ม "คำขอใช้วงเงิน" เดิมบนหัวโมดูล — ต้องพิสูจน์ว่าทางเข้ายังครบ
// ตั้งแต่กดจนบันทึกสำเร็จ ไม่ใช่แค่ว่าปุ่มมีอยู่
suite('3ง. ทางเข้าคำขอสินเชื่อใช้งานได้ตั้งแต่กดจนบันทึก');
{
  await as(A, '/credit');
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().startsWith('เพิ่มคำขอสินเชื่อ'));
    if (b) { b.click(); return true; } return false;
  });
  happy('กดปุ่มเพิ่มคำขอสินเชื่อแล้วจอเปิด', opened, '');
  await settle(2200);
  const formOpen = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return Boolean(dlg && [...dlg.querySelectorAll('button')].some((b) => b.innerText.trim() === 'ยื่นคำขอ'));
  });
  happy('ฟอร์มกางให้เลย ไม่ต้องกดเพิ่มอีกชั้น', formOpen, '');

  // เลือกวงเงินของโครงการทดสอบ แล้วกรอกจำนวนเงิน
  const picked = await page.evaluate((facId) => {
    const dlg = document.querySelector('[role="dialog"]');
    const sel = dlg && dlg.querySelector('select');
    if (!sel) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    set.call(sel, facId);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return sel.value === facId;
  }, fac.data.id);
  happy('เลือกวงเงินในฟอร์มได้', picked, '');
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const inp = dlg && [...dlg.querySelectorAll('input[type="number"]')][0];
    if (!inp) return;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(inp, '125000');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(800);
  happy('ขึ้นบรรทัดบอกวงเงินคงเหลือใต้ช่องจำนวนเงิน',
    (await body()).includes('คงเหลือใช้ได้'), '');
  await shot('03ง-ฟอร์มคำขอ');
  const submit = () => page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const b = dlg && [...dlg.querySelectorAll('button')].find((x) => x.innerText.trim() === 'ยื่นคำขอ');
    if (b) b.click();
  });
  // ผู้รับผลประโยชน์เป็นช่องบังคับเหมือนฟอร์มของระบบจริง (saveReq กันไว้สี่ช่อง) —
  // กดบันทึกโดยยังไม่กรอกต้องถูกทัก ไม่ใช่บันทึกคำขอที่ไม่รู้ว่าเงินออกไปให้ใคร
  await submit();
  await settle(1800);
  bad('ยังไม่กรอกผู้รับผลประโยชน์ → ถูกทัก ไม่บันทึก',
    (await body()).includes('กรอกข้อมูลที่จำเป็น (*) ให้ครบ'), '');
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const inp = [...dlg.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('สิริวัฒน์'));
    if (!inp) return;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(inp, 'ZZUI ผู้รับผลประโยชน์');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(700);
  await submit();
  await settle(3200);
  const saved = (await query(
    'select amount, status from credit_requests where facility_id = $1 order by created_at desc limit 1',
    [fac.data.id])).rows[0];
  happy('คำขอถูกบันทึกลงฐานจริง', Number(saved?.amount) === 125000, `${saved?.amount} · ${saved?.status}`);
  happy('บอกผู้ใช้ว่าบันทึกแล้ว', (await body()).includes('บันทึกคำขอแล้ว'), '');
  await query('delete from credit_requests where facility_id = $1', [fac.data.id]);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.innerText.trim() === 'ปิด');
    if (b) b.click();
  });
  await settle(1200);
}

// ── 4. คนที่ไม่ควรเห็นเงิน ต้องไม่เห็น ─────────────────────────────────────
// The seeded hr1 account carries a stale credit override, so this fixes the
// permission it is testing instead of inheriting it, and puts it back after.
const hrPerms = (await query('select permissions from profiles where id = $1', [H.id])).rows[0].permissions;
const setHrCredit = async (on) => {
  const next = { ...(hrPerms || {}) };
  if (on) next.credit = { view: true, edit: false }; else delete next.credit;
  await query('update profiles set permissions = $2 where id = $1', [H.id, JSON.stringify(next)]);
};

suite('4. ฝ่ายบุคคลที่ไม่มีสิทธิ์ต้องไม่เห็นข้อมูลการเงิน');
{
  await setHrCredit(false);
  await as(H, '/');
  bad('การ์ดวงเงินสินเชื่อไม่ขึ้นให้คนที่ไม่มีสิทธิ์', !(await body()).includes('วงเงินสินเชื่อ'), '');
  await as(H, '/credit');
  const t = await body();
  bad('เปิดตรง ๆ ก็ไม่เห็นตัวเลขวงเงิน', !t.includes('5,000,000') && !t.includes(`${MARK} ทดสอบหน้าจอ`), t.slice(0, 70));
  bad('ไม่ถูกทิ้งไว้กับหน้าที่พังหรือข้อความภาษาอังกฤษ',
    !/Insufficient permissions|Forbidden|403/.test(t), t.slice(0, 70));
  happy('ถูกพากลับหน้าแรก ไม่ใช่จอว่าง', t.includes('แอปพลิเคชัน'), t.slice(0, 60));
  await shot('04-ไม่มีสิทธิ์');

  await as(C, '/credit');
  happy('ผู้บริหารเปิดดูได้ตามสิทธิ์', await waitForText(`${MARK} ทดสอบหน้าจอ`), '');
  await shot('05-ผู้บริหาร');
}

// ── 4ข. สิทธิ์ที่ผู้ดูแลตั้งเองต้องมีผลจริง ────────────────────────────────
// Granting "ดูข้อมูล" used to change the menu but not the server, so the person
// reached the page and was met with an English 403.
suite('4ข. เปิดสิทธิ์ให้รายบุคคลได้');
{
  await setHrCredit(true);
  await as(H, '/credit');
  const seen = await waitForText(`${MARK} ทดสอบหน้าจอ`);
  const t = await body();
  happy('ผู้ที่ได้รับสิทธิ์เพิ่มเปิดดูได้ แม้ไม่ได้เป็นผู้บริหาร', seen, '');
  bad('ไม่มีข้อความสิทธิ์ไม่พอค้างอยู่บนหน้า', !/Insufficient permissions|ไม่มีสิทธิ์/.test(t), '');
  await as(H, '/');
  happy('การ์ดขึ้นในหน้าแรกให้คนที่ได้รับสิทธิ์', (await body()).includes('วงเงินสินเชื่อ'), '');
  await shot('05ข-เปิดสิทธิ์รายคน');

  // ดูได้ แต่ยังแก้ไม่ได้
  const w = await call('/credit/facilities', { method: 'POST', user: H, body: {
    projectId: project.id, facilityNo: 7, limit: 1, notes: MARK } });
  bad('ได้สิทธิ์ดูอย่างเดียว ยังเพิ่มวงเงินไม่ได้', w.status === 403, `${w.status}`);

  await query('update profiles set permissions = $2 where id = $1', [H.id, hrPerms]);
}

// ── 5. จอเล็ก ──────────────────────────────────────────────────────────────
/**
 * การ์ดสรุปบนหน้าภาพรวมเป็น <button> ซึ่งเบราว์เซอร์จัดเนื้อหาไว้กลางแนวตั้งให้เอง
 * การ์ดที่เตี้ยกว่าเพื่อนในแถว (T/L ไม่มีบรรทัดย่อย ส่วน BG มีสามบรรทัด) จึงลอยลงมา
 * อยู่กลางกล่อง หัวข้อสองใบเลยไม่ตรงแนวกัน — ลูกค้าทักมาจากภาพหน้าจอ · คลาส
 * .card-btn เป็นตัวแก้ ข้อนี้กันไม่ให้หลุดอีก
 */
suite('4ค. หัวการ์ดสรุปอยู่ระดับเดียวกันทั้งแถว');
{
  await as(A, '/credit');
  const drift = await page.evaluate(() => {
    const rows = new Map();
    for (const b of document.querySelectorAll('button.card-btn')) {
      const box = b.getBoundingClientRect();
      const first = b.children[0]?.getBoundingClientRect();
      if (!first || box.height === 0) continue;
      const key = Math.round(box.top / 8);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(Math.round(first.top - box.top));
    }
    let worst = 0; let n = 0;
    for (const offs of rows.values()) {
      if (offs.length < 2) continue;
      n += offs.length;
      worst = Math.max(worst, Math.max(...offs) - Math.min(...offs));
    }
    return { worst, n };
  });
  happy('มีการ์ดสรุปให้ตรวจ', drift.n >= 2, JSON.stringify(drift));
  happy('หัวการ์ดในแถวเดียวกันเริ่มที่ระดับเดียวกัน', drift.worst <= 1, `ต่างกัน ${drift.worst}px`);
}

suite('5. เปิดบนจอเล็กแล้วยังอ่านได้');
{
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await as(A, '/credit');
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  bad('หน้าไม่ล้นออกด้านข้าง', over <= 2, `${over}px`);
  happy('ยังเห็นตัวเลขวงเงินอยู่', (await body()).includes('5,000,000'), '');
  await shot('06-จอเล็ก');
  await page.setViewport({ width: 1440, height: 950 });
}

// ── 6. ไม่มีข้อผิดพลาดค้างในคอนโซล ────────────────────────────────────────
suite('6. ไม่มีข้อผิดพลาดซ่อนอยู่');
{
  const real = errors.filter((e) => !/favicon|Download the React DevTools|ERR_NETWORK_CHANGED/.test(e));
  bad('ไม่มี error ในคอนโซลระหว่างใช้งาน', real.length === 0, real.slice(0, 2).join(' | '));
}

// ── 7. เก็บกวาด ────────────────────────────────────────────────────────────
suite('7. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  // sweep by marker, not only by the ids this run created — an aborted run
  // would otherwise leave a facility behind and fail the next one
  await query('delete from credit_ledger where facility_id in (select id from facilities where notes = $1)', [MARK]);
  await query('delete from facilities where notes = $1', [MARK]);
  const left = await query('select count(*)::int n from facilities where notes = $1', [MARK]);
  happy('ลบข้อมูลทดสอบหมดแล้ว', left.rows[0].n === 0, `${left.rows[0].n} รายการ`);
}

await browser.close();
report();
