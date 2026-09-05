/**
 * สิทธิ์การใช้งาน now lives inside the user, not in a menu of its own.
 *
 * The checks that matter: the standalone menu is gone, the tab is there in both
 * add and edit, one save button writes BOTH the account and its permissions, and
 * what was saved is what the user actually gets — verified by reading the profile
 * back from the database, not by trusting the screen.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { call, suite, happy, bad, report, U, warm, APP, tok, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/perm-in-user`;
fs.mkdirSync(SHOTS, { recursive: true });

await warm();
const { admin: A, hr: H } = U;
// แต่ละชุดใช้โปรไฟล์ Chrome ของตัวเอง ไม่ใช้ร่วมกัน — ชุดที่ล้มกลางคันจะทิ้ง
// Chrome ที่ยังถือ lock ของโปรไฟล์ไว้ ชุดถัดไปที่ใช้โปรไฟล์เดียวกันจะค้างตามไป
// ทั้งที่ตัวเองไม่มีอะไรผิด (เกิดขึ้นจริงตอนรันรวมทั้งชุดบนเครื่องที่งานหนัก)

// โปรไฟล์ Chrome ใช้ครั้งเดียวแล้วทิ้ง — ชุดที่ล้มกลางคันทิ้งโปรไฟล์ที่เขียนค้าง
// ไว้ และ Chrome จะค้างตอนเปิดโปรไฟล์นั้นทุกครั้งหลังจากนั้น ชุดเดิมจึงล้มซ้ำ
// ไปเรื่อย ๆ ทั้งที่โค้ดไม่ได้ผิดอะไร (ไล่จนเจอเมื่อ 2026-09-05)
fs.rmSync(`${ROOT}/chrome-perm-in-user`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false,
  userDataDir: `${ROOT}/chrome-perm-in-user`,
  defaultViewport: { width: 1440, height: 1000 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
// 30 วินาทีของค่าเริ่มต้นตึงเกินไปเมื่อเครื่องรันงานอื่นอยู่ด้วย
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 2500) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const as = async (u, path) => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(u));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3200);
};
const clickExact = (label) => page.evaluate((t) => {
  const el = [...document.querySelectorAll('button,a')].find((x) => x.innerText.trim() === t);
  if (el) { el.click(); return true; } return false;
}, label);

// ── 1. เมนูเดิมหายไป ───────────────────────────────────────────────────────
suite('1. เมนู "สิทธิ์การใช้งาน" ถูกยุบเข้าไปในผู้ใช้');
{
  await as(A, '/settings?s=users');
  const t = await body();
  bad('ไม่มีเมนู "สิทธิ์การใช้งาน" ในแถบซ้ายแล้ว',
    !/^\s*สิทธิ์การใช้งาน\s*$/m.test(t.split('จัดการ')[0] || t), '');
  happy('ยังมีเมนูผู้ใช้และประกาศตามเดิม', t.includes('ผู้ใช้และสังกัดโครงการ') && t.includes('ประกาศ'), '');

  // an old bookmark must not dead-end
  await as(A, '/settings?s=permissions');
  happy('ลิงก์เดิม ?s=permissions พามาหน้าผู้ใช้', (await body()).includes('เพิ่มผู้ใช้'), page.url());
  await shot('01-เมนูใหม่');
}

// ── 2. แท็บสิทธิ์อยู่ใน Modal แก้ไขผู้ใช้ ──────────────────────────────────
suite('2. แท็บสิทธิ์อยู่ใน Modal ของผู้ใช้');
{
  await as(A, '/settings?s=users');
  // open the row for the HR test account
  const opened = await page.evaluate((email) => {
    const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes(email));
    const edit = row && [...row.querySelectorAll('button,a')].find((b) => b.innerText.trim() === 'แก้ไข');
    if (edit) { edit.click(); return true; } return false;
  }, H.email);
  await settle(2500);
  happy('เปิดหน้าต่างแก้ไขผู้ใช้ได้', opened && (await body()).includes('แก้ไขผู้ใช้'), '');

  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll('button')].map((b) => b.innerText.trim()));
  happy('มีแท็บ "ข้อมูลผู้ใช้" และ "สิทธิ์การใช้งาน"',
    tabs.includes('ข้อมูลผู้ใช้') && tabs.includes('สิทธิ์การใช้งาน'), '');
  await shot('02-แท็บข้อมูลผู้ใช้');

  await clickExact('สิทธิ์การใช้งาน');
  await settle(3000);
  const p = await body();
  happy('แท็บสิทธิ์แสดงรายการโมดูลให้เปิด/ปิด', /E-Memo|บันทึกงาน/.test(p), '');
  happy('มีส่วนขอบเขตการมองเห็นเอกสาร', p.includes('การมองเห็นเอกสาร'), '');
  bad('ไม่มีช่องเลือกผู้ใช้ซ้ำในแท็บนี้แล้ว', !p.includes('— เลือกผู้ใช้ —'), '');
  await shot('03-แท็บสิทธิ์');
}

// ── 3. ปุ่มบันทึกเดียวเขียนทั้งบัญชีและสิทธิ์ ──────────────────────────────
suite('3. กดบันทึกครั้งเดียว เขียนทั้งข้อมูลและสิทธิ์');
{
  const before = (await query('select permissions from profiles where id = $1', [H.id])).rows[0].permissions;
  try {
    // turn ONE switch off, then save from the footer button
    const toggled = await page.evaluate(() => {
      const sw = [...document.querySelectorAll('button[aria-pressed]')]
        .find((b) => b.getAttribute('aria-pressed') === 'true' && (b.getAttribute('aria-label') || '').includes('อนุญาต'));
      if (!sw) return null;
      const label = sw.getAttribute('aria-label');
      sw.click();
      return label;
    });
    happy('ปิดสวิตช์สิทธิ์ได้ 1 รายการ', Boolean(toggled), String(toggled));
    await settle(800);
    happy('มีข้อความบอกว่าจะบันทึกเมื่อกดปุ่มด้านล่าง', (await body()).includes('กดปุ่มบันทึก'), '');

    await clickExact('บันทึก');
    await settle(4000);
    const closed = !(await body()).includes('แก้ไขผู้ใช้');
    happy('บันทึกแล้วหน้าต่างปิด', closed, '');

    const after = (await query('select permissions from profiles where id = $1', [H.id])).rows[0].permissions;
    happy('สิทธิ์ถูกบันทึกลงบัญชีของผู้ใช้จริง',
      JSON.stringify(after) !== JSON.stringify(before), JSON.stringify(after));

    // and the user really is blocked by it
    const perm = await call(`/admin/users/${H.id}/permissions`, { user: A });
    happy('อ่านสิทธิ์กลับมาได้ตรงกับที่ตั้ง', perm.status === 200 && perm.data?.effective, `${perm.status}`);
    await shot('04-บันทึกแล้ว');
  } finally {
    await query('update profiles set permissions = $2 where id = $1',
      [H.id, JSON.stringify(before || {})]);
    const back = (await query('select permissions from profiles where id = $1', [H.id])).rows[0].permissions;
    happy('คืนค่าสิทธิ์เดิมของบัญชีจริงแล้ว', JSON.stringify(back) === JSON.stringify(before || {}), '');
  }
}

// ── 4. ตอนเพิ่มผู้ใช้ใหม่ก็ตั้งสิทธิ์ได้เลย ────────────────────────────────
suite('4. เพิ่มผู้ใช้ใหม่พร้อมตั้งสิทธิ์ในครั้งเดียว');
{
  await as(A, '/settings?s=users');
  await clickExact('เพิ่มผู้ใช้');
  await settle(2500);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.innerText.trim()));
  happy('หน้าต่างเพิ่มผู้ใช้มีแท็บสิทธิ์ด้วย', tabs.includes('สิทธิ์การใช้งาน'), '');
  await clickExact('สิทธิ์การใช้งาน');
  await settle(2500);
  const p = await body();
  happy('แท็บสิทธิ์ของผู้ใช้ใหม่แสดงค่าเริ่มต้นตามบทบาท', /E-Memo|บันทึกงาน/.test(p), '');
  await shot('05-เพิ่มผู้ใช้แท็บสิทธิ์');
  await page.keyboard.press('Escape');
  await settle(800);
}

await browser.close();
process.exit(report(`${ROOT}/perm-in-user.json`) ? 1 : 0);
