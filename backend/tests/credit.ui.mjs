/**
 * วงเงินสินเชื่อ — the screens nobody has ever opened.
 *
 * The module was built with Module 3 and gated off before anyone used it, so
 * these four tabs have never been driven by a person. Before it goes live the
 * screens have to render with real figures, the arithmetic on the page has to
 * match the arithmetic in the database, and the people who must not see money
 * must not see it — including the nav card that would tell them it exists.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query, call } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/credit-ui`;
fs.mkdirSync(SHOTS, { recursive: true });

await warm();
const { admin: A, exec: C, hr: H } = U;
const MARK = 'ZZUI';
const project = (await query("select id, name from projects where code = 'kda' limit 1")).rows[0];
const made = { fac: [], led: [] };

// real figures to read off the screen: a 5,000,000 facility with 2,000,000 drawn
const fac = await call('/credit/facilities', { method: 'POST', user: A, body: {
  projectId: project.id, company: `${MARK} ทดสอบหน้าจอ`, bank: 'ธนาคารกรุงเทพ',
  facilityNo: 1, limit: 5000000, notes: MARK } });   // 1 = หนังสือค้ำประกันสัญญา 5% (กล่อง BG)
made.fac.push(fac.data.id);
const led = await call('/credit/ledger', { method: 'POST', user: A, body: {
  facilityId: fac.data.id, amount: 2000000, startDate: '2026-08-01',
  dueDate: '2026-12-31', ref: `${MARK}-L1` } });
made.led.push(led.data.id);
// แต่ละชุดใช้โปรไฟล์ Chrome ของตัวเอง ไม่ใช้ร่วมกัน — ชุดที่ล้มกลางคันจะทิ้ง
// Chrome ที่ยังถือ lock ของโปรไฟล์ไว้ ชุดถัดไปที่ใช้โปรไฟล์เดียวกันจะค้างตามไป
// ทั้งที่ตัวเองไม่มีอะไรผิด (เกิดขึ้นจริงตอนรันรวมทั้งชุดบนเครื่องที่งานหนัก)

// โปรไฟล์ Chrome ใช้ครั้งเดียวแล้วทิ้ง — ชุดที่ล้มกลางคันทิ้งโปรไฟล์ที่เขียนค้าง
// ไว้ และ Chrome จะค้างตอนเปิดโปรไฟล์นั้นทุกครั้งหลังจากนั้น ชุดเดิมจึงล้มซ้ำ
// ไปเรื่อย ๆ ทั้งที่โค้ดไม่ได้ผิดอะไร (ไล่จนเจอเมื่อ 2026-09-05)
fs.rmSync(`${ROOT}/chrome-credit`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false,
  userDataDir: `${ROOT}/chrome-credit`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
// 30 วินาทีของค่าเริ่มต้นตึงเกินไปเมื่อเครื่องรันงานอื่นอยู่ด้วย
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 2500) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const as = async (user, path) => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3500);
};
const clickText = async (label) => page.evaluate((l) => {
  const el = [...document.querySelectorAll('button, a, [role="tab"]')].find((x) => x.innerText.trim().includes(l));
  if (el) el.click();
  return Boolean(el);
}, label);

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
// A console error for a failed request carries no URL, so the request itself is
// what gets judged — otherwise a cold favicon reads as an application error.
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });

// ── 1. เปิดโมดูลได้จริง ────────────────────────────────────────────────────
suite('1. โมดูลเปิดใช้งานแล้ว');
{
  await as(A, '/');
  const t = await body();
  happy('การ์ดวงเงินสินเชื่อขึ้นที่หน้าแรก', t.includes('วงเงินสินเชื่อ'), '');
  bad('ไม่ขึ้นป้ายว่ายังไม่เปิดใช้งาน', !/วงเงินสินเชื่อ[\s\S]{0,120}(เร็ว ๆ นี้|ยังไม่เปิด)/.test(t), '');
  await shot('01-หน้าแรก');

  await as(A, '/credit');
  const c = await body();
  happy('เปิดหน้าวงเงินสินเชื่อได้', !c.includes('ไม่พบหน้า') && !c.includes('ยังไม่เปิดใช้งาน'), c.slice(0, 60));
  happy('เห็นวงเงินที่เพิ่งสร้าง', c.includes(`${MARK} ทดสอบหน้าจอ`), '');
  happy('เห็นชื่อธนาคารเจ้าของวงเงิน', c.includes('ธนาคารกรุงเทพ'), '');
  await shot('02-หน้าวงเงิน');
}

// ── 2. ตัวเลขบนหน้าจอตรงกับฐานข้อมูล ───────────────────────────────────────
suite('2. ตัวเลขบนหน้าจอต้องตรงกับความจริง');
{
  const t = await body();
  happy('แสดงวงเงิน 5,000,000', t.includes('5,000,000'), '');
  happy('แสดงยอดใช้ไป 2,000,000', t.includes('2,000,000'), '');
  happy('แสดงคงเหลือ 3,000,000', t.includes('3,000,000'), '');
  const api = ((await call('/credit/facilities', { user: A })).data || []).find((x) => x.id === fac.data.id);
  happy('คงเหลือที่ฝั่งข้อมูลก็ตรงกัน', Number(api.available) === 3000000, String(api.available));
  bad('ไม่มีตัวเลขที่เป็น NaN หรือ undefined บนหน้าจอ', !/NaN|undefined|\[object/.test(t), '');
}

// ── 3. ครบทั้งสี่แท็บ ──────────────────────────────────────────────────────
suite('3. ทุกแท็บเปิดได้ ไม่มีจอขาว');
for (const tab of ['วงเงินสินเชื่อ (Facilities)', 'รายการสินเชื่อ (Credit Ledger)',
  'วางแผนสินเชื่อ (Cash Plan)', 'คำขอใช้วงเงิน']) {
  const found = await clickText(tab);
  await settle(2200);
  const t = await body();
  happy(`แท็บ "${tab}" เปิดได้`, found && t.trim().length > 120, found ? `${t.trim().length} ตัวอักษร` : 'ไม่พบแท็บ');
  // "500" alone would match ฿5,000,000, so match the wording of a real failure
  const err = t.match(/(เกิดข้อผิดพลาด|Something went wrong|Internal Server Error|Failed to fetch|ไม่มีสิทธิ์)/);
  bad(`แท็บ "${tab}" ไม่ขึ้นข้อความผิดพลาด`, !err, err ? err[0] : '');
  await shot(`03-แท็บ-${tab}`);
}

// ── 4. คนที่ไม่ควรเห็นเงิน ต้องไม่เห็น ─────────────────────────────────────
// The seeded hr1 account carries a stale credit override, so this fixes the
// permission it is testing instead of inheriting it, and puts it back after.
const hrPerms = (await query('select permissions from profiles where id = $1', [H.id])).rows[0].permissions;
const setHrCredit = async (on) => {
  const next = { ...(hrPerms || {}) };
  if (on) next.credit = { view: true, edit: false }; else delete next.credit;
  await query('update profiles set permissions = $2 where id = $1', [H.id, JSON.stringify(next)]);
};

suite('4. ฝ่ายบุคคลที่ไม่มีสิทธิ์ต้องไม่เห็นข้อมูลการเงิน');
{
  await setHrCredit(false);
  await as(H, '/');
  bad('การ์ดวงเงินสินเชื่อไม่ขึ้นให้คนที่ไม่มีสิทธิ์', !(await body()).includes('วงเงินสินเชื่อ'), '');
  await as(H, '/credit');
  const t = await body();
  bad('เปิดตรง ๆ ก็ไม่เห็นตัวเลขวงเงิน', !t.includes('5,000,000') && !t.includes(`${MARK} ทดสอบหน้าจอ`), t.slice(0, 70));
  bad('ไม่ถูกทิ้งไว้กับหน้าที่พังหรือข้อความภาษาอังกฤษ',
    !/Insufficient permissions|Forbidden|403/.test(t), t.slice(0, 70));
  happy('ถูกพากลับหน้าแรก ไม่ใช่จอว่าง', t.includes('แอปพลิเคชัน'), t.slice(0, 60));
  await shot('04-ไม่มีสิทธิ์');

  await as(C, '/credit');
  happy('ผู้บริหารเปิดดูได้ตามสิทธิ์', (await body()).includes(`${MARK} ทดสอบหน้าจอ`), '');
  await shot('05-ผู้บริหาร');
}

// ── 4ข. สิทธิ์ที่ผู้ดูแลตั้งเองต้องมีผลจริง ────────────────────────────────
// Granting "ดูข้อมูล" used to change the menu but not the server, so the person
// reached the page and was met with an English 403.
suite('4ข. เปิดสิทธิ์ให้รายบุคคลได้');
{
  await setHrCredit(true);
  await as(H, '/credit');
  const t = await body();
  happy('ผู้ที่ได้รับสิทธิ์เพิ่มเปิดดูได้ แม้ไม่ได้เป็นผู้บริหาร', t.includes(`${MARK} ทดสอบหน้าจอ`), '');
  bad('ไม่มีข้อความสิทธิ์ไม่พอค้างอยู่บนหน้า', !/Insufficient permissions|ไม่มีสิทธิ์/.test(t), '');
  await as(H, '/');
  happy('การ์ดขึ้นในหน้าแรกให้คนที่ได้รับสิทธิ์', (await body()).includes('วงเงินสินเชื่อ'), '');
  await shot('05ข-เปิดสิทธิ์รายคน');

  // ดูได้ แต่ยังแก้ไม่ได้
  const w = await call('/credit/facilities', { method: 'POST', user: H, body: {
    projectId: project.id, facilityNo: 7, limit: 1, notes: MARK } });
  bad('ได้สิทธิ์ดูอย่างเดียว ยังเพิ่มวงเงินไม่ได้', w.status === 403, `${w.status}`);

  await query('update profiles set permissions = $2 where id = $1', [H.id, hrPerms]);
}

// ── 5. จอเล็ก ──────────────────────────────────────────────────────────────
suite('5. เปิดบนจอเล็กแล้วยังอ่านได้');
{
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await as(A, '/credit');
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  bad('หน้าไม่ล้นออกด้านข้าง', over <= 2, `${over}px`);
  happy('ยังเห็นตัวเลขวงเงินอยู่', (await body()).includes('5,000,000'), '');
  await shot('06-จอเล็ก');
  await page.setViewport({ width: 1440, height: 950 });
}

// ── 6. ไม่มีข้อผิดพลาดค้างในคอนโซล ────────────────────────────────────────
suite('6. ไม่มีข้อผิดพลาดซ่อนอยู่');
{
  const real = errors.filter((e) => !/favicon|Download the React DevTools|ERR_NETWORK_CHANGED/.test(e));
  bad('ไม่มี error ในคอนโซลระหว่างใช้งาน', real.length === 0, real.slice(0, 2).join(' | '));
}

// ── 7. เก็บกวาด ────────────────────────────────────────────────────────────
suite('7. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  // sweep by marker, not only by the ids this run created — an aborted run
  // would otherwise leave a facility behind and fail the next one
  await query('delete from credit_ledger where facility_id in (select id from facilities where notes = $1)', [MARK]);
  await query('delete from facilities where notes = $1', [MARK]);
  const left = await query('select count(*)::int n from facilities where notes = $1', [MARK]);
  happy('ลบข้อมูลทดสอบหมดแล้ว', left.rows[0].n === 0, `${left.rows[0].n} รายการ`);
}

await browser.close();
report();
