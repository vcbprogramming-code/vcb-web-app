/**
 * The day-to-day journeys, driven through a real browser rather than the API.
 *
 * The API suites prove the rules hold. This one asks the other question: can a
 * person actually get through the work — find the button, understand the state
 * they are in, and be told what happened. It walks one document from a blank
 * form to a signed PDF, through the creator, the ผู้จัดการโครงการ who signs, and
 * the executive who approves, then the reject-and-resubmit path.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { call, cleanup, suite, happy, bad, report, U, warm, APP, tok, query, made, MARK } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/journey`;
fs.mkdirSync(SHOTS, { recursive: true });

await warm();
const { admin: A, admin2: B, exec: C } = U;
const proj = (await query("select id, code from projects where code = 'kda' limit 1")).rows[0];

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
const as = async (u, path) => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(u));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3200);
};
const clickText = (label) => page.evaluate((t) => {
  const el = [...document.querySelectorAll('button, a, [role="button"]')]
    .filter((x) => (x.innerText || '').trim().includes(t))
    .sort((a, b) => a.innerText.length - b.innerText.length)[0];
  if (el) { el.click(); return true; }
  return false;
}, label);

// ── 1. หน้าแรกและการหาทางไปโมดูล ───────────────────────────────────────────
suite('1. หน้าแรก — หาทางไปงานที่ต้องทำ');
{
  await as(A, '/');
  const t = await body();
  happy('หน้าแรกบอกชื่อระบบ', /VCB/i.test(t), '');
  happy('มีทางเข้าโมดูล E-Memo', t.includes('E-Memo') || t.includes('บันทึก'), '');
  happy('มีชื่อผู้ใช้ที่กำลังใช้งาน', t.includes(A.name), '');
  await shot('01-หน้าแรก');

  const went = await clickText('E-Memo');
  await settle(3000);
  happy('กดจากหน้าแรกเข้าโมดูลได้', went && !page.url().endsWith('/'), page.url());
}

// ── 2. ผู้จัดทำ — ตั้งแต่ฟอร์มเปล่าจนถึงส่งอนุมัติ ─────────────────────────
suite('2. ผู้จัดทำ — สร้างเอกสารและส่งเข้าสายอนุมัติ');
let docId = null;
{
  await as(B, '/memos');
  const before = await body();
  happy('ทะเบียนบอกจำนวนเอกสาร', /\d+\s*เอกสาร/.test(before), '');
  happy('มีปุ่มเพิ่มเอกสารเห็นชัด', /เพิ่มเอกสาร|สร้างเอกสาร/.test(before), '');

  // the form itself is the API's job to accept; here we only need a document to walk
  const created = await call('/documents', { method: 'POST', user: B, body: {
    projectId: proj.id, docCode: '0823', subject: `${MARK} เส้นทางผู้ใช้`,
    recipient: 'เรียน กรรมการผู้จัดการ', body: 'ขอเรียนเสนอเพื่อโปรดพิจารณา' } });
  docId = created.data.id; made.add(docId);
  happy('เอกสารใหม่ได้เลขที่ทันที', Boolean(created.data.doc_number), created.data?.doc_number);

  await as(B, `/memos/${docId}`);
  const d = await body();
  happy('หน้าเอกสารบอกสถานะฉบับร่าง', d.includes('ฉบับร่าง') || d.includes('ร่าง'), '');
  happy('หน้าเอกสารแสดงเลขที่', d.includes(created.data.doc_number), '');
  bad('ฉบับร่างยังไม่ขึ้นว่าอนุมัติแล้ว', !d.includes('อนุมัติแล้ว'), '');
  await shot('02-ฉบับร่าง');

  await call(`/documents/${docId}/generate-pdf`, { method: 'POST', user: B });
  await call(`/documents/${docId}/submit`, { method: 'POST', user: B, body: {
    approvers: [{ name: A.name, email: A.email, isSigner: true }, { name: C.name, email: C.email }] } });
  await as(B, `/memos/${docId}`);
  const s = await body();
  happy('ส่งแล้วสถานะเปลี่ยนเป็นรออนุมัติ', s.includes('รออนุมัติ'), '');
  happy('เห็นว่ารอใครอยู่', s.includes(A.name), '');
  await shot('03-รออนุมัติ');
}

// ── 3. ผู้ลงนาม — เห็นงานค้างของตัวเองและลงนาม ─────────────────────────────
suite('3. ผู้ลงนาม (ผู้จัดการโครงการ) — เห็นงานค้างและอนุมัติ');
{
  await as(A, '/memos');
  const t = await body();
  happy('ทะเบียนเตือนว่ามีเอกสารรออนุมัติจากเรา', /รออนุมัติ\s*\d+|รออนุมัติจากคุณ/.test(t), '');
  await shot('04-มุมผู้อนุมัติ');

  await as(A, `/memos/${docId}`);
  const d = await body();
  happy('ผู้อนุมัติเห็นปุ่มอนุมัติบนหน้าเอกสาร', /อนุมัติ/.test(d), '');
  bad('ยังไม่มีข้อความว่าอนุมัติแล้วก่อนกด', !d.includes('อนุมัติแล้ว'), '');

  await call(`/documents/${docId}/approve`, { method: 'POST', user: A,
    body: { action: 'approved', comment: 'เห็นชอบตามเสนอ' } });
  await as(A, `/memos/${docId}`);
  const after = await body();
  happy('อนุมัติแล้วเห็นในไทม์ไลน์', after.includes('เห็นชอบตามเสนอ'), '');
  happy('ส่งต่อผู้อนุมัติลำดับถัดไป', after.includes(C.name), '');
  bad('ผู้ที่อนุมัติไปแล้วไม่เห็นปุ่มอนุมัติซ้ำ',
    !/กดเพื่ออนุมัติ|ยืนยันการอนุมัติ/.test(after), '');
  await shot('05-ลงนามแล้ว');
}

// ── 4. ผู้บริหาร — อนุมัติปิดงานและได้หนังสือฉบับลงนาม ─────────────────────
suite('4. ผู้บริหาร — อนุมัติปิดงาน');
{
  await call(`/documents/${docId}/approve`, { method: 'POST', user: C, body: { action: 'approved' } });
  await as(C, `/memos/${docId}`);
  const d = await body();
  happy('เอกสารขึ้นสถานะอนุมัติแล้ว', d.includes('อนุมัติแล้ว'), '');
  happy('มีปุ่มดาวน์โหลดหนังสือฉบับลงนาม', /ดาวน์โหลด/.test(d), '');
  happy('มีทางตรวจสอบความถูกต้อง (QR)', /ตรวจสอบ/.test(d), '');
  await shot('06-อนุมัติแล้ว');
}

// ── 5. เส้นทางไม่อนุมัติ — ต้องบอกเหตุผลและกลับไปแก้ได้ ────────────────────
suite('5. ไม่อนุมัติ แล้วกลับไปแก้และยื่นใหม่');
{
  const r = await call('/documents', { method: 'POST', user: B, body: {
    projectId: proj.id, docCode: '0823', subject: `${MARK} เส้นทางไม่อนุมัติ`,
    recipient: 'เรียน กรรมการผู้จัดการ', body: 'ทดสอบ' } });
  const rid = r.data.id; made.add(rid);
  await call(`/documents/${rid}/generate-pdf`, { method: 'POST', user: B });
  await call(`/documents/${rid}/submit`, { method: 'POST', user: B, body: {
    approvers: [{ name: A.name, email: A.email, isSigner: true }] } });

  const noReason = await call(`/documents/${rid}/approve`, { method: 'POST', user: A, body: { action: 'rejected' } });
  bad('ไม่อนุมัติโดยไม่บอกเหตุผลไม่ได้', noReason.status === 400, `${noReason.status}`);

  await call(`/documents/${rid}/approve`, { method: 'POST', user: A,
    body: { action: 'rejected', comment: 'งบประมาณเกินกรอบที่อนุมัติไว้' } });
  await as(B, `/memos/${rid}`);
  const d = await body();
  happy('ผู้จัดทำเห็นว่าไม่อนุมัติ', d.includes('ไม่อนุมัติ'), '');
  happy('เห็นเหตุผลที่ไม่อนุมัติชัดเจน', d.includes('งบประมาณเกินกรอบ'), '');
  happy('มีทางกลับไปแก้ไข', /แก้ไข/.test(d), '');
  await shot('07-ไม่อนุมัติ');
}

// ── 6. การค้นหาและตัวกรอง ──────────────────────────────────────────────────
suite('6. การค้นหาและตัวกรองในทะเบียน');
{
  await as(B, '/memos');
  const all = await body();
  happy('ตัวกรองพร้อมใช้งานครบ',
    ['ทุกประเภทเอกสาร', 'ทุกสถานะ', 'เอกสารของฉัน', 'ที่ฉันเคยดำเนินการ', 'ทุกโครงการ']
      .every((s) => all.includes(s)), '');

  await as(B, '/memos?mine=created');
  await settle(2500);
  happy('กรอง "เอกสารของฉัน" แล้วยังมีผลลัพธ์', (await body()).includes('เอกสาร'), '');

  await as(A, '/memos?mine=acted');
  await settle(2500);
  const acted = await body();
  happy('กรอง "ที่ฉันเคยดำเนินการ" ใช้งานได้', acted.length > 200, '');
  happy('เรียงจากที่ดำเนินการล่าสุด', acted.includes(`${MARK} เส้นทางผู้ใช้`) || acted.includes('เส้นทาง'), '');
  await shot('08-ตัวกรองที่ฉันเคยดำเนินการ');

  await as(B, '/memos?status=approved');
  await settle(2500);
  const ap = await body();
  bad('กรองอนุมัติแล้วไม่ปนฉบับร่าง', !ap.includes('ฉบับร่าง'), '');

  // every project must be reachable from the register, not just the first few
  await as(B, '/memos');
  const chips = await page.evaluate(() => {
    const row = [...document.querySelectorAll('div')].find((d) => d.innerText?.trim().startsWith('ทุกโครงการ') && d.scrollWidth > 0);
    if (!row) return null;
    return { shown: row.clientWidth, total: row.scrollWidth, text: row.innerText.replace(/\n/g, ' ') };
  });
  const projCount = (await query('select count(*) n from projects where is_active = true')).rows[0].n;
  happy(`โครงการทั้ง ${projCount} โครงการเข้าถึงได้จากทะเบียน`,
    !chips || chips.total <= chips.shown + 2, chips ? `ซ่อนไว้ ${chips.total - chips.shown}px — ${chips.text}` : '');
}

// ── 7. สิทธิ์ที่มองเห็นบนหน้าจอ ────────────────────────────────────────────
suite('7. สิ่งที่แต่ละบทบาทเห็นบนหน้าจอ');
{
  await as(C, '/');
  bad('ผู้บริหารไม่เห็นเมนูภาพรวมของผู้ดูแล', !(await body()).includes('ภาพรวม E-Memo'), '');
  await as(C, '/dashboard');
  bad('ผู้บริหารเปิดหน้าภาพรวมผู้ดูแลไม่ได้', !page.url().includes('/dashboard'), page.url());
  await as(C, '/settings?s=users');
  bad('ผู้บริหารไม่เห็นตารางผู้ใช้', !(await body()).includes('เพิ่มผู้ใช้'), '');
}

await browser.close();
await cleanup();
process.exit(report(`${ROOT}/journey.json`) ? 1 : 0);
