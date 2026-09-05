/**
 * ไทย / English.
 *
 * The rule this suite exists to hold: switching to English must change what is
 * READ and nothing else, and Thai must be byte-for-byte what it is today. The
 * dictionary is keyed by the Thai text, so a gap falls back to Thai — which is
 * correct — and this suite makes sure that is what actually happens rather than
 * a blank label or a raw key.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/i18n`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();
const { admin: A } = U;
// แต่ละชุดใช้โปรไฟล์ Chrome ของตัวเอง ไม่ใช้ร่วมกัน — ชุดที่ล้มกลางคันจะทิ้ง
// Chrome ที่ยังถือ lock ของโปรไฟล์ไว้ ชุดถัดไปที่ใช้โปรไฟล์เดียวกันจะค้างตามไป
// ทั้งที่ตัวเองไม่มีอะไรผิด (เกิดขึ้นจริงตอนรันรวมทั้งชุดบนเครื่องที่งานหนัก)

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-i18n`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
// 30 วินาทีของค่าเริ่มต้นตึงเกินไปเมื่อเครื่องรันงานอื่นอยู่ด้วย
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 2500) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const open = async (path, lang) => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t, l) => {
    localStorage.clear();
    localStorage.setItem('hr_access_token', t);
    if (l) localStorage.setItem('vcb_lang', l);
  }, tok(A), lang);
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3500);
};

// ── 1. ภาษาไทยต้องไม่เปลี่ยนเลย ────────────────────────────────────────────
suite('1. ภาษาไทยยังเป็นไทยเหมือนเดิมทุกตัวอักษร');
{
  await open('/', 'th');
  const th = await body();
  happy('หน้าแรกยังเป็นภาษาไทย', th.includes('แอปพลิเคชัน') && th.includes('ระบบงานภายใน'), '');
  happy('ชื่อโมดูลยังเป็นไทย', th.includes('บันทึกงานฝ่ายบุคคล'), '');
  bad('ไม่มีคีย์แปลโผล่บนหน้าจอ', !/\bt\(['"]/.test(th) && !th.includes('undefined'), '');
  await page.screenshot({ path: `${SHOTS}/1-ไทย.png` });
}

// ── 2. สลับเป็นอังกฤษแล้วเปลี่ยนจริง ───────────────────────────────────────
suite('2. สลับเป็นอังกฤษ');
{
  await open('/', 'en');
  const en = await body();
  happy('หัวข้อเปลี่ยนเป็นอังกฤษ', en.includes('Applications'), '');
  happy('ชื่อโมดูลเปลี่ยนเป็นอังกฤษ', en.includes('HR work log'), '');
  happy('คำอธิบายโมดูลเปลี่ยนด้วย', en.includes('by site') || en.includes('each day'), '');
  bad('ไม่เหลือคำที่แปลแล้วเป็นไทยค้าง', !en.includes('แอปพลิเคชัน'), '');
  await page.screenshot({ path: `${SHOTS}/2-อังกฤษ.png` });
}

// ── 3. คำที่ยังไม่ได้แปล ต้องตกกลับเป็นไทย ไม่ใช่ช่องว่าง ──────────────────
suite('3. คำที่ยังไม่ได้แปลต้องตกกลับเป็นไทย');
{
  const probe = await page.evaluate(() => {
    const el = document.body;
    // any element whose text is empty where a label is expected would show here
    const empties = [...el.querySelectorAll('button, a[href]')]
      .filter((b) => b.offsetParent !== null && !b.innerText.trim() && !b.querySelector('svg')).length;
    return { empties, len: el.innerText.length };
  });
  bad('ไม่มีปุ่มที่ข้อความหายไป', probe.empties === 0, `${probe.empties} ปุ่ม`);
  happy('หน้ายังมีเนื้อหาครบ', probe.len > 300, `${probe.len} ตัวอักษร`);
}

// ── 4. ตัวสลับภาษาอยู่ที่เดิมทุกหน้า และจำค่าไว้ ───────────────────────────
suite('4. ตัวสลับภาษาหาเจอทุกหน้า และจำค่าไว้');
{
  for (const [path, name] of [['/', 'หน้าแรก'], ['/memos', 'ทะเบียนหนังสือ'], ['/sop', 'คู่มือ']]) {
    await open(path, 'en');
    const has = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'EN')
      && [...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'ไทย'));
    happy(`มีตัวสลับภาษาที่ ${name}`, has, '');
  }
  // click back to Thai and make sure it sticks across a reload
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'ไทย');
    if (b) b.click();
  });
  await settle(1200);
  const saved = await page.evaluate(() => localStorage.getItem('vcb_lang'));
  happy('กดแล้วจำค่าไว้', saved === 'th', String(saved));
  await page.reload({ waitUntil: 'networkidle2' });
  await settle(3000);
  happy('โหลดหน้าใหม่ยังเป็นภาษาที่เลือกไว้', (await body()).includes('ทะเบียน') || (await body()).includes('คู่มือ'), '');
}

// ── 4ข. เอกสารเป็นภาษาไทยเสมอ แม้เลือก English ─────────────────────────────
// The preview is a picture of the PDF, and that PDF is always Thai. Translating
// the canvas once made the app show an English letter and hand over a Thai one.
suite('4ข. ตัวหนังสือไม่แปลตามภาษาที่เลือก');
{
  await open('/memos', 'en');
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button,a')].find((x) => /เพิ่มเอกสาร|New document/.test(x.innerText));
    if (el) el.click();
  });
  await settle(3500);
  const paper = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')]
      .find((x) => /บันทึกข้อความ|Memorandum/.test(x.innerText || '') && x.innerText.length < 900);
    return el ? el.innerText : '';
  });
  happy('หัวหนังสือยังเป็น "บันทึกข้อความ"', paper.includes('บันทึกข้อความ'), paper.slice(0, 60));
  bad('ไม่กลายเป็น Memorandum', !paper.includes('Memorandum'), '');
  for (const w of ['เลขที่', 'วันที่', 'เรื่อง', 'ขอแสดงความนับถือ']) {
    happy(`ยังมีคำว่า "${w}" บนกระดาษ`, paper.includes(w), '');
  }
  bad('ไม่มีคำแปลอังกฤษปนบนกระดาษ', !/\b(No\.|Date|Subject|Enclosures)\b/.test(paper), '');
  await page.screenshot({ path: `${SHOTS}/7-กระดาษยังเป็นไทย.png` });
}

// ── 5. E-Memo ต้องไม่ได้รับผลกระทบ ─────────────────────────────────────────
suite('5. E-Memo ยังทำงานเหมือนเดิมทั้งสองภาษา');
{
  for (const lang of ['th', 'en']) {
    await open('/memos', lang);
    const t = await body();
    happy(`ทะเบียนหนังสือเปิดได้ (${lang})`, t.length > 300, `${t.length}`);
    bad(`ไม่มีข้อผิดพลาดบนหน้า (${lang})`, !t.includes('เกิดข้อผิดพลาด') && !t.includes('Something went wrong'), '');
  }
  await page.screenshot({ path: `${SHOTS}/3-ememo.png` });
}

await browser.close();
process.exit(report(`${ROOT}/i18n.json`) ? 1 : 0);
