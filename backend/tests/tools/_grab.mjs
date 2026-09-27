/** เก็บโครงหน้าจอ (เมนู หัวข้อ ปุ่ม หัวตาราง ป้ายช่อง) จากหน้าเว็บหนึ่งหน้า
 *  ใช้ได้ทั้งแอป Apps Script ของลูกค้า (เนื้อหาอยู่ใน iframe userHtmlFrame) และของเรา */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { U, tok } from '../harness.mjs';

const OUT = process.env.OUT, PAGE = process.env.URL, WAIT = Number(process.env.WAIT || 9000);
const CLICKS = JSON.parse(process.env.CLICKS || '[]');
const MINE = process.env.MINE === '1';

const shape = () => ({
  nav: [...document.querySelectorAll('nav a, nav button, a[data-go], [role="tab"], aside a, aside button, .sidebar a')]
    .map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter((x) => x && x.length < 44),
  headings: [...document.querySelectorAll('h1, h2, h3, legend, .card > h3')]
    .map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter((x) => x && x.length < 90),
  buttons: [...document.querySelectorAll('button, .btn, a.btn, [role="button"]')]
    .map((e) => (e.innerText || e.title || '').replace(/\s+/g, ' ').trim()).filter((x) => x && x.length < 44),
  tableHeads: [...document.querySelectorAll('table')].slice(0, 8)
    .map((t) => [...t.querySelectorAll('thead th, tr:first-child th')].map((th) => th.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '))
    .filter(Boolean),
  labels: [...document.querySelectorAll('label, .fld > label')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter((x) => x && x.length < 44),
  selects: [...document.querySelectorAll('select')].map((s) => [...s.options].map((o) => o.text.trim()).slice(0, 10).join(' / ')).filter(Boolean).slice(0, 8),
  text: document.body.innerText.replace(/\s*\n\s*/g, ' | ').slice(0, 2200),
});

const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', userDataDir: `${OUT}.chrome`, defaultViewport: { width: 1500, height: 1000 } });
const p = (await b.pages())[0];
p.setDefaultTimeout(120000);
if (MINE) {
  await p.goto(new URL(PAGE).origin, { waitUntil: 'domcontentloaded' });
  await p.evaluate((tk) => { localStorage.clear(); localStorage.setItem('hr_access_token', tk); localStorage.setItem('vcb_lang', 'th'); }, tok(U.admin));
}
await p.goto(PAGE, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, WAIT));
// แอปของลูกค้าจำภาษาไว้ต่อเบราว์เซอร์ โปรไฟล์ใหม่จึงขึ้นอังกฤษ — บังคับเป็นไทยก่อนเทียบ
if (!MINE) {
  const set = await p.evaluate(() => { try { localStorage.setItem('vcb_connect_lang', 'th'); return true; } catch { return false; } });
  if (set) { await p.reload({ waitUntil: 'networkidle2' }); await new Promise((r) => setTimeout(r, WAIT)); }
}
const frame = () => p.frames().find((x) => x.name() === 'userHtmlFrame') || p.mainFrame();
const out = {};
out['(หน้าแรก)'] = await frame().evaluate(shape);
for (const label of CLICKS) {
  try {
    const f = frame();
    const hit = await f.evaluate((lb) => {
      const el = [...document.querySelectorAll('button, a, [role="tab"], .btn, li, div')]
        .find((x) => (x.innerText || '').replace(/\s+/g, ' ').trim().startsWith(lb) && x.offsetParent !== null);
      if (el) { el.click(); return true; } return false;
    }, label);
    if (!hit) { out[label] = { __missing: true }; continue; }
    await new Promise((r) => setTimeout(r, 4500));
    out[label] = await frame().evaluate(shape);
  } catch (e) { out[label] = { __error: e.message }; }
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('เก็บแล้ว', Object.keys(out).join(' · '));
await b.close();
