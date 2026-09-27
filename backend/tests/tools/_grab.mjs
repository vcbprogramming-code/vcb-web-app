/** เก็บโครงหน้าจอ (เมนู หัวข้อ ปุ่ม หัวตาราง ป้ายช่องกรอก) จากหน้าเว็บหนึ่งหน้า
 *  ใช้ได้ทั้งแอป Apps Script ของลูกค้า (เนื้อหาอยู่ใน iframe userHtmlFrame) และของเรา */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { U, tok } from '../harness.mjs';

const OUT = process.env.OUT, PAGE = process.env.URL, WAIT = Number(process.env.WAIT || 9000);
const CLICKS = JSON.parse(process.env.CLICKS || '[]');   // ชื่อเมนู/แท็บที่จะกดเก็บทีละหน้า
const MINE = process.env.MINE === '1';

const shape = () => ({
  title: (document.querySelector('h1, .apptitle, .brand')?.innerText || '').trim().slice(0, 120),
  nav: [...document.querySelectorAll('nav a, nav button, a[data-go], [role="tab"], aside a, .sidebar a')]
    .map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter((x) => x && x.length < 40),
  headings: [...document.querySelectorAll('h1, h2, h3, .card > h3, .grp-title, .sec-title, legend')]
    .map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter((x) => x && x.length < 80),
  buttons: [...document.querySelectorAll('button, .btn, a.btn, [role="button"]')]
    .map((e) => (e.innerText || e.title || '').replace(/\s+/g, ' ').trim()).filter((x) => x && x.length < 40),
  tableHeads: [...document.querySelectorAll('table')].slice(0, 6)
    .map((t) => [...t.querySelectorAll('thead th, tr:first-child th')].map((th) => th.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '))
    .filter(Boolean),
  labels: [...document.querySelectorAll('label, .fld > label, .field-label')]
    .map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter((x) => x && x.length < 40),
  selects: [...document.querySelectorAll('select')].map((s) => [...s.options].map((o) => o.text.trim()).slice(0, 12).join(' / ')).filter(Boolean).slice(0, 6),
  text: document.body.innerText.replace(/\s*\n\s*/g, ' | ').slice(0, 1800),
});

const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', userDataDir: `${OUT}.chrome`, defaultViewport: { width: 1500, height: 1000 } });
const p = (await b.pages())[0];
p.setDefaultTimeout(120000);
if (MINE) {
  await p.goto(new URL(PAGE).origin, { waitUntil: 'domcontentloaded' });
  await p.evaluate((tk) => { localStorage.clear(); localStorage.setItem('hr_access_token', tk); }, tok(U.admin));
}
await p.goto(PAGE, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, WAIT));
// แอปของลูกค้าจำภาษาไว้ต่อเบราว์เซอร์ โปรไฟล์ใหม่จึงขึ้นอังกฤษ — บังคับเป็นไทยก่อนเทียบ
if (!MINE) {
  const set = await p.evaluate(() => {
    try { localStorage.setItem('vcb_connect_lang', 'th'); localStorage.setItem('lang', 'th'); localStorage.setItem('vcb_lang', 'th'); return true; } catch (e) { return false; }
  });
  const f0 = p.frames().find((x) => x.name() === 'userHtmlFrame');
  if (f0) await f0.evaluate(() => {
    try { localStorage.setItem('vcb_connect_lang', 'th'); localStorage.setItem('lang', 'th'); localStorage.setItem('vcb_lang', 'th'); } catch (e) {}
    const b = [...document.querySelectorAll('button, a')].find((x) => ['ไทย', 'TH', 'ไทย · TH'].includes((x.innerText || '').trim()) || x.dataset?.lang === 'th');
    if (b) b.click();
  }).catch(() => {});
  await p.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, WAIT));
  console.log('ตั้งภาษาไทย:', set);
}
const frame = () => (MINE ? p : (p.frames().find((x) => x.name() === 'userHtmlFrame') || p));
const out = { '(หน้าแรก)': await frame().evaluate(shape) };
for (const label of CLICKS) {
  const clicked = await frame().evaluate((l) => {
    const el = [...document.querySelectorAll('a, button, [role="tab"], [data-go]')]
      .find((x) => (x.innerText || '').replace(/\s+/g, ' ').trim().startsWith(l) && x.offsetParent !== null);
    if (el) { el.click(); return true; } return false;
  }, label);
  await new Promise((r) => setTimeout(r, MINE ? 3500 : 7000));
  out[label] = clicked ? await frame().evaluate(shape) : { error: 'กดเมนูนี้ไม่ได้' };
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v.error || `nav ${v.nav?.length} · ปุ่ม ${v.buttons?.length} · หัวข้อ ${v.headings?.length}`}`).join('\n'));
await b.close(); process.exit(0);
