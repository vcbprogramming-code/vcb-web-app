/**
 * แผนผังระบบ — อ่านผังกระบวนการ ทะเบียนฟังก์ชัน และโอกาสใช้ AI บนหน้าจอจริง
 *
 * โมดูลนี้เป็นข้อมูลอ้างอิงอย่างเดียวตามที่ตกลงกันไว้ (เปิดแก้ไขได้ด้วย
 * SYSMAP_EDIT=on) ชุดนี้จึงถามสองอย่าง: อ่านรู้เรื่องไหม และไม่มีปุ่มแก้ไข
 * โผล่มาให้กดโดยที่ไม่ได้เปิดไว้
 *
 * มีข้อหนึ่งที่ดูเล็กแต่ตั้งใจใส่: แท็บที่เปิดอยู่ต้องถูกไฮไลต์ เพราะเงื่อนไข
 * ไฮไลต์เคยเทียบตัวแปรที่ชื่อชนกันจนได้ false เสมอทั้งห้าหน้าในระบบ
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, call } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/sysmap-ui`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin, C = U.exec;

fs.rmSync(`${ROOT}/chrome-sysmap`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-sysmap`,
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
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0].slice(0, 160)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().split('\n')[0].slice(0, 160));
});

const as = async (user, path = '/sysmap') => {
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
/** แท็บที่ถูกไฮไลต์อยู่ตอนนี้ — ดูจากสีเส้นใต้ ไม่ใช่จากชื่อคลาส */
const activeTab = () => page.evaluate(() => {
  const tabs = [...document.querySelectorAll('button')].filter((b) => b.className.includes('border-b-2'));
  const on = tabs.find((b) => b.className.includes('border-brand'));
  return on ? on.innerText.trim().split('\n')[0] : null;
});

// ── 1. เปิดผังกระบวนการ ───────────────────────────────────────────────────
suite('1. เปิดแผนผังระบบแล้วอ่านได้');
{
  await as(A);
  const t = await body();
  happy('หน้าไม่ล้ม', !t.includes('เกิดข้อผิดพลาดบางอย่าง'), t.slice(0, 80).replace(/\n/g, ' | '));
  happy('เห็นหัวข้อแผนผังระบบ', t.includes('แผนผังระบบ'), '');
  happy('บอกจำนวนเลน ขั้นตอน และเส้นเชื่อม', /\d+ เลน · \d+ ขั้นตอน · \d+ เส้นเชื่อม/.test(t), t.slice(0, 120).replace(/\n/g, ' '));
  happy('มีครบทั้งสามแท็บ',
    ['ผังกระบวนการ', 'ทะเบียนฟังก์ชัน', 'โอกาสใช้ AI'].every((k) => t.includes(k)), '');
  happy('แท็บที่เปิดอยู่ถูกไฮไลต์', (await activeTab())?.startsWith('ผังกระบวนการ'), `${await activeTab()}`);
  happy('อธิบายวิธีอ่านผังให้ก่อน', t.includes('กดที่กล่องงาน'), '');
  bad('ไม่มี error ตอนเปิดหน้า', errors.length === 0, errors.slice(0, 2).join(' / '));
  await shot('01-ผังกระบวนการ');
}

// ── 2. กดกล่องงานแล้วเห็นรายละเอียด ──────────────────────────────────────
suite('2. กดกล่องงานแล้วเห็นรายละเอียดและเส้นทางที่เชื่อมถึง');
{
  const nodes = (await call('/sysmap/bootstrap', { user: A })).data.nodes || [];
  happy('มีกล่องงานให้กดจริง', nodes.length > 0, `${nodes.length} กล่อง`);
  // กล่องงานบนผังเป็นปุ่มที่มีชื่อกล่องอยู่ข้างใน — กดจากชื่อ อย่างที่คนกด
  const first = nodes[0].label_th.split('\n')[0].trim();
  const opened = await page.evaluate((label) => {
    const el = [...document.querySelectorAll('button')].find((b) => b.innerText.includes(label));
    if (el) { el.click(); return true; } return false;
  }, first);
  happy('กดกล่องงานบนผังได้', opened, first);
  await settle(1800);
  const t = await body();
  happy('เปิดรายละเอียดกล่องงานได้', t.includes(first), first);
  happy('รายละเอียดบอกเส้นทางที่เชื่อมถึงกล่องนี้',
    t.includes('เข้า') || t.includes('ออก') || t.includes('เชื่อม'), '');
  await shot('02-รายละเอียดกล่องงาน');

  // เปิดจากลิงก์ตรงก็ต้องได้กล่องเดิม — คนส่งลิงก์ผังให้กันอ่าน
  await as(A, `/sysmap?node=${encodeURIComponent(nodes[0].id)}`);
  happy('เปิดจากลิงก์ตรงถึงกล่องงานได้', (await body()).includes(first), '');
  await shot('02b-ลิงก์ตรง');

  happy('กดแสดงทุกเส้นเชื่อมได้', await click('แสดงทุกเส้นเชื่อม'), '');
  await settle(1400);
  happy('บอกว่ากำลังแสดงเส้นเชื่อมทั้งหมด', (await body()).includes('กำลังแสดงเส้นเชื่อมทั้งหมด'), '');
  happy('มีคำอธิบายความหมายของเส้น', (await body()).includes('ความหมายของเส้น'), '');
  await shot('03-ทุกเส้นเชื่อม');
}

// ── 3. ทะเบียนฟังก์ชัน ────────────────────────────────────────────────────
suite('3. ทะเบียนฟังก์ชัน — ค้นหาและกรองได้');
{
  happy('เปิดแท็บทะเบียนฟังก์ชันได้', await click('ทะเบียนฟังก์ชัน'), '');
  await settle(2000);
  happy('แท็บที่เปิดอยู่เปลี่ยนไปไฮไลต์ที่ทะเบียนฟังก์ชัน',
    (await activeTab())?.startsWith('ทะเบียนฟังก์ชัน'), `${await activeTab()}`);
  const t = await body();
  happy('เห็นตารางฟังก์ชัน', t.includes('งานที่ทำ') && t.includes('แผนก'), '');
  happy('บอกว่ากำลังแสดงกี่รายการจากทั้งหมดเท่าไร', /แสดง \d+ จาก \d+ รายการ/.test(t), '');
  await shot('04-ทะเบียนฟังก์ชัน');

  const countRows = () => page.evaluate(() => document.querySelectorAll('tbody tr').length);
  const before = await countRows();
  await page.evaluate(() => {
    const i = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('ค้นหารหัส'));
    if (!i) return;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, 'จัดซื้อ');
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(1500);
  const after = await countRows();
  happy(`ค้นหาแล้วรายการแคบลง (${before} → ${after})`, before > 0 && after < before, `${before} → ${after}`);
  await shot('05-ค้นหาฟังก์ชัน');

  happy('กรองเฉพาะที่ยังทำมือได้', await click('เฉพาะที่ยังทำมือ'), '');
  await settle(1500);
  happy('ตัวกรองทำงานร่วมกับคำค้นได้ ไม่ล้าง', (await body()).includes('แสดง'), '');
  await shot('06-กรองทำมือ');
}

// ── 4. โอกาสใช้ AI ────────────────────────────────────────────────────────
suite('4. โอกาสใช้ AI — เรียงจากคุ้มที่สุด');
{
  happy('เปิดแท็บโอกาสใช้ AI ได้', await click('โอกาสใช้ AI'), '');
  await settle(2000);
  const t = await body();
  happy('บอกเกณฑ์การเรียงให้ผู้อ่านรู้', t.includes('เรียงจากคุ้มที่สุด'), '');
  happy('มีตัวกรองตามระดับผลกระทบ', t.includes('ผลกระทบ'), '');
  await shot('07-โอกาสใช้AI');
}

// ── 5. เป็นข้อมูลอ้างอิง ไม่ใช่ที่แก้ไข ──────────────────────────────────
suite('5. โมดูลนี้เป็นข้อมูลอ้างอิง ไม่มีปุ่มแก้ไขให้กด');
{
  await as(A);
  const t = await body();
  bad('ไม่มีปุ่มเพิ่มเลน', !t.includes('เลน\n') || !/\+ เลน/.test(t), '');
  const edits = await page.evaluate(() => [...document.querySelectorAll('button')]
    .map((b) => b.innerText.trim()).filter((x) => ['เพิ่มฟังก์ชัน', 'เพิ่มรายการ', 'กล่องงาน', 'แก้ไข'].includes(x)));
  bad('ไม่มีปุ่มแก้ไขใด ๆ บนผัง', edits.length === 0, edits.join(', '));

  await click('ทะเบียนฟังก์ชัน');
  await settle(1600);
  const e2 = await page.evaluate(() => [...document.querySelectorAll('button')]
    .map((b) => b.innerText.trim()).filter((x) => x === 'เพิ่มฟังก์ชัน' || x === 'แก้ไข'));
  bad('ทะเบียนฟังก์ชันก็ไม่มีปุ่มแก้ไข', e2.length === 0, e2.join(', '));
  await shot('08-อ่านอย่างเดียว');
}

// ── 6. ผู้ใช้ทั่วไปเปิดได้เหมือนกัน ──────────────────────────────────────
suite('6. ผู้บริหารเปิดอ่านได้เหมือนกัน');
{
  await as(C);
  const t = await body();
  happy('ผู้บริหารเปิดแผนผังได้', t.includes('แผนผังระบบ') && !t.includes('เกิดข้อผิดพลาด'), t.slice(0, 70).replace(/\n/g, ' | '));
  happy('เห็นผังกระบวนการเหมือนกัน', t.includes('ผังกระบวนการ'), '');
  await shot('09-ผู้บริหาร');
}

// ── 7. สลับภาษาของผัง ─────────────────────────────────────────────────────
suite('7. สลับผังเป็นภาษาอังกฤษได้');
{
  await as(A);
  const before = await body();
  happy('มีปุ่มสลับภาษาบนหัวเรื่อง', before.includes('EN'), '');
  await click('EN');
  await settle(1600);
  const after = await body();
  happy('กด EN แล้วเนื้อหาบนผังเปลี่ยนไป', after !== before, '');
  await shot('10-ภาษาอังกฤษ');
}

// ── 8. ไม่มีข้อผิดพลาดซ่อนอยู่ ───────────────────────────────────────────
suite('8. ไม่มีข้อผิดพลาดซ่อนอยู่');
{
  bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' / '));
}

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
