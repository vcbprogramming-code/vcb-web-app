/**
 * หน้าหลัก (Portal) — ประตูทางเข้าที่ทุกคนเห็นก่อนเสมอ
 *
 * ทุกคนในบริษัทเปิดหน้านี้ก่อนเข้าโมดูลใด ๆ ถ้าหน้านี้เพี้ยน คนจะเข้าใจว่า
 * ทั้งระบบเพี้ยน ชุดนี้กดของจริงบนหน้านี้: ค้นหาแอป เปิดแอป อ่านประกาศ
 * ปิดแถบประกาศ ปฏิทินวันหยุด กล่องวันเกิด กล่องช่วยเหลือ และเมนูบนมือถือ
 *
 * ชุดที่ 2 เทียบคำต่อคำกับพอร์ทัลที่บริษัทใช้อยู่จริง (พจนานุกรม I18N.th ของเขา)
 * เพราะงานรอบนี้คือ "ให้ตรงกับของเขา" ไม่ใช่แค่ "ไม่พัง"
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/portal-ui`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin, C = U.exec;
const MARK = 'ZZPORTAL';
const clean = () => query('delete from announcements where title like $1', [`${MARK}%`]);
await clean();

// วันเกิดที่ยืมมาทดสอบ — คืนค่าเดิมทุกครั้งใน suite เก็บกวาด
const bdaySeeded = [];
const seedBirthdays = async () => {
  const rows = (await query(
    'select id, birth_date from employees where is_active order by full_name limit 3')).rows;
  const today = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const plus = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); d.setFullYear(1990); return iso(d); };
  // วันนี้ · พรุ่งนี้ · เมื่อวานของปีก่อน (= อีกเกือบปี ต้องไปอยู่ท้ายสุด)
  const want = [plus(0), plus(1), plus(-1)];
  for (let i = 0; i < rows.length; i++) {
    bdaySeeded.push(rows[i]);
    await query('update employees set birth_date = $1 where id = $2', [want[i], rows[i].id]);
  }
  return rows.length;
};
const restoreBirthdays = async () => {
  for (const r of bdaySeeded) await query('update employees set birth_date = $1 where id = $2', [r.birth_date, r.id]);
};

fs.rmSync(`${ROOT}/chrome-portal`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-portal`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 1600) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0].slice(0, 150)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().split('\n')[0].slice(0, 150));
});

const as = async (user, path = '/') => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(2600);
};
const click = (label) => page.evaluate((l) => {
  const el = [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim() === l)
    || [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim().includes(l));
  if (el) { el.click(); return true; } return false;
}, label);
const typeSearch = (v) => page.evaluate((val) => {
  const i = [...document.querySelectorAll('input[type=search], input')].find((x) => (x.placeholder || '').includes('ค้นหาแอป'));
  if (!i) return false;
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, val);
  i.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, v);
/** ข้อความในแผงข้าง (อ่านจากหัวข้อของแผงนั้น ไม่ใช่ทั้งหน้า — คำว่า "วันนี้"
 *  โผล่ในคำอธิบายปฏิทินด้วย ถ้าอ่านรวมจะได้ผลบวกลวง) */
const panelText = (heading) => page.evaluate((h) => {
  const el = [...document.querySelectorAll('h3')].find((x) => x.innerText.includes(h));
  return el && el.parentElement ? el.parentElement.innerText : '';
}, heading);
/** หัวข้อกลุ่มในเมนูข้าง ตามลำดับที่แสดง */
const navGroups = () => page.evaluate(() => {
  const side = document.getElementById('portal-sidebar');
  if (!side) return [];
  return [...side.querySelectorAll('div')]
    .filter((d) => d.className.includes('uppercase'))
    .map((d) => d.innerText.trim());
});
const appCount = () => page.evaluate(() => {
  const m = document.body.innerText.match(/(\d+) รายการ/);
  return m ? Number(m[1]) : -1;
});
/** การ์ดในตารางแอป — ต้องหาใน <main> เท่านั้น เพราะเมนูข้างก็เป็น <button>
 *  ที่มีชื่อแอปเหมือนกัน และอยู่ก่อนในเอกสาร (เคยทำให้เช็กไปอ่านแถวเมนูแทน) */
const cardAttr = (name, attr) => page.evaluate(([n, a]) => {
  const main = document.querySelector('main');
  const el = main && [...main.querySelectorAll('button')].find((x) => x.innerText.includes(n));
  return el ? el.getAttribute(a) : null;
}, [name, attr]);

// ── 1. เปิดหน้าหลัก ───────────────────────────────────────────────────────
suite('1. เปิดหน้าหลักแล้วเห็นทุกอย่างที่ต้องเห็น');
{
  await as(A);
  const t = await body();
  happy('หน้าไม่ล้ม', !t.includes('เกิดข้อผิดพลาดบางอย่าง'), t.slice(0, 70).replace(/\n/g, ' | '));
  happy('ทักทายด้วยชื่อผู้ใช้', t.includes('ทนงศักดิ์') || t.includes(A.name.split(' ')[0]), '');
  happy('เห็นรายการแอปพลิเคชัน', t.includes('แอปพลิเคชัน'), '');
  happy('เห็นเมนูช่วยเหลือ', t.includes('ช่วยเหลือ'), '');
  happy('บอกจำนวนแอปที่แสดงอยู่', /\d+ รายการ/.test(t), '');
  bad('ไม่มี error ตอนเปิดหน้า', errors.length === 0, errors.slice(0, 2).join(' / '));
  await shot('01-หน้าหลัก');
}

// ── 2. ตรงกับพอร์ทัลที่บริษัทใช้อยู่ ─────────────────────────────────────
suite('2. คำบนหน้าตรงกับพอร์ทัลที่บริษัทใช้อยู่');
{
  const t = await body();
  happy('คำบรรยายแบรนด์เป็นของเขา', t.includes('พอร์ทัลอินทราเน็ตภายในองค์กร'),
    t.slice(0, 80).replace(/\n/g, ' | '));

  // ชื่อการ์ดตามพจนานุกรมของเขา — ยกเว้น E-Memo ที่คงชื่อของเราไว้ตามที่ตกลง
  for (const name of ['รายงานการประชุม', 'มาตรฐานการปฏิบัติงาน', 'แผนผังระบบ',
    'บันทึกงานฝ่ายบุคคล', 'ระบบจัดการวงเงินสินเชื่อ']) {
    happy(`ชื่อการ์ด "${name}"`, t.includes(name), '');
  }
  happy('การ์ด E-Memo ยังใช้ชื่อเดิมของเรา', t.includes('บันทึก & อนุมัติ (E-Memo)'), '');
  bad('ไม่มีชื่อโมดูลเก่าค้างบนการ์ด', !t.includes('คู่มือปฏิบัติงาน (SOP)')
    && !t.includes('วงเงินสินเชื่อโครงการ') && !t.includes('(System Map)'), '');

  // คำบรรยายการ์ด (desc) ของเขา
  for (const desc of ['วงเงินสินเชื่อ การเบิกถอน คำขอ และการอนุมัติ',
    'เรียกดู ค้นหา และควบคุมเวอร์ชันเอกสาร SOP ของบริษัท',
    'การลงเวลา บันทึกงาน และตารางเวลาทำงานสำหรับทีม HR']) {
    happy(`คำบรรยาย "${desc.slice(0, 24)}…"`, t.includes(desc), '');
  }

  // คำบรรยายยาว (preview) ขึ้นเป็น tooltip ตอนชี้ค้าง
  const tip = await cardAttr('มาตรฐานการปฏิบัติงาน', 'title');
  happy('การ์ดมี tooltip คำบรรยายยาวของเขา',
    !!tip && tip.startsWith('เป็นคลังขั้นตอนการปฏิบัติงานมาตรฐานที่ค้นหาได้'), String(tip).slice(0, 50));

  // เมนูข้างจัดสามกลุ่มเหมือนเขา
  const groups = await navGroups();
  happy(`เมนูมีกลุ่ม แอปพลิเคชัน · ทางลัด · เพิ่มเติม (${groups.join(' / ')})`,
    groups.includes('แอปพลิเคชัน') && groups.includes('ทางลัด') && groups.includes('เพิ่มเติม'),
    groups.join(' / '));
  bad('ไม่มีกลุ่ม "ช่วยเหลือ" แยกออกมาอีกกลุ่ม', !groups.includes('ช่วยเหลือ'), groups.join(' / '));

  // tooltip ของทางลัด
  const shortcutTips = await page.evaluate(() => {
    const side = document.getElementById('portal-sidebar');
    const pick = (label) => {
      const a = [...side.querySelectorAll('a')].find((x) => x.innerText.trim() === label);
      return a ? a.getAttribute('title') : null;
    };
    const onb = [...side.querySelectorAll('button')].find((x) => x.innerText.includes('พอร์ทัลปฐมนิเทศ'));
    return { erp: pick('ERP'), zoom: pick('Zoom'), onboarding: onb ? onb.getAttribute('title') : null };
  });
  happy('tooltip ERP เป็นข้อความของเขา',
    shortcutTips.erp === 'ไปที่ระบบ Mango ERP — สำหรับคำขอซื้อ คำขอเบิกเงินสด และธุรกรรมเชิงตัวเลขอื่น ๆ',
    String(shortcutTips.erp).slice(0, 50));
  happy('tooltip Zoom เป็นข้อความของเขา', shortcutTips.zoom === 'เข้าร่วมประชุมผ่าน Zoom', String(shortcutTips.zoom));
  happy('เมนู "พอร์ทัลปฐมนิเทศ" อยู่ในกลุ่มเพิ่มเติม พร้อม tooltip ของเขา',
    shortcutTips.onboarding === 'การปฐมนิเทศและต้อนรับพนักงานใหม่', String(shortcutTips.onboarding));

  // ตัวนับนับแอปหลัก 6 ตัว เหมือน apps.length ของเขา
  happy(`ตัวนับเท่ากับจำนวนแอปหลัก (${await appCount()} = 6)`, (await appCount()) === 6, `${await appCount()}`);

  // ป้ายบทบาทตามของเขา: พนักงาน / แอดมิน / ผู้เยี่ยมชม
  happy('ป้ายบทบาทของผู้ดูแลคือ "แอดมิน"', t.includes('แอดมิน'), '');
  bad('ไม่ใช้ป้ายเก่า "ผู้ดูแลระบบ" บนหน้าหลัก', !t.includes('ผู้ดูแลระบบ'), '');

  // นาฬิกา: "วันอาทิตย์ที่ 27 ก.ย. · 11:51" — มีชื่อวัน ไม่มีวินาที
  happy('วันที่/เวลาเป็นรูปแบบของเขา (ชื่อวัน + เดือนย่อ + เวลา)',
    /วัน\S+ที่ \d{1,2} \S+ · \d{2}:\d{2}/.test(t), (t.match(/วัน\S+ที่[^\n]*/) || [''])[0].slice(0, 40));
  bad('เวลาไม่มีวินาทีวิ่ง', !/· \d{2}:\d{2}:\d{2}/.test(t), '');

  // ปุ่มบนการ์ดมีลูกศรต่อท้าย "เปิดใช้งาน"
  const hasArrow = await page.evaluate(() => {
    const main = document.querySelector('main');
    const card = main && [...main.querySelectorAll('button')].find((b) => b.innerText.includes('มาตรฐานการปฏิบัติงาน'));
    if (!card) return false;
    const cta = [...card.querySelectorAll('span')].find((s) => s.innerText.trim().startsWith('เปิดใช้งาน'));
    return !!cta && !!cta.querySelector('svg');
  });
  happy('"เปิดใช้งาน" มีลูกศร SVG ต่อท้าย', hasArrow, '');
  await shot('02-ตรงกับระบบจริง');
}

// ── 3. ค้นหาแอป ──────────────────────────────────────────────────────────
suite('3. ค้นหาแอปแล้วรายการแคบลงจริง');
{
  const before = await appCount();
  happy('มีช่องค้นหาแอป', await typeSearch('ประชุม'), '');
  await settle(1200);
  const after = await appCount();
  happy(`ค้นแล้วเหลือน้อยลง (${before} → ${after})`, before > 0 && after > 0 && after < before, `${before} → ${after}`);
  happy('ผลที่เหลือคือแอปที่ค้น', (await body()).includes('รายงานการประชุม'), '');
  await shot('03-ค้นหาแอป');

  await typeSearch('ไม่มีแอปชื่อนี้แน่นอน');
  await settle(1200);
  happy('ค้นไม่เจอแล้วบอกด้วยคำของเขา', (await body()).includes('ไม่พบแอปพลิเคชันที่ค้นหา'), '');
  await shot('04-ค้นไม่เจอ');
  await typeSearch('');
  await settle(1000);
}

// ── 4. เปิดแอปจากหน้าหลัก ────────────────────────────────────────────────
suite('4. กดการ์ดแล้วเข้าแอปได้จริง');
{
  const went = await page.evaluate(() => {
    const card = [...document.querySelectorAll('button, a')].find((x) => x.innerText.includes('มาตรฐานการปฏิบัติงาน'));
    if (card) { card.click(); return true; } return false;
  });
  happy('กดการ์ดแอปได้', went, '');
  await settle(3000);
  happy('เข้าไปถึงหน้าแอปจริง', page.url().includes('/sop'), page.url());
  await shot('05-เข้าแอป');
  await as(A);
}

// ── 5. แผงประกาศ ─────────────────────────────────────────────────────────
suite('5. แผงประกาศขึ้นเสมอ และประกาศที่ปักหมุดขึ้นเป็นแถบให้อ่าน');
{
  // ยังไม่มีประกาศ — แผงต้องยังอยู่ พร้อมบอกว่าไม่มี
  const t0 = await body();
  happy('ไม่มีประกาศก็ยังเห็นแผง "ประกาศ"', t0.includes('ประกาศ'), '');
  happy('บอกว่ายังไม่มีประกาศด้วยคำของเขา', t0.includes('ยังไม่มีประกาศในขณะนี้'), '');
  await shot('06-ประกาศว่าง');

  await query(
    `insert into announcements (title, body, pinned, is_active, starts_at)
     values ($1, $2, true, true, now() - interval '1 day')`,
    [`${MARK} ประกาศทดสอบ`, 'ทดสอบการแสดงประกาศบนหน้าหลัก']);
  await as(A);
  const t = await body();
  happy('ประกาศที่ปักหมุดขึ้นบนหน้าหลัก', t.includes(`${MARK} ประกาศทดสอบ`), t.slice(0, 100).replace(/\n/g, ' | '));
  bad('มีประกาศแล้วไม่บอกว่า "ยังไม่มีประกาศ"', !t.includes('ยังไม่มีประกาศในขณะนี้'), '');
  await shot('07-ประกาศ');

  const dismissed = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '').includes('ปิดแถบประกาศ'));
    if (b) { b.click(); return true; } return false;
  });
  happy('มีปุ่มปิดแถบประกาศ', dismissed, '');
  await settle(1200);
  // ปิดแล้วประกาศย้ายลงไปอยู่ในการ์ดด้านล่างตามที่ออกแบบไว้ — ที่ต้องหายคือ
  // "แถบเด่น" ซึ่งดูจากปุ่มปิดที่อยู่ในแถบนั้น ไม่ใช่ดูจากข้อความทั้งหน้า
  const bannerGone = async () => !(await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') || '').includes('ปิดแถบประกาศ'))));
  bad('ปิดแล้วแถบเด่นหายไปจริง', await bannerGone(), '');
  happy('ประกาศยังอ่านย้อนหลังได้ในการ์ดด้านล่าง', (await body()).includes(`${MARK} ประกาศทดสอบ`), '');
  await shot('08-ปิดประกาศ');

  // ปิดแล้วต้องจำไว้ ไม่ใช่เด้งกลับมาทุกครั้งที่เปิดหน้า
  await page.reload({ waitUntil: 'networkidle2' });
  await settle(2600);
  bad('เปิดหน้าใหม่แล้วแถบที่ปิดไปไม่เด้งกลับมา', await bannerGone(), '');
  await shot('09-เปิดใหม่');
  await clean();
}

// ── 6. ปฏิทินวันหยุด ─────────────────────────────────────────────────────
suite('6. ปฏิทินวันหยุดเลื่อนเดือนได้');
{
  await as(A);
  const t = await body();
  const hasCal = /มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม/.test(t);
  happy('เห็นปฏิทินบนหน้าหลัก', hasCal, '');
  // อ่านชื่อเดือนจากป้ายในปฏิทินเอง ไม่ใช่จากทั้งหน้า
  const monthNow = () => page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => (b.getAttribute('aria-label') || '').includes('เดือนถัดไป'));
    const label = btn?.previousElementSibling;
    return label ? label.innerText.trim() : '';
  });
  const m1 = await monthNow();
  const moved = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '').includes('เดือนถัดไป'));
    if (b) { b.click(); return true; } return false;
  });
  happy('มีปุ่มเลื่อนไปเดือนถัดไป', moved, '');
  await settle(1000);
  const m2 = await monthNow();
  happy(`กดแล้วเปลี่ยนเดือนจริง (${m1} → ${m2})`, m1 !== '' && m2 !== '' && m1 !== m2, `${m1} → ${m2}`);
  await shot('10-ปฏิทิน');
}

// ── 7. ลาวันนี้ · วันเกิดที่กำลังจะถึง ───────────────────────────────────
suite('7. แผงลาวันนี้และวันเกิดที่กำลังจะถึง');
{
  const leave = await panelText('ลาวันนี้');
  happy('เห็นแผง "ลาวันนี้" (ไม่ใช่ "ใครลาวันนี้")', leave.includes('ลาวันนี้') && !leave.includes('ใครลา'), leave.slice(0, 50).replace(/\n/g, ' | '));
  happy('ไม่มีคนลาก็บอกด้วยคำของเขา',
    leave.includes('วันนี้ไม่มีพนักงานลา') || !leave.includes('ไม่มี'), leave.slice(0, 60).replace(/\n/g, ' | '));

  let bday = await panelText('วันเกิดที่กำลังจะถึง');
  happy('แผงวันเกิดขึ้นแม้ยังไม่มีข้อมูล', bday.includes('วันเกิดที่กำลังจะถึง'), bday.slice(0, 50).replace(/\n/g, ' | '));
  // ทะเบียนวันเกิดชุดเดียวกับระบบจริงถูกนำเข้าแล้ว (35 คน) แผงจึงมีรายชื่อเสมอ
  // ถ้าวันหนึ่งทะเบียนว่าง ต้องกลับไปขึ้นข้อความว่างของเขา — ตรวจทั้งสองทาง
  // ป้ายแผนกขึ้นเป็น "Acct" ไม่ใช่ "ACCT" อย่างระบบจริง (จัดรูปด้วย CSS ค่าที่เก็บ
  // ยังเป็นตัวพิมพ์ใหญ่) — เทียบแบบไม่สนตัวพิมพ์
  happy('แผงวันเกิดมีรายชื่อจากทะเบียนของเขา (หรือขึ้นข้อความว่างของเขา)',
    /(ACCT|ADMIN|FIN|ENG|HR|IT|IC|PUR|SUPPORT)/i.test(bday) || bday.includes('ยังไม่มีวันเกิดที่กำลังจะถึง'),
    bday.slice(0, 80).replace(/\n/g, ' | '));
  await shot('11-วันเกิดว่าง');

  // ใส่วันเกิดชั่วคราว: วันนี้ · พรุ่งนี้ · เมื่อวาน(ของปีก่อน = ไกลสุด)
  const n = await seedBirthdays();
  happy('มีพนักงานให้ทดสอบวันเกิด', n >= 3, `${n} คน`);
  await as(A);
  bday = await panelText('วันเกิดที่กำลังจะถึง');
  happy('ป้าย "วันนี้" ขึ้นในแผงวันเกิด', bday.includes('วันนี้'), bday.slice(0, 120).replace(/\n/g, ' | '));
  happy('ป้าย "พรุ่งนี้" ขึ้นในแผงวันเกิด', bday.includes('พรุ่งนี้'), bday.slice(0, 120).replace(/\n/g, ' | '));
  bad('ไม่ขึ้นข้อความว่างทั้งที่มีข้อมูลแล้ว', !bday.includes('ยังไม่มีวันเกิด'), '');
  const rows = await page.evaluate(() => {
    const h = [...document.querySelectorAll('h3')].find((x) => x.innerText.includes('วันเกิดที่กำลังจะถึง'));
    return h && h.parentElement ? h.parentElement.querySelectorAll('li').length : -1;
  });
  happy(`แสดงไม่เกิน 3 คนที่ใกล้ที่สุด (${rows} แถว)`, rows > 0 && rows <= 3, `${rows}`);
  bad('ไม่มีคำหลุด (NaN / Invalid Date) ในแผงวันเกิด',
    !/NaN|Invalid Date|undefined/.test(bday), bday.slice(0, 80).replace(/\n/g, ' | '));
  await shot('12-วันเกิดมีข้อมูล');
}

// ── 8. กล่องช่วยเหลือ ────────────────────────────────────────────────────
suite('8. กล่องช่วยเหลือเปิดอ่านได้');
{
  happy('กดเมนูช่วยเหลือได้', await click('ช่วยเหลือ / แจ้งปัญหา'), '');
  await settle(1400);
  const t = await body();
  happy('กล่องช่วยเหลือมีเนื้อหาให้อ่าน', t.includes('ช่วยเหลือ') && t.length > 200, '');
  await shot('13-ช่วยเหลือ');
  await page.keyboard.press('Escape');
  await settle(900);
}

// ── 9. คนละบทบาทเห็นแอปไม่เท่ากัน ────────────────────────────────────────
suite('9. ผู้บริหารเห็นเฉพาะแอปที่ตัวเองเข้าได้');
{
  await as(C);
  const t = await body();
  happy('ผู้บริหารเปิดหน้าหลักได้', !t.includes('เกิดข้อผิดพลาดบางอย่าง'), t.slice(0, 60).replace(/\n/g, ' | '));
  happy('ยังเห็นรายการแอป', /\d+ รายการ/.test(t), '');
  happy('ป้ายบทบาทที่ไม่ใช่แอดมินคือ "พนักงาน"', t.includes('พนักงาน'), '');
  bad('ไม่เห็นเมนูผู้ดูแลระบบ', !t.includes('ผู้ดูแลระบบ') || !t.includes('จัดการผู้ใช้'), '');
  await shot('14-ผู้บริหาร');
}

// ── 10. ไม่มีข้อผิดพลาดซ่อนอยู่ ──────────────────────────────────────────
suite('10. ไม่มีข้อผิดพลาดซ่อนอยู่');
{
  bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' / '));
}

// ── 11. เก็บกวาด ─────────────────────────────────────────────────────────
suite('11. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await clean();
  const left = (await query('select count(*)::int n from announcements where title like $1', [`${MARK}%`])).rows[0].n;
  happy('ลบประกาศทดสอบหมดแล้ว', left === 0, `${left}`);
  await restoreBirthdays();
  const stillSet = (await query(
    'select count(*)::int n from employees where id = any($1::uuid[]) and birth_date is not null',
    [bdaySeeded.filter((r) => !r.birth_date).map((r) => r.id)])).rows[0].n;
  happy('คืนค่าวันเกิดเดิมให้พนักงานแล้ว', stillSet === 0, `${stillSet} คนยังค้างอยู่`);
}

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
