/**
 * SOP: a link that points at one thing.
 *
 * People quote the manual at each other — "ดูเคส AP-3" — and the only way to
 * point at an item used to be describing where to click. A shared link has to
 * land on that exact case or flow, survive a reload, and not strand the reader
 * when the id is wrong. On a phone the actions have to stay reachable once the
 * title row has scrolled away.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/sop-share`;
fs.mkdirSync(SHOTS, { recursive: true });

await warm();
const { admin: A } = U;
const scenario = (await query('select no, title_th from sop_scenarios order by no limit 1 offset 3')).rows[0];
const flow = (await query('select id, title_th from sop_flows order by id limit 1 offset 2')).rows[0];

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false,
  userDataDir: `${ROOT}/chrome-profile`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
const settle = (ms = 2500) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const as = async (path) => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(A));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3500);
};

// ── 1. ลิงก์ตรงถึงกรณีศึกษา ────────────────────────────────────────────────
suite('1. ลิงก์ตรงถึงกรณีศึกษา');
{
  await as(`/sop?case=${scenario.no}`);
  const t = await body();
  happy(`เปิดลิงก์แล้วมาที่กรณีศึกษานั้นเลย (เคส ${scenario.no})`, t.includes(scenario.title_th), scenario.title_th);
  bad('ไม่ขึ้นข้อความว่าให้เลือกจากทางซ้าย', !t.includes('เลือกกรณีศึกษาทางซ้าย'), '');
  happy('เปิดมาที่แท็บกรณีศึกษา', t.includes('กรณีศึกษา'), '');
  await shot('01-ลิงก์กรณีศึกษา');

  // a number that is not a real case must not strand the reader on a blank pane
  await as('/sop?case=999999');
  const bogus = await body();
  happy('เลขที่ไม่มีอยู่จริง ยังใช้งานหน้าต่อได้', bogus.includes('กรณีศึกษา') && bogus.length > 200, '');
}

// ── 2. ลิงก์ตรงถึงผังกระบวนการ ─────────────────────────────────────────────
suite('2. ลิงก์ตรงถึงผังกระบวนการ');
{
  await as(`/sop?flow=${encodeURIComponent(flow.id)}`);
  const t = await body();
  happy(`เปิดลิงก์แล้วมาที่ผังนั้นเลย (${flow.id})`, t.includes(flow.title_th), flow.title_th);
  happy('สลับไปแท็บผังกระบวนการให้อัตโนมัติ', t.includes('ผังกระบวนการ'), '');
  await shot('02-ลิงก์ผัง');

  await as('/sop?flow=ไม่มีผังนี้');
  const bogus = await body();
  happy('รหัสผังที่ไม่มีอยู่ ตกไปที่ผังแรกแทนหน้าเปล่า', bogus.length > 200 && !bogus.includes('undefined'), '');
}

// ── 3. ปุ่มแชร์คัดลอกลิงก์ที่ถูกต้อง ───────────────────────────────────────
suite('3. ปุ่มแชร์');
{
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(new URL(APP).origin, ['clipboard-read', 'clipboard-write']);
  await as(`/sop?case=${scenario.no}`);
  // the clipboard is refused to a background tab, and a driven browser often is one
  await page.bringToFront();
  await settle(600);
  const has = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'แชร์'));
  happy('มีปุ่มแชร์บนหน้ารายละเอียด', has, '');

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'แชร์');
    if (b) b.click();
  });
  // Poll rather than sleep: the answer can arrive in 50ms or after the 3s
  // clipboard guard, and the confirmation clears itself a couple of seconds
  // later — any single fixed wait lands in the gap on some runs.
  let verdict = '';
  for (let i = 0; i < 40 && !verdict; i += 1) {
    const label = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /แชร์|คัดลอก/.test(x.innerText));
      return b ? b.innerText.trim() : '';
    });
    if (label.includes('คัดลอกแล้ว') || label.includes('ไม่สำเร็จ')) verdict = label;
    else await settle(200);
  }
  happy('ปุ่มบอกผู้ใช้ว่าคัดลอกแล้ว', verdict.includes('คัดลอกแล้ว'), verdict || '(ปุ่มไม่เปลี่ยนสถานะเลย)');
  const copied = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  happy('คัดลอกลิงก์ที่ชี้มาที่เคสนี้', copied.includes(`case=${scenario.no}`), copied || '(อ่านคลิปบอร์ดไม่ได้)');
  await shot('03-กดแชร์');

  // and the copied link really works
  if (copied) {
    const u = new URL(copied);
    await as(u.pathname + u.search);
    happy('เปิดลิงก์ที่คัดลอกมาแล้วได้เคสเดิม', (await body()).includes(scenario.title_th), '');
  }
}

// ── 4. บนจอมือถือ ──────────────────────────────────────────────────────────
suite('4. บนจอมือถือ ปุ่มยังกดถึงได้');
{
  await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
  await as(`/sop?case=${scenario.no}`);
  const bar = await page.evaluate(() => {
    const back = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('กลับไปที่รายการ'));
    if (!back) return null;
    const row = back.parentElement;
    const s = getComputedStyle(row);
    const share = [...row.querySelectorAll('button')].some((b) => b.innerText.trim() === 'แชร์');
    const hdr = document.querySelector('header.sticky');
    return {
      sticky: s.position === 'sticky',
      share,
      top: row.getBoundingClientRect().top,
      headerBottom: hdr ? hdr.getBoundingClientRect().bottom : 0,
    };
  });
  happy('มีแถบกลับไปที่รายการบนมือถือ', Boolean(bar), '');
  happy('ปุ่มแชร์อยู่บนแถบนั้นด้วย', bar?.share === true, JSON.stringify(bar));
  happy('แถบติดหน้าจอไม่เลื่อนหาย', bar?.sticky === true, JSON.stringify(bar));
  happy('แถบอยู่ใต้หัวเว็บ ไม่โดนบัง', bar != null && bar.top >= bar.headerBottom - 2, JSON.stringify(bar));

  // scroll down: the bar has to still be on screen
  await page.evaluate(() => window.scrollBy(0, 1200));
  await settle(900);
  const after = await page.evaluate(() => {
    const back = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('กลับไปที่รายการ'));
    const hdr = document.querySelector('header.sticky');
    if (!back) return null;
    const row = back.parentElement.getBoundingClientRect();
    return { top: row.top, headerBottom: hdr ? hdr.getBoundingClientRect().bottom : 0 };
  });
  // "on screen" is not enough — parked under the sticky header it is invisible
  happy('เลื่อนหน้าลงแล้วแถบยังเห็นได้ ไม่จมใต้หัวเว็บ',
    after !== null && after.top >= after.headerBottom - 2, JSON.stringify(after));
  bad('หน้าไม่เลื่อนออกด้านข้าง',
    (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, '');
  await shot('04-มือถือ');
  await page.setViewport({ width: 1440, height: 950 });
}

await browser.close();
process.exit(report(`${ROOT}/sop-share.json`) ? 1 : 0);
