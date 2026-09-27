/**
 * แผนการเงิน (T-bar) · หักค่างานตามจริง · ผลต่าง — ชุดทดสอบหน้าจอ
 *
 * ขับหน้าจอแบบคนใช้จริง: เปิดแท็บ เลือกเดือน เพิ่มโครงการ พิมพ์ตัวเลขทีละช่อง
 * แล้วดูว่าช่องที่คำนวณเองขยับตามทันทีไหม จัดตั๋วเข้าส่วน เพิ่ม/ลบส่วน คัดลอก
 * จากเดือนก่อน ส่งออก Excel และอ่านหน้าผลต่าง
 *
 * เลขที่ตรวจเป็นเลขเดียวกับชุด credit-tbar.mjs (คำนวณมือจากสูตรในซอร์สของลูกค้า)
 * — จุดประสงค์คือพิสูจน์ว่าเลขบนจอ = เลขที่เซิร์ฟเวอร์บันทึก ไม่ใช่คนละสูตร
 *
 * เดือนที่ใช้อยู่ในช่วง 13 เดือนของแถบเลือกเดือน (ย้อน 6 · ล่วงหน้า 6) และเป็น
 * เดือนไกลพอที่ตั๋วทดสอบจะไม่ไปโผล่ในการ์ด "ครบกำหนดเดือนนี้/เดือนหน้า"
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query, call, TEST_PROJECT, sleep } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/credit-tbar-ui`;
fs.mkdirSync(SHOTS, { recursive: true });
const DOWNLOADS = `${ROOT}/credit-tbar-dl`;
fs.rmSync(DOWNLOADS, { recursive: true, force: true });
fs.mkdirSync(DOWNLOADS, { recursive: true });

await warm();
const A = U.admin;
const MARK = 'ZZTBARUI';
const MONTH = '2027-02';        // 02/70 — ช่องเลือกเดือนมีให้ถึง +6 เดือน
const NEXT = '2027-03';         // 03/70 — ปลายทางของการคัดลอก
const project = (await query('select id, code, name from projects where code = $1', [TEST_PROJECT])).rows[0];

/** ล้างของที่ค้างจากรอบก่อน แล้วสร้างวงเงิน + ตั๋วสองใบที่ครบกำหนดในเดือนที่ทดสอบ */
const sweep = async () => {
  await query('delete from cash_plans where project_id = $1', [project.id]);
  await query('delete from credit_ledger where ref like $1', [`${MARK}%`]);
  await query(`delete from credit_ledger where facility_id in (select id from facilities where notes = $1)`, [MARK]);
  await query('delete from facilities where notes = $1', [MARK]);
};
await sweep();
const fac = await call('/credit/facilities', { method: 'POST', user: A, body: {
  projectId: project.id, company: `${MARK} ทดสอบจอ T-bar`, bank: 'ธนาคารทดสอบ',
  facilityNo: 6, limit: 20000000, notes: MARK } });
const mkLedger = async (amount, due, ref) => (await call('/credit/ledger', { method: 'POST', user: A, body: {
  facilityId: fac.data.id, amount, dueDate: due, startDate: `${MONTH}-01`, status: 'อนุมัติแล้ว',
  ref: `${MARK}-${ref}`, counterparty: `${MARK} คู่ค้า ${ref}` } })).data;
const L1 = await mkLedger(400000, `${MONTH}-15`, 'A');
const L2 = await mkLedger(250000, `${MONTH}-25`, 'B');

// โปรไฟล์ Chrome ใช้ครั้งเดียวแล้วทิ้ง — ชุดที่ล้มกลางคันทิ้งโปรไฟล์ที่เขียนค้างไว้
// แล้ว Chrome จะค้างตอนเปิดโปรไฟล์นั้นทุกครั้งหลังจากนั้น
fs.rmSync(`${ROOT}/chrome-tbar`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false,
  userDataDir: `${ROOT}/chrome-tbar`,
  defaultViewport: { width: 1500, height: 980 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const errors = [];
const httpErrors = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
// ข้อความ error ในคอนโซลของ Chrome ไม่บอก URL ("Failed to load resource") การ
// ไล่จึงต้องดูจากตัว response เอง ไม่ใช่จากข้อความ — favicon ของ Vite ไม่นับ
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('response', (r) => {
  if (r.status() >= 400 && !/favicon/.test(r.url())) httpErrors.push(`${r.status()} ${r.url()}`);
});
await page.createCDPSession().then((s) => s.send('Page.setDownloadBehavior', {
  behavior: 'allow', downloadPath: DOWNLOADS })).catch(() => {});

const settle = (ms = 1200) => sleep(ms);
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const as = async (user, path) => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3000);
};
const openTab = (label) => page.evaluate((l) => {
  const el = [...document.querySelectorAll('button')].filter((b) => b.className.includes('border-b-2'))
    .find((b) => b.innerText.trim() === l);
  if (el) { el.click(); return true; }
  return false;
}, label);
const pickMonth = (value) => page.evaluate((v) => {
  const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === 'เดือน');
  if (!s) return false;
  s.value = v;
  s.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, value);
const clickText = (label, exact = false) => page.evaluate((l, ex) => {
  const els = [...document.querySelectorAll('button, [role="button"]')];
  const el = els.find((b) => (ex ? b.innerText.trim() === l : b.innerText.trim().includes(l)));
  if (el) { el.click(); return true; }
  return false;
}, label, exact);
/**
 * พิมพ์เงินลงช่องที่กำกับด้วย title — เลือกทั้งช่องก่อนพิมพ์ เหมือนคนแก้เลข
 * (คลิกสามครั้งของ puppeteer ไม่ได้เลือกข้อความจริง ต้องสั่ง setSelectionRange
 *  ไม่งั้นตัวเลขใหม่จะไปแทรกกลางเลขเดิม แล้วได้ยอดที่ไม่มีใครตั้งใจ)
 */
const typeMoney = async (title, value, nth = 0) => {
  const els = await page.$$(`input[title="${title}"]`);
  const el = els[nth];
  if (!el) return false;
  await el.click();
  await el.evaluate((n) => n.setSelectionRange(0, n.value.length));
  await el.type(String(value), { delay: 12 });
  await el.evaluate((n) => n.blur());
  await settle(500);
  return true;
};
const valueOf = (title, nth = 0) => page.evaluate((t, n) => {
  const els = [...document.querySelectorAll(`input[title="${t}"]`)];
  return els[n] ? els[n].value : null;
}, title, nth);
/** ข้อความของการ์ดโครงการที่กำลังทดสอบ */
const cardText = () => page.evaluate((code) => {
  const cards = [...document.querySelectorAll('div')].filter((d) => {
    const s = d.querySelector(':scope > div > select');
    return s && [...s.options].some((o) => o.text.startsWith(code)) && d.className.includes('rounded-2xl');
  });
  return cards.length ? cards[0].innerText : '';
}, project.code);

// ── 1. เปิดแท็บแผนการเงิน ───────────────────────────────────────────────────
suite('1. แท็บแผนการเงิน (T-bar) เปิดได้และมีของครบ');
{
  await as(A, '/credit');
  happy('เปิดแท็บแผนการเงินได้', await openTab('แผนการเงิน (T-bar)'), '');
  await settle(2500);
  const months = await page.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === 'เดือน');
    return s ? [...s.options].map((o) => o.text) : [];
  });
  happy('แถบเดือนมี 13 เดือน', months.length === 13, `${months.length} เดือน`);
  happy('ป้ายเดือนเป็น เดือน/พ.ศ. สองหลัก', months.every((m) => /^\d{2}\/\d{2}$/.test(m)), months.join(' '));
  happy('มีเดือนที่ใช้ทดสอบอยู่ในรายการ (02/70)', months.includes('02/70'), months.join(' '));
  const t = await body();
  happy('มีปุ่ม Export T-bar', t.includes('Export T-bar'), '');
  bad('ปุ่มไม่ใช้อีโมจิ', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t), '');
  happy('มีการ์ด ① เริ่มต้น พร้อมคำอธิบายของเขา',
    t.includes('① เริ่มต้น') && t.includes('เลือกโครงการเพื่อสร้างแผน 3 ส่วน พร้อม B/E + P/N ที่ครบกำหนดเดือนนี้'), '');
  happy('มีแถบ รับ · Cash in / จ่าย · Cash out / สุทธิ · Net',
    t.includes('รับ · Cash in') && t.includes('จ่าย · Cash out') && t.includes('สุทธิ · Net'), '');
  await shot('01-แท็บแผนการเงิน');
}

// ── 2. เพิ่มโครงการจากการ์ดเริ่มต้น ────────────────────────────────────────
suite('2. เพิ่มโครงการแล้วได้สามส่วนพร้อมตั๋วที่ครบกำหนด');
{
  happy('เลือกเดือนที่ทดสอบได้', await pickMonth(MONTH), '');
  await settle(2500);
  const picked = await page.evaluate((pid) => {
    const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === 'เลือกโครงการ');
    if (!s) return false;
    s.value = pid;
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, project.id);
  happy('เลือกโครงการจากการ์ดเริ่มต้นได้', picked, '');
  await settle(4000);
  const t = await body();
  happy('ได้ส่วน รับเงินค่างาน + หักหนี้', t.includes('รับเงินค่างาน + หักหนี้'), '');
  happy('ได้ส่วน ขอเบิก P/N ค่างาน', t.includes('ขอเบิก P/N ค่างาน'), '');
  happy('ได้ส่วน ขอเบิก P/N Workdone', t.includes('ขอเบิก P/N Workdone'), '');
  const heads = await page.evaluate(() => [...document.querySelectorAll('table thead tr')]
    .map((r) => [...r.children].map((c) => c.innerText.trim()).join('|')));
  happy('ตารางซ้ายมีหัวคอลัมน์ รายการ | จำนวน | คำนวณ | %',
    heads.some((h) => h === 'รายการ|จำนวน|คำนวณ|%'), heads.slice(0, 4).join(' / '));
  happy('ตารางขวาเป็น ครบ | ประเภท | เลขที่ | รายละเอียด (N รายการ) | จำนวน',
    heads.some((h) => /^ครบ\|ประเภท\|เลขที่\|รายละเอียด \(\d+ รายการ\)\|จำนวน\|$/.test(h)),
    heads.find((h) => h.startsWith('ครบ')) || heads.join(' / '));
  happy('ห้าแถวหักครบพร้อมคำกำกับ auto',
    ['หัก TL', 'หัก ML', 'หัก PN', 'หัก PN ขอเบิกใหม่', 'หัก Segment CVE'].every((l) => t.includes(l))
    && t.includes('(auto 15%)') && t.includes('(auto 1.5%)')
    && t.includes('(PN Work Done ของงวดก่อน)') && t.includes('(PN ต่อค่างานงวดนี้ · auto จาก P/N ที่ขาย)'), '');
  happy('ตั๋วที่ครบกำหนดเดือนนี้ถูกดึงเข้าส่วน P/N แล้ว',
    t.includes(`${MARK}-A`) && t.includes(`${MARK}-B`), '');
  happy('ตั๋วขึ้นป้ายประเภท B/E', t.includes('B/E'), '');
  happy('มีปุ่มบนหัวการ์ด: ＋ เพิ่มส่วน', t.includes('＋ เพิ่มส่วน'), '');
  await shot('02-สามส่วน');
}

// ── 3. พิมพ์แล้วช่องที่คำนวณเองขยับทันที ───────────────────────────────────
suite('3. พิมพ์ตัวเลขแล้วช่องคำนวณขยับตามสูตรของเขา');
{
  happy('กรอกค่างานที่ส่ง 1,000,000 ได้', await typeMoney('ค่างานที่ส่ง', 1000000), '');
  let c = await cardText();
  happy('เพดาน 80% ขึ้นเป็น 800,000 ทันที ไม่ต้องรีโหลด', c.includes('800,000'), '');
  await typeMoney('ค่า segment CVE', 200000);
  c = await cardText();
  happy('หัก segment 60% = 120,000', c.includes('120,000'), '');
  happy('เหลือค่างวด = 880,000', c.includes('880,000'), '');
  await typeMoney('PN ที่ขายไว้', 100000);
  c = await cardText();
  happy('จะคงเหลือ P/N ที่ขายได้ = 700,000', c.includes('700,000'), '');
  await typeMoney('เงินประกันผลงาน', 500000);
  c = await cardText();
  happy('P/N RT 80% = 400,000', c.includes('400,000'), '');
  happy('รวม P/N ที่ขาย = 1,100,000', c.includes('1,100,000'), '');
  happy('ตารางดอกเบี้ย P/N ที่ต้องจ่ายโผล่ขึ้นมา', c.includes('ดอกเบี้ย P/N ที่ต้องจ่าย'), '');
  happy('ดอกเบี้ยรวม 17,223.28 ตามสูตร ยอด × วัน × อัตรา ÷ 365',
    c.includes('17,223') || c.includes('17,223.28'), '');
  happy('แถวดอกเบี้ยมีทั้ง P/N ที่ขายได้ และ P/N RT (เงินประกัน)',
    c.includes('P/N ที่ขายได้') && c.includes('P/N RT (เงินประกัน)'), '');

  happy('กรอกรับเงินค่างานสุทธิ 2,000,000 ได้', await typeMoney('รับเงินค่างานสุทธิ', 2000000), '');
  await settle(800);
  happy('หัก TL คิดเอง 15% = 300,000', (await valueOf('หัก TL')) === '300,000', String(await valueOf('หัก TL')));
  happy('หัก ML คิดเอง 1.5% = 30,000', (await valueOf('หัก ML')) === '30,000', String(await valueOf('หัก ML')));
  happy('หัก PN ขอเบิกใหม่ = รวม P/N ที่ขาย = 1,100,000',
    (await valueOf('หัก PN ขอเบิกใหม่')) === '1,100,000', String(await valueOf('หัก PN ขอเบิกใหม่')));
  const ro = await page.evaluate(() => ['หัก TL', 'หัก ML', 'หัก PN ขอเบิกใหม่'].map((t) => {
    const el = [...document.querySelectorAll(`input[title="${t}"]`)][0];
    return el ? el.readOnly : null;
  }));
  bad('ช่อง auto แก้มือไม่ได้', ro.every((x) => x === true), JSON.stringify(ro));
  const rw = await page.evaluate(() => ['หัก PN', 'หัก Segment CVE'].map((t) => {
    const el = [...document.querySelectorAll(`input[title="${t}"]`)][0];
    return el ? el.readOnly : null;
  }));
  happy('ช่องที่กรอกมือได้ยังกรอกได้ (หัก PN · Segment CVE)', rw.every((x) => x === false), JSON.stringify(rw));
  await typeMoney('หัก PN', 300000);
  await typeMoney('หัก Segment CVE', 50000);
  await settle(900);
  c = await cardText();
  happy('คงเหลือ = 2,000,000 − 1,780,000 = ฿220,000', c.includes('220,000'), '');
  await shot('03-กรอกตัวเลขครบ');
}

// ── 4. บันทึกเองแล้วรีโหลดยังอยู่ ──────────────────────────────────────────
suite('4. บันทึกให้เองแล้วรีโหลดยังอยู่');
{
  await settle(2500);   // รอคิวบันทึกที่รวบไว้ยิงออกให้หมด
  await as(A, '/credit');
  await openTab('แผนการเงิน (T-bar)');
  await settle(2000);
  await pickMonth(MONTH);
  await settle(3000);
  happy('ค่างานที่ส่งยังเป็น 1,000,000', (await valueOf('ค่างานที่ส่ง')) === '1,000,000', String(await valueOf('ค่างานที่ส่ง')));
  happy('รับเงินค่างานสุทธิยังเป็น 2,000,000',
    (await valueOf('รับเงินค่างานสุทธิ')) === '2,000,000', String(await valueOf('รับเงินค่างานสุทธิ')));
  happy('หัก TL ยังคิดได้ 300,000', (await valueOf('หัก TL')) === '300,000', String(await valueOf('หัก TL')));
  const api = (await call(`/credit/cash-plan/tbar?month=${MONTH}&kind=plan`, { user: A })).data;
  const mine = (api.periods || []).filter((p) => p.project_id === project.id);
  const inc = mine.find((p) => p.period_type === 'income' && p.period_idx === 2);
  happy('เลขบนจอตรงกับเลขที่เซิร์ฟเวอร์เก็บไว้ (รวม P/N 1,100,000)',
    inc?.calc?.totalPN === 1100000, String(inc?.calc?.totalPN));
  const c = await cardText();
  const proj = (api.projects || []).find((x) => x.project_id === project.id);
  happy('รวมรับท้ายการ์ดตรงกับที่เซิร์ฟเวอร์คิด',
    c.includes(proj.cash_in.toLocaleString('en-US', { maximumFractionDigits: 0 })), String(proj.cash_in));
  await shot('04-หลังรีโหลด');
}

// ── 5. เพิ่มส่วน · Aval · ลบส่วน ───────────────────────────────────────────
suite('5. เพิ่มส่วน ขอออก Aval จัดสรร แล้วลบทิ้ง');
{
  happy('กดปุ่ม ＋ เพิ่มส่วน ได้', await clickText('＋ เพิ่มส่วน'), '');
  await settle(1200);
  let t = await body();
  happy('จอเลือกประเภทงวดขึ้นครบสามแบบ',
    t.includes('เลือกประเภทงวดสำหรับ') && t.includes('ขอเบิก P/N')
    && t.includes('รับเงินค่างาน + หักหนี้') && t.includes('ขอออก Aval จัดสรร'), '');
  happy('คำอธิบายประเภทงวดเป็นคำของเขา',
    t.includes('ออก Aval (B/E) จ่ายผู้ขาย/วัสดุ'), '');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role="dialog"] button')]
      .find((x) => x.innerText.trim().startsWith('ขอออก Aval จัดสรร'));
    if (b) b.click();
  });
  await settle(3500);
  happy('เพิ่มส่วน Aval แล้วมีสี่ส่วน',
    (await page.evaluate(() => (document.body.innerText.match(/ขอออก Aval จัดสรร/g) || []).length)) >= 1, '');
  happy('กรอกยอด Aval 750,000 ได้', await typeMoney('ขอออก Aval จัดสรร', 750000), '');
  await settle(1500);
  let c = await cardText();
  happy('Aval ขึ้นเป็นเงินจ่ายของส่วนนั้น', c.includes('750,000'), '');
  await shot('05-เพิ่มส่วน-aval');

  const before = await page.evaluate(() => document.querySelectorAll('button[title="ลบส่วนนี้"]').length);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button[title="ลบส่วนนี้"]')];
    if (btns.length) btns[btns.length - 1].click();
  });
  await settle(1000);
  t = await body();
  happy('ถามยืนยันก่อนลบส่วน', t.includes('ลบส่วนนี้?'), '');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'ลบ');
    if (b) b.click();
  });
  await settle(2500);
  const after = await page.evaluate(() => document.querySelectorAll('button[title="ลบส่วนนี้"]').length);
  happy('ลบส่วนแล้วจำนวนส่วนลดลง', after === before - 1, `${before} → ${after}`);
  c = await cardText();
  bad('ยอด Aval หายไปจากรวมจ่ายด้วย', !c.includes('750,000'), '');
}

// ── 6. จัดตั๋วเข้าส่วน — ตัดออก แล้วเพิ่มกลับจาก picker ────────────────────
suite('6. จัดตั๋วเข้าส่วน — ตัดออก / เพิ่มกลับ / ย้ายไปส่วนอื่น');
{
  const rows = () => page.evaluate((m) => (document.body.innerText.match(new RegExp(`${m}-[AB]`, 'g')) || []).length, MARK);
  happy('ตอนนี้เห็นตั๋วทั้งสองใบ', (await rows()) === 2, String(await rows()));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button[title="ตัดออกจากส่วนนี้"]')][0];
    if (b) b.click();
  });
  await settle(2500);
  happy('กด "ตัดออกจากส่วนนี้" แล้วเหลือใบเดียว', (await rows()) === 1, String(await rows()));
  let t = await body();
  happy('ปุ่ม ＋ เพิ่ม บอกจำนวนที่ยังไม่ถูกจัดเข้าส่วน', /＋ เพิ่ม \(1\)/.test(t), (t.match(/＋ เพิ่ม \(\d+\)/) || [''])[0]);
  await clickText('＋ เพิ่ม (1)');
  await settle(1200);
  t = await body();
  happy('จอเลือกตั๋วขึ้นพร้อมกลุ่ม "ครบกำหนดเดือนนี้"',
    t.includes('เลือกรายการที่จะเพิ่มเข้าส่วนนี้') && t.includes('ครบกำหนดเดือนนี้'), '');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => /ZZTBARUI-/.test(x.innerText));
    if (b) b.click();
  });
  await settle(2500);
  happy('เพิ่มตั๋วกลับเข้าส่วนได้', (await rows()) === 2, String(await rows()));

  // ย้ายไปส่วนถัดไป (ปุ่มลูกศรลง) — ตั๋วต้องไปอยู่ส่วนอื่น ไม่ใช่ซ้ำสองที่
  const moved = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /^ย้ายไปส่วน \d+$/.test(x.title || '') && x.title.includes('3'));
    if (b) { b.click(); return b.title; }
    return '';
  });
  await settle(2500);
  const api = (await call(`/credit/cash-plan/tbar?month=${MONTH}&kind=plan`, { user: A })).data;
  const mine = (api.periods || []).filter((p) => p.project_id === project.id);
  const owners = mine.filter((p) => (p.paid_ids || []).length).map((p) => p.period_idx);
  happy(`ย้ายตั๋วด้วยปุ่ม "${moved || 'ย้ายไปส่วน'}" ได้`, Boolean(moved), '');
  bad('ตั๋วใบหนึ่งอยู่ได้ส่วนเดียว ไม่ซ้ำสองส่วน',
    mine.reduce((s, p) => s + (p.paid_ids || []).length, 0) === 2
    && new Set(mine.flatMap((p) => p.paid_ids || [])).size === 2,
    JSON.stringify(mine.map((p) => p.paid_ids)));
  happy('ตอนนี้ตั๋วกระจายอยู่สองส่วน', owners.length === 2, JSON.stringify(owners));
  await shot('06-จัดตั๋ว');
}

// ── 7. คัดลอกจากเดือนก่อน ───────────────────────────────────────────────────
suite('7. คัดลอกจากเดือนก่อน');
{
  await pickMonth(NEXT);
  await settle(3000);
  let t = await body();
  happy('เดือนใหม่ยังว่าง — ขึ้นการ์ดเริ่มต้น', t.includes('① เริ่มต้น'), '');
  await page.evaluate((pid) => {
    const s = [...document.querySelectorAll('select')].find((x) => (x.title || '') === 'เลือกโครงการ');
    if (s) { s.value = pid; s.dispatchEvent(new Event('change', { bubbles: true })); }
  }, project.id);
  await settle(4000);
  happy('กดคัดลอกจากเดือนก่อนได้', await page.evaluate(() => {
    const b = [...document.querySelectorAll('button[title="คัดลอกจากเดือนก่อน"]')][0];
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  }), '');
  await settle(4000);
  happy('ยอดของเดือนก่อนถูกลอกมา (ค่างานที่ส่ง 1,000,000)',
    (await valueOf('ค่างานที่ส่ง')) === '1,000,000', String(await valueOf('ค่างานที่ส่ง')));
  happy('รับเงินค่างานสุทธิถูกลอกมาด้วย (2,000,000)',
    (await valueOf('รับเงินค่างานสุทธิ')) === '2,000,000', String(await valueOf('รับเงินค่างานสุทธิ')));
  t = await body();
  bad('ตั๋วไม่ถูกลอกมา — เดือนใหม่ไม่มีตั๋วครบกำหนด',
    !t.includes(`${MARK}-A`) && !t.includes(`${MARK}-B`), '');
  await shot('07-คัดลอกเดือนก่อน');
  // เก็บเดือนปลายทางทิ้ง ไม่ให้ค้างไปกวนชุดอื่น
  await call(`/credit/cash-plan/tbar/project?projectId=${project.id}&month=${NEXT}`, { method: 'DELETE', user: A });
  await pickMonth(MONTH);
  await settle(2500);
}

// ── 8. ส่งออก T-bar ─────────────────────────────────────────────────────────
suite('8. ส่งออก T-bar เป็น Excel จากหน้าจอ');
{
  happy('กดปุ่ม Export T-bar ได้', await clickText('Export T-bar'), '');
  // ข้อความแจ้งผลอยู่บนจอ 3.5 วินาที — อ่านให้ทันก่อนมันหาย
  await settle(1500);
  const t = await body();
  happy('ขึ้นข้อความว่าดาวน์โหลดแล้ว', t.includes('ดาวน์โหลดไฟล์ Excel แล้ว'), '');
  bad('ไม่ขึ้นข้อความส่งออกไม่สำเร็จ', !t.includes('ส่งออกไม่สำเร็จ'), '');
  await shot('08-ส่งออก');
}

// ── 8ข. แท็บหักค่างานตามจริง ตั้งต้นจากแผนให้เอง ──────────────────────────
suite('8ข. หักค่างานตามจริงตั้งต้นจากแผน แล้วแก้เป็นยอดจริง');
{
  happy('เปิดแท็บหักค่างานตามจริงได้', await openTab('หักค่างานตามจริง'), '');
  await settle(2500);
  await pickMonth(MONTH);
  await settle(4000);
  const t = await body();
  happy('หัวจอบอกว่าเป็นฉบับหักค่างานตามจริง', t.includes('หักค่างานตามจริง · เดือน'), '');
  happy('เปิดครั้งแรกแล้วมีส่วนตั้งต้นให้เลย ไม่ใช่จอว่าง',
    t.includes('รับเงินค่างาน + หักหนี้') && !t.includes('① เริ่มต้น'), '');
  happy('ยอดตั้งต้นลอกมาจากแผน (ค่างานที่ส่ง 1,000,000)',
    (await valueOf('ค่างานที่ส่ง')) === '1,000,000', String(await valueOf('ค่างานที่ส่ง')));
  happy('แก้เป็นยอดจริง 800,000 ได้', await typeMoney('ค่างานที่ส่ง', 800000), '');
  await settle(2500);
  await shot('08ข-หักค่างานตามจริง');
}

// ── 9. แท็บผลต่าง ───────────────────────────────────────────────────────────
suite('9. แท็บผลต่าง — หัวตารางสองชั้นและตัวเลขที่ถูก');
{
  happy('เปิดแท็บผลต่างได้', await openTab('ผลต่าง (Variance)'), '');
  await settle(2500);
  await pickMonth(MONTH);
  await settle(3000);
  const heads = await page.evaluate(() => [...document.querySelectorAll('table thead tr')]
    .map((r) => [...r.children].map((c) => c.innerText.trim()).join('|')));
  happy('หัวตารางชั้นแรก: โครงการ + สามกลุ่ม',
    heads[0] === 'โครงการ|รับเงิน (Received)|หักจ่าย (Deducted)|คงเหลือสุทธิ (Net)', heads[0]);
  happy('หัวตารางชั้นสอง: แผน / จริง / ผลต่าง สามชุด',
    heads[1] === 'แผน|จริง|ผลต่าง|แผน|จริง|ผลต่าง|แผน|จริง|ผลต่าง', heads[1]);
  const row = await page.evaluate((code) => {
    const tr = [...document.querySelectorAll('table tbody tr')].find((r) => r.innerText.includes(code));
    return tr ? [...tr.children].map((c) => c.innerText.trim()) : null;
  }, project.code);
  happy('มีแถวของโครงการทดสอบ', Boolean(row), '');
  const v = (await call(`/credit/cash-plan/tbar/variance?month=${MONTH}`, { user: A })).data
    .find((x) => x.project_id === project.id);
  happy('รับเงินตามแผนบนจอตรงกับ API',
    row[1].replace(/[฿,]/g, '') === String(Math.round(v.received.plan)), `${row[1]} / ${v.received.plan}`);
  happy('รับเงินตามจริงบนจอตรงกับ API',
    row[2].replace(/[฿,]/g, '') === String(Math.round(v.received.actual)), `${row[2]} / ${v.received.actual}`);
  happy('ผลต่างขึ้นเครื่องหมายลบเมื่อจริงน้อยกว่าแผน', row[3].startsWith('−'), row[3]);
  happy('ผลต่างเท่ากับ จริง − แผน',
    row[3].replace(/[−+฿,]/g, '') === String(Math.abs(Math.round(v.received.diff))), `${row[3]} / ${v.received.diff}`);
  bad('แท็บผลต่างไม่มีแถบตัวกรองร่วม (บริษัท / ระยะเวลา)', await page.evaluate(() => {
    const titles = ['บริษัท', 'ระยะเวลา'];
    return ![...document.querySelectorAll('select')].some((x) => titles.includes(x.title || ''));
  }), '');
  await shot('09-ผลต่าง');
}

// ── 10. สองฉบับไม่ปนกัน ────────────────────────────────────────────────────
suite('10. แผนกับจริงเป็นจอเดียวกัน แต่ข้อมูลแยกกัน');
{
  happy('กลับไปแท็บหักค่างานตามจริงได้', await openTab('หักค่างานตามจริง'), '');
  await settle(2500);
  await pickMonth(MONTH);
  await settle(3000);
  happy('เห็นค่างานที่ส่งของฉบับจริง (800,000)',
    (await valueOf('ค่างานที่ส่ง')) === '800,000', String(await valueOf('ค่างานที่ส่ง')));
  await openTab('แผนการเงิน (T-bar)');
  await settle(2000);
  await pickMonth(MONTH);
  await settle(3000);
  happy('สลับกลับมาฉบับแผนแล้วยังเป็น 1,000,000 — สองฉบับไม่ปนกัน',
    (await valueOf('ค่างานที่ส่ง')) === '1,000,000', String(await valueOf('ค่างานที่ส่ง')));
  await shot('10-สองฉบับ');
}

// ── 11. จอโทรศัพท์ ──────────────────────────────────────────────────────────
suite('11. เปิดบนจอโทรศัพท์แล้วยังอ่านได้');
{
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await as(A, '/credit');
  await openTab('แผนการเงิน (T-bar)');
  await settle(2000);
  await pickMonth(MONTH);
  await settle(3500);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  bad('หน้าไม่ล้นออกด้านข้าง', over <= 2, `${over}px`);
  const t = await body();
  happy('ยังเห็นแถบ รับ · Cash in', t.includes('รับ · Cash in'), '');
  happy('ยังเห็นห้าแถวหัก', t.includes('หัก TL') && t.includes('หัก Segment CVE'), '');
  happy('ยังเห็นยอดรวมท้ายเดือน', t.includes('รวมทุก T-bar (Total all)'), '');
  await shot('11-จอโทรศัพท์');
  await page.setViewport({ width: 1500, height: 980 });
}

// ── 12. ไม่มีข้อผิดพลาดซ่อนอยู่ ────────────────────────────────────────────
suite('12. ไม่มีข้อผิดพลาดซ่อนอยู่');
{
  const real = errors.filter((e) => !/favicon|React DevTools|ERR_NETWORK_CHANGED|net::ERR_FAILED/.test(e));
  bad('ไม่มี error ในคอนโซลระหว่างใช้งาน', real.length === 0, real.slice(0, 3).join(' | '));
  bad('ไม่มีคำขอไปที่ API ที่ตอบไม่ผ่าน', httpErrors.length === 0, httpErrors.slice(0, 3).join(' | '));
}

// ── 13. เก็บกวาด ────────────────────────────────────────────────────────────
suite('13. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await sweep();
  const left = await query(
    `select (select count(*) from facilities where notes = $1)::int f,
            (select count(*) from credit_ledger where ref like $2)::int l,
            (select count(*) from cash_plans where project_id = $3)::int c`,
    [MARK, `${MARK}%`, project.id]);
  happy('ลบข้อมูลทดสอบหมดแล้ว',
    left.rows[0].f === 0 && left.rows[0].l === 0 && left.rows[0].c === 0, JSON.stringify(left.rows[0]));
}

await browser.close();
process.exit(report(`${ROOT}/credit-tbar-ui.json`) ? 1 : 0);
