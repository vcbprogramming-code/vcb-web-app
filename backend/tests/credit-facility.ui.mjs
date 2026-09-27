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
import { suite, happy, bad, report, U, warm, APP, tok, query, call, TEST_PROJECT } from './harness.mjs';

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
// โครงการทิ้งขว้างเท่านั้น — "order by created_at limit 1" เคยได้ BT1 ซึ่งตอนนี้
// ถือข้อมูลวงเงินจริงของลูกค้า (นำเข้า 2026-09-27) วงเงินทดสอบที่สร้างทับคีย์
// (โครงการ × เลขประเภท) ของแถวจริง และไปบวกเข้ายอดบนการ์ดระหว่างที่ชุดนี้รันอยู่
const project = (await query('select id, name, code from projects where code = $1', [TEST_PROJECT])).rows[0];

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
/** หาแถวจากค่าในช่องแบบตรงตัว (฿1,000,000) ไม่ใช่การค้นข้อความบางส่วน —
 *  ฐานข้อมูลจริงมีวงเงินหลายสิบก้อน '1,000,000' ไปตรงกับ '21,000,000' ได้ */
const ROW_BY_CELL = `(v) => [...document.querySelectorAll('tbody tr')].find(
  (r) => [...r.querySelectorAll('td')].some((td) => td.innerText.trim().split('\\n')[0] === v))`;
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
  // ช่องกรองบนแถบตัวกรองก็ลิสต์ทะเบียนทั้งสิบเหมือนกันแล้ว (พร้อมกลุ่มรวม BG/B/E)
  // จึงต้องหยิบช่องใน "ฟอร์ม" ที่เปิดอยู่ ไม่ใช่ช่องแรกที่เจอในหน้า
  const options = await page.evaluate(() => {
    const scope = document.querySelector('[role="dialog"]') || document;
    const sels = [...scope.querySelectorAll('select')];
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
// ข้อมูลจริงของลูกค้า (วงเงิน 48 ก้อน) อยู่ในฐานเดียวกันแล้ว และชุดทดสอบชุดอื่น
// อาจรันพร้อมกันอยู่ — ตัวเลขรวมทั้งพอร์ตจึงใช้เป็นค่าคาดหวังตายตัวไม่ได้ และแม้
// วัดเป็นผลต่างก่อน/หลังก็ยังเพี้ยนได้ถ้ามีคนเขียนข้อมูลคั่นกลาง
//
// สิ่งที่ชุดนี้ต้องพิสูจน์คือ "กฎการพับรวม" ไม่ใช่ตัวเลขใดตัวเลขหนึ่ง จึงเทียบกล่อง
// บนหน้าภาพรวมกับผลรวมของวงเงินที่ควรอยู่ในกล่องนั้น คิดสดจากทะเบียนทุกครั้ง —
// ถูกเสมอไม่ว่าจะมีข้อมูลจริงกี่ก้อนหรือใครเขียนอะไรคั่น
const boxOf = async (type) => ((await call('/credit/overview', { user: A })).data.byType || [])
  .find((x) => x.type === type) || { limit: 0, used: 0, available: 0, parts: [] };
/** ผลรวมของวงเงินทุกก้อนที่ประเภทอยู่ในกล่องนั้น (BG = ประเภท 1-3) */
const sumOfNos = async (nos) => {
  const all = (await call('/credit/facilities', { user: A })).data || [];
  return all.filter((f) => nos.includes(Number(f.facility_no)))
    .reduce((a, f) => ({ limit: a.limit + Number(f.limit), used: a.used + Number(f.used) }), { limit: 0, used: 0 });
};
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
  const boxes = (ov.byType || []).map((x) => x.type);
  happy('หน้าภาพรวมรวมทั้งสองใบไว้ในกล่อง BG กล่องเดียว',
    !!bgBox && boxes.filter((x) => x === 'BG').length === 1, JSON.stringify(boxes));
  const bgSum = await sumOfNos([1, 2, 3]);
  happy('วงเงินในกล่องคือผลรวมของค้ำประกันทุกใบ ไม่ใช่แยกกล่อง',
    Math.round(Number(bgBox?.limit)) === Math.round(bgSum.limit),
    `กล่อง ${Math.round(Number(bgBox?.limit))} · ผลรวม ${Math.round(bgSum.limit)}`);
  // กล่องเดียวแต่กางดูได้ว่ามาจากค้ำประกันประเภทไหนบ้าง — ทั้งสองใบที่เพิ่งสร้าง
  // ต้องอยู่ในรายการย่อย ไม่ได้ถูกยุบหายไปกับยอดรวม
  const partNos = (bgBox?.parts || []).map((x) => Number(x.no));
  happy('กล่องเก็บรายละเอียดไว้ให้กางดูว่ามาจากใบไหนบ้าง',
    partNos.includes(1) && partNos.includes(2), partNos.join(', '));

  await as(A);
  const t = await bodyText();
  // ตัวเลขใหญ่บนกล่องคือวงเงินคงเหลือของทั้งกล่อง
  const bgAvail = Math.round(Number((await boxOf('BG')).available)).toLocaleString('en-US');
  happy('หน้าจอแสดงกล่อง BG ที่รวมยอดแล้ว', t.includes(bgAvail), bgAvail);
  await shot('04-ภาพรวมพับรวม');
}

// ── 4. เบิกใช้แล้วยอดคงเหลือลด ───────────────────────────────────────────
suite('4. เบิกใช้แล้วยอดคงเหลือลดลงตามจริง');
{
  await click('วงเงินสินเชื่อ (Facilities)');
  await settle(2400);
  const opened = await page.evaluate((src) => {
    // eslint-disable-next-line no-eval
    const row = eval(src)('฿1,000,000');
    const b = row && [...row.querySelectorAll('button')].find((x) => x.innerText.trim() === 'เบิกใช้');
    if (b) { b.click(); return true; } return false;
  }, ROW_BY_CELL);
  happy('กดเบิกใช้จากแถววงเงินได้', opened, '');
  await settle(1500);
  await setField('จำนวนเงิน', '400000');
  // ฟอร์มแยกช่อง "เลขที่อ้างอิง" ออกจาก "หมายเหตุ" แบบเดียวกับระบบจริงแล้ว
  await setField('เลขที่อ้างอิง', `${MARK} เบิกงวดแรก`);
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

  // ผลของการเบิกต้องเห็นที่วงเงินก้อนที่เบิกก่อน แล้วค่อยไหลขึ้นไปที่กล่องรวม
  const one = (await query(`select id from facilities where notes like $1 and "limit" = 1000000 limit 1`, [`%${MARK}%`])).rows[0];
  const oneView = ((await call('/credit/facilities', { user: A })).data || []).find((f) => f.id === one?.id);
  happy('ยอดใช้ไปของวงเงินก้อนที่เบิกเพิ่มขึ้นเท่าที่เบิก', Number(oneView?.used) === 400000, `${oneView?.used}`);
  happy('ยอดคงเหลือของก้อนนั้นลดลงเท่าที่เบิก', Number(oneView?.available) === 600000, `${oneView?.available}`);
  const bg = await boxOf('BG');
  const bgNow = await sumOfNos([1, 2, 3]);
  happy('ยอดใช้ไปในกล่องรวมเท่ากับผลรวมของทุกใบในกล่อง',
    Math.round(Number(bg.used)) === Math.round(bgNow.used), `กล่อง ${Math.round(Number(bg.used))} · ผลรวม ${Math.round(bgNow.used)}`);
  await as(A);
  const overviewText = await bodyText();
  // ตัวเลขใหญ่บนกล่องคือวงเงินคงเหลือ เหมือนการ์ดของระบบจริง
  const avail = Math.round(Number(bg.available)).toLocaleString('en-US');
  happy('กล่องภาพรวมแสดงวงเงินคงเหลือ', overviewText.includes(avail), avail);
  // การ์ดเลิกพิมพ์วงเงินเต็มซ้ำแล้ว (ระบบจริงเหลือ "฿คงเหลือ" + "ใช้ไปแล้ว N%")
  // สัดส่วนยังต้องผูกยอดใช้กับวงเงินเต็มไว้ด้วยกัน
  const pct = Math.min(100, Math.round((Number(bg.used) / Number(bg.limit)) * 100));
  happy('กล่องภาพรวมบอกสัดส่วนที่ใช้ไปเทียบวงเงินเต็ม', overviewText.includes(`ใช้ไปแล้ว ${pct}%`),
    (overviewText.match(/ใช้ไปแล้ว \d+%/) || ['ไม่พบ'])[0]);
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
  const edited = await page.evaluate((src) => {
    // eslint-disable-next-line no-eval
    const row = eval(src)('฿1,000,000');
    const b = row && [...row.querySelectorAll('button')].find((x) => (x.title || '').includes('แก้ไข'));
    if (b) { b.click(); return true; } return false;
  }, ROW_BY_CELL);
  happy('ปุ่มแก้ไขวงเงินมีคำอธิบายให้อ่านและกดได้', edited, '');
  await settle(1600);
  await setField('วงเงินที่อนุมัติ', '1500000');
  await settle(400);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'บันทึก');
    if (b) b.click();
  });
  await settle(3200);
  const bumpedId = (await query(`select id from facilities where notes like $1 and "limit" = 1500000 limit 1`, [`%${MARK}%`])).rows[0]?.id;
  const bumped = ((await call('/credit/facilities', { user: A })).data || []).find((f) => f.id === bumpedId);
  happy('วงเงินของก้อนที่แก้เปลี่ยนตาม', Number(bumped?.limit) === 1500000, `${bumped?.limit}`);
  happy('ยอดคงเหลือคำนวณใหม่ให้เอง', Number(bumped?.available) === 1100000, `${bumped?.available}`);
  const bgAfter = await boxOf('BG');
  const sumAfter = await sumOfNos([1, 2, 3]);
  happy('กล่องรวมเดินตามวงเงินที่แก้',
    Math.round(Number(bgAfter.limit)) === Math.round(sumAfter.limit),
    `กล่อง ${Math.round(Number(bgAfter.limit))} · ผลรวม ${Math.round(sumAfter.limit)}`);
  await shot('07-แก้วงเงิน');
}

// ── 6ข. หน้าจอตรงกับระบบที่ลูกค้าใช้อยู่ (เทียบคำและพฤติกรรม 2026-09-27) ──
suite('6ข. ตารางและจอย่อยตรงกับระบบจริง');
{
  await as(A);
  await click('วงเงินสินเชื่อ (Facilities)');
  await settle(2400);

  // หัวคอลัมน์ครบตามลำดับของเขา และช่องปุ่มท้ายตารางเว้นหัวว่างไว้
  const head = await page.evaluate(() => [...document.querySelectorAll('table thead th')].map((x) => x.innerText.trim()));
  happy('หัวคอลัมน์เรียงตามระบบจริง (มีคอลัมน์บริษัท)',
    head.slice(0, 8).join('|') === '#|โครงการ|บริษัท|ประเภท|วงเงิน|ใช้ไป|คงเหลือ|การใช้', head.join('|'));
  happy('หัวคอลัมน์ปุ่มเว้นว่าง', head.length === 9 && head[8] === '', `${head.length} คอลัมน์`);

  // หัวตารางกดเรียงได้ — กดแล้วลำดับต้องเปลี่ยน
  const limitCol = () => page.evaluate(() => [...document.querySelectorAll('tbody tr')]
    .map((r) => Number((r.querySelectorAll('td')[4]?.innerText || '0').replace(/[^\d.-]/g, '')) || 0));
  const before = await limitCol();
  await page.evaluate(() => {
    const th = [...document.querySelectorAll('table thead th')].find((x) => x.innerText.includes('วงเงิน'));
    if (th) th.click();
  });
  await settle(900);
  const asc = await limitCol();
  happy('กดหัวคอลัมน์วงเงินแล้วเรียงจากน้อยไปมาก',
    asc.length === before.length && asc.every((v, i) => i === 0 || asc[i - 1] <= v), asc.slice(0, 5).join(' < '));
  await page.evaluate(() => {
    const th = [...document.querySelectorAll('table thead th')].find((x) => x.innerText.includes('วงเงิน'));
    if (th) th.click();
  });
  await settle(900);
  const desc = await limitCol();
  happy('กดอีกครั้งเรียงจากมากไปน้อย',
    desc.every((v, i) => i === 0 || desc[i - 1] >= v), desc.slice(0, 5).join(' > '));
  // กดครั้งที่สามเลิกเรียง กลับไปลำดับตั้งต้น เหมือน sortBy ของระบบจริง
  await page.evaluate(() => {
    const th = [...document.querySelectorAll('table thead th')].find((x) => x.innerText.includes('วงเงิน'));
    if (th) th.click();
  });
  await settle(900);
  happy('กดครั้งที่สามเลิกเรียง กลับลำดับตั้งต้น', (await limitCol()).join(',') === before.join(','), '');

  // ปุ่มดินสอเปิดจอ "ปรับวงเงิน / ใช้ไป" ซึ่งเป็นงานกระทบยอดรายเดือน
  const opened = await page.evaluate((src) => {
    // eslint-disable-next-line no-eval
    const row = eval(src)('฿2,000,000');
    const b = row && [...row.querySelectorAll('button')].find((x) => (x.title || '') === 'ปรับวงเงิน / ใช้ไป');
    if (b) { b.click(); return true; } return false;
  }, ROW_BY_CELL);
  happy('ปุ่มดินสอเปิดจอปรับวงเงิน / ใช้ไป', opened, '');
  await settle(1400);
  const mt = await bodyText();
  happy('จอปรับวงเงินมีทั้งช่องวงเงินและช่องใช้ไป',
    mt.includes('วงเงิน (บาท)') && mt.includes('ใช้ไป (บาท)'), '');
  happy('บอกว่าเว้นช่องใช้ไปไว้ให้ระบบคำนวณเอง',
    mt.includes('เว้นว่างเพื่อใช้ค่าที่คำนวณอัตโนมัติจากรายการ'), '');
  await shot('08-ปรับวงเงิน');

  // ปักยอดใช้ไปเอง — ต้องขึ้นเครื่องหมายว่าไม่ได้คำนวณจากรายการ
  await setField('ใช้ไป (บาท)', '900000');
  await settle(500);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'บันทึก');
    if (b) b.click();
  });
  await settle(3200);
  const stored = (await query(`select used_override from facilities where notes like $1 and "limit" = 2000000 limit 1`, [`%${MARK}%`])).rows[0];
  happy('ปักยอดใช้ไปจากจอนี้แล้วบันทึกจริง', Number(stored?.used_override) === 900000, String(stored?.used_override));
  const marks = await page.evaluate(() => [...document.querySelectorAll('tbody td')]
    .map((td) => td.innerText.trim()).filter((x) => x.includes('✱')));
  happy('ยอดที่ปักเองมีเครื่องหมายกำกับในตาราง',
    marks.some((x) => x.startsWith('฿900,000')), marks.join(' / ') || 'ไม่พบ ✱ ในตาราง');
  await shot('08b-ปักยอดใช้ไป');
  // คืนค่าให้กลับไปคำนวณจากรายการ ไม่ให้ค้างไปรบกวนชุดถัดไป
  const facId = (await query(`select id from facilities where notes like $1 and "limit" = 2000000 limit 1`, [`%${MARK}%`])).rows[0]?.id;
  if (facId) await call(`/credit/facilities/${facId}`, { method: 'PATCH', user: A, body: { usedOverride: null } });

  // ตัวกรองไม่เจออะไร ต้องบอกว่า "ตามเงื่อนไข" ไม่ใช่ "ยังไม่มีวงเงิน"
  await as(A);
  await click('วงเงินสินเชื่อ (Facilities)');
  await settle(2000);
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === 'ประเภทวงเงิน');
    if (s) {
      s.value = '8';   // M/L — ไม่มีวงเงินประเภทนี้ในชุดทดสอบ
      s.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await settle(2200);
  happy('กรองแล้วไม่เจอ ขึ้นข้อความว่าไม่มีข้อมูลตามเงื่อนไข',
    (await bodyText()).includes('ไม่มีข้อมูลวงเงินตามเงื่อนไข'), '');
  await shot('09-กรองไม่เจอ');

  // กดการ์ด BG แล้วต้องกระโดดมาที่แท็บวงเงินพร้อมเลือกกลุ่มค้ำประกันให้
  await as(A);
  const jumped = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.title || '').includes('ค้ำสัญญา 5%')
      || (x.title || '').includes('ดูรายละเอียดวงเงิน BG'));
    if (b) { b.click(); return true; } return false;
  });
  happy('การ์ด BG กดได้ และบอกรายละเอียดวงเงินย่อยใน tooltip', jumped, '');
  await settle(2400);
  const picked = await page.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === 'ประเภทวงเงิน');
    return s ? s.value : '';
  });
  happy('กดการ์ด BG แล้วตัวกรองถูกตั้งเป็นกลุ่มค้ำประกัน', picked === 'k:LG', picked);
  await shot('10-กดการ์ด-BG');

  // จอตั้งค่า: เปิด-ปิดพาเนลแดชบอร์ด + ทะเบียนหมวดค่าใช้จ่าย
  await as(A);
  const gear = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.title || '') === 'ตั้งค่า');
    if (b) { b.click(); return true; } return false;
  });
  happy('ปุ่มเฟืองบนหัวโมดูลเปิดจอตั้งค่าได้', gear, '');
  await settle(1600);
  const st = await bodyText();
  happy('จอตั้งค่ามีทั้งบล็อกแดชบอร์ดและบล็อกหมวดค่าใช้จ่าย',
    st.includes('แดชบอร์ด / Dashboard') && st.includes('หมวดค่าใช้จ่าย / Cost categories'), '');
  const boxes = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return dlg ? dlg.querySelectorAll('input[type="checkbox"]').length : 0;
  });
  happy('เปิด-ปิดพาเนลได้ 11 ตัวตามระบบจริง', boxes === 11, `${boxes} ตัว`);
  await shot('11-ตั้งค่า');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'ปิด');
    if (b) b.click();
  });
  await settle(900);
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
