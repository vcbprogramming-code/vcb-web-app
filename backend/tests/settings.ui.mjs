/**
 * PH — ชุดที่ 3: รวมหน้าตั้งค่าไว้ที่เดียว + ตั้งลายเซ็นให้ผู้ใช้รายอื่น
 */
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { call, cleanup, suite, happy, bad, report, U, warm, APP, API, tok, query } from './harness.mjs';

await warm();
const { admin: A, hr: H } = U;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
execSync(`mkdir -p ${ROOT}/set`);

const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
function png(w = 90, h = 30) {
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'latin1'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x30)])));
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ── 1. ผู้ดูแลตั้งลายเซ็นให้คนอื่น (ฝั่งระบบ) ─────────────────────────────
suite('1. ผู้ดูแลตั้งลายเซ็นให้ผู้ใช้รายอื่น');
{
  const before = (await query('select signature_url from profiles where id = $1', [H.id])).rows[0].signature_url;
  try {
    const fd = new FormData();
    fd.append('file', new Blob([png()], { type: 'image/png' }), 'ลายเซ็นผู้ใช้.png');
    const up = await fetch(`${API}/admin/users/${H.id}/signature`, {
      method: 'POST', headers: { Authorization: `Bearer ${tok(A)}` }, body: fd,
    });
    happy('อัปโหลดลายเซ็นแทนผู้ใช้รายอื่นได้', up.status === 201, `${up.status}`);
    const row = (await query('select signature_url from profiles where id = $1', [H.id])).rows[0];
    happy('บันทึกลงบัญชีของผู้ใช้รายนั้นจริง', Boolean(row.signature_url) && row.signature_url !== before, '');

    const img = await call(`/admin/users/${H.id}/signature`, { user: A, raw: true });
    happy('เปิดดูลายเซ็นที่ตั้งให้ได้', img.status === 200 && (img.headers.get('content-type') || '').startsWith('image/'), `${img.status}`);

    const audit = await query(
      "select detail from audit_log where action = 'signature_set' order by created_at desc limit 1");
    happy('บันทึกในประวัติว่าใครตั้งลายเซ็นให้ใคร',
      audit.rows.length > 0 && JSON.stringify(audit.rows[0].detail).includes(H.id), JSON.stringify(audit.rows[0]?.detail));

    bad('ผู้ใช้ทั่วไปตั้งลายเซ็นให้คนอื่นไม่ได้',
      (await call(`/admin/users/${A.id}/signature`, { user: H })).status === 403, '');
    const svg = new FormData();
    svg.append('file', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: 'image/svg+xml' }), 'x.svg');
    const badUp = await fetch(`${API}/admin/users/${H.id}/signature`, {
      method: 'POST', headers: { Authorization: `Bearer ${tok(A)}` }, body: svg });
    bad('อัปโหลดไฟล์ SVG เป็นลายเซ็นไม่ได้', badUp.status === 400, `${badUp.status}`);

    const del = await call(`/admin/users/${H.id}/signature`, { method: 'DELETE', user: A });
    happy('ลบลายเซ็นของผู้ใช้รายอื่นได้', del.status === 200, `${del.status}`);
  } finally {
    await query('update profiles set signature_url = $2 where id = $1', [H.id, before]);
    happy('คืนค่าลายเซ็นเดิมของบัญชีจริงแล้ว',
      (await query('select signature_url from profiles where id = $1', [H.id])).rows[0].signature_url === before, '');
  }
}

// ── 2. หน้าตั้งค่ารวมที่เดียว ──────────────────────────────────────────────
suite('2. หน้าตั้งค่ารวมอยู่ที่เดียว');
{
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: `${ROOT}/chrome-profile`,
    defaultViewport: { width: 1600, height: 1000 }, args: ['--no-first-run', '--no-default-browser-check'],
  });
  const page = (await browser.pages())[0] || (await browser.newPage());
  const settle = (ms = 2500) => new Promise((r) => setTimeout(r, ms));
  const shot = async (n) => { await page.screenshot({ path: `${ROOT}/set/${n}.png` }); };
  const body = () => page.evaluate(() => document.body.innerText);
  const as = async (u, path) => {
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(u));
    await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' });
    await settle(3500);
  };

  await as(A, '/settings');
  const t = await body();
  happy('เปิดหน้าตั้งค่าได้', page.url().includes('/settings'), page.url());
  for (const s of ['ของฉัน', 'ระบบ', 'E-Memo']) {
    happy(`มีหมวด "${s}"`, t.includes(s), '');
  }
  // สิทธิ์การใช้งาน is deliberately absent — it moved inside the user modal
  for (const s of ['โปรไฟล์และลายเซ็น', 'ผู้ใช้และสังกัดโครงการ', 'ประกาศ', 'โครงการ / หัวจดหมาย', 'บริษัท / ตรา', 'ประเภทเอกสาร', 'ผู้อนุมัติตามรหัสเอกสาร']) {
    happy(`มีเมนู "${s}"`, t.includes(s), '');
  }
  await shot('01-หน้าตั้งค่ารวม');

  // clicking a menu item swaps the panel and is linkable
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'ประเภทเอกสาร');
    if (b) { b.click(); return true; } return false;
  });
  await settle(2500);
  happy('กดเมนูแล้วสลับเนื้อหาได้', clicked && page.url().includes('s=doctypes'), page.url());
  await shot('02-สลับเมนู');

  // old links still work
  for (const [old, expect] of [['/admin', 's=users'], ['/memos-settings', 's=projects'], ['/profile', 's=signature']]) {
    await as(A, old);
    happy(`ลิงก์เดิม ${old} ยังใช้ได้ (พาไป ${expect})`, page.url().includes('/settings') && page.url().includes(expect), page.url());
  }

  // the gear on the register goes here now
  await as(A, '/memos');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '').includes('ตั้งค่า'));
    if (b) b.click();
  });
  await settle(3000);
  happy('ปุ่มตั้งค่าในหน้าทะเบียนพามาหน้าเดียวกัน', page.url().includes('/settings'), page.url());

  // non-admin sees only their own section
  await as(H, '/settings');
  const th = await body();
  happy('ผู้ใช้ทั่วไปเปิดหน้าตั้งค่าได้', page.url().includes('/settings'), page.url());
  happy('ผู้ใช้ทั่วไปเห็นเมนูโปรไฟล์และลายเซ็นของตน', th.includes('โปรไฟล์และลายเซ็น'), '');
  bad('ผู้ใช้ทั่วไปไม่เห็นเมนูของผู้ดูแล', !th.includes('ผู้ใช้และสังกัดโครงการ') && !th.includes('ประเภทเอกสาร'), '');
  happy('มีช่องอัปโหลดลายเซ็นของตัวเอง', /ลายเซ็น/.test(th), '');
  await shot('03-มุมผู้ใช้ทั่วไป');

  await browser.close();
}

await cleanup();
process.exit(report(`${ROOT}/PH.json`) ? 1 : 0);
