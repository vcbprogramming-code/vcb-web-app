/**
 * ปฐมนิเทศพนักงานใหม่ — เดินทั้งโปรแกรมอย่างที่พนักงานใหม่คนหนึ่งจะเดิน
 *
 * ชุด API พิสูจน์ว่ากติกาถูก ชุดนี้ถามว่า "คนหนึ่งคนเดินจนจบได้ไหม" ตามลำดับ
 * เจ็ดขั้นของพอร์ทัลที่บริษัทใช้อยู่: เตรียมความพร้อม → เอกสารที่จำเป็น →
 * เลือกแผนก → สามระยะ → สำเร็จการปฐมนิเทศ
 *
 * สิ่งที่ชุดนี้จับได้และชุด API จับไม่ได้ คือ **หน้าจอไทยที่ยังเป็นอังกฤษ** —
 * เนื้อหาเช็กลิสต์มาจากฐานข้อมูล ไม่ได้ผ่านพจนานุกรม t() การตรวจว่ามีคอลัมน์
 * text_th ในคำตอบ API ไม่ได้บอกว่าหน้าจอเอามาใช้จริง
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/onboarding`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin;
const wipe = async () => {
  for (const t of ['ob_progress', 'ob_doc_submissions', 'ob_enrollments'])
    await query(`delete from ${t} where profile_id = $1`, [A.id]);
};
await wipe();

// โปรไฟล์ Chrome ใช้ครั้งเดียวแล้วทิ้ง — ชุดที่ล้มกลางคันทิ้งโปรไฟล์ที่เขียนค้าง
// ไว้ และ Chrome จะค้างตอนเปิดโปรไฟล์นั้นทุกครั้งหลังจากนั้น
fs.rmSync(`${ROOT}/chrome-onboarding`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-onboarding`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 1800) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });

const as = async (user, path = '/onboarding/program') => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(2600);
};
/**
 * รอจนข้อความที่คาดว่าจะขึ้นมาอยู่บนหน้าจอจริง แทนการนอนรอเป็นวินาที
 *
 * เซิร์ฟเวอร์ dev ของ Vite แปลงไฟล์ตอนที่ถูกขอครั้งแรก การเข้าโมดูลครั้งแรก
 * ของการรันหนึ่งรอบจึงช้ากว่าครั้งถัด ๆ ไปหลายวินาที — settle() คงที่จึงถ่าย
 * ภาพหน้าจอตอนยังขึ้น "กำลังโหลด…" แล้วรายงานว่าข้อความหาย ทั้งที่มันแค่ยัง
 * มาไม่ถึง
 */
const waitText = (s, ms = 45000) => page
  .waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms, polling: 300 }, s)
  .then(() => true).catch(() => false);
/** อยู่ในโมดูลและโหลดเสร็จแล้ว (แถบความคืบหน้าขึ้นทุกหน้าของโมดูล) */
const ready = () => waitText('ความคืบหน้าการปฐมนิเทศของคุณ');

const clickText = (label, sel = 'button, a') => page.evaluate((l, s) => {
  const el = [...document.querySelectorAll(s)].filter((x) => x.innerText.trim() === l)
    .concat([...document.querySelectorAll(s)].filter((x) => x.innerText.trim().includes(l)))[0];
  if (el) { el.click(); return true; } return false;
}, label, sel);
/** ช่องติ๊กในตารางเช็กลิสต์ (ไม่นับช่องอื่นในหน้า) */
const boxes = () => page.evaluate(() =>
  [...document.querySelectorAll('label input[type=checkbox]')].map((b) => ({ checked: b.checked, disabled: b.disabled })));
/** จำนวนเอกสารที่ยังไม่ได้ทำเครื่องหมายว่าเสร็จสมบูรณ์ */
const unmarkedDocs = () => page.evaluate(() =>
  document.querySelectorAll('button[aria-label="ทำเครื่องหมายว่าเสร็จสมบูรณ์"]').length);

/**
 * ติ๊กเอกสารฉบับถัดไปว่าเสร็จสมบูรณ์ แล้ว **รอจนตัวเลขลดลงจริง**
 *
 * รอเป็นวินาทีคงที่แล้วกดต่อไม่ได้ เพราะระหว่างที่คำขอยังไม่กลับ ปุ่มของเอกสาร
 * ฉบับนั้นถูกปิดไว้ การกดซ้ำจึงตกใส่ปุ่มที่กดไม่ได้และหายไปเฉย ๆ — อาการคือ
 * กดหกครั้งแล้วติ๊กขึ้นศูนย์ฉบับ ซึ่งดูเหมือนหน้าจอพัง ทั้งที่แค่กดเร็วเกินไป
 */
const markDoc = async () => {
  const before = await unmarkedDocs();
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button[aria-label]')]
      .find((x) => x.getAttribute('aria-label') === 'ทำเครื่องหมายว่าเสร็จสมบูรณ์' && !x.disabled);
    if (b) { b.click(); return true; } return false;
  });
  if (!clicked) return false;
  return page.waitForFunction(
    (n) => document.querySelectorAll('button[aria-label="ทำเครื่องหมายว่าเสร็จสมบูรณ์"]').length < n,
    { timeout: 30000, polling: 200 }, before,
  ).then(() => true).catch(() => false);
};

/**
 * ติ๊กงานถัดไปในเช็กลิสต์ แล้วรอจนตัวเลขของ **เซิร์ฟเวอร์** ขยับ
 *
 * ช่องติ๊กอัปเดตหน้าจอทันทีก่อนรอเซิร์ฟเวอร์ (ตั้งใจ) ตัวนับในหน้าเฟสจึงขยับ
 * ทันทีแม้บันทึกยังไม่เสร็จ — ถ้าชุดทดสอบเชื่อตัวเลขนั้นแล้วกดต่อทันที มันจะ
 * แซงหน้าการบันทึกจริง และข้อมูลที่โหลดกลับมาทีหลังจะทับเครื่องหมายที่กดไว้
 * แถบ "N/27 งานที่เสร็จสมบูรณ์ในแผนกของคุณ" มาจากเซิร์ฟเวอร์ จึงใช้อันนั้นเป็นตัววัด
 */
const deptDone = () => page.evaluate(() => {
  const m = document.body.innerText.match(/(\d+)\/(\d+)\s*งานที่เสร็จสมบูรณ์ในแผนกของคุณ/);
  return m ? Number(m[1]) : -1;
});
const waitDeptDone = (cmp, n) => page.waitForFunction((c, x) => {
  const m = document.body.innerText.match(/(\d+)\/(\d+)\s*งานที่เสร็จสมบูรณ์ในแผนกของคุณ/);
  if (!m) return false;
  return c === 'up' ? Number(m[1]) > x : Number(m[1]) < x;
}, { timeout: 30000, polling: 200 }, cmp, n).then(() => true).catch(() => false);

const tickNext = async () => {
  const before = await deptDone();
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('label input[type=checkbox]')].find((x) => !x.checked && !x.disabled);
    if (b) { b.click(); return true; } return false;
  });
  if (!clicked) return false;
  return waitDeptDone('up', before);
};
const untickOne = async () => {
  const before = await deptDone();
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('label input[type=checkbox]')].find((x) => x.checked && !x.disabled);
    if (b) { b.click(); return true; } return false;
  });
  if (!clicked) return false;
  return waitDeptDone('down', before);
};

// ── 1. เข้าโมดูลจากหน้าแรก ────────────────────────────────────────────────
suite('1. หาโมดูลเจอจากหน้าแรก');
{
  await as(A, '/');
  const t = await body();
  happy('การ์ดปฐมนิเทศขึ้นที่หน้าแรก', t.includes('ปฐมนิเทศพนักงานใหม่'), '');
  bad('ไม่ขึ้นป้ายว่ายังไม่เปิดใช้งาน', !/ปฐมนิเทศ[\s\S]{0,120}(เร็ว ๆ นี้|ยังไม่เปิด)/.test(t), '');
  await shot('01-หน้าแรก');

  // การ์ดบนหน้าแรกเป็น <button> ไม่ใช่ลิงก์ — ต้องกดปุ่ม ไม่ใช่มองหา <a>
  const went = await page.evaluate(() => {
    const card = [...document.querySelectorAll('button')]
      .find((x) => x.innerText.includes('ปฐมนิเทศพนักงานใหม่') && x.innerText.includes('เปิดใช้งาน'));
    if (card) { card.click(); return true; } return false;
  });
  await settle(1200);
  const loaded = await ready();
  happy('กดการ์ดแล้วเข้าโมดูลได้',
    went && loaded && page.url().includes('/onboarding/program'),
    `${page.url()}`);
}

// ── 2. ชั้นวางเจ็ดขั้น + แถบความคืบหน้า ───────────────────────────────────
suite('2. ชั้นวางเจ็ดขั้นและแถบความคืบหน้าแบบพอร์ทัลของเขา');
{
  const t = await body();
  happy('ชั้นวางใช้ชื่อขั้นตามของเขา',
    ['เตรียมความพร้อมก่อนเริ่มงาน', 'เอกสารที่จำเป็น', 'เลือกแผนก', 'สำเร็จการปฐมนิเทศ']
      .every((x) => t.includes(x)),
    ['เตรียมความพร้อมก่อนเริ่มงาน', 'เอกสารที่จำเป็น', 'เลือกแผนก', 'สำเร็จการปฐมนิเทศ']
      .filter((x) => !t.includes(x)).join(' / '));
  bad('ไม่ใช้คำเดิมที่ไม่ตรงระบบจริงแล้ว',
    !t.includes('เอกสารที่ต้องส่ง') && !t.includes('แผนกที่สังกัด') && !t.includes('จบโปรแกรม'), '');
  happy('แถบความคืบหน้ามีชื่อคนและเปอร์เซ็นต์',
    t.includes('ความคืบหน้าการปฐมนิเทศของคุณ') && t.includes(A.name) && /\d+% เสร็จสมบูรณ์/.test(t),
    (t.match(/\d+% เสร็จสมบูรณ์/) || [''])[0]);
  await shot('02-ชั้นวาง');
}

// ── 3. เตรียมความพร้อมก่อนเริ่มงาน — เนื้อหาไทยของเขา ─────────────────────
suite('3. หน้าเตรียมความพร้อม — ข้อความไทยของเขาตรงตัว');
{
  const t = await body();
  happy('สารต้อนรับใช้คำว่า "ท่านกรรมการผู้จัดการ"', t.includes('สารต้อนรับจากท่านกรรมการผู้จัดการ'), '');
  happy('ชื่อไทยของท่านกรรมการผู้จัดการ', t.includes('นาย วรวิทย์ ชวนะนันท์'), '');
  happy('หัวข้อค่านิยมตรงของเขา',
    t.includes('วัฒนธรรมและค่านิยมของ VCB') && t.includes('สิ่งที่เรายึดถือ — โปรดซึมซับตั้งแต่วันแรก'), '');
  happy('ชื่อค่านิยมใช้คำแปลของเขา (ความซื่อสัตย์ / ความประณีต)',
    t.includes('ความซื่อสัตย์') && t.includes('ความประณีต'), '');
  bad('ไม่เหลือคำที่เราแปลเองผิดไป', !t.includes('ความซื่อตรง'), '');
  bad('เนื้อความค่านิยมไม่ใช่อังกฤษล้วน', !t.includes('We follow structured systems'), '');
  await shot('03-เตรียมความพร้อม');
}

// ── 4. เอกสารที่จำเป็น — ดู ดาวน์โหลด อัปโหลด เสร็จสมบูรณ์ ────────────────
suite('4. เอกสารที่จำเป็น — สี่อย่างบนการ์ดเดียว');
{
  happy('เข้าขั้นเอกสารได้', await clickText('เอกสารที่จำเป็น'), '');
  await waitText('ฉบับนี้ก่อนวันเริ่มงานวันแรก');
  await settle(1200);
  const t = await body();
  happy('ข้อความนำบอกให้ดู ดาวน์โหลด กรอก และอัปโหลด',
    /ดู ดาวน์โหลด กรอกข้อมูล และอัปโหลดเอกสารทั้ง 8 ฉบับนี้ก่อนวันเริ่มงานวันแรก/.test(t), '');
  happy('ชื่อเอกสารเป็นไทย ไม่ใช่อังกฤษ',
    t.includes('ใบสมัครงาน') && t.includes('สัญญาจ้างงาน') && t.includes('ข้อตกลงการรักษาความลับ'), '');
  bad('ไม่เหลือชื่อเอกสารภาษาอังกฤษ', !t.includes('Employment Application Form'), '');
  const counts = await page.evaluate(() => ({
    view: [...document.querySelectorAll('a')].filter((x) => x.innerText.includes('ดูเอกสาร')).length,
    dl: [...document.querySelectorAll('a')].filter((x) => x.innerText.includes('ดาวน์โหลด')).length,
    up: [...document.querySelectorAll('button')].filter((x) => x.innerText.includes('อัปโหลด')).length,
    done: document.querySelectorAll('button[aria-label="ทำเครื่องหมายว่าเสร็จสมบูรณ์"]').length,
  }));
  happy(`ปุ่มดูเอกสาร 7 ฉบับ (พบ ${counts.view})`, counts.view === 7, `${counts.view}`);
  happy(`ปุ่มดาวน์โหลด 7 ฉบับ (พบ ${counts.dl})`, counts.dl === 7, `${counts.dl}`);
  happy(`ปุ่มอัปโหลดครบ 8 ฉบับ (พบ ${counts.up})`, counts.up === 8, `${counts.up}`);
  happy(`ปุ่มเสร็จสมบูรณ์ครบ 8 ฉบับ (พบ ${counts.done})`, counts.done === 8, `${counts.done}`);
  happy('ลิงก์ดูเอกสารชี้ไปเอกสารต้นแบบจริง',
    await page.evaluate(() => [...document.querySelectorAll('a')]
      .some((x) => x.innerText.includes('ดูเอกสาร') && /drive\.google\.com|docs\.google\.com/.test(x.href))), '');
  happy('บอกว่าเหลืออีกกี่รายการจึงจะเลือกแผนกได้',
    /ยังเหลืออีก 8 รายการ จึงจะเลือกแผนกได้/.test(t), t.split('\n').find((l) => l.includes('เหลืออีก')) || '');
  await shot('04-เอกสาร');
}

// ── 5. ประตูกั้นก่อนเลือกแผนก ─────────────────────────────────────────────
suite('5. เอกสารยังไม่ครบ — เลือกแผนกไม่ได้ และบอกว่าขาดฉบับไหน');
{
  // ติ๊กไว้ก่อนสองฉบับ เพื่อให้รายชื่อที่ขาดในป๊อปอัปเป็น 6 ไม่ใช่ทั้ง 8
  happy('ติ๊กเอกสารฉบับแรกว่าเสร็จสมบูรณ์ได้', await markDoc(), '');
  happy('ติ๊กฉบับที่สองได้', await markDoc(), '');
  happy('เหลือยังไม่ติ๊ก 6 ฉบับ', (await unmarkedDocs()) === 6, `${await unmarkedDocs()}`);
  await clickText('เลือกแผนก');
  await waitText('เลือกระดับตำแหน่งของคุณ');
  happy('กดการ์ดแผนกได้ (ยังไม่ผ่านประตู)', await clickText('ฝ่ายบัญชี'), '');
  await waitText('กรุณากรอกเอกสารที่จำเป็นให้ครบก่อน');
  await settle(600);
  const t = await body();
  happy('ขึ้นป๊อปอัปว่ากรอกเอกสารให้ครบก่อน', t.includes('กรุณากรอกเอกสารที่จำเป็นให้ครบก่อน'), '');
  happy('บอกรายชื่อเอกสารที่ยังขาด ไม่ใช่แค่ว่ายังไม่ครบ',
    t.includes('เอกสารที่ยังขาดอยู่:') && t.includes('แบบฟอร์มขึ้นทะเบียนภาษี'), '');
  bad('เอกสารที่ติ๊กแล้วไม่อยู่ในรายชื่อที่ขาด',
    !/เอกสารที่ยังขาดอยู่:[\s\S]{0,400}ใบสมัครงาน/.test(t), '');
  happy('ยังไม่ถูกย้ายไปแผนกไหน', !(await body()).includes('งานที่เสร็จสมบูรณ์ในแผนกของคุณ'), '');
  await shot('05-ประตูกั้น');
  happy('ป๊อปอัปมีปุ่มพาไปหน้าเอกสาร', await clickText('ไปที่เอกสารที่จำเป็น'), '');
  await settle(2000);
}

// ── 6. ส่งเอกสารครบแล้วเลือกแผนกได้ ───────────────────────────────────────
suite('6. ส่งครบแล้วเลือกแผนกได้ และเข้าระยะแรกทันที');
{
  for (let i = 0; i < 6; i += 1) await markDoc();
  happy('ติ๊กครบทั้ง 8 ฉบับ', (await unmarkedDocs()) === 0, `${await unmarkedDocs()} ฉบับที่ยังเหลือ`);
  await settle(600);
  const t = await body();
  happy('ระบบบอกว่าเลือกแผนกได้แล้ว', t.includes('ส่งเอกสารครบแล้ว — เลือกแผนกได้เลย'), '');
  await shot('06-เอกสารครบ');

  await clickText('ไปที่เลือกแผนก');
  await settle(2000);
  const t2 = await body();
  happy('หน้าเลือกแผนกมีหัวข้อระดับตำแหน่งของเขา',
    t2.includes('เลือกระดับตำแหน่งของคุณ') && t2.includes('จูเนียร์') && t2.includes('ซีเนียร์'), '');
  bad('ไม่ใช้คำเดิม ระดับต้น/ระดับอาวุโส', !t2.includes('ระดับต้น') && !t2.includes('ระดับอาวุโส'), '');

  happy('เลือกฝ่ายบัญชีได้', await clickText('ฝ่ายบัญชี'), '');
  await waitText('เอกสารที่ต้องศึกษา');
  await settle(1200);
  const t3 = await body();
  happy('เข้าระยะแรกทันทีหลังเลือกแผนก', /ระยะพื้นฐาน/.test(t3), t3.split('\n').slice(0, 3).join(' | '));
  happy('ช่วงวันในชั้นวางใช้ขีดยาว (วันที่ 1–30)', t3.includes('วันที่ 1–30'), '');
  happy('แถบความคืบหน้าบอกงานในแผนก', /0\/27\s*งานที่เสร็จสมบูรณ์ในแผนกของคุณ/.test(t3), '');
}

// ── 7. เนื้อหาระยะเป็นภาษาไทย ─────────────────────────────────────────────
suite('7. เนื้อหาระยะเป็นภาษาไทย ไม่ใช่อังกฤษล้วน');
{
  const t = await body();
  happy('หัวเฟสเป็นไทย', t.includes('บัญชี · ระยะที่ 1 (วันที่ 1–30)'), t.split('\n')[0]);
  happy('หัวบล็อกเป็นไทย',
    t.includes('เอกสารที่ต้องศึกษา') && t.includes('ความรู้ที่จำเป็น') && t.includes('ผลงานที่ต้องส่งมอบ'), '');
  bad('หัวบล็อกอังกฤษไม่เหลืออยู่',
    !t.includes('Required Reading') && !t.includes('Knowledge Requirements') && !t.includes('Required Outputs'), '');
  happy('ข้อเช็กลิสต์เป็นไทย', t.includes('โครงสร้างผังบัญชี'), '');
  bad('ข้อเช็กลิสต์อังกฤษไม่เหลืออยู่', !t.includes('Chart of Accounts Structure'), '');
  happy('มีแถบความคืบหน้าต่อบล็อกพร้อมเปอร์เซ็นต์',
    (t.match(/\d+% เสร็จสมบูรณ์/g) || []).length >= 4, `${(t.match(/\d+% เสร็จสมบูรณ์/g) || []).length} แถบ`);
  await shot('07-ระยะแรกภาษาไทย');
}

// ── 8. ติ๊กงานจริง ────────────────────────────────────────────────────────
suite('8. ติ๊กงานแล้วระบบตอบสนอง');
{
  const b0 = await boxes();
  happy('พนักงานจูเนียร์เห็น 9 รายการ ไม่ใช่ 12', b0.length === 9, `${b0.length}`);
  happy('ช่องติ๊กใช้งานได้ทุกช่อง', b0.every((x) => !x.disabled), '');
  happy('ติ๊กงานแรกได้', await tickNext(), '');
  const t = await body();
  happy('ตัวนับเพิ่มขึ้นหลังติ๊ก', /1\/9\s*รายการ/.test(t), (t.match(/\d+\/\d+\s*รายการ/) || [''])[0]);
  happy('คำชมตรงห้าข้อของเขา มีเครื่องหมายอัศเจรีย์',
    /(ทำได้ดีมาก!|เยี่ยมมาก!|ทำต่อไปนะ!|ทำได้ดี!|คุณมาถูกทางแล้ว!)/.test(t),
    (t.match(/(ทำได้ดีมาก!|เยี่ยมมาก!|ทำต่อไปนะ!|ทำได้ดี!|คุณมาถูกทางแล้ว!)/) || [''])[0]);
  await shot('08-ติ๊กแล้ว');

  happy('ติ๊กออกได้', await untickOne(), '');
  happy('ติ๊กออกแล้วตัวนับลดลง', /0\/9\s*รายการ/.test(await body()), '');
  happy('ความคืบหน้าที่หัวหน้าจอตรงกัน', /0\/27/.test(await body()), '');
}

// ── 9. จบระยะแรกแล้วเจอป๊อปอัปฉลอง ────────────────────────────────────────
suite('9. จบระยะแรกแล้วมีป๊อปอัปฉลองและพาไประยะถัดไป');
{
  for (let i = 0; i < 9; i += 1) await tickNext();
  await settle(1400);
  const t = await body();
  happy('ติ๊กครบ 9/9', /9\/9\s*รายการ/.test(t), (t.match(/\d+\/\d+\s*รายการ/) || [''])[0]);
  happy('ป๊อปอัปฉลองขึ้นมา', t.includes('จบเฟสนี้แล้ว'), '');
  happy('มีทั้งปุ่มไปต่อและปุ่มอยู่หน้านี้',
    t.includes('ไปเฟสถัดไป') && t.includes('อยู่หน้านี้ต่อ'), '');
  await shot('09-ฉลองจบระยะ');

  happy('กดไปเฟสถัดไปได้', await clickText('ไปเฟสถัดไป'), '');
  await settle(2600);
  const t2 = await body();
  bad('ระยะสองเปิดให้ติ๊กแล้ว', !t2.includes('ทำเฟสก่อนหน้าให้เสร็จเพื่อปลดล็อก'), '');
  happy('อยู่ที่ระยะสองจริง', /วันที่ 31–60/.test(t2), '');
}

// ── 10. ระยะสามยังล็อก และเหตุผลถูกต้อง ───────────────────────────────────
suite('10. ระยะสามยังล็อกด้วยเหตุผลที่ถูก');
{
  await clickText('วันที่ 61–90');
  await settle(2400);
  const t = await body();
  happy('บอกว่าติดเฟสก่อนหน้า ไม่ใช่ติดเอกสาร',
    t.includes('ทำเฟสก่อนหน้าให้เสร็จเพื่อปลดล็อกงานเหล่านี้')
      && !t.includes('กรอกเอกสารที่จำเป็นทั้งหมดให้ครบ'), '');
  happy('บอกด้วยว่าอ่านล่วงหน้าได้', t.includes('ยังสามารถอ่านเนื้อหาด้านล่างได้ตามปกติ'), '');
  const b = await boxes();
  bad('ช่องติ๊กยังปิดอยู่', b.length > 0 && b.every((x) => x.disabled), `${b.length} ช่อง`);
  happy('เนื้อหายังอ่านได้ครบ ไม่ได้ถูกซ่อน', b.length === 9, `${b.length}`);
  await shot('10-ระยะสามล็อก');
}

// ── 11. สลับระดับตำแหน่ง ──────────────────────────────────────────────────
suite('11. สลับเป็นซีเนียร์แล้วงานเพิ่ม');
{
  await clickText('เลือกแผนก');
  await settle(2000);
  happy('กดเลือกซีเนียร์ได้', await clickText('ซีเนียร์'), '');
  await settle(2600);
  await clickText('วันที่ 1–30');
  await settle(2400);
  const b = await boxes();
  happy('ระยะแรกมี 12 รายการเมื่อเป็นซีเนียร์', b.length === 12, `${b.length}`);
  happy('เก้ารายการเดิมยังติ๊กอยู่', b.filter((x) => x.checked).length === 9, `${b.filter((x) => x.checked).length}`);
  happy('เห็นป้ายกำกับ ซีเนียร์ ที่ข้อของซีเนียร์', (await body()).includes('ซีเนียร์'), '');
  await shot('11-ซีเนียร์');

  await clickText('เลือกแผนก');
  await settle(2000);
  await clickText('จูเนียร์');
  await settle(2400);
  await clickText('วันที่ 1–30');
  await settle(2200);
  happy('กลับเป็นจูเนียร์แล้วเหลือ 9 รายการเหมือนเดิม', (await boxes()).length === 9, '');
}

// ── 12. เปลี่ยนแผนกแล้วกลับมา ─────────────────────────────────────────────
suite('12. เปลี่ยนแผนกแล้วความคืบหน้าไม่หาย');
{
  await clickText('เลือกแผนก');
  await settle(2000);
  await clickText('ฝ่ายการเงิน');
  await settle(3000);
  happy('ย้ายไปแผนกการเงินแล้ว', /0\/27/.test(await body()), (( await body()).match(/\d+\/\d+/) || [''])[0]);
  await clickText('เลือกแผนก');
  await settle(2000);
  await clickText('ฝ่ายบัญชี');
  await settle(3000);
  happy('กลับมาแผนกบัญชีแล้วเจอของเดิม', /9\/27/.test(await body()), (( await body()).match(/\d+\/\d+/) || [''])[0]);
  await shot('12-เปลี่ยนแผนก');
}

// ── 13. ทำจนจบโปรแกรม ─────────────────────────────────────────────────────
suite('13. ทำจนครบ 90 วันแล้วถึงหน้าสำเร็จการปฐมนิเทศ');
{
  for (const tab of ['วันที่ 31–60', 'วันที่ 61–90']) {
    await clickText(tab);
    await settle(2200);
    for (let i = 0; i < 10; i += 1) { if (!(await tickNext())) break; }
    await settle(1400);
    await clickText('อยู่หน้านี้ต่อ');
    await settle(900);
  }
  const t = await body();
  happy('ครบทั้ง 27 รายการ', /27\/27/.test(t), (t.match(/\d+\/\d+/) || [''])[0]);
  happy('แถบความคืบหน้าขึ้น 100%', /100% เสร็จสมบูรณ์/.test(t), (t.match(/\d+% เสร็จสมบูรณ์/) || [''])[0]);
  await shot('13-ครบทุกระยะ');

  await clickText('สำเร็จการปฐมนิเทศ');
  await waitText('พิมพ์แบบประเมินการปฐมนิเทศ');
  await settle(800);
  const t2 = await body();
  happy('เข้าหน้าสำเร็จการปฐมนิเทศได้', t2.includes('ยินดีต้อนรับสู่ทีมของเราอย่างเป็นทางการ!'), t2.slice(0, 90));
  happy('บอกจำนวนรายการที่ทำครบ', /27/.test(t2), '');
  happy('มีปุ่มพิมพ์แบบประเมิน', t2.includes('พิมพ์แบบประเมินการปฐมนิเทศ'), '');
  happy('มีปุ่มกลับไปหน้าหลัก VCB Connect', t2.includes('กลับไปหน้าหลัก VCB Connect'), '');
  await shot('14-สำเร็จการปฐมนิเทศ');
}

// ── 14. ใบพิมพ์สองหน้า ────────────────────────────────────────────────────
suite('14. ใบพิมพ์สองหน้าแบบของเขา');
{
  // เปิดจริงแล้วอ่าน HTML ที่ได้ ไม่ใช่เชื่อว่าปุ่มทำงาน — และไม่เรียก print()
  // ในชุดทดสอบ เพราะกล่องพิมพ์ของระบบปฏิบัติการจะค้างรอคนกด
  const html = await page.evaluate(() => {
    const open = window.open;
    let captured = '';
    window.open = () => ({
      document: { open() {}, write(h) { captured += h; }, close() {} },
      focus() {}, print() {},
    });
    const btn = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('พิมพ์แบบประเมิน'));
    if (btn) btn.click();
    window.open = open;
    return captured;
  });
  happy('ปุ่มสร้างใบพิมพ์ออกมาจริง', html.length > 2000, `${html.length} ตัวอักษร`);
  happy('มีสองหน้า (หน้า 2 ขึ้นหน้าใหม่)', html.includes('page-break-before:always'), '');
  happy('หน้า 1 มีช่องวงคะแนน 1–5 ต่อข้อ',
    html.includes('ให้คะแนน 1–5') && (html.match(/class="dot"/g) || []).length >= 100,
    `${(html.match(/class="dot"/g) || []).length} วง`);
  bad('หมวดเอกสารที่ต้องศึกษาไม่อยู่ในใบพิมพ์',
    !html.includes('เอกสารที่ต้องศึกษา') && !html.includes('โครงสร้างผังบัญชี'), '');
  happy('มีหมวดความรู้และผลงานในใบพิมพ์',
    html.includes('ความรู้ที่จำเป็น') && html.includes('ผลงานที่ต้องส่งมอบ'), '');
  happy('หน้า 2 มี Attitude & Working Relationships ครบ 6 หัวข้อ',
    html.includes('Attitude &amp; Working Relationships')
      && ['ทัศนคติและวินัย', 'การทำงานเป็นทีมและความร่วมมือ', 'การสื่อสาร',
        'ความคิดริเริ่มและความเป็นเจ้าของงาน', 'ความน่าเชื่อถือและการตรงต่อเวลา',
        'ความสามารถในการปรับตัว'].every((x) => html.includes(x)), '');
  happy('มีช่องความเห็นทั่วไป 6 บรรทัด',
    html.includes('ความเห็นทั่วไป') && (html.match(/class="cmt-line"/g) || []).length === 6,
    `${(html.match(/class="cmt-line"/g) || []).length} บรรทัด`);
  happy('มีช่องเซ็นพนักงานและหัวหน้าฝ่าย พร้อมชื่อหัวหน้า',
    html.includes('ลายมือชื่อพนักงาน') && html.includes('ลายมือชื่อหัวหน้าฝ่าย')
      && html.includes('คุณวันเพ็ญ ยำพลอย'), '');
  happy('ชื่อพนักงานมาจากบัญชี ไม่ใช่ช่องให้พิมพ์เอง', html.includes(A.name), '');
}

// ── 15. ผู้ดูแล ───────────────────────────────────────────────────────────
suite('15. ผู้ดูแลเห็นภาพรวมและแก้เช็กลิสต์ได้');
{
  happy('มีขั้นภาพรวมพนักงาน', await clickText('ภาพรวมพนักงาน'), '');
  await settle(2400);
  const t = await body();
  happy('เห็นตัวเองในตาราง', t.includes(A.name) || t.includes(A.email), t.slice(0, 100));
  happy('บอกความคืบหน้าเป็นตัวเลข', /27\/27/.test(t), '');
  await shot('15-ภาพรวมพนักงาน');

  happy('มีขั้นแก้เช็กลิสต์', await clickText('แก้เช็กลิสต์'), '');
  await waitText('เพิ่มข้อใหม่');
  await settle(800);
  const t2 = await body();
  happy('เลือกแผนก ระยะ และบล็อกได้',
    t2.includes('ระยะ') && t2.includes('บล็อก') && t2.includes('ฝ่ายบัญชี'), '');
  happy('เห็นข้อความทั้งสองภาษาให้แก้',
    await page.evaluate(() => [...document.querySelectorAll('input[placeholder]')]
      .some((x) => x.placeholder.includes('ไทย'))
      && [...document.querySelectorAll('input[placeholder]')].some((x) => x.placeholder.includes('อังกฤษ'))), '');
  happy('มีช่องติ๊กเฉพาะซีเนียร์ ปุ่มเลื่อนลำดับ และปุ่มปิดใช้งาน',
    t2.includes('เฉพาะซีเนียร์') && t2.includes('ปิดใช้งาน')
      && await page.evaluate(() => document.querySelector('button[aria-label="เลื่อนขึ้น"]') !== null), '');
  happy('มีฟอร์มเพิ่มข้อใหม่', t2.includes('เพิ่มข้อใหม่'), '');
  await shot('16-แก้เช็กลิสต์');
}

// ── 16. โหมดอังกฤษ ────────────────────────────────────────────────────────
suite('16. สลับเป็นอังกฤษแล้วเนื้อหาเช็กลิสต์เป็นอังกฤษ');
{
  await page.evaluate(() => { localStorage.setItem('vcb_lang', 'en'); });
  await page.goto(`${APP}/onboarding/program?v=accounting-day-1-30`, { waitUntil: 'networkidle2' }).catch(() => {});
  await waitText('Your Onboarding Progress');
  await settle(1200);
  const t = await body();
  happy('ชั้นวางเป็นอังกฤษ', t.includes('Pre-boarding') && t.includes('Required Documents'), '');
  happy('เนื้อหาเช็กลิสต์กลับเป็นอังกฤษด้วย',
    t.includes('Chart of Accounts Structure') && t.includes('Required Reading'), '');
  bad('ไม่มีไทยปนในโหมดอังกฤษของหัวบล็อก', !t.includes('เอกสารที่ต้องศึกษา'), '');
  await shot('17-โหมดอังกฤษ');
  await page.evaluate(() => { localStorage.setItem('vcb_lang', 'th'); });
}

suite('17. ไม่มีข้อผิดพลาดซ่อนอยู่');
bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' | '));

suite('18. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await wipe();
  const left = (await query('select count(*)::int n from ob_progress where profile_id = $1', [A.id])).rows[0].n;
  const docs = (await query('select count(*)::int n from ob_doc_submissions where profile_id = $1', [A.id])).rows[0].n;
  happy('ลบความคืบหน้าทดสอบหมดแล้ว', left === 0 && docs === 0, `${left} / ${docs}`);
}

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
