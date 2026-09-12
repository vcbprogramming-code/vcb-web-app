/**
 * เปิดทุกหน้าบนจอโทรศัพท์ — หาเนื้อหาที่ล้นออกนอกจอ
 *
 * หัวหน้างานที่ไซต์เปิดระบบจากมือถือ ไม่ได้นั่งหน้าคอม ครั้งก่อนพบว่าตาราง
 * ลงบันทึกงานอยู่นอกจอทั้งตาราง กดอะไรไม่ได้เลย — ชุดนี้กันไม่ให้เกิดซ้ำ
 *
 * เกณฑ์: ตัวหน้าเว็บเองต้องไม่เลื่อนซ้าย-ขวา ส่วนตารางกว้าง ๆ เลื่อนได้ แต่
 * ต้องเลื่อนอยู่ในกล่องของตัวเอง ไม่ใช่ดันทั้งหน้า
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/mobile-ui`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const PAGES = [
  ['/', 'หน้าหลัก'],
  ['/performance', 'บันทึกการทำงาน'],
  ['/credit', 'วงเงินสินเชื่อ'],
  ['/onboarding/program', 'โปรแกรมปฐมนิเทศ'],
  ['/onboarding', 'ปฐมนิเทศฝั่ง HR'],
  ['/sop', 'คู่มือ SOP'],
  ['/sysmap', 'แผนผังระบบ'],
  ['/meetings', 'รายงานการประชุม'],
  ['/settings', 'ตั้งค่า'],
  ['/profile', 'โปรไฟล์'],
];

fs.rmSync(`${ROOT}/chrome-mobile`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-mobile`,
  defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  args: ['--no-first-run', '--no-default-browser-check', '--window-size=430,900'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 2400) => new Promise((r) => setTimeout(r, ms));
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0].slice(0, 140)));

await page.goto(APP, { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(U.admin));

/** อะไรที่กว้างเกินจอบ้าง และมันอยู่ในกล่องที่เลื่อนได้หรือเปล่า */
const overflow = () => page.evaluate(() => {
  const w = document.documentElement.clientWidth;
  const scrolls = (el) => {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX === 'auto' || s.overflowX === 'scroll') return true;
    }
    return false;
  };
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // ลิ้นชักเมนูที่ซ่อนไว้นอกจอด้านซ้ายเป็นเรื่องปกติ — สนใจเฉพาะที่ล้นขอบขวา
    if (r.right <= w + 2) continue;
    if (scrolls(el)) continue;                       // อยู่ในกล่องที่เลื่อนได้ = ตั้งใจ
    if (el.children.length > 0 && [...el.children].some((c) => {
      const cr = c.getBoundingClientRect();
      return cr.right > w + 2;
    })) continue;                                    // รายงานเฉพาะตัวที่ล้นเอง ไม่ใช่กล่องที่ห่อมันอยู่
    bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} → ${Math.round(r.right)}px`);
    if (bad.length > 4) break;
  }
  return { pageScroll: document.documentElement.scrollWidth - w, items: bad };
});

for (const [path, name] of PAGES) {
  suite(`${name} บนจอโทรศัพท์ (390px)`);
  errors.length = 0;
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle();
  const t = await page.evaluate(() => document.body.innerText);
  const denied = t.includes('ไม่มีสิทธิ์') || t.includes('ยังไม่เปิดใช้งาน');
  happy('เปิดได้ ไม่ล้ม', !t.includes('เกิดข้อผิดพลาดบางอย่าง'), t.slice(0, 60).replace(/\n/g, ' | '));
  const o = await overflow();
  bad('หน้าไม่เลื่อนซ้าย-ขวาทั้งหน้า', o.pageScroll <= 2, `เกินมา ${o.pageScroll}px`);
  bad('ไม่มีอะไรล้นออกนอกจอโดยไม่ได้ตั้งใจ', o.items.length === 0, o.items.join(' · '));
  happy('เมนูหลักยังกดได้บนมือถือ',
    denied || await page.evaluate(() => [...document.querySelectorAll('button, a')]
      .some((b) => b.getBoundingClientRect().width > 0)), '');
  bad('ไม่มี error', errors.length === 0, errors.slice(0, 2).join(' / '));
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

// ── แท็บที่มีตารางกว้าง — ที่ที่ตัวเลขอยู่ ─────────────────────────────────
// หน้าแรกของแต่ละโมดูลมักเป็นการ์ด ตารางจริงอยู่ในแท็บถัดไป จึงต้องกดเข้าไปดู
for (const [path, name, tab] of [
  ['/performance', 'บันทึกการทำงาน', 'รายงาน'],
  ['/credit', 'วงเงินสินเชื่อ', 'รายการสินเชื่อ'],
  ['/sop', 'คู่มือ SOP', 'เมนูรายงาน'],
  ['/onboarding', 'ปฐมนิเทศฝั่ง HR', 'พนักงานใหม่'],
]) {
  suite(`${name} · แท็บ ${tab} บนจอโทรศัพท์`);
  errors.length = 0;
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle();
  const opened = await page.evaluate((l) => {
    const b = [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim().startsWith(l));
    if (b) { b.click(); return true; } return false;
  }, tab);
  happy('เปิดแท็บได้', opened, tab);
  await settle(2600);
  const o = await overflow();
  bad('หน้าไม่เลื่อนซ้าย-ขวาทั้งหน้า', o.pageScroll <= 2, `เกินมา ${o.pageScroll}px`);
  bad('ตารางกว้างเลื่อนอยู่ในกล่องของตัวเอง ไม่ถูกตัดหาย', o.items.length === 0, o.items.join(' · '));
  bad('ไม่มี error', errors.length === 0, errors.slice(0, 2).join(' / '));
  await page.screenshot({ path: `${SHOTS}/${name}-${tab}.png` });
}

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
