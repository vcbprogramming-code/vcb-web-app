/**
 * กวาดทุกหน้าทุกบทบาท — หาความพังที่ไม่มีใครกดเจอ
 *
 * ชุดทดสอบรายโมดูลถามว่า "ทำงานตามที่ตั้งใจไหม" ชุดนี้ถามอีกแบบ: เปิดทุกหน้า
 * ด้วยทุกบทบาท กดทุกแท็บ แล้วดูว่ามีหน้าไหนล้ม ค้าง หรือขึ้นคำที่ไม่ควรให้คน
 * เห็น (undefined, NaN, [object Object]) — วิธีเดียวกับที่เจอหน้ารายงานการ
 * ประชุมล้มทั้งหน้าเพราะไม่เคยมีใครเปิดมันหลังแก้ครั้งล่าสุด
 *
 * ไม่แตะ E-memo — โมดูลนั้นมีชุดของตัวเองอยู่แล้วและห้ามทำพัง
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/sweep-ui`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const PAGES = [
  { path: '/', name: 'หน้าหลัก', must: ['VCB'] },
  { path: '/performance', name: 'บันทึกการทำงาน', must: ['บันทึก'] },
  { path: '/credit', name: 'วงเงินสินเชื่อ', must: [] },
  { path: '/onboarding', name: 'ปฐมนิเทศ (ฝั่ง HR)', must: [] },
  { path: '/onboarding/program', name: 'โปรแกรมปฐมนิเทศ 90 วัน', must: [] },
  { path: '/sop', name: 'คู่มือ SOP', must: ['คู่มือ'] },
  { path: '/sysmap', name: 'แผนผังระบบ', must: ['แผนผัง'] },
  { path: '/meetings', name: 'รายงานการประชุม', must: ['รายงานการประชุม'] },
  { path: '/settings', name: 'ตั้งค่า', must: [] },
  { path: '/profile', name: 'โปรไฟล์', must: [] },
  { path: '/admin', name: 'ผู้ดูแลระบบ', must: [] },
];
const ROLES = [
  { u: U.admin, label: 'ผู้ดูแลระบบ' },
  { u: U.exec, label: 'ผู้บริหาร' },
  { u: U.hr, label: 'ฝ่ายบุคคล' },
];

fs.rmSync(`${ROOT}/chrome-sweep`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-sweep`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 1800) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);

let errors = [];
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0].slice(0, 140)));
page.on('console', (m) => {
  const x = m.text();
  if (m.type() === 'error' && !/Failed to load resource|favicon/.test(x)) errors.push(x.split('\n')[0].slice(0, 140));
});

const login = async (user) => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
};

/** คำที่ไม่ควรหลุดถึงสายตาคนใช้ */
const LEAKS = ['undefined', 'NaN', '[object Object]', 'null null', 'Invalid Date', 'ไม่พบเส้นทาง'];

for (const role of ROLES) {
  suite(`เปิดทุกหน้าในบทบาท ${role.label}`);
  await login(role.u);
  for (const p of PAGES) {
    errors = [];
    await page.goto(`${APP}${p.path}`, { waitUntil: 'networkidle2' }).catch(() => {});
    await settle(2600);
    const t = await body();

    // หน้าที่บทบาทนี้ไม่มีสิทธิ์เข้า ถือว่าถูกต้องถ้าบอกเหตุผลชัด
    const denied = t.includes('ไม่มีสิทธิ์') || t.includes('ยังไม่เปิดใช้งาน') || t.includes('ปิดใช้งานอยู่');
    bad(`${p.name} — ไม่ล้มทั้งหน้า`, !t.includes('เกิดข้อผิดพลาดบางอย่าง'), t.slice(0, 90).replace(/\n/g, ' | '));
    bad(`${p.name} — ไม่ค้างอยู่ที่หน้าจอโหลด`, !/^\s*(กำลังโหลด|Loading)/.test(t.trim()) || denied, t.slice(0, 60).replace(/\n/g, ' | '));
    happy(`${p.name} — มีเนื้อหาให้อ่าน`, t.trim().length > 60, `${t.trim().length} ตัวอักษร`);
    if (p.must.length && !denied) {
      happy(`${p.name} — เห็นสิ่งที่ควรเห็น`, p.must.every((k) => t.includes(k)), p.must.join(', '));
    }
    const leaked = LEAKS.filter((w) => t.includes(w));
    bad(`${p.name} — ไม่มีคำหลุดถึงผู้ใช้`, leaked.length === 0, leaked.join(', '));
    bad(`${p.name} — ไม่มี error ในคอนโซล`, errors.length === 0, errors.slice(0, 2).join(' / '));
    await page.screenshot({ path: `${SHOTS}/${role.label}-${p.name}.png` });
  }
}

// ── กดทุกแท็บในทุกหน้าที่มีแท็บ ──────────────────────────────────────────
suite('กดทุกแท็บในทุกหน้าแล้วไม่มีหน้าไหนล้ม');
{
  await login(U.admin);
  for (const p of ['/sop', '/sysmap', '/credit', '/onboarding', '/performance']) {
    await page.goto(`${APP}${p}`, { waitUntil: 'networkidle2' }).catch(() => {});
    await settle(2600);
    const tabs = await page.evaluate(() => [...document.querySelectorAll('button')]
      .filter((b) => b.className.includes('border-b-2') && b.innerText.trim())
      .map((b) => b.innerText.trim().split('\n')[0]));
    for (const label of tabs) {
      errors = [];
      const clicked = await page.evaluate((l) => {
        const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().split('\n')[0] === l);
        if (b) { b.click(); return true; } return false;
      }, label);
      if (!clicked) continue;
      await settle(2200);
      const t = await body();
      bad(`${p} · แท็บ ${label} — ไม่ล้ม`, !t.includes('เกิดข้อผิดพลาดบางอย่าง'), t.slice(0, 80).replace(/\n/g, ' | '));
      happy(`${p} · แท็บ ${label} — มีเนื้อหา`, t.trim().length > 60, '');
      bad(`${p} · แท็บ ${label} — ไม่มี error`, errors.length === 0, errors.slice(0, 2).join(' / '));
      const active = await page.evaluate(() => {
        const on = [...document.querySelectorAll('button')].find((b) => b.className.includes('border-b-2') && b.className.includes('border-brand'));
        return on ? on.innerText.trim().split('\n')[0] : null;
      });
      happy(`${p} · แท็บ ${label} — ถูกไฮไลต์หลังกด`, active === label, `ไฮไลต์อยู่ที่ ${active}`);
      await page.screenshot({ path: `${SHOTS}/แท็บ-${p.replace(/\//g, '')}-${label}.png` });
    }
  }
}

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
