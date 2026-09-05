/**
 * Whole-system sweep: every screen, as every kind of user.
 *
 * This is the broad pass — it opens each page in a real Chrome window and records
 * what a person would actually hit: a script error, a request that failed, a page
 * that scrolls sideways, a control with no readable name, an empty screen with no
 * explanation. The deep per-flow checks live in the other suites.
 *
 * Findings land in .out/audit.json; screenshots in .out/audit/ for eyeballing.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { call, suite, happy, bad, report, U, warm, APP, tok, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/audit`;
fs.mkdirSync(SHOTS, { recursive: true });
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

await warm();
const { admin: A, exec: C, hr: H } = U;

// a real document to open, and a real share/verify token to visit
const anyDoc = (await query(
  "select id from documents where status = 'approved' order by created_at desc limit 1")).rows[0];
const verifyTok = (await query(
  'select verify_token from documents where verify_token is not null limit 1')).rows[0]?.verify_token;

const PAGES = [
  { path: '/', name: 'หน้าแรก (Portal)' },
  { path: '/memos', name: 'ทะเบียนหนังสือ' },
  { path: `/memos/${anyDoc?.id}`, name: 'รายละเอียดเอกสาร' },
  { path: '/dashboard', name: 'ภาพรวมผู้ดูแล', adminOnly: true },
  { path: '/settings?s=signature', name: 'ตั้งค่า · โปรไฟล์และลายเซ็น' },
  { path: '/settings?s=users', name: 'ตั้งค่า · ผู้ใช้', adminOnly: true },
  { path: '/settings?s=permissions', name: 'ตั้งค่า · สิทธิ์', adminOnly: true },
  { path: '/settings?s=announcements', name: 'ตั้งค่า · ประกาศ', adminOnly: true },
  { path: '/settings?s=projects', name: 'ตั้งค่า · โครงการ/หัวจดหมาย', adminOnly: true },
  { path: '/settings?s=companies', name: 'ตั้งค่า · บริษัท/ตรา', adminOnly: true },
  { path: '/settings?s=doctypes', name: 'ตั้งค่า · ประเภทเอกสาร', adminOnly: true },
  { path: '/settings?s=approvers', name: 'ตั้งค่า · ผู้อนุมัติตามรหัส', adminOnly: true },
  { path: '/performance', name: 'บันทึกงานฝ่ายบุคคล' },
  { path: '/sop', name: 'คู่มือการปฏิบัติงาน (SOP)' },
  { path: '/หน้าที่ไม่มีอยู่', name: 'หน้าที่ไม่มีอยู่' },
];
const WHO = [
  { u: A, role: 'ผู้ดูแลระบบ', key: 'admin' },
  { u: C, role: 'ผู้บริหาร', key: 'exec' },
  { u: H, role: 'ฝ่ายบุคคล', key: 'hr' },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  userDataDir: `${ROOT}/chrome-profile`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
const settle = (ms = 2500) => new Promise((r) => setTimeout(r, ms));

// collect what the browser complains about, per navigation
let errors = [];
let failed = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errors.push(`อุบัติเหตุสคริปต์: ${String(e).slice(0, 160)}`));
// นับเฉพาะคำขอที่หน้าเว็บของเราเป็นคนยิง — chrome-extension:// เป็นของตัว
// เบราว์เซอร์เอง (เช่นตัวเปิด PDF ในตัว) เราควบคุมไม่ได้และไม่ใช่ข้อบกพร่องของระบบ
const ourRequest = (u) => !u.startsWith('chrome-extension://') && !u.startsWith('devtools://');
page.on('requestfailed', (r) => {
  if (ourRequest(r.url())) failed.push(`${r.method()} ${r.url().slice(0, 90)}`);
});
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon') && ourRequest(r.url())) {
    failed.push(`${r.status()} ${r.url().slice(0, 90)}`);
  }
});

async function open(user, path) {
  errors = []; failed = [];
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3200);
}

/** Everything a reviewer wants to know about the rendered page, in one pass. */
const inspect = () => page.evaluate(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const name = (el) => (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
  const controls = [...document.querySelectorAll('button, a[href], [role="button"]')].filter(vis);
  const inputs = [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].filter(vis);
  const labelled = (el) => Boolean(
    el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title')
    || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest('label'));
  return {
    title: document.title,
    text: document.body.innerText,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    controls: controls.length,
    namelessControls: controls.filter((b) => !name(b)).length,
    inputs: inputs.length,
    unlabelledInputs: inputs.filter((i) => !labelled(i)).length,
    imgsNoAlt: [...document.querySelectorAll('img')].filter((i) => vis(i) && !i.alt).length,
    // English leaking into a Thai UI is a real review item, so surface it
    latinChunks: [...new Set((document.body.innerText.match(/[A-Za-z][A-Za-z .'-]{5,}/g) || [])
      .map((s) => s.trim()))].slice(0, 12),
  };
});

const notes = [];
const note = (sev, where, what) => notes.push({ sev, where, what });

// Load the app once and throw the result away. Against a dev server the first
// visit can 404 on a chunk that is still being built, and the very first page of
// the sweep would report a script error that has nothing to do with the code —
// twice now that has sent someone looking for a bug that was never there.
await page.goto(APP, { waitUntil: 'networkidle2' }).catch(() => {});
await settle(4000);

for (const { u, role, key } of WHO) {
  suite(`หน้าจอในมุมของ${role}`);
  for (const p of PAGES) {
    if (!p.path.includes('undefined')) await open(u, p.path);
    else continue;
    const r = await inspect();
    const tag = `${p.name} · ${role}`;

    happy(`เปิดได้: ${tag}`, r.text.length > 40, `ข้อความ ${r.text.length} ตัวอักษร`);
    bad(`ไม่มีอุบัติเหตุสคริปต์: ${tag}`, errors.length === 0, errors.slice(0, 2).join(' | '));
    bad(`ไม่มีคำขอที่ล้มเหลว: ${tag}`, failed.length === 0, failed.slice(0, 2).join(' | '));
    bad(`ไม่เลื่อนออกด้านข้าง: ${tag}`, r.overflowX <= 1, `เกิน ${r.overflowX}px`);

    if (r.namelessControls) note('กลาง', tag, `ปุ่ม/ลิงก์ไม่มีข้อความอ่านออก ${r.namelessControls} จุด`);
    if (r.unlabelledInputs) note('กลาง', tag, `ช่องกรอกไม่มีป้ายกำกับ ${r.unlabelledInputs} จุด`);
    if (r.imgsNoAlt) note('ต่ำ', tag, `รูปไม่มีคำบรรยาย ${r.imgsNoAlt} รูป`);
    if (errors.length) note('สูง', tag, `สคริปต์ผิดพลาด: ${errors[0]}`);
    if (failed.length) note('สูง', tag, `คำขอล้มเหลว: ${failed[0]}`);
    if (r.overflowX > 1) note('กลาง', tag, `หน้าเลื่อนออกด้านข้าง ${r.overflowX}px`);
    if (r.latinChunks.length) note('ตรวจถ้อยคำ', tag, `ภาษาอังกฤษบนหน้าจอ: ${r.latinChunks.join(' · ')}`);

    const file = `${key}-${String(PAGES.indexOf(p) + 1).padStart(2, '0')}${p.path.replace(/[^\w]+/g, '-').slice(0, 34)}`;
    await page.screenshot({ path: `${SHOTS}/${file}.png` });
    fs.writeFileSync(`${SHOTS}/${file}.txt`, r.text);
  }
}

// ── หน้าสาธารณะ (ไม่ต้องล็อกอิน) ───────────────────────────────────────────
suite('หน้าสาธารณะที่เปิดได้โดยไม่ต้องล็อกอิน');
{
  for (const [path, name] of [['/login', 'หน้าเข้าสู่ระบบ'], [`/verify/${verifyTok}`, 'หน้าตรวจสอบเอกสารจาก QR']]) {
    errors = []; failed = [];
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
    await settle(3200);
    const r = await inspect();
    happy(`เปิดได้โดยไม่ต้องล็อกอิน: ${name}`, r.text.length > 40, '');
    bad(`ไม่มีอุบัติเหตุสคริปต์: ${name}`, errors.length === 0, errors.slice(0, 2).join(' | '));
    if (errors.length) note('สูง', name, `สคริปต์ผิดพลาด: ${errors[0]}`);
    await page.screenshot({ path: `${SHOTS}/public-${name.replace(/\s/g, '')}.png` });
    fs.writeFileSync(`${SHOTS}/public-${name.replace(/\s/g, '')}.txt`, r.text);
  }
  // a logged-out visitor must not reach the register
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${APP}/memos`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3000);
  bad('ยังไม่ล็อกอินแล้วเปิดทะเบียนไม่ได้', page.url().includes('/login'), page.url());
}

// ── บนจอมือถือ ─────────────────────────────────────────────────────────────
suite('การแสดงผลบนจอมือถือ');
{
  await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
  for (const [path, name] of [['/', 'หน้าแรก'], ['/memos', 'ทะเบียน'], [`/memos/${anyDoc?.id}`, 'รายละเอียดเอกสาร'], ['/settings?s=signature', 'ตั้งค่า']]) {
    await open(A, path);
    const r = await inspect();
    bad(`จอมือถือไม่เลื่อนออกด้านข้าง: ${name}`, r.overflowX <= 1, `เกิน ${r.overflowX}px`);
    if (r.overflowX > 1) note('กลาง', `${name} (มือถือ)`, `เลื่อนออกด้านข้าง ${r.overflowX}px`);
    await page.screenshot({ path: `${SHOTS}/mobile-${name.replace(/\s/g, '')}.png` });
  }
  await page.setViewport({ width: 1440, height: 950 });
}

await browser.close();

fs.writeFileSync(`${ROOT}/audit-notes.json`, JSON.stringify(notes, null, 1));
console.log(`\n── ข้อสังเกตที่ต้องใช้สายตาตัดสิน (${notes.length}) ──`);
for (const n of notes) console.log(`  [${n.sev}] ${n.where} — ${n.what}`);
console.log(`\nภาพหน้าจอ: ${SHOTS}`);
process.exit(report(`${ROOT}/audit.json`) ? 1 : 0);
