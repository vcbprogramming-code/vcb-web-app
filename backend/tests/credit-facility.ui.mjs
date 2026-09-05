/**
 * วงเงินสินเชื่อ — เพิ่มวงเงินจากทะเบียนจริง แล้วดูว่ายอดบนหน้าจอตรงกับธนาคาร
 *
 * โมดูลนี้เคยเก็บ "ชื่อกล่องบนหน้าจอ" ไว้แทน "ประเภทวงเงินของธนาคาร" ธนาคาร
 * ออกวงเงินสิบประเภท แต่หน้าภาพรวมมีห้ากล่องเพราะบางประเภทใช้วงเงินก้อนเดียว
 * กัน (ค้ำประกันสามใบใช้ก้อน BG ก้อนเดียว) ถ้าเก็บกล่องเป็นประเภท ค้ำประกัน
 * สามใบจะกลายเป็นสามวงเงิน — วงเงินที่เห็นมากกว่าที่ธนาคารให้จริง
 *
 * ชุดนี้จึงพิสูจน์บนหน้าจอว่า: ทะเบียนมีครบสิบ, สามใบพับรวมเป็นกล่องเดียว,
 * ยอดคงเหลือลดลงตามที่เบิกจริง และเบิกด้วยจำนวนติดลบไม่ได้
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query, call } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/credit-facility-ui`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin;
const MARK = 'ZZCFUI';

const clean = async () => {
  await query(`delete from credit_ledger where ref like $1 or note like $1`, [`%${MARK}%`]);
  await query(`delete from facilities where notes like $1`, [`%${MARK}%`]);
};
await clean();

const types = (await call('/credit/facility-types', { user: A })).data || [];
const project = ((await call('/credit/facilities', { user: A })).data, (await query(
  'select id, name, code from projects order by created_at limit 1')).rows[0]);

fs.rmSync(`${ROOT}/chrome-cf`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-cf`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 1800) => new Promise((r) => setTimeout(r, ms));
const bodyText = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0].slice(0, 150)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().split('\n')[0].slice(0, 150));
});

const as = async (user, path = '/credit') => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3000);
};
const click = (label) => page.evaluate((l) => {
  const el = [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim() === l)
    || [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim().startsWith(l));
  if (el) { el.click(); return true; } return false;
}, label);
const setField = (labelText, value) => page.evaluate(([l, v]) => {
  const wrap = [...document.querySelectorAll('label')].find((x) => x.innerText.trim().startsWith(l));
  const el = wrap?.parentElement?.querySelector('input, select, textarea')
    || wrap?.nextElementSibling;
  if (!el) return false;
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
    : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  return true;
}, [labelText, value]);

/** เพิ่มวงเงินหนึ่งก้อนผ่านฟอร์มบนหน้าจอ */
const addFacility = async (typeNo, limit, note) => {
  await click('เพิ่มวงเงิน');
  await settle(1400);
  await setField('โครงการ', project.id);
  await setField('ประเภทวงเงิน', String(typeNo));
  await setField('วงเงินที่อนุมัติ', String(limit));
  await setField('หมายเหตุ', `${MARK} ${note}`);
  await settle(600);
  return page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'บันทึก');
    if (b) { b.click(); return true; } return false;
  });
};

// ── 1. ทะเบียนประเภทวงเงินตรงกับที่ธนาคารออกจริง ─────────────────────────
suite('1. ทะเบียนประเภทวงเงินครบตามที่ธนาคารออกให้');
{
  happy('ทะเบียนมีสิบประเภท', types.length === 10, `${types.length} ประเภท`);
  const bg = types.filter((x) => x.doc_kind === 'BG');
  happy('หนังสือค้ำประกันสามใบอยู่ในกล่อง BG เดียวกัน',
    bg.length === 3 && bg.every((x) => x.foldsInto === 1), bg.map((x) => `${x.no}→${x.foldsInto}`).join(' '));
  const lg = types.filter((x) => x.foldsInto === 6);
  happy('วงเงิน L/G สี่ประเภทพับรวมเป็นกล่องเดียว', lg.length === 4, lg.map((x) => x.no).join(', '));
  const boxes = new Set(types.map((x) => x.foldsInto));
  happy('สิบประเภทยุบเหลือห้ากล่องบนหน้าภาพรวม', boxes.size === 5, [...boxes].join(', '));

  await as(A);
  const t = await bodyText();
  happy('หน้าเปิดได้ ไม่ล้ม', !t.includes('เกิดข้อผิดพลาดบางอย่าง'), t.slice(0, 70).replace(/\n/g, ' | '));
  await shot('01-หน้าแรก');
}

// ── 2. เพิ่มวงเงินจากทะเบียน ─────────────────────────────────────────────
suite('2. เพิ่มวงเงินจากทะเบียน ไม่ใช่พิมพ์ประเภทเอง');
{
  await click('วงเงินสินเชื่อ (Facilities)');
  await settle(2200);
  happy('กดเพิ่มวงเงินแล้วฟอร์มเปิด', await click('เพิ่มวงเงิน'), '');
  await settle(1500);
  const t = await bodyText();
  happy('ฟอร์มถามประเภทวงเงินจากทะเบียน', t.includes('ประเภทวงเงิน'), '');
  const options = await page.evaluate(() => {
    const sels = [...document.querySelectorAll('select')];
    const s = sels.find((x) => [...x.options].some((o) => /หนังสือค้ำประกัน/.test(o.text)));
    return s ? [...s.options].map((o) => o.text) : [];
  });
  happy('ตัวเลือกประเภทมาจากทะเบียนครบสิบรายการ', options.length === 10, `${options.length} ตัวเลือก`);
  happy('ตัวเลือกขึ้นเลขกำกับตามทะเบียนธนาคาร', /^1\. /.test(options[0] || ''), options[0] || '');
  await shot('02-ฟอร์มเพิ่มวงเงิน');

  // เลือกประเภทที่ใช้วงเงินร่วมกับกล่องอื่น ต้องเตือนไว้ตรงนั้นเลย
  await setField('ประเภทวงเงิน', '5');
  await settle(800);
  happy('เตือนตรงฟอร์มว่าประเภทนี้ใช้วงเงินร่วมกับกล่องอื่น',
    (await bodyText()).includes('ใช้วงเงินร่วมกับ'), '');
  await shot('03-เตือนใช้วงเงินร่วม');
  await click('ยกเลิก');
  await settle(1200);
}

// ── 3. สามใบค้ำประกันต้องรวมเป็นวงเงินก้อนเดียว ─────────────────────────
suite('3. ค้ำประกันสามใบรวมเป็นวงเงินก้อนเดียว ไม่ใช่สามก้อน');
{
  happy('บันทึกวงเงินค้ำประกันสัญญา 5% ได้', await addFacility(1, 1000000, 'ค้ำสัญญา'), '');
  await settle(3000);
  happy('บันทึกวงเงินค้ำประกัน Advance 15% ได้', await addFacility(2, 2000000, 'ค้ำ Advance'), '');
  await settle(3000);

  const rows = (await query(
    `select facility_no, "limit" from facilities where notes like $1 order by facility_no`, [`%${MARK}%`])).rows;
  happy('บันทึกลงฐานข้อมูลเป็นคนละประเภทตามทะเบียน',
    rows.length === 2 && rows[0].facility_no === 1 && rows[1].facility_no === 2,
    rows.map((r) => r.facility_no).join(', '));

  const ov = (await call('/credit/overview', { user: A })).data;
  const bgBox = (ov.byType || []).find((x) => x.type === 'BG');
  happy('หน้าภาพรวมรวมทั้งสองใบไว้ในกล่อง BG กล่องเดียว', !!bgBox, JSON.stringify((ov.byType || []).map((x) => x.type)));
  happy('วงเงินในกล่องคือผลรวมของทั้งสองใบ', Number(bgBox?.limit) === 3000000, `${bgBox?.limit}`);
  happy('กล่องเก็บรายละเอียดไว้ให้กางดูว่ามาจากใบไหนบ้าง', (bgBox?.parts || []).length === 2, `${(bgBox?.parts || []).length} ใบ`);

  await as(A);
  const t = await bodyText();
  happy('หน้าจอแสดงกล่อง BG ที่รวมยอดแล้ว', t.includes('3,000,000') || t.includes('3.0'), '');
  await shot('04-ภาพรวมพับรวม');
}

// ── 4. เบิกใช้แล้วยอดคงเหลือลด ───────────────────────────────────────────
suite('4. เบิกใช้แล้วยอดคงเหลือลดลงตามจริง');
{
  await click('วงเงินสินเชื่อ (Facilities)');
  await settle(2400);
  const opened = await page.evaluate((mark) => {
    const row = [...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes('1,000,000'));
    const b = row && [...row.querySelectorAll('button')].find((x) => x.innerText.trim() === 'เบิกใช้');
    if (b) { b.click(); return true; } return false;
  }, MARK);
  happy('กดเบิกใช้จากแถววงเงินได้', opened, '');
  await settle(1500);
  await setField('จำนวนเงิน', '400000');
  await setField('อ้างอิง / หมายเหตุ', `${MARK} เบิกงวดแรก`);
  await settle(500);
  await shot('05-ฟอร์มเบิกใช้');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'บันทึก');
    if (b) b.click();
  });
  await settle(3200);

  const led = (await query(`select amount, status from credit_ledger where ref like $1`, [`%${MARK}%`])).rows;
  happy('รายการเบิกถูกบันทึกไว้จริง', led.length === 1, `${led.length} รายการ`);
  happy('จำนวนเงินตรงกับที่กรอก', Number(led[0]?.amount) === 400000, `${led[0]?.amount}`);

  const ov = (await call('/credit/overview', { user: A })).data;
  const bg = (ov.byType || []).find((x) => x.type === 'BG');
  happy('ยอดใช้ไปในกล่องเพิ่มขึ้นเท่าที่เบิก', Number(bg?.used) === 400000, `${bg?.used}`);
  happy('ยอดคงเหลือลดลงเท่าที่เบิก', Number(bg?.available) === 2600000, `${bg?.available}`);
  await as(A);
  const overviewText = await bodyText();
  happy('กล่องภาพรวมแสดงยอดที่ใช้ไปแล้ว', overviewText.includes('400,000'), '');
  happy('กล่องภาพรวมกำกับวงเงินเต็มไว้ด้วย', overviewText.includes('3,000,000'), '');
  await shot('06-หลังเบิกใช้');

  // ตารางวงเงินคือที่ที่คนดูยอดคงเหลือรายก้อน
  await click('วงเงินสินเชื่อ (Facilities)');
  await settle(2400);
  happy('ตารางวงเงินแสดงยอดคงเหลือรายก้อนถูกต้อง', (await bodyText()).includes('600,000'), '');
  await shot('06b-ตารางวงเงิน');
}

// ── 5. กันการเบิกด้วยจำนวนที่ทำให้ยอดเพี้ยน ─────────────────────────────
suite('5. เบิกด้วยจำนวนติดลบหรือศูนย์ไม่ได้');
{
  const neg = await call('/credit/ledger', { method: 'POST', user: A,
    body: { facilityId: (await query(`select id from facilities where notes like $1 limit 1`, [`%${MARK}%`])).rows[0].id,
      amount: -500000, ref: `${MARK} ติดลบ` } });
  bad('เบิกด้วยจำนวนติดลบถูกปฏิเสธ', neg.status >= 400, `${neg.status}`);
  const zero = await call('/credit/ledger', { method: 'POST', user: A,
    body: { facilityId: (await query(`select id from facilities where notes like $1 limit 1`, [`%${MARK}%`])).rows[0].id,
      amount: 0, ref: `${MARK} ศูนย์` } });
  bad('เบิกด้วยจำนวนศูนย์ถูกปฏิเสธ', zero.status >= 400, `${zero.status}`);

  const ov = (await call('/credit/overview', { user: A })).data;
  const bg = (ov.byType || []).find((x) => x.type === 'BG');
  bad('ยอดคงเหลือไม่โตขึ้นเกินวงเงินที่ธนาคารให้', Number(bg?.available) <= Number(bg?.limit), `${bg?.available} / ${bg?.limit}`);
}

// ── 6. แก้ไขวงเงินแล้วยอดตามไปด้วย ───────────────────────────────────────
suite('6. แก้วงเงินที่อนุมัติแล้วยอดคงเหลือคำนวณใหม่');
{
  await as(A);
  await click('วงเงินสินเชื่อ (Facilities)');
  await settle(2400);
  // ปุ่มแก้ไขเป็นไอคอนล้วน — ต้องมีคำอธิบายกำกับไว้ ไม่งั้นทั้งคนและเครื่อง
  // อ่านไม่ออกว่าปุ่มนี้ทำอะไร
  const edited = await page.evaluate(() => {
    const row = [...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes('1,000,000'));
    const b = row && [...row.querySelectorAll('button')].find((x) => (x.title || '').includes('แก้ไข'));
    if (b) { b.click(); return true; } return false;
  });
  happy('ปุ่มแก้ไขวงเงินมีคำอธิบายให้อ่านและกดได้', edited, '');
  await settle(1600);
  await setField('วงเงินที่อนุมัติ', '1500000');
  await settle(400);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'บันทึก');
    if (b) b.click();
  });
  await settle(3200);
  const ov = (await call('/credit/overview', { user: A })).data;
  const bg = (ov.byType || []).find((x) => x.type === 'BG');
  happy('วงเงินรวมในกล่องเปลี่ยนตาม', Number(bg?.limit) === 3500000, `${bg?.limit}`);
  happy('ยอดคงเหลือคำนวณใหม่ให้เอง', Number(bg?.available) === 3100000, `${bg?.available}`);
  await shot('07-แก้วงเงิน');
}

// ── 7. ไม่มีข้อผิดพลาดซ่อนอยู่ ───────────────────────────────────────────
suite('7. ไม่มีข้อผิดพลาดซ่อนอยู่');
{
  bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' / '));
}

// ── 8. เก็บกวาด ──────────────────────────────────────────────────────────
suite('8. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await clean();
  const left = (await query(`select count(*)::int n from facilities where notes like $1`, [`%${MARK}%`])).rows[0].n;
  happy('ลบวงเงินทดสอบหมดแล้ว', left === 0, `${left}`);
}

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
