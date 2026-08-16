/**
 * PG — ชุดที่ 2 บนหน้าจอจริง: เลือกผู้รับสำเนาเป็นคน · ผู้รับสำเนา comment ได้ · tag ด้วย @
 */
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { execSync } from 'node:child_process';
import { call, newDoc, cleanup, suite, happy, bad, report, U, warm, APP, tok, query } from './harness.mjs';

await warm();
const { admin: A, admin2: B, exec: C, hr: H } = U;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
execSync(`mkdir -p ${ROOT}/cc`);

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, userDataDir: `${ROOT}/chrome-profile`,
  defaultViewport: { width: 1600, height: 1000 }, args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
const settle = (ms = 2500) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => { await page.screenshot({ path: `${ROOT}/cc/${n}.png` }); };
const body = () => page.evaluate(() => document.body.innerText);
const as = async (u, path) => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(u));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' });
  await settle(3500);
};
const MODAL = '.fixed.inset-0.z-50';

// ── 1. เลือกผู้รับสำเนาจากรายชื่อในวิซาร์ด ────────────────────────────────
suite('1. เลือกผู้รับสำเนาเป็นคน (ไม่ใช่พิมพ์อีเมลเอง)');
let docId = null;
{
  await as(A, '/memos');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('เพิ่มเอกสาร'));
    if (b) b.click();
  });
  await page.waitForSelector(MODAL, { timeout: 10000 });
  await settle(1500);

  // สำเนาเรียน is a numbered list like สิ่งที่ส่งมาด้วย: it starts collapsed behind
  // "+ เพิ่มผู้รับสำเนา" and there is no free-text address box anywhere in the form
  const shape = await page.evaluate((s) => {
    const m = document.querySelector(s);
    return {
      addLink: [...m.querySelectorAll('button')].some((b) => b.innerText.trim() === '+ เพิ่มผู้รับสำเนา'),
      freeText: [...m.querySelectorAll('input,textarea')]
        .some((i) => /อีเมล.*สำเนา|สำเนา.*อีเมล|cc/i.test(i.placeholder || '')),
    };
  }, MODAL);
  happy('ช่องสำเนาเรียนเป็นตัวเลือกรายชื่อ ไม่ใช่ช่องพิมพ์อิสระ', shape.addLink && !shape.freeText, JSON.stringify(shape));
  await shot('01-ช่องสำเนาเรียน');

  const opened = await page.evaluate((s) => {
    const m = document.querySelector(s);
    const b = [...m.querySelectorAll('button')].find((x) => x.innerText.trim() === '+ เพิ่มผู้รับสำเนา');
    if (!b) return false;
    b.click();
    return true;
  }, MODAL);
  await settle(2000);
  const names = await page.evaluate((s) => {
    const m = document.querySelector(s);
    const list = m.querySelector('.absolute.z-30');
    return list ? [...list.querySelectorAll('button')].map((b) => b.innerText.split('\n')[0]).slice(0, 5) : [];
  }, MODAL);
  happy(`กดแล้วมีรายชื่อคนในระบบให้เลือก (${names.length} คนแรก)`, opened && names.length > 0, names.join(' , '));
  await shot('02-รายชื่อให้เลือก');

  // pick two — the search stays open between picks so several people go in at once
  for (let i = 0; i < 2; i += 1) {
    await page.evaluate((s) => {
      const m = document.querySelector(s);
      const list = m.querySelector('.absolute.z-30');
      const b = list && list.querySelector('button');
      if (b) b.click();
    }, MODAL);
    await settle(1200);
  }
  await page.keyboard.press('Escape');
  await settle(900);
  // each recipient is its own numbered row, name and address both readable
  const picked = await page.evaluate((s) => {
    const m = document.querySelector(s);
    const label = [...m.querySelectorAll('label')].find((l) => l.innerText.includes('สำเนาเรียน'));
    const block = label?.parentElement;
    if (!block) return { rows: [], numbered: false };
    const rows = [...block.querySelectorAll('div')]
      .filter((d) => /^\d+\.$/.test(d.firstElementChild?.innerText?.trim() || ''))
      .map((d) => d.innerText.replace(/\s+/g, ' ').trim());
    return { rows, numbered: rows.every((t, i) => t.startsWith(`${i + 1}.`)) };
  }, MODAL);
  happy(`เลือกผู้รับสำเนาได้หลายคน (${picked.rows.length} คน)`, picked.rows.length === 2, picked.rows.join(' , '));
  happy('แสดงเป็นรายการมีเลขลำดับแบบเดียวกับสิ่งที่ส่งมาด้วย', picked.numbered && picked.rows.length > 0, picked.rows.join(' , '));
  happy('แต่ละบรรทัดเห็นทั้งชื่อและอีเมล', picked.rows.every((t) => t.includes('@')), picked.rows.join(' , '));
  await shot('03-เลือกแล้ว2คน');

  await page.keyboard.press('Escape');
  await settle(800);
  await browser.close();
}

// ── 2. ผู้รับสำเนาเปิดเอกสารและ comment ได้ ────────────────────────────────
suite('2. ผู้รับสำเนาเปิดเอกสารเดียวกันและร่วมสนทนาได้');
{
  const d = await newDoc(A, 'สำเนาเรียน comment ได้', { ccProfileIds: [C.id] });
  docId = d.id;

  const b2 = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: `${ROOT}/chrome-profile`,
    defaultViewport: { width: 1600, height: 1000 }, args: ['--no-first-run', '--no-default-browser-check'],
  });
  const p2 = (b2.targets ? (await b2.pages())[0] : null) || (await b2.newPage());
  const go = async (u, path) => {
    await p2.goto(APP, { waitUntil: 'domcontentloaded' });
    await p2.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(u));
    await p2.goto(`${APP}${path}`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 3500));
  };

  await go(C, `/memos/${d.id}`);
  const t = await p2.evaluate(() => document.body.innerText);
  happy('ผู้รับสำเนาเปิดหน้าเอกสารจริงได้ (หน้าเดียวกับผู้อนุมัติ)', p2.url().includes(`/memos/${d.id}`), p2.url());
  happy('เห็นเลขที่เอกสาร', t.includes(d.doc_number), '');
  happy('เห็นชื่อตัวเองในช่องสำเนาเรียน', t.includes(C.name), '');
  happy('มีช่องเขียนความเห็นให้ใช้', Boolean(await p2.$('textarea')), '');
  await p2.screenshot({ path: `${ROOT}/cc/04-ผู้รับสำเนาเปิดเอกสาร.png` });

  await p2.evaluate(() => {
    const ta = document.querySelector('textarea');
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(ta, 'ผมในฐานะผู้รับสำเนา ขอให้ความเห็นครับ');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 800));
  await p2.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /ส่งข้อความ|ส่งความเห็น/.test(x.textContent));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 4000));
  const after = await call(`/documents/${d.id}`, { user: A });
  happy('ความเห็นของผู้รับสำเนาถูกบันทึกและทุกคนเห็น',
    after.data.messages.some((m) => m.body.includes('ในฐานะผู้รับสำเนา')), '');
  await p2.screenshot({ path: `${ROOT}/cc/05-ผู้รับสำเนาแสดงความเห็นแล้ว.png` });
  await b2.close();
}

// ── 3. tag ด้วย @ แล้วส่งอีเมล ─────────────────────────────────────────────
suite('3. กล่าวถึงเพื่อนร่วมงานด้วย @');
{
  const b3 = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: `${ROOT}/chrome-profile`,
    defaultViewport: { width: 1600, height: 1000 }, args: ['--no-first-run', '--no-default-browser-check'],
  });
  const p3 = (await b3.pages())[0] || (await b3.newPage());
  await p3.goto(APP, { waitUntil: 'domcontentloaded' });
  await p3.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(A));
  await p3.goto(`${APP}/memos/${docId}`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 4000));

  happy('ช่องเขียนบอกวิธีใช้ @', await p3.evaluate(() =>
    (document.querySelector('textarea')?.placeholder || '').includes('@')), '');

  await p3.evaluate(() => {
    const ta = document.querySelector('textarea');
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(ta, 'รบกวนช่วยดูให้หน่อย @');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 2000));
  const list = await p3.evaluate(() => {
    const l = document.querySelector('.absolute.z-30');
    return l ? [...l.querySelectorAll('button')].map((b) => b.innerText.split('\n')[0]).slice(0, 5) : [];
  });
  happy(`พิมพ์ @ แล้วขึ้นรายชื่อให้เลือก (${list.length})`, list.length > 0, list.join(' , '));
  await p3.screenshot({ path: `${ROOT}/cc/06-พิมพ์-at-ขึ้นรายชื่อ.png` });

  const picked = await p3.evaluate(() => {
    const l = document.querySelector('.absolute.z-30');
    const b = l && l.querySelector('button');
    if (!b) return null;
    const name = b.innerText.split('\n')[0];
    b.click();
    return name;
  });
  await new Promise((r) => setTimeout(r, 1200));
  const chipShown = await p3.evaluate(() => document.body.innerText.includes('แจ้งเตือนถึง:'));
  happy(`เลือกแล้วขึ้นว่าจะแจ้งเตือนถึงใคร (${picked})`, chipShown, '');
  await p3.screenshot({ path: `${ROOT}/cc/07-เลือกคนที่จะ-tag.png` });

  await p3.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /ส่งข้อความ|ส่งความเห็น/.test(x.textContent));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 4500));
  const det = await call(`/documents/${docId}`, { user: A });
  const tagged = det.data.messages.find((m) => Array.isArray(m.mentions) && m.mentions.length > 0);
  happy('ส่งแล้วบันทึกว่ากล่าวถึงใคร', Boolean(tagged), JSON.stringify(tagged?.mentions));
  const shown = await p3.evaluate(() => document.body.innerText.includes('@'));
  happy('ข้อความที่ส่งแล้วแสดงป้ายผู้ถูกกล่าวถึง', shown, '');
  await p3.screenshot({ path: `${ROOT}/cc/08-ส่งแล้ว.png` });
  await b3.close();
}

const removed = await cleanup();
console.log(`\nลบเอกสารทดสอบ ${removed} ฉบับ`);
process.exit(report(`${ROOT}/PG.json`) ? 1 : 0);
