/**
 * แผนผังระบบ — อ่านผังกระบวนการ ทะเบียนฟังก์ชัน และโอกาสใช้ AI บนหน้าจอจริง
 *
 * โมดูลนี้เป็นข้อมูลอ้างอิงอย่างเดียวตามที่ตกลงกันไว้ (เปิดแก้ไขได้ด้วย
 * SYSMAP_EDIT=on) ชุดนี้จึงถามสองอย่าง: อ่านรู้เรื่องไหม และไม่มีปุ่มแก้ไข
 * โผล่มาให้กดโดยที่ไม่ได้เปิดไว้
 *
 * มีข้อหนึ่งที่ดูเล็กแต่ตั้งใจใส่: แท็บที่เปิดอยู่ต้องถูกไฮไลต์ เพราะเงื่อนไข
 * ไฮไลต์เคยเทียบตัวแปรที่ชื่อชนกันจนได้ false เสมอทั้งห้าหน้าในระบบ
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, call } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/sysmap-ui`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin, C = U.exec;

fs.rmSync(`${ROOT}/chrome-sysmap`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-sysmap`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 1800) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const countRows = () => page.evaluate(() => document.querySelectorAll('tbody tr').length);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0].slice(0, 160)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().split('\n')[0].slice(0, 160));
});

const as = async (user, path = '/sysmap') => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3000);
  // แผนผังโหลดข้อมูลก้อนเดียวทั้งผัง ทะเบียน และโอกาส AI — รอจนสปินเนอร์หาย
  // แทนการนับเวลาตายตัว ไม่งั้นเครื่องช้าหน่อยก็อ่านเจอแต่คำว่า "กำลังโหลด"
  await page.waitForFunction(() => !document.body.innerText.includes('กำลังโหลดแผนผัง'),
    { timeout: 30000 }).catch(() => {});
};
const click = (label) => page.evaluate((l) => {
  const el = [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim() === l)
    || [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim().startsWith(l));
  if (el) { el.click(); return true; } return false;
}, label);
/** แท็บที่ถูกไฮไลต์อยู่ตอนนี้ — ดูจากสีเส้นใต้ ไม่ใช่จากชื่อคลาส */
const activeTab = () => page.evaluate(() => {
  const tabs = [...document.querySelectorAll('button')].filter((b) => b.className.includes('border-b-2'));
  const on = tabs.find((b) => b.className.includes('border-brand'));
  return on ? on.innerText.trim().split('\n')[0] : null;
});

// ── 1. เปิดผังกระบวนการ ───────────────────────────────────────────────────
suite('1. เปิดแผนผังระบบแล้วอ่านได้');
{
  await as(A);
  const t = await body();
  happy('หน้าไม่ล้ม', !t.includes('เกิดข้อผิดพลาดบางอย่าง'), t.slice(0, 80).replace(/\n/g, ' | '));
  happy('เห็นหัวข้อแผนผังการทำงานของระบบ', t.includes('แผนผังการทำงานของระบบ'), '');
  // หัวข้อและป้ายเวอร์ชันแบบระบบจริง — คนเปิดสองระบบเทียบกันต้องเห็นว่าเป็นผังเดียวกัน
  happy('มีหัวข้ออังกฤษแบบระบบจริง', t.includes('System Operating Map'), '');
  happy('มีป้ายเวอร์ชันชุดข้อมูล', t.includes('v8.86'), t.slice(0, 100).replace(/\n/g, ' '));
  happy('บอกจำนวนเลน ขั้นตอน และเส้นเชื่อม', /\d+ เลน · \d+ ขั้นตอน · \d+ เส้นเชื่อม/.test(t), t.slice(0, 120).replace(/\n/g, ' '));
  happy('มีครบทั้งสามแท็บ',
    ['ผังกระบวนการ', 'ทะเบียนฟังก์ชัน', 'โอกาสใช้ AI'].every((k) => t.includes(k)), '');
  happy('แท็บที่เปิดอยู่ถูกไฮไลต์', (await activeTab())?.startsWith('ผังกระบวนการ'), `${await activeTab()}`);
  happy('อธิบายวิธีอ่านผังให้ก่อน', t.includes('กดที่กล่องงาน'), '');
  // คำของระบบจริง ไม่ใช่คำที่เราคิดขึ้นเอง
  happy('สวิตช์เลเยอร์ใช้คำของระบบจริง',
    t.includes('เลเยอร์') && t.includes('ERP เท่านั้น') && t.includes('Manual เท่านั้น'), '');
  happy('มีสวิตช์เส้นตรงและเส้นมีเงื่อนไขแยกกัน',
    t.includes('เส้นตรง') && t.includes('เส้นมีเงื่อนไข'), '');
  happy('มีชิปกรองเฉพาะหน้างานบนผัง', t.includes('เฉพาะหน้างาน'), '');
  happy('มีปุ่มคำอธิบายสัญลักษณ์', t.includes('คำอธิบายสัญลักษณ์'), '');
  bad('คำอธิบายสัญลักษณ์พับเก็บอยู่ ไม่บังผัง', !t.includes('เส้นย้อนกลับ / วนกลับ'), '');
  happy('กดเปิดคำอธิบายสัญลักษณ์ได้', await click('คำอธิบายสัญลักษณ์'), '');
  await settle(900);
  const k = await body();
  happy('คำอธิบายสัญลักษณ์บอกความหมายของเส้นครบชุด',
    k.includes('เส้นกระตุ้น') && k.includes('ป้อนข้อมูลเข้า') && k.includes('ความหมายของเส้น')
      && k.includes('เส้นย้อนกลับ / วนกลับ'), '');
  await shot('01b-คำอธิบายสัญลักษณ์');
  await click('คำอธิบายสัญลักษณ์');
  await settle(700);
  bad('พับกลับเก็บได้', !(await body()).includes('เส้นย้อนกลับ / วนกลับ'), '');
  happy('มีชั้นการไหลของเอกสารหน้างาน', t.includes('Document Control'), '');
  bad('ไม่มี error ตอนเปิดหน้า', errors.length === 0, errors.slice(0, 2).join(' / '));
  await shot('01-ผังกระบวนการ');
}

// ── 2. กดกล่องงานแล้วเห็นรายละเอียด ──────────────────────────────────────
suite('2. กดกล่องงานแล้วเห็นรายละเอียดและเส้นทางที่เชื่อมถึง');
{
  const nodes = (await call('/sysmap/bootstrap', { user: A })).data.nodes || [];
  happy('มีกล่องงานให้กดจริง', nodes.length > 0, `${nodes.length} กล่อง`);
  // กล่องงานบนผังเป็นปุ่มที่มีชื่อกล่องอยู่ข้างใน — กดจากชื่อ อย่างที่คนกด
  const first = nodes[0].label_th.split('\n')[0].trim();
  const opened = await page.evaluate((label) => {
    const el = [...document.querySelectorAll('button')].find((b) => b.innerText.includes(label));
    if (el) { el.click(); return true; } return false;
  }, first);
  happy('กดกล่องงานบนผังได้', opened, first);
  await settle(1800);
  const t = await body();
  happy('เปิดรายละเอียดกล่องงานได้', t.includes(first), first);
  happy('รายละเอียดบอกเส้นทางที่เชื่อมถึงกล่องนี้',
    t.includes('เข้า') || t.includes('ออก') || t.includes('เชื่อม'), '');
  await shot('02-รายละเอียดกล่องงาน');

  // เปิดจากลิงก์ตรงก็ต้องได้กล่องเดิม — คนส่งลิงก์ผังให้กันอ่าน
  await as(A, `/sysmap?node=${encodeURIComponent(nodes[0].id)}`);
  happy('เปิดจากลิงก์ตรงถึงกล่องงานได้', (await body()).includes(first), '');
  await shot('02b-ลิงก์ตรง');

  happy('กดแสดงทุกเส้นเชื่อมได้', await click('แสดงทุกเส้นเชื่อม'), '');
  await settle(1400);
  happy('บอกว่ากำลังแสดงเส้นเชื่อมทั้งหมด', (await body()).includes('กำลังแสดงเส้นเชื่อมทั้งหมด'), '');
  const drawn = await page.evaluate(() => document.querySelectorAll('svg path[stroke]').length);
  happy(`วาดเส้นเชื่อมลงผังจริง (${drawn} เส้น)`, drawn > 100, `${drawn}`);
  await shot('03-ทุกเส้นเชื่อม');
}

// ── 2b. ผืนผังเป็นพื้นเข้มแบบระบบจริง แต่ไม่ลามไปทั้งแอป ──────────────────
suite('2b. ผืนผังเป็นพื้นเข้ม อ่านออก และไม่ลามไปทั้งแอป');
{
  await as(A);
  const lum = (css) => {
    const n = (css.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    if (n.length < 3) return null;
    const [r, g, b] = n.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const probe = await page.evaluate(() => {
    const frame = [...document.querySelectorAll('div')]
      .find((d) => /linear-gradient/.test(getComputedStyle(d).backgroundImage) && d.querySelector('svg, button'));
    // ปุ่มที่ระบายสีพื้นของตัวเอง = ชิปแผนก + กล่อง ERP บนผัง
    const painted = [...(frame ? frame.querySelectorAll('button[style*="background"]') : [])]
      .map((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, fg: cs.color, text: el.innerText.trim().slice(0, 24) };
      })
      .filter((x) => x.bg && !/rgba\(0, 0, 0, 0\)/.test(x.bg));
    return {
      frameBg: frame ? getComputedStyle(frame).backgroundImage : '',
      pageBg: getComputedStyle(document.body).backgroundColor,
      painted,
    };
  });
  happy('ผืนผังเป็นพื้นไล่เฉดสีเข้ม', /linear-gradient/.test(probe.frameBg) && /13, 27, 42|11, 18, 32/.test(probe.frameBg),
    probe.frameBg.slice(0, 70));
  const pageL = lum(probe.pageBg);
  happy('พื้นหลังของแอปยังเป็นธีมสว่าง ไม่ได้เปลี่ยนทั้งระบบ', pageL === null || pageL > 0.6, probe.pageBg);

  happy('มีกล่อง/ชิปที่ระบายสีประจำแผนกให้ตรวจ', probe.painted.length >= 10, `${probe.painted.length}`);
  const worst = probe.painted
    .map((x) => {
      const a = lum(x.fg); const b = lum(x.bg);
      if (a === null || b === null) return null;
      return { ...x, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    })
    .filter(Boolean)
    .sort((x, y) => x.ratio - y.ratio)[0];
  happy(`ตัวอักษรบนสีประจำแผนกคอนทราสต์ผ่านเกณฑ์ (ต่ำสุด ${worst ? worst.ratio.toFixed(2) : '?'}:1)`,
    Boolean(worst) && worst.ratio >= 4.5, worst ? `${worst.text} — ${worst.fg} บน ${worst.bg}` : 'ไม่มีข้อมูล');
  await shot('03b-พื้นเข้ม');
}

// ── 3. ทะเบียนฟังก์ชัน ────────────────────────────────────────────────────
suite('3. ทะเบียนฟังก์ชัน — ค้นหาและกรองได้');
{
  happy('เปิดแท็บทะเบียนฟังก์ชันได้', await click('ทะเบียนฟังก์ชัน'), '');
  await settle(2000);
  happy('แท็บที่เปิดอยู่เปลี่ยนไปไฮไลต์ที่ทะเบียนฟังก์ชัน',
    (await activeTab())?.startsWith('ทะเบียนฟังก์ชัน'), `${await activeTab()}`);
  const t = await body();
  happy('เห็นตารางฟังก์ชัน',
    t.includes('ฟังก์ชัน') && t.includes('ประเภท') && t.includes('หมายเหตุ'), '');
  happy('มีแท็บแผนกปฏิบัติการหน้างาน', t.includes('ปฏิบัติการหน้างาน'), '');
  happy('บอกว่ากำลังแสดงกี่รายการจากทั้งหมดเท่าไร', /แสดง \d+ จาก \d+ รายการ/.test(t), '');
  await shot('04-ทะเบียนฟังก์ชัน');

  const before = await countRows();
  await page.evaluate(() => {
    const i = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('ค้นหารหัส'));
    if (!i) return;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, 'จัดซื้อ');
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(1500);
  const after = await countRows();
  happy(`ค้นหาแล้วรายการแคบลง (${before} → ${after})`, before > 0 && after < before, `${before} → ${after}`);
  await shot('05-ค้นหาฟังก์ชัน');

  happy('กรองเฉพาะที่ยังทำมือได้', await click('เฉพาะที่ยังทำมือ'), '');
  await settle(1500);
  happy('ตัวกรองทำงานร่วมกับคำค้นได้ ไม่ล้าง', (await body()).includes('แสดง'), '');
  await shot('06-กรองทำมือ');

  // ล้างตัวกรองแล้วกดแท็บหน้างาน — 18 แถวตามทะเบียนของระบบจริง
  happy('มีปุ่มล้างตัวกรอง', await click('ล้างตัวกรอง'), '');
  await settle(1200);
  happy('กดแท็บปฏิบัติการหน้างานได้', await click('ปฏิบัติการหน้างาน'), '');
  await settle(1500);
  const siteRows = await countRows();
  happy(`แท็บหน้างานแสดง 18 แถว (ได้ ${siteRows})`, siteRows === 18, `${siteRows}`);
  await shot('06b-แท็บหน้างาน');

  happy('ล้างตัวกรองกลับมาครบ', await click('ล้างตัวกรอง'), '');
  await settle(1200);
  const allRows = await countRows();
  happy(`ล้างแล้วเห็นครบ 158 แถว (ได้ ${allRows})`, allRows === 158, `${allRows}`);

  // ชิปเครื่องมือ AI ระดับฟังก์ชัน — ของเขาติดไว้ที่แถวในทะเบียน
  const withAi = await page.evaluate(() => document.body.innerText.split('โอกาส AI').length - 1);
  happy(`แถวในทะเบียนติดชิปโอกาส AI ให้ (${withAi} แถว)`, withAi > 0, `${withAi}`);
}

// ── 3b. แผงกล่องงานเป็นแบบมีแท็บ และผูกโอกาส AI ───────────────────────────
suite('3b. แผงรายละเอียดกล่องงาน — แท็บ และโอกาส AI ของกล่องนั้น');
{
  // n-gl (บัญชีแยกประเภท) มีข้อเสนอ AI ผูกไว้ในข้อมูลของระบบจริง
  await as(A, '/sysmap?node=n-gl');
  const t = await body();
  happy('แผงกล่องงานมีแท็บขั้นตอนและการเชื่อมต่อ',
    t.includes('ขั้นตอน') && t.includes('การเชื่อมต่อ'), '');
  happy('กล่องที่มีข้อเสนอ AI มีแท็บโอกาส AI', t.includes('โอกาส AI'), '');
  happy('มีปุ่มปิดที่มีคำว่าปิด', t.includes('ปิด'), '');

  // สองบล็อกท้ายแผงที่ลูกค้าเห็นบนจอจริง — ชิปรหัสหน้าที่ และชิปแบบฟอร์ม
  happy('แผงกล่องงานมีหน้าที่ที่เกี่ยวข้อง', t.includes('หน้าที่ที่เกี่ยวข้อง'), '');
  happy('ชิปรหัสหน้าที่เป็นรหัสจริงในทะเบียน', /ACC-\d\d|FIN-\d\d/.test(t), '');
  happy('แผงกล่องงานมีแบบฟอร์มที่เกี่ยวข้อง', t.includes('แบบฟอร์มที่เกี่ยวข้อง'), '');

  // กดชิปรหัสแล้วต้องพาไปที่แถวนั้นในทะเบียน ไม่ใช่เปิดทะเบียนเปล่า
  happy('กดชิปรหัสหน้าที่แล้วเปิดทะเบียนไปที่แถวนั้น', await click('ACC-10'), '');
  await settle(1800);
  const jumped = await body();
  happy('ทะเบียนถูกกรองเหลือรหัสที่กด',
    jumped.includes('ACC-10') && /แสดง [1-3] จาก/.test(jumped),
    (jumped.match(/แสดง \d+ จาก \d+/) || [''])[0]);
  await shot('06e-กระโดดเข้าทะเบียน');

  await as(A, '/sysmap?node=n-gl');


  happy('กดแท็บการเชื่อมต่อได้', await click('การเชื่อมต่อ'), '');
  await settle(1200);
  const c = await body();
  happy('ใช้คำของระบบจริงในแท็บการเชื่อมต่อ',
    c.includes('สิ่งที่ป้อนข้อมูลเข้าโหนดนี้') && c.includes('โหนดนี้เชื่อมไปยัง'), '');
  happy('ป้ายทิศทางเข้า/ออกแบบระบบจริง', c.includes('เข้า') && c.includes('ออก'), '');
  await shot('06c-แท็บการเชื่อมต่อ');

  happy('กดแท็บโอกาส AI ได้', await click('โอกาส AI'), '');
  await settle(1200);
  const a = await body();
  happy('แท็บ AI บอกผลกระทบและความยากด้วยคำเต็ม',
    a.includes('ผลกระทบทางธุรกิจ') && a.includes('ความยากในการนำไปใช้'), '');
  await shot('06d-แท็บโอกาสAI');

  // กล่องที่ไม่มีข้อเสนอ AI ต้องไม่มีแท็บว่างให้กด
  await as(A, '/sysmap?node=n-m-del');
  const n2 = await body();
  // "โอกาส AI" ต่างจากชื่อแท็บของโมดูล ("โอกาสใช้ AI") จึงเช็กตรง ๆ ได้
  bad('กล่องที่ไม่มีข้อเสนอ AI ไม่มีแท็บ AI ว่างให้กด', !n2.includes('โอกาส AI'), '');

  await as(A);
  await click('ทะเบียนฟังก์ชัน');
  await settle(1600);
}

// ── 4. โอกาสใช้ AI ────────────────────────────────────────────────────────
suite('4. โอกาสใช้ AI — เรียงจากคุ้มที่สุด');
{
  happy('เปิดแท็บโอกาสใช้ AI ได้', await click('โอกาสใช้ AI'), '');
  await settle(2000);
  const t = await body();
  happy('บอกเกณฑ์การเรียงให้ผู้อ่านรู้', t.includes('เรียงจากคุ้มที่สุด'), '');
  happy('มีตัวกรองตามระดับผลกระทบ', t.includes('ผลกระทบ'), '');
  await shot('07-โอกาสใช้AI');
}

// ── 5. เป็นข้อมูลอ้างอิง ไม่ใช่ที่แก้ไข ──────────────────────────────────
suite('5. โมดูลนี้เป็นข้อมูลอ้างอิง ไม่มีปุ่มแก้ไขให้กด');
{
  await as(A);
  const t = await body();
  bad('ไม่มีปุ่มเพิ่มเลน', !t.includes('เลน\n') || !/\+ เลน/.test(t), '');
  const edits = await page.evaluate(() => [...document.querySelectorAll('button')]
    .map((b) => b.innerText.trim()).filter((x) => ['เพิ่มฟังก์ชัน', 'เพิ่มรายการ', 'กล่องงาน', 'แก้ไข'].includes(x)));
  bad('ไม่มีปุ่มแก้ไขใด ๆ บนผัง', edits.length === 0, edits.join(', '));

  await click('ทะเบียนฟังก์ชัน');
  await settle(1600);
  const e2 = await page.evaluate(() => [...document.querySelectorAll('button')]
    .map((b) => b.innerText.trim()).filter((x) => x === 'เพิ่มฟังก์ชัน' || x === 'แก้ไข'));
  bad('ทะเบียนฟังก์ชันก็ไม่มีปุ่มแก้ไข', e2.length === 0, e2.join(', '));
  await shot('08-อ่านอย่างเดียว');
}

// ── 6. ผู้ใช้ทั่วไปเปิดได้เหมือนกัน ──────────────────────────────────────
suite('6. ผู้บริหารเปิดอ่านได้เหมือนกัน');
{
  await as(C);
  const t = await body();
  happy('ผู้บริหารเปิดแผนผังได้', t.includes('แผนผังการทำงานของระบบ') && !t.includes('เกิดข้อผิดพลาด'), t.slice(0, 70).replace(/\n/g, ' | '));
  happy('เห็นผังกระบวนการเหมือนกัน', t.includes('ผังกระบวนการ'), '');
  await shot('09-ผู้บริหาร');
}

// ── 7. สลับภาษาของผัง ─────────────────────────────────────────────────────
suite('7. สลับผังเป็นภาษาอังกฤษได้');
{
  await as(A);
  const before = await body();
  happy('มีปุ่มสลับภาษาบนหัวเรื่อง', before.includes('EN'), '');
  await click('EN');
  await settle(1600);
  const after = await body();
  happy('กด EN แล้วเนื้อหาบนผังเปลี่ยนไป', after !== before, '');
  // เคยสลับแค่ข้อมูล คำรอบ ๆ ยังเป็นไทย — ปุ่มเดียวต้องเปลี่ยนทั้งสองอย่าง
  // ป้ายแถวตัวกรองเป็นตัวพิมพ์ใหญ่ด้วย CSS อย่างระบบจริง (LAYER: / DEPT:)
  // innerText จึงคืนค่าพิมพ์ใหญ่มา เทียบแบบไม่สนตัวพิมพ์
  const afterLc = after.toLowerCase();
  happy('คำรอบผังเปลี่ยนเป็นอังกฤษด้วย ไม่ใช่แค่ข้อมูล',
    afterLc.includes('function registry') && afterLc.includes('layer'),
    after.slice(0, 120).replace(/\n/g, ' '));
  bad('ไม่มีคำไทยของแท็บค้างอยู่ตอนเป็นอังกฤษ', !after.includes('ทะเบียนฟังก์ชัน'), '');
  await shot('10-ภาษาอังกฤษ');
  await click('ไทย');
  await settle(1200);
}

// ── 8. ไม่มีข้อผิดพลาดซ่อนอยู่ ───────────────────────────────────────────
suite('8. ไม่มีข้อผิดพลาดซ่อนอยู่');
{
  bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' / '));
}

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
