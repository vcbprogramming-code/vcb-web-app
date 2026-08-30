/**
 * Screenshots for the client's test manual.
 *
 * Every picture is one step of one test case, with the thing to click ringed in
 * red and everything else dimmed — a manual that says "click the file column"
 * and then shows an undifferentiated screen makes the reader hunt.
 *
 *   API=http://localhost:4000/api APP=http://localhost:5173 node tests/tools/manual-shots.mjs
 *
 * Writes .out/manual3/<key>.png|jpg and a shots.json of base64 JPEGs, which the
 * manual generator inlines.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer-core';
import { U, APP, tok, query } from '../harness.mjs';

/** รหัสพนักงานชั่วคราวสำหรับภาพตัวอย่างการนำเข้า — ลบทิ้งเมื่อถ่ายเสร็จ */
const TMP = 'ZZMAN';

const ROOT = fileURLToPath(new URL('../.out', import.meta.url));
const OUT = `${ROOT}/manual3`;
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-man3`,
  defaultViewport: { width: 1360, height: 900 },
  args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
const settle = (ms = 1600) => new Promise((r) => setTimeout(r, ms));

const as = async (user, path = '/performance') => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(3200);
};
const clickText = (label, sel = 'button, a, [role="tab"], label') => page.evaluate((l, s) => {
  const el = [...document.querySelectorAll(s)].find((x) => x.innerText.trim().includes(l));
  if (el) { el.click(); return true; } return false;
}, label, sel);
const pickSite = (name = 'โครงการสาธิต') => page.evaluate((n) => {
  const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.text.includes(n)));
  if (!sel) return false;
  const opt = [...sel.options].find((o) => o.text.includes(n));
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, name);

/**
 * Ring one element and dim the rest. The dimming is a 9999px box-shadow around
 * a transparent rectangle, so the element itself is never covered and stays as
 * crisp as the reader will see it on their own screen.
 */
const HL = '__manual_hl__';
const clearMark = () => page.evaluate((id) => { document.querySelectorAll(`.${id}`).forEach((n) => n.remove()); }, HL);
async function mark(find, label, { pad = 6, center = true } = {}) {
  await clearMark();
  const ok = await page.evaluate(({ id, src, label: cap, pad: p, center: c }) => {
    // eslint-disable-next-line no-new-func
    const el = new Function(`return (${src})`)()();
    if (!el) return false;
    if (c) el.scrollIntoView({ block: 'center', inline: 'center' });
    return new Promise((resolve) => setTimeout(() => {
      const r = el.getBoundingClientRect();
      const box = document.createElement('div');
      box.className = id;
      Object.assign(box.style, {
        position: 'fixed', left: `${r.left - p}px`, top: `${r.top - p}px`,
        width: `${r.width + p * 2}px`, height: `${r.height + p * 2}px`,
        border: '2px solid #ef4444', borderRadius: '10px', zIndex: 99998,
        boxShadow: '0 0 0 9999px rgba(241,245,249,.74)', pointerEvents: 'none',
      });
      document.body.appendChild(box);
      if (cap) {
        const tag = document.createElement('div');
        tag.className = id;
        tag.textContent = cap;
        const above = r.top > 46;
        Object.assign(tag.style, {
          position: 'fixed', left: `${Math.max(8, r.left - p)}px`,
          top: above ? `${r.top - p - 30}px` : `${r.bottom + p + 8}px`,
          background: '#ef4444', color: '#fff', font: '600 13px/1.5 system-ui, sans-serif',
          padding: '3px 10px', borderRadius: '8px', zIndex: 99999, pointerEvents: 'none',
          maxWidth: '520px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        });
        document.body.appendChild(tag);
      }
      resolve(true);
    }, c ? 350 : 0));
  }, { id: HL, src: find.toString(), label, pad, center });
  if (!ok) console.log(`  ⚠ ไม่พบเป้าหมาย: ${label}`);
  return ok;
}

const taken = [];
async function shoot(key, find, label, opts) {
  if (only.length && !only.some((o) => key.startsWith(o))) return;
  if (find) await mark(find, label, opts);
  await settle(420);
  await page.screenshot({ path: `${OUT}/${key}.png` });
  await clearMark();
  taken.push(key);
  console.log(`  ✓ ${key} · ${label || ''}`);
}
/** Plain shot, nothing ringed — for "this is the result" pictures. */
const plain = (key, note = '') => shoot(key, null, note);

// ═══════════════════════════════════════════════════════════════════════════
const A = U.admin;

// ── 01 บทบาทผู้ใช้ ────────────────────────────────────────────────────────
await as(A, '/settings?s=users');
await shoot('c01-a', () => () => [...document.querySelectorAll('tr')]
  .map((r) => [...r.querySelectorAll('button')].find((b) => b.innerText.trim() === 'แก้ไข'))
  .find(Boolean), 'กด แก้ไข ที่ผู้ใช้รายที่ต้องการ');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('tr')]
    .map((r) => [...r.querySelectorAll('button')].find((x) => x.innerText.trim() === 'แก้ไข')).find(Boolean);
  if (b) b.click();
});
await settle(2200);
await shoot('c01-b', () => () => [...document.querySelectorAll('select')]
  .find((s) => [...s.options].some((o) => o.value === 'recorder')), 'ช่องบทบาท — มีให้เลือกครบ 5 ระดับ');
await clickText('สิทธิ์การใช้งาน');
await settle(1500);
await shoot('c01-c', () => () => [...document.querySelectorAll('div')]
  .find((d) => d.innerText.includes('ตรวจสอบและยืนยันข้อมูล') && d.children.length < 6),
'แท็บสิทธิ์การใช้งาน มีสวิตช์รายโมดูล');

// ── 02 ทะเบียนแผนก/ตำแหน่ง ────────────────────────────────────────────────
await as(A);
await clickText('ตั้งค่า'); await settle(3000);
await shoot('c02-a', () => () => {
  const card = [...document.querySelectorAll('section, div')].find((d) => d.innerText.startsWith('ทะเบียนแผนกและตำแหน่ง'));
  return card && card.querySelector('select');
}, 'เลือกไซต์งานของทะเบียนก่อน');
await shoot('c02-b', () => () => [...document.querySelectorAll('input')]
  .find((i) => (i.placeholder || '').includes('ชื่อแผนกใหม่')), 'พิมพ์ชื่อแผนก แล้วกด + เพิ่ม');
await shoot('c02-c', () => () => [...document.querySelectorAll('input')]
  .find((i) => (i.placeholder || '').includes('ชื่อตำแหน่งใหม่')), 'คลิกแผนกทางซ้ายก่อน จึงเพิ่มตำแหน่งได้');
await shoot('c02-d', () => () => [...document.querySelectorAll('button')]
  .find((b) => b.innerText.trim() === 'ปิดใช้งาน'), 'ปิดใช้งานแทนการลบ เมื่อมีคนผูกอยู่');

// ── 03 นำเข้าพนักงาน ──────────────────────────────────────────────────────
await shoot('c03-a', () => () => [...document.querySelectorAll('button')]
  .find((b) => b.innerText.includes('ดาวน์โหลดไฟล์ตัวอย่าง')), 'ดาวน์โหลดไฟล์ตัวอย่างเพื่อดูชื่อคอลัมน์');
await shoot('c03-b', () => () => [...document.querySelectorAll('button')]
  .find((b) => b.innerText.includes('ตรวจไฟล์ก่อน')), 'ตรวจไฟล์ก่อน — ยังไม่เขียนลงระบบ');
await shoot('c03-c', () => () => [...document.querySelectorAll('button')]
  .find((b) => b.innerText.includes('นำเข้าจริง')), 'เมื่อตรวจแล้วจึงกดนำเข้าจริง');

// นำเข้าจริงสองรายชื่อ เพื่อให้ภาพ "ไปอยู่ตรงไหน" เป็นของจริง ไม่ใช่ภาพจำลอง
// (ลบออกให้เรียบร้อยตอนท้ายไฟล์)
{
  const demo = (await query("select code, name from units where name like 'โครงการสาธิต%' limit 1")).rows[0];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('พนักงาน');
  ws.columns = [{ header: 'รหัสพนักงาน', key: 'code' }, { header: 'ชื่อ-สกุล', key: 'name' },
    { header: 'โครงการ', key: 'site' }, { header: 'ประเภท', key: 'kind' }, { header: 'สถานะ', key: 'status' }];
  ws.addRow({ code: `${TMP}-001`, name: 'สมปอง ตัวอย่างนำเข้า', site: demo.code, kind: 'ปฏิบัติการ', status: 'ปฏิบัติงาน' });
  ws.addRow({ code: `${TMP}-002`, name: 'วิภา ตัวอย่างนำเข้า', site: demo.code, kind: 'สนับสนุน', status: 'ปฏิบัติงาน' });
  const xlsx = `${OUT}/ตัวอย่างนำเข้าพนักงาน.xlsx`;
  await wb.xlsx.writeFile(xlsx);
  const input = await page.$('input[accept=".xlsx"]');
  if (input) await input.uploadFile(xlsx);
  await settle(1200);
  await clickText('นำเข้าจริง');
  await settle(4200);
  await shoot('c03-d', () => () => [...document.querySelectorAll('div')]
    .find((d) => d.innerText.startsWith('รายชื่อที่นำเข้าอยู่ในโครงการเหล่านี้')),
  'หลังนำเข้า — ระบบบอกว่ารายชื่อไปอยู่โครงการไหน');
  await shoot('c03-e', () => () => [...document.querySelectorAll('button')]
    .find((b) => b.innerText.includes('ไปดูรายชื่อพนักงาน')), 'กดเพื่อไปดูรายชื่อที่เพิ่งเพิ่มได้ทันที');
}

// ── 04 บันทึกแรงงาน-วันรายคน ──────────────────────────────────────────────
await as(A);
await shoot('c04-a', () => () => [...document.querySelectorAll('select')]
  .find((x) => [...x.options].some((o) => o.text.includes('โครงการสาธิต'))), 'เลือกไซต์งานก่อนเสมอ');
await pickSite(); await settle(1800);
await shoot('c04-b', () => () => [...document.querySelectorAll('button')]
  .find((b) => b.innerText.trim() === 'แรงงาน-วัน'), 'เปิดแท็บ แรงงาน-วัน');
await clickText('แรงงาน-วัน'); await settle(3000);
await shoot('c04-c', () => () => document.querySelector('input[type=date]'), 'เลือกวันที่ปฏิบัติงาน');
await shoot('c04-d', () => () => {
  const i = document.querySelector('table tbody input[type=number]');
  return i && i.closest('tr');
}, 'กรอกแรงงาน-วัน แล้วเลือกสถานะการทำงาน');

// ── 05 บันทึกทั้งทีม ──────────────────────────────────────────────────────
await shoot('c05-a', () => () => [...document.querySelectorAll('button')]
  .find((b) => b.innerText.includes('เลือกทั้งหมด')), 'กดเลือกทั้งหมด หรือติ๊กเฉพาะบางคน');
await clickText('เลือกทั้งหมด'); await settle(900);
await shoot('c05-b', () => () => [...document.querySelectorAll('div')]
  .find((d) => d.innerText.startsWith('บันทึกทั้งทีม')), 'ตั้งค่าที่จะใช้กับทุกคนที่เลือก');
await shoot('c05-c', () => () => [...document.querySelectorAll('button')]
  .find((b) => b.innerText.includes('บันทึกให้ทุกคนที่เลือก')), 'กดบันทึกครั้งเดียวจบ');
await clickText('บันทึกให้ทุกคนที่เลือก'); await settle(4000);
await shoot('c05-d', () => () => document.querySelector('table tbody'),
  'หลังบันทึก — ช่องแรงงาน-วันของทุกคนที่เลือกขึ้นค่าใหม่ครบ', { pad: 2 });

// ── 07 แนบไฟล์ เปิดดู และดาวน์โหลด ────────────────────────────────────────
await shoot('c07-a', () => () => [...document.querySelectorAll('th')]
  .find((h) => h.innerText.includes('ไฟล์ประกอบ')), 'คอลัมน์ไฟล์ประกอบ อยู่ท้ายแถว');
await shoot('c07-b', () => () => [...document.querySelectorAll('table tbody label')]
  .find((l) => ['แนบ', '+'].includes(l.innerText.trim())), 'กด แนบ เพื่อเลือกไฟล์');
await shoot('c07-c', () => () => [...document.querySelectorAll('table tbody button')]
  .find((b) => /^\d+$/.test(b.innerText.trim())), 'กดที่ตัวเลข เพื่อเปิดรายการไฟล์ที่แนบไว้');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('table tbody button')].find((x) => /^\d+$/.test(x.innerText.trim()));
  if (b) b.click();
});
await settle(900);
await shoot('c07-d', () => () => {
  const dl = [...document.querySelectorAll('button')].find((b) => b.title === 'ดาวน์โหลด');
  return dl && dl.parentElement.parentElement;
}, 'ชื่อไฟล์ = เปิดดู · ลูกศร = ดาวน์โหลด · ลบ = เอาออก');

// ── 08 ตรวจสอบและยืนยันข้อมูล ─────────────────────────────────────────────
await page.keyboard.press('Escape');
await settle(600);
await shoot('c08-a', () => () => [...document.querySelectorAll('button')]
  .find((b) => b.innerText.includes('ยืนยันข้อมูลของวันนี้')), 'ปุ่มยืนยันข้อมูลของวันนี้');
await shoot('c08-b', () => () => [...document.querySelectorAll('th')]
  .find((h) => h.innerText.includes('การยืนยัน')), 'คอลัมน์การยืนยัน บอกสถานะรายคน');
await shoot('c08-c', () => () => [...document.querySelectorAll('button')]
  .find((b) => b.innerText.includes('ยกเลิกการยืนยัน')), 'ถ้าต้องแก้ ต้องยกเลิกการยืนยันก่อน');

// ── 09 ล็อกย้อนหลังและปิดงวด ──────────────────────────────────────────────
await shoot('c09-a', () => () => [...document.querySelectorAll('span')]
  .find((s) => /^(แก้ไขได้|ใกล้ครบกำหนด|ล็อกแล้ว|ปิดงวดแล้ว)$/.test(s.innerText.trim())), 'ป้ายสถานะของวันที่เลือก');
await shoot('c09-b', () => () => [...document.querySelectorAll('button')]
  .find((b) => b.innerText.trim().startsWith('ปิดงวด')), 'ปุ่มปิดงวดทั้งเดือน');
await clickText('ปิดงวด'); await settle(1600);
await shoot('c09-c', () => () => {
  const go = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'ปิดงวด'
    && getComputedStyle(b).backgroundColor.startsWith('rgb(5,'));
  return go ? go.parentElement : null;
}, 'ยืนยัน = เขียว · ยกเลิก = แดง แยกกันชัดเจน');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'ยกเลิก');
  if (b) b.click();
});
await settle(1200);

// ── 10 ขอลาและอนุมัติ ─────────────────────────────────────────────────────
await as(A, '/performance?tab=leave');
await settle(2800);
await shoot('c10-b', () => () => [...document.querySelectorAll('form')].find((f) => f.innerText.includes('ขอลาใหม่')),
  'ฟอร์มขอลาใหม่ อยู่บนสุดของแท็บการลา', { pad: 4 });
await shoot('c10-c', () => () => [...document.querySelectorAll('select')]
  .find((s) => [...s.options].some((o) => o.text.includes('ลาครึ่งวันเช้า'))), 'ช่วงเวลาที่ลา — เต็มวัน หรือครึ่งวัน');
await shoot('c10-d', () => () => document.querySelector('form input[type=file]'), 'ช่องแนบใบรับรองแพทย์');
await shoot('c10-e', () => () => [...document.querySelectorAll('button')]
  .find((b) => b.innerText.trim().startsWith('รออนุมัติ')), 'แท็บรออนุมัติ สำหรับผู้อนุมัติ');
await shoot('c10-f', () => () => {
  const b = [...document.querySelectorAll('button')].find((x) => x.title === 'เปิดไฟล์แนบ');
  return b ? b.parentElement : null;
}, 'ไฟล์ที่แนบมา — กดชื่อเพื่อเปิด กดลูกศรเพื่อดาวน์โหลด');
await shoot('c10-g', () => () => [...document.querySelectorAll('div')]
  .find((d) => /^รอ .+ อนุมัติ$/.test(d.innerText.trim()) || /^(อนุมัติแล้ว|ไม่อนุมัติ)โดย/.test(d.innerText.trim())),
'ระบบบอกว่าคำขอนี้รอใครอนุมัติ และใครเป็นผู้ตัดสิน');

// ── 11 กำลังคนแบบเรียลไทม์ ────────────────────────────────────────────────
await as(A);
await pickSite(); await settle(1500);
await clickText('รายงานและตรวจสอบ'); await settle(3600);
await shoot('c11-a', () => () => document.querySelector('input[type=date]')?.parentElement?.parentElement,
  'เลือกช่วงวันที่ที่ต้องการดู');
await shoot('c11-b', () => () => {
  const el = [...document.querySelectorAll('div')].find((d) => d.innerText.startsWith('รวมแรงงาน-วัน') && d.children.length <= 3);
  return el ? el.parentElement : null;
}, 'ยอดรวมของช่วงที่เลือก');
await shoot('c11-c', () => () => [...document.querySelectorAll('div')]
  .find((d) => d.innerText.startsWith('สัดส่วนตามประเภทงาน')), 'สัดส่วนกำลังคนตามประเภทงาน');

// ── 12 รายงานและการส่งออก ─────────────────────────────────────────────────
await shoot('c12-a', () => () => [...document.querySelectorAll('select')]
  .find((s) => [...s.options].some((o) => o.text.includes('รายโครงการ'))), 'สลับมุมมองรายงานได้ 4 แบบ');
await shoot('c12-b', () => () => [...document.querySelectorAll('button')]
  .find((b) => b.innerText.includes('เป็น PDF')), 'ดาวน์โหลดรายงานนี้เป็น PDF');
await shoot('c12-c', () => () => [...document.querySelectorAll('button')]
  .find((b) => b.innerText.includes('ทุกโครงการ')), 'รายงานเดือน ทุกโครงการในไฟล์เดียว');

// ── 13 ประวัติการแก้ไข ────────────────────────────────────────────────────
await shoot('c13-a', () => () => [...document.querySelectorAll('h3')]
  .find((h) => h.innerText.includes('ประวัติการแก้ไข')), 'ตารางประวัติอยู่ล่างสุดของหน้า');
await shoot('c13-b', () => () => [...document.querySelectorAll('table')]
  .find((t) => [...t.querySelectorAll('th')].some((h) => h.innerText.includes('ค่าเดิม'))),
'อ่านเป็นภาษาไทย — ชื่อรายการ ค่าเดิม → ค่าใหม่', { pad: 3 });

// ── 14 การแจ้งเตือน ───────────────────────────────────────────────────────
await shoot('c14-a', () => () => [...document.querySelectorAll('div')]
  .find((d) => d.innerText.startsWith('รายการที่ต้องดำเนินการ')), 'กล่องรายการที่ต้องดำเนินการ');

// ── 15 ตั้งค่าระยะเวลาล็อก ────────────────────────────────────────────────
await as(A);
await clickText('ตั้งค่า'); await settle(3400);
await shoot('c15-a', () => () => [...document.querySelectorAll('section')]
  .find((d) => d.innerText.startsWith('ล็อกการแก้ไขย้อนหลัง')), 'ตั้งจำนวนวันล็อกแยกรายไซต์งาน');
// เก็บกวาดรายชื่อตัวอย่างที่นำเข้าไว้เพื่อถ่ายภาพ
await query('delete from employees where employee_code like $1', [`${TMP}%`]);

console.log(`\nถ่ายแล้ว ${taken.length} ภาพ → ${OUT}`);
await browser.close();
process.exit(0);
