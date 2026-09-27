/**
 * วงเงินสินเชื่อ — ขับหน้าจอทีละสถานการณ์ เทียบกับ index.html ของเขา
 *
 * ชุด API (credit-flows.mjs) ตรวจกฎได้ครบ แต่กฎที่ถูกต้องยังพังบนจอได้สามแบบ:
 * ช่องกรองที่ค้างค่าไว้แต่ไม่มีผลกับตาราง · ปุ่มที่คนมีสิทธิ์แล้วยังหาไม่เจอ ·
 * และข้อความยืนยันที่บอกผลไม่ตรงกับสิ่งที่จะเกิดขึ้น สามอย่างนี้เห็นได้จากจอ
 * เท่านั้น ชุดนี้จึงกดเองทั้งหมด
 *
 * รันคู่กับหน้าเว็บที่กำลังพัฒนา: APP=http://localhost:5173 API=http://localhost:4000/api
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query, call, TEST_PROJECT } from './harness.mjs';
import { clickInDialog } from './tools/ui.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/credit-flows-ui`;
fs.mkdirSync(SHOTS, { recursive: true });

await warm();
const A = U.admin;
const H = U.hr;
const MARK = 'ZZFUI';
const project = (await query('select id, code, name from projects where code = $1', [TEST_PROJECT])).rows[0];
const made = { fac: [], led: [], req: [] };

const p2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const now = new Date();
const LAST_MONTH = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 12));
const NEXT_MONTH = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 12));

/** ตัวเลขจริงให้อ่านจากจอ: วงเงินสองก้อนต่างประเภท เพื่อทดสอบช่องกรองประเภท */
const mkFac = async (facilityNo, limit, tag) => {
  const r = await call('/credit/facilities', { method: 'POST', user: A, body: {
    projectId: project.id, company: `${MARK} ${tag}`, bank: 'ธนาคารกรุงเทพ',
    facilityNo, limit, interestNote: '1.25 % ต่อปี', notes: MARK } });
  made.fac.push(r.data.id);
  return r.data;
};
const mkLed = async (facilityId, body) => {
  const r = await call('/credit/ledger', { method: 'POST', user: A, body: { facilityId, ...body } });
  if (r.status === 201) made.led.push(r.data.id);
  return r.data;
};

const facBE = await mkFac(6, 30000000, 'อาวัล');      // doc_kind = B/E
const facTL = await mkFac(4, 20000000, 'เงินกู้');     // doc_kind = T/L
await mkLed(facBE.id, { amount: 4400000, ref: `${MARK}-BE`, dueDate: NEXT_MONTH, beneficiary: `${MARK} คู่ค้าอาวัล` });
await mkLed(facTL.id, { amount: 5500000, ref: `${MARK}-TL`, dueDate: LAST_MONTH, beneficiary: `${MARK} คู่ค้าเงินกู้` });
// คำขอที่ยังไม่อนุมัติแต่ขอเกินวงเงินคงเหลือ — แถวนี้ต้องขึ้นป้าย "เกินวงเงิน"
// บนตารางรายการ (ยังไม่ถูกตัดวงเงิน จึงเทียบกับคงเหลือได้)
const facTiny = await mkFac(7, 1000000, 'วงเงินเล็ก');
await mkLed(facTiny.id, { amount: 9000000, status: 'คำขอใหม่', ref: `${MARK}-เกิน`, dueDate: NEXT_MONTH });
// ก้อนที่ "ใช้เกินวงเงินไปแล้วจริง" (อนุมัติแล้วมากกว่าวงเงิน) — คงเหลือติดลบ
// ตารางวงเงินสินเชื่อต้องขึ้นป้ายเตือนที่ก้อนนี้
const facOver = await mkFac(1, 500000, 'ใช้เกินวงเงิน');
await mkLed(facOver.id, { amount: 2000000, ref: `${MARK}-ทะลุ`, dueDate: NEXT_MONTH });

fs.rmSync(`${ROOT}/chrome-credit-flows`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false,
  userDataDir: `${ROOT}/chrome-credit-flows`,
  defaultViewport: { width: 1440, height: 980 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
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
const openTab = (label) => page.evaluate((l) => {
  const el = [...document.querySelectorAll('button')].filter((b) => b.className.includes('border-b-2'))
    .find((b) => b.innerText.trim().startsWith(l));
  if (el) { el.click(); return true; } return false;
}, label);
const setSelect = (title, value) => page.evaluate(([ttl, v]) => {
  const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === ttl);
  if (!s) return false;
  s.value = v;
  s.dispatchEvent(new Event('change', { bubbles: true }));
  return s.value === v;
}, [title, value]);
// ปุ่มบางปุ่มมีป้ายตัวเลขต่อท้าย ("เพิ่มคำขอสินเชื่อ 1") — เทียบแบบขึ้นต้นด้วย
// ไม่ใช่เท่ากันเป๊ะ ไม่งั้นเทสต์จะหาปุ่มไม่เจอทันทีที่มีคำขอค้างอยู่หนึ่งใบ
const clickText = (label) => page.evaluate((l) => {
  const list = [...document.querySelectorAll('button, a')];
  const el = list.find((x) => x.innerText.trim() === l)
    || list.find((x) => x.innerText.trim().split('\n')[0].trim() === l);
  if (el) { el.click(); return true; } return false;
}, label);
/** ปุ่มทั้งหมดในกล่องที่เปิดอยู่ — [] เมื่อไม่มีกล่อง ไม่ใช่ล้มทั้งชุด */
const dialogBtns = () => page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  return d ? [...d.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean) : [];
});
/** เลขที่เอกสารของทุกแถวที่ตารางรายการสินเชื่อกำลังแสดง */
const ledgerRefs = () => page.evaluate(() => [...document.querySelectorAll('tbody tr')]
  .map((tr) => (tr.children[5]?.innerText || '').trim()).filter(Boolean));
const toastText = () => page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span,p')]
    .filter((e) => e.children.length === 0 && e.innerText && e.innerText.trim().length > 4);
  return els.map((e) => e.innerText.trim()).join('\n');
});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });

// ───────────────────────────────────────────────────────────────────────────
suite('1. ช่องกรองประเภทวงเงินต้องมีผลกับตารางรายการ');
{
  await as(A, '/credit');
  happy('เปิดแท็บรายการสินเชื่อได้', await openTab('รายการสินเชื่อ'), '');
  await settle(3000);
  await setSelect('โครงการ', project.id);
  await settle(2500);
  const all = await ledgerRefs();
  happy('เห็นทั้งรายการอาวัลและรายการเงินกู้ของโครงการทดสอบ',
    all.includes(`${MARK}-BE`) && all.includes(`${MARK}-TL`), all.join(', ').slice(0, 120));

  // เลือกประเภทเดียว (ไม่ใช่กล่องรวม) — ก่อนแก้ ช่องนี้ค้างค่าไว้แต่ตารางไม่ขยับ
  const picked = await page.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === 'ประเภทวงเงิน');
    const opt = s && [...s.options].find((o) => /^4\./.test(o.text));
    if (!s || !opt) return null;
    s.value = opt.value;
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return opt.text;
  });
  happy('ช่องประเภทมีตัวเลือกแยกรายวงเงิน', Boolean(picked), String(picked));
  await settle(2800);
  const only = await ledgerRefs();
  happy('เลือกประเภทเดียวแล้วเหลือแต่รายการของประเภทนั้น',
    only.includes(`${MARK}-TL`) && !only.includes(`${MARK}-BE`), only.join(', ').slice(0, 120));
  await shot('01-กรองประเภทเดียว');

  // กล่องรวม B/E ต้องยังทำงานเหมือนเดิม
  await setSelect('ประเภทวงเงิน', 'k:AVAL,LGM,DLC,PNPOST');
  await settle(2800);
  const grp = await ledgerRefs();
  happy('กล่องรวม B/E เห็นรายการอาวัล ไม่เห็นรายการเงินกู้',
    grp.includes(`${MARK}-BE`) && !grp.includes(`${MARK}-TL`), grp.join(', ').slice(0, 120));
  await setSelect('ประเภทวงเงิน', '');
  await settle(2000);
}

// ───────────────────────────────────────────────────────────────────────────
suite('2. การ์ดบนแดชบอร์ดกดแล้วพาไปพร้อมตัวกรอง');
{
  await as(A, '/credit');
  const cards = await page.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => b.innerText.includes('ดูรายการ')).map((b) => b.innerText.split('\n')[0].trim()));
  happy('มีการ์ดครบกำหนดที่กดได้', cards.some((c) => c.includes('ครบกำหนด')), cards.join(' · '));

  const jumped = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('ครบกำหนด — เดือนหน้า'));
    if (b) { b.click(); return true; } return false;
  });
  happy('กดการ์ด "ครบกำหนด — เดือนหน้า" ได้', jumped, '');
  await settle(3200);
  const t = await body();
  happy('พาไปแท็บรายการสินเชื่อพร้อมป้าย "แสดงเฉพาะ:"', t.includes('แสดงเฉพาะ:'), '');
  happy('ป้ายบอกว่ากรองเดือนหน้าอยู่', /แสดงเฉพาะ:\s*ครบกำหนดเดือนหน้า/.test(t), (t.match(/แสดงเฉพาะ:.*/) || [''])[0]);
  const due = await page.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === 'ระยะเวลา');
    return s ? s.value : '';
  });
  happy('ช่องระยะเวลาบนแถบตัวกรองค้างค่าไว้ให้เห็นว่ากรองอะไรอยู่', due === 'nextMonth', due);
  await shot('02-กดการ์ดแล้วกรองตาม');

  // ตัวกรองเจาะลึกต้องถูกล้างเมื่อกดการ์ดใบอื่น แต่โครงการที่ผู้ใช้เลือกไว้ต้องอยู่
  await setSelect('โครงการ', project.id);
  await settle(2000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('ครบกำหนด — เดือนนี้'));
    if (b) b.click();
  });
  await settle(2800);
  const after = await page.evaluate(() => {
    const g = (ttl) => { const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === ttl); return s ? s.value : null; };
    return { due: g('ระยะเวลา'), proj: g('โครงการ') };
  });
  happy('กดการ์ดใบใหม่แล้วระยะเวลาเปลี่ยนตาม', after.due === 'thisMonth', String(after.due));
  happy('โครงการที่ผู้ใช้เลือกเองไม่ถูกล้าง', after.proj === project.id, String(after.proj));
}

// ───────────────────────────────────────────────────────────────────────────
suite('3. ฟอร์มยื่นคำขอสินเชื่อ');
{
  await as(A, '/credit');
  happy('กดปุ่มเพิ่มคำขอสินเชื่อแล้วฟอร์มกางให้เลย', await clickText('เพิ่มคำขอสินเชื่อ'), '');
  await settle(2500);
  const stars = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return dlg ? [...dlg.querySelectorAll('label')].filter((l) => l.innerText.includes('*'))
      .map((l) => l.innerText.replace('*', '').trim()) : [];
  });
  happy('ช่องบังคับมีดาวกำกับครบสามช่องเหมือนของเขา',
    ['วงเงิน', 'จำนวนเงิน', 'ผู้รับผลประโยชน์'].every((s) => stars.some((x) => x.startsWith(s))),
    stars.join(' · '));
  await shot('03-ฟอร์มคำขอ');

  // กรอกวงเงิน + จำนวนเงิน แต่ไม่กรอกผู้รับผลประโยชน์ → ต้องถูกทัก ไม่ใช่บันทึกผ่าน
  const filled = await page.evaluate((facId) => {
    const dlg = document.querySelector('[role="dialog"]');
    const sel = dlg.querySelector('select');
    sel.value = facId;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const amt = dlg.querySelector('input[type="number"]');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(amt, '250000');
    amt.dispatchEvent(new Event('input', { bubbles: true }));
    return sel.value === facId;
  }, facBE.id);
  happy('เลือกวงเงินและกรอกจำนวนเงินได้', filled, '');
  await settle(1500);
  const hint = await body();
  happy('มีบรรทัดบอกวงเงินคงเหลือใต้ช่องจำนวนเงิน', /คงเหลือใช้ได้/.test(hint), (hint.match(/คงเหลือใช้ได้.*/) || [''])[0]);

  const before = (await call(`/credit/requests`, { user: A })).data.length;
  await clickText('ยื่นคำขอ');
  await settle(2200);
  const warned = await toastText();
  happy('ไม่กรอกผู้รับผลประโยชน์ → ถูกทักด้วยข้อความของเขา',
    /กรอกข้อมูลที่จำเป็น \(\*\) ให้ครบ/.test(warned), warned.split('\n').slice(-3).join(' / ').slice(0, 120));
  const mid = (await call(`/credit/requests`, { user: A })).data.length;
  bad('และยังไม่ถูกบันทึกเข้าระบบ', mid === before, `${before} → ${mid}`);

  await page.evaluate((v) => {
    const dlg = document.querySelector('[role="dialog"]');
    const inp = [...dlg.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('สิริวัฒน์'));
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(inp, v);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, `${MARK} ผู้รับผลประโยชน์`);
  await settle(1000);
  await clickText('ยื่นคำขอ');
  await settle(3000);
  const list = (await call(`/credit/requests`, { user: A })).data;
  const saved = list.find((r) => r.beneficiary === `${MARK} ผู้รับผลประโยชน์`);
  happy('กรอกครบแล้วบันทึกได้', Boolean(saved), `${before} → ${list.length}`);
  if (saved) made.req.push(saved.id);
  happy('ขึ้นข้อความว่าบันทึกคำขอแล้ว', /บันทึกคำขอแล้ว/.test(await toastText()), '');
  await shot('03ข-บันทึกคำขอแล้ว');
}

// ───────────────────────────────────────────────────────────────────────────
suite('4. คนที่ถูกเปิดสิทธิ์ต้องเห็นปุ่มอนุมัติ ไม่ใช่เฉพาะผู้บริหาร');
{
  const perms = (await query('select permissions from profiles where id = $1', [H.id])).rows[0];
  const canEdit = perms?.permissions?.credit?.edit === true;
  happy('บัญชีทดสอบถูกเปิดสิทธิ์ "แก้ไขข้อมูล" ไว้จริง', canEdit, JSON.stringify(perms?.permissions?.credit || {}));

  await as(A, '/credit');
  happy('เปิดคิวคำขอจากปุ่มบนแถบตัวกรองได้', await clickText('เพิ่มคำขอสินเชื่อ'), '');
  await settle(3000);
  const asAdmin = await dialogBtns();
  happy('ผู้ดูแลเห็นปุ่มอนุมัติในคิวคำขอ', asAdmin.includes('อนุมัติ'), asAdmin.join(' / ').slice(0, 140));
  await shot('04-คิวคำขอของผู้ดูแล');

  if (canEdit) {
    await as(H, '/credit');
    const opened = await clickText('เพิ่มคำขอสินเชื่อ');
    await settle(3200);
    const asHr = await dialogBtns();
    happy('บัญชีที่ไม่ใช่ผู้บริหารเปิดคิวคำขอได้', opened && asHr.length > 0, `${asHr.length} ปุ่ม`);
    happy('และเห็นปุ่มอนุมัติด้วย เพราะถูกเปิดสิทธิ์ไว้', asHr.includes('อนุมัติ'), asHr.join(' / ').slice(0, 160));
    await shot('04ข-คิวคำขอของคนที่ถูกเปิดสิทธิ์');
  }
}

// ───────────────────────────────────────────────────────────────────────────
suite('5. ชำระ / ปิดรายการจากตาราง');
{
  const l = await mkLed(facBE.id, { amount: 1234567, ref: `${MARK}-ชำระ`, dueDate: LAST_MONTH });
  await as(A, '/credit');
  await openTab('รายการสินเชื่อ');
  await settle(2800);
  await setSelect('โครงการ', project.id);
  await settle(2500);
  await page.evaluate(() => {
    const inp = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('ค้นหา'));
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(inp, 'ZZFUI-ชำระ');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(3000);
  happy('ค้นหาแล้วเจอรายการที่จะปิด', (await ledgerRefs()).includes(`${MARK}-ชำระ`), (await ledgerRefs()).join(','));
  const hasBtn = await page.evaluate(() => Boolean([...document.querySelectorAll('tbody button')]
    .find((b) => b.innerText.trim() === 'ชำระ')));
  happy('แถวที่อนุมัติแล้วมีปุ่มชำระ', hasBtn, '');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('tbody button')].find((x) => x.innerText.trim() === 'ชำระ');
    if (b) b.click();
  });
  await settle(1800);
  const dlg = await body();
  happy('กล่องยืนยันบอกผลที่จะเกิดขึ้นตรงตามของเขา',
    /วงเงินจะถูกปล่อยคืนและดอกเบี้ยจะหยุดเดิน/.test(dlg), (dlg.match(/ยืนยันชำระ.*/) || [''])[0].slice(0, 90));
  await shot('05-ยืนยันชำระ');
  happy('กดยืนยันได้', await clickInDialog(page, 'ชำระ'), '');
  await settle(3200);
  const row = (await query('select status, settled_date from credit_ledger where id = $1', [l.id])).rows[0];
  happy('สถานะเปลี่ยนเป็นชำระแล้ว', row.status === 'ชำระแล้ว', row.status);
  happy('และมีวันชำระติดมาด้วย', Boolean(row.settled_date), String(row.settled_date));
  happy('ขึ้นข้อความว่าปิดรายการแล้ว', /ปิดรายการแล้ว/.test(await toastText()), '');
}

// ───────────────────────────────────────────────────────────────────────────
suite('6. ป้ายเตือนบนตาราง');
{
  await as(A, '/credit');
  await openTab('รายการสินเชื่อ');
  await settle(2800);
  await setSelect('โครงการ', project.id);
  await settle(2500);
  const t = await body();
  happy('รายการที่ขอเกินวงเงินคงเหลือขึ้นป้าย "เกินวงเงิน"', /เกินวงเงิน/.test(t),
    (t.match(/เกินวงเงิน.{0,20}/) || [''])[0]);
  happy('แท็บวงเงินสินเชื่อขึ้นป้ายเกินวงเงินให้ก้อนที่คงเหลือติดลบ',
    await (async () => { await openTab('วงเงินสินเชื่อ'); await settle(2600); return /เกินวงเงิน/.test(await body()); })(), '');
  await shot('06-ป้ายเกินวงเงิน');
}

// ───────────────────────────────────────────────────────────────────────────
suite('7. ปรับวงเงิน / ตั้งยอดใช้ไปเอง');
{
  await as(A, '/credit');
  await settle(2500);
  await setSelect('โครงการ', project.id);
  await settle(2500);
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('tbody button')]
      .find((x) => /ปรับ/.test(x.innerText) || /ปรับ/.test(x.title || ''));
    if (b) { b.click(); return b.innerText.trim() || b.title; } return null;
  });
  happy('เปิดจอปรับวงเงินจากแถวในตารางได้', Boolean(opened), String(opened));
  await settle(1800);
  const modal = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d ? { title: d.querySelector('h3')?.innerText.trim() || '', text: d.innerText,
      ph: [...d.querySelectorAll('input')].map((i) => i.placeholder || '') } : null;
  });
  if (modal) {
    happy('หัวจอคือ "ปรับวงเงิน / ใช้ไป"', modal.title === 'ปรับวงเงิน / ใช้ไป', modal.title);
    happy('บอกว่าเว้นว่างคือกลับไปคำนวณอัตโนมัติ ไม่ใช่ตั้งเป็นศูนย์',
      /เว้นว่างเพื่อใช้ค่าที่คำนวณอัตโนมัติจากรายการ/.test(modal.text), '');
    happy('ช่องใช้ไปบอกยอดที่คำนวณได้ไว้ใน placeholder',
      modal.ph.some((p) => /คำนวณอัตโนมัติ/.test(p)), modal.ph.join(' | '));
    await shot('07-ปรับวงเงิน');

    // กรอกวงเงินติดลบ → ต้องถูกทักด้วยข้อความของเขา ไม่ใช่ส่งไปให้เซิร์ฟเวอร์ปฏิเสธ
    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      const inp = d.querySelector('input[type="number"]');
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(inp, '-100');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clickInDialog(page, 'บันทึก');
    await settle(1800);
    happy('วงเงินติดลบ → ขึ้น "กรอกวงเงินให้ถูกต้อง"', /กรอกวงเงินให้ถูกต้อง/.test(await toastText()), '');
    await clickInDialog(page, 'ยกเลิก');
    await settle(1200);
  }
}

// ───────────────────────────────────────────────────────────────────────────
suite('8. ตั้งงบหมวดค่าใช้จ่ายจากหน้าสรุป');
{
  const CAT = `${MARK}-หมวด`;
  const withCat = await mkLed(facBE.id, { amount: 2200000, ref: `${MARK}-หมวด-ก`, costCategory: CAT });
  await mkLed(facBE.id, { amount: 1100000, ref: `${MARK}-ไม่ระบุหมวด` });   // ไม่มีหมวด → กลุ่ม (ไม่ระบุหมวด)

  await as(A, '/credit');
  happy('เปิดแท็บสรุปค่าใช้จ่ายได้', await openTab('สรุปค่าใช้จ่าย'), '');
  await settle(3500);
  const t = await body();
  happy('เห็นหมวดที่เพิ่งเบิก', t.includes(CAT), '');
  happy('เห็นกลุ่ม "(ไม่ระบุหมวด)" ไม่ถูกซ่อน', t.includes('(ไม่ระบุหมวด)'), '');
  happy('หมวดที่ยังไม่ตั้งงบเขียนว่า "ไม่ได้ตั้ง"', /ไม่ได้ตั้ง/.test(t), '');
  await shot('08-สรุปค่าใช้จ่าย');

  // กดตั้งงบที่แถวกลุ่ม "(ไม่ระบุหมวด)" → ต้องถูกทัก ไม่ใช่เปิดกล่องให้ตั้ง
  const clickedPseudo = await page.evaluate(() => {
    const tr = [...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes('(ไม่ระบุหมวด)'));
    const b = tr && [...tr.querySelectorAll('button')].find((x) => /งบ/.test(x.title || ''));
    if (b) { b.click(); return true; } return false;
  });
  happy('แถวกลุ่มไม่ระบุหมวดก็มีปุ่มตั้งงบให้กด', clickedPseudo, '');
  await settle(1800);
  happy('กดแล้วถูกทักให้ไปกรอกหมวดที่คำขอก่อน',
    /ยังไม่ได้ระบุหมวด/.test(await toastText()), (await toastText()).split('\n').slice(-2).join(' / ').slice(0, 120));
  bad('และไม่เปิดกล่องตั้งงบให้',
    await page.evaluate(() => !document.querySelector('[role="dialog"]')), '');

  // ตั้งงบหมวดจริงแล้วหน้าสรุปต้องขึ้นว่าเกินงบ
  const clickedReal = await page.evaluate((cat) => {
    const tr = [...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes(cat));
    const b = tr && [...tr.querySelectorAll('button')].find((x) => /งบ/.test(x.title || ''));
    if (b) { b.click(); return true; } return false;
  }, CAT);
  happy('เปิดกล่องตั้งงบของหมวดจริงได้', clickedReal, '');
  await settle(1800);
  happy('กล่องบอกว่าเว้นว่างเพื่อยกเลิกงบ',
    /เว้นว่างเพื่อยกเลิกงบ/.test(await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText || '')), '');
  await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const inp = d.querySelector('input[type="number"]');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(inp, '1000000');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await clickInDialog(page, 'บันทึก');
  await settle(3500);
  happy('ขึ้นข้อความว่าตั้งงบแล้ว', /ตั้งงบแล้ว/.test(await toastText()), '');
  happy('หน้าสรุปขึ้นว่าเกินงบ', /เกินงบ/.test(await body()), '');
  await shot('08ข-ตั้งงบแล้วเกินงบ');
  await query('delete from credit_category_caps where cost_category like $1', [`${MARK}%`]);
  if (withCat) { /* ลบตอนเก็บของท้ายชุด */ }
}

// ───────────────────────────────────────────────────────────────────────────
suite('9. จอตั้งค่า — ทะเบียนหมวดค่าใช้จ่าย');
{
  await as(A, '/credit');
  const gear = await page.evaluate(() => {
    const b = [...document.querySelectorAll('header button')].find((x) => (x.title || '') === 'ตั้งค่า');
    if (b) { b.click(); return true; } return false;
  });
  happy('กดเฟืองบนแถบหัวแล้วเปิดจอตั้งค่า', gear, '');
  await settle(2800);
  const s = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d ? { title: d.querySelector('h3')?.innerText.trim() || '', text: d.innerText } : null;
  });
  happy('หัวจอคือ "ตั้งค่า / Settings"', s?.title === 'ตั้งค่า / Settings', String(s?.title));
  happy('มีทั้งส่วนพาเนลแดชบอร์ดและทะเบียนหมวดค่าใช้จ่าย',
    /แดชบอร์ด/.test(s?.text || '') && /หมวดค่าใช้จ่าย/.test(s?.text || ''), '');
  happy('บอกวิธีย้ายลำดับและลบ', /กดลูกศรขึ้น-ลงเพื่อย้าย/.test(s?.text || ''), '');
  await shot('09-จอตั้งค่า');

  // เพิ่มหมวดที่มีอยู่แล้ว → ต้องถูกทัก ไม่ใช่เพิ่มซ้ำเงียบ ๆ
  const dup = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const first = d.querySelector('.grid > div span[title]');
    const name = first ? first.getAttribute('title') : null;
    const inp = [...d.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('ชื่อหมวดใหม่'));
    if (!name || !inp) return null;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(inp, name);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    const btn = [...d.querySelectorAll('button')].find((x) => x.innerText.trim() === 'เพิ่มหมวด');
    if (btn) btn.click();
    return name;
  });
  happy('พิมพ์ชื่อหมวดที่มีอยู่แล้วกดเพิ่ม', Boolean(dup), String(dup));
  await settle(1800);
  happy('ถูกทักว่ามีหมวดนี้อยู่แล้ว', /มีหมวดนี้อยู่แล้ว/.test(await toastText()),
    (await toastText()).split('\n').slice(-2).join(' / ').slice(0, 100));
  await clickInDialog(page, 'ปิด', 'บันทึก');
  await settle(1500);
}

// ───────────────────────────────────────────────────────────────────────────
suite('10. ส่งออก Excel ถามยืนยันพร้อมบอกว่าใช้ตัวกรองปัจจุบัน');
{
  await as(A, '/credit');
  await setSelect('โครงการ', project.id);
  await settle(2200);
  happy('มีปุ่มส่งออก Excel', await clickText('ส่งออก Excel'), '');
  await settle(1800);
  const t = await body();
  happy('ถามยืนยันก่อน และบอกว่าใช้ตัวกรองปัจจุบัน',
    /ส่งออกไฟล์ Excel ตามตัวกรองปัจจุบัน\?/.test(t), (t.match(/ส่งออกไฟล์ Excel.*/) || [''])[0]);
  await shot('10-ยืนยันส่งออก');
  await clickInDialog(page, 'ยกเลิก', 'ส่งออก');
  await settle(1200);
}

// ───────────────────────────────────────────────────────────────────────────
suite('11. ไม่มีข้อผิดพลาดซ่อนอยู่');
{
  const real = errors.filter((e) => !/409|400|413/.test(e));   // การปฏิเสธที่ตั้งใจทดสอบไม่ใช่ข้อผิดพลาด
  happy('ไม่มี error จากหน้าจอหรือคำขอที่ล้ม', real.length === 0, real.slice(0, 4).join(' | ').slice(0, 300));
}

suite('12. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await browser.close();
  // เก็บด้วย "เครื่องหมาย" ไม่ใช่ด้วยรายชื่อ id ของรอบนี้ — รอบที่ล้มกลางคันทิ้ง
  // วงเงินทดสอบไว้แล้วรอบถัดไปมองไม่เห็น เพราะ id พวกนั้นไม่ได้อยู่ในตัวแปรอีก
  const marked = (await query('select id from facilities where notes = $1', [MARK])).rows.map((r) => r.id);
  const ids = [...new Set([...made.fac, ...marked])];
  if (ids.length) {
    await query('delete from credit_ledger where facility_id = any($1::uuid[])', [ids]);
    await query('delete from credit_requests where facility_id = any($1::uuid[])', [ids]);
    await query('delete from facilities where id = any($1::uuid[])', [ids]);
  }
  await query('delete from credit_ledger where ref like $1', [`${MARK}%`]);
  await query('delete from credit_category_caps where cost_category like $1', [`${MARK}%`]);
  const left = (await query(
    `select (select count(*) from facilities where notes = $1)
          + (select count(*) from credit_ledger where ref like $2) n`, [MARK, `${MARK}%`])).rows[0].n;
  happy('ลบข้อมูลทดสอบหมดแล้ว', Number(left) === 0, `เหลือ ${left}`);
  const real = (await query(
    `select (select count(*) from facilities f join projects p on p.id = f.project_id where p.code <> $1) fac,
            (select count(*) from credit_ledger where source_id is not null) led`, [TEST_PROJECT])).rows[0];
  happy('ข้อมูลจริงของลูกค้ายังเท่าเดิม (48 ก้อน · 66 แถว)',
    Number(real.fac) === 48 && Number(real.led) === 66, `${real.fac}/${real.led}`);
}

process.exit(report(`${new URL('./.out/credit-flows-ui.json', import.meta.url).pathname}`) ? 1 : 0);
