/**
 * ปฐมนิเทศพนักงานใหม่ — เดินทั้งโปรแกรมอย่างที่พนักงานใหม่คนหนึ่งจะเดิน
 *
 * โมดูลนี้เพิ่งสร้างและยังไม่เคยมีใครคลิกจริง ชุด API พิสูจน์ว่ากติกาถูก
 * ชุดนี้ถามว่า "คนหนึ่งคนเดินจนจบได้ไหม" — เลือกแผนก ส่งเอกสาร ติ๊กงาน
 * เจอเฟสที่ล็อก อ่านเนื้อหาล่วงหน้า สลับระดับ แล้วไปถึงหน้าจบโปรแกรม
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query, call } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/onboarding`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin;
const wipe = async () => {
  for (const t of ['ob_progress', 'ob_doc_submissions', 'ob_enrollments'])
    await query(`delete from ${t} where profile_id = $1`, [A.id]);
};
await wipe();

// โปรไฟล์ Chrome ใช้ครั้งเดียวแล้วทิ้ง — ชุดที่ล้มกลางคันทิ้งโปรไฟล์ที่เขียนค้าง
// ไว้ และ Chrome จะค้างตอนเปิดโปรไฟล์นั้นทุกครั้งหลังจากนั้น
fs.rmSync(`${ROOT}/chrome-onboarding`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-onboarding`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 1800) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });

const as = async (user, path = '/onboarding/program') => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(2600);
};
const clickText = (label, sel = 'button, a') => page.evaluate((l, s) => {
  const el = [...document.querySelectorAll(s)].filter((x) => x.innerText.trim() === l)
    .concat([...document.querySelectorAll(s)].filter((x) => x.innerText.trim().includes(l)))[0];
  if (el) { el.click(); return true; } return false;
}, label, sel);
/** ช่องติ๊กในตารางเช็กลิสต์ (ไม่นับช่องอื่นในหน้า) */
const boxes = () => page.evaluate(() =>
  [...document.querySelectorAll('label input[type=checkbox]')].map((b) => ({ checked: b.checked, disabled: b.disabled })));

// ── 1. เข้าโมดูลจากหน้าแรก ────────────────────────────────────────────────
suite('1. หาโมดูลเจอจากหน้าแรก');
{
  await as(A, '/');
  const t = await body();
  happy('การ์ดปฐมนิเทศขึ้นที่หน้าแรก', t.includes('ปฐมนิเทศพนักงานใหม่'), '');
  bad('ไม่ขึ้นป้ายว่ายังไม่เปิดใช้งาน', !/ปฐมนิเทศ[\s\S]{0,120}(เร็ว ๆ นี้|ยังไม่เปิด)/.test(t), '');
  await shot('01-หน้าแรก');

  // การ์ดบนหน้าแรกเป็น <button> ไม่ใช่ลิงก์ — ต้องกดปุ่ม ไม่ใช่มองหา <a>
  const went = await page.evaluate(() => {
    const card = [...document.querySelectorAll('button')]
      .find((x) => x.innerText.includes('ปฐมนิเทศพนักงานใหม่') && x.innerText.includes('เปิดใช้งาน'));
    if (card) { card.click(); return true; } return false;
  });
  await settle(3200);
  // ตรวจด้วยข้อความที่มีเฉพาะในโมดูล ไม่ใช่คำโปรยของการ์ดที่อยู่บนหน้าแรกด้วย
  happy('กดการ์ดแล้วเข้าโมดูลได้',
    went && page.url().includes('/onboarding/program') && (await body()).includes('แผนกที่สังกัด'),
    `${page.url()}`);
}

// ── 2. ยังไม่เลือกแผนก ────────────────────────────────────────────────────
suite('2. ยังไม่เลือกแผนก — ระบบบอกให้เลือกก่อน');
{
  const t = await body();
  happy('บอกให้เลือกแผนกก่อน', t.includes('เลือกแผนกที่จะไปประจำก่อน'), '');
  happy('เห็นแผนกให้เลือกครบ 5 แผนก',
    ['บัญชี', 'การเงิน', 'จัดซื้อ', 'ทรัพย์สิน', 'วิศวกรรม'].every((x) => t.includes(x)), '');
  bad('ยังไม่มีแท็บเอกสารหรือเฟสให้กด', !t.includes('เอกสารที่ต้องส่ง'), '');
  await shot('02-ยังไม่เลือกแผนก');
}

// ── 3. เลือกแผนกแล้วเริ่มที่เอกสาร ────────────────────────────────────────
suite('3. เลือกแผนกแล้วเริ่มที่เอกสาร');
{
  happy('เลือกแผนกบัญชีได้', await clickText('ฝ่ายบัญชี'), '');
  await settle(2600);
  const t = await body();
  happy('เข้าสู่แท็บเอกสารทันที', t.includes('เอกสารที่ต้องส่ง'), '');
  happy('บอกว่าเหลืออีกกี่รายการ', /ยังเหลืออีก 8 รายการ/.test(t), t.split('\n').find((l) => l.includes('เหลืออีก')) || '');
  const docs = await page.evaluate(() => document.querySelectorAll('.card > div > button[aria-label]').length);
  happy(`เห็นเอกสารครบ 8 รายการ (พบ ${docs})`, docs === 8, `${docs}`);
  await shot('03-เอกสาร');
}

// ── 4. เฟสที่ล็อกอ่านได้ แต่ติ๊กไม่ได้ ────────────────────────────────────
suite('4. เฟสที่ยังล็อก — อ่านได้ แต่ติ๊กไม่ได้');
{
  happy('เปิดแท็บเฟสแรกได้ทั้งที่ยังล็อก', await clickText('วันที่ 1-30'), '');
  await settle(2400);
  const t = await body();
  happy('บอกเหตุผลว่าติดที่เอกสาร', t.includes('ส่งเอกสารให้ครบก่อน'), '');
  happy('บอกด้วยว่าอ่านล่วงหน้าได้', t.includes('อ่านล่วงหน้าได้'), '');
  happy('เนื้อหายังอ่านได้ครบ ไม่ได้ถูกซ่อน',
    t.includes('Required Reading') && t.includes('Knowledge Requirements') && t.includes('Required Outputs'), '');
  const b = await boxes();
  bad(`ช่องติ๊กถูกปิดทุกช่อง (${b.filter((x) => x.disabled).length}/${b.length})`,
    b.length > 0 && b.every((x) => x.disabled), `${b.length} ช่อง`);
  await shot('04-เฟสที่ล็อก');
}

// ── 5. ส่งเอกสารครบแล้วเฟสแรกเปิด ─────────────────────────────────────────
suite('5. ส่งเอกสารครบแล้วเฟสแรกเปิด');
{
  await clickText('เอกสารที่ต้องส่ง');
  await settle(2000);
  // ติ๊กทีละใบเหมือนคนทำจริง แล้วดูตัวเลขลดลง
  for (let i = 0; i < 8; i += 1) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button[aria-label]')]
        .find((x) => x.getAttribute('aria-label') === 'ทำเครื่องหมายว่าส่งแล้ว');
      if (b) b.click();
    });
    await settle(900);
  }
  const t = await body();
  happy('ส่งครบแล้วระบบบอกว่าเริ่มได้', t.includes('ส่งเอกสารครบแล้ว'), t.split('\n').find((l) => l.includes('เอกสาร')) || '');
  await shot('05-เอกสารครบ');

  await clickText('วันที่ 1-30');
  await settle(2400);
  const t2 = await body();
  bad('ไม่มีข้อความว่ายังล็อกอยู่แล้ว', !t2.includes('ส่งเอกสารให้ครบก่อน'), '');
  const b = await boxes();
  happy(`ช่องติ๊กใช้งานได้ทุกช่อง (${b.filter((x) => !x.disabled).length}/${b.length})`,
    b.length > 0 && b.every((x) => !x.disabled), `${b.length} ช่อง`);
  happy('พนักงานระดับต้นเห็น 9 รายการ ไม่ใช่ 12', b.length === 9, `${b.length}`);
}

// ── 6. ติ๊กงานจริง ────────────────────────────────────────────────────────
suite('6. ติ๊กงานแล้วระบบตอบสนอง');
{
  const before = (await body()).match(/(\d+)\/(\d+)\s*รายการ/);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('label input[type=checkbox]')].find((x) => !x.checked && !x.disabled);
    if (b) b.click();
  });
  await settle(1500);
  const t = await body();
  happy('ตัวนับเพิ่มขึ้นหลังติ๊ก', /1\/9\s*รายการ/.test(t), (t.match(/\d+\/\d+\s*รายการ/) || [''])[0]);
  happy('มีข้อความให้กำลังใจขึ้นมา',
    /ทำได้ดีมาก|เยี่ยมมาก|ไปได้สวย|เก่งมาก|มาถูกทางแล้ว/.test(t), '');
  await shot('06-ติ๊กแล้ว');

  // ติ๊กออกแล้วต้องลดลง และไม่มีข้อความให้กำลังใจ
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('label input[type=checkbox]')].find((x) => x.checked);
    if (b) b.click();
  });
  await settle(1500);
  happy('ติ๊กออกแล้วตัวนับลดลง', /0\/9\s*รายการ/.test(await body()), (( await body()).match(/\d+\/\d+\s*รายการ/) || [''])[0]);
  happy('ความคืบหน้าที่หัวหน้าจอตรงกัน', /0\/27/.test(await body()), '');
}

// ── 7. ทำเฟสแรกให้ครบ แล้วเจอป๊อปอัปฉลอง ──────────────────────────────────
suite('7. จบเฟสแรกแล้วมีป๊อปอัปฉลองและพาไปเฟสถัดไป');
{
  for (let i = 0; i < 9; i += 1) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('label input[type=checkbox]')].find((x) => !x.checked && !x.disabled);
      if (b) b.click();
    });
    await settle(800);
  }
  await settle(1600);
  const t = await body();
  happy('ติ๊กครบ 9/9', /9\/9\s*รายการ/.test(t), (t.match(/\d+\/\d+\s*รายการ/) || [''])[0]);
  happy('ป๊อปอัปฉลองขึ้นมา', t.includes('จบเฟสนี้แล้ว'), '');
  happy('มีทั้งปุ่มไปต่อและปุ่มอยู่หน้านี้',
    t.includes('ไปเฟสถัดไป') && t.includes('อยู่หน้านี้ต่อ'), '');
  await shot('07-ฉลองจบเฟส');

  happy('กดไปเฟสถัดไปได้', await clickText('ไปเฟสถัดไป'), '');
  await settle(2600);
  const t2 = await body();
  bad('เฟสสองเปิดให้ติ๊กแล้ว', !t2.includes('ทำเฟสก่อนหน้าให้ครบก่อน'), '');
  happy('อยู่ที่เฟสสองจริง', /วันที่ 31-60/.test(t2), '');
}

// ── 8. เฟสสามยังล็อก และเหตุผลถูกต้อง ─────────────────────────────────────
suite('8. เฟสสามยังล็อกด้วยเหตุผลที่ถูก');
{
  await clickText('วันที่ 61-90');
  await settle(2400);
  const t = await body();
  happy('บอกว่าติดเฟสก่อนหน้า ไม่ใช่ติดเอกสาร',
    t.includes('ทำเฟสก่อนหน้าให้ครบก่อน') && !t.includes('ส่งเอกสารให้ครบก่อน'), '');
  const b = await boxes();
  bad('ช่องติ๊กยังปิดอยู่', b.length > 0 && b.every((x) => x.disabled), `${b.length} ช่อง`);
  await shot('08-เฟสสามล็อก');
}

// ── 9. สลับระดับพนักงาน ───────────────────────────────────────────────────
suite('9. สลับเป็นระดับอาวุโสแล้วงานเพิ่ม');
{
  await clickText('วันที่ 1-30');
  await settle(2200);
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'senior'));
    if (!sel) return;
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, 'senior');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle(2600);
  const b = await boxes();
  happy('เฟสแรกมี 12 รายการเมื่อเป็นอาวุโส', b.length === 12, `${b.length}`);
  happy('เก้ารายการเดิมยังติ๊กอยู่', b.filter((x) => x.checked).length === 9, `${b.filter((x) => x.checked).length}`);
  happy('เห็นป้ายกำกับรายการของอาวุโส', (await body()).includes('ระดับอาวุโส'), '');
  await shot('09-ระดับอาวุโส');

  // กลับเป็นระดับต้น
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'senior'));
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, 'junior');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle(2400);
  happy('กลับเป็นระดับต้นแล้วเหลือ 9 รายการเหมือนเดิม', (await boxes()).length === 9, '');
}

// ── 10. เปลี่ยนแผนกแล้วกลับมา ─────────────────────────────────────────────
suite('10. เปลี่ยนแผนกแล้วความคืบหน้าไม่หาย');
{
  await clickText('ฝ่ายการเงิน');
  await settle(2600);
  happy('ย้ายไปแผนกการเงินแล้ว', /0\/27/.test(await body()), (( await body()).match(/\d+\/\d+/) || [''])[0]);
  await clickText('ฝ่ายบัญชี');
  await settle(2600);
  happy('กลับมาแผนกบัญชีแล้วเจอของเดิม', /9\/27/.test(await body()), (( await body()).match(/\d+\/\d+/) || [''])[0]);
  await shot('10-เปลี่ยนแผนก');
}

// ── 11. ทำจนจบโปรแกรม ─────────────────────────────────────────────────────
suite('11. ทำจนครบ 90 วันแล้วถึงหน้าจบโปรแกรม');
{
  for (const tab of ['วันที่ 31-60', 'วันที่ 61-90']) {
    await clickText(tab);
    await settle(2200);
    for (let i = 0; i < 10; i += 1) {
      const left = await page.evaluate(() => {
        const b = [...document.querySelectorAll('label input[type=checkbox]')].find((x) => !x.checked && !x.disabled);
        if (b) { b.click(); return true; } return false;
      });
      if (!left) break;
      await settle(700);
    }
    await settle(1400);
    // ปิดป๊อปอัปถ้ามี เพื่อไปแท็บถัดไปได้
    await clickText('อยู่หน้านี้ต่อ');
    await settle(900);
  }
  const t = await body();
  happy('ครบทั้ง 27 รายการ', /27\/27/.test(t), (t.match(/\d+\/\d+/) || [''])[0]);
  await shot('11-ครบทุกเฟส');

  await clickText('จบโปรแกรม');
  await settle(2400);
  const t2 = await body();
  happy('เข้าหน้าจบโปรแกรมได้', t2.includes('จบโปรแกรมปฐมนิเทศ 90 วัน'), t2.slice(0, 90));
  happy('บอกจำนวนรายการที่ทำครบ', /27/.test(t2), '');
  happy('มีปุ่มพิมพ์ใบรับรอง', t2.includes('พิมพ์ใบรับรอง'), '');
  await shot('12-จบโปรแกรม');
}

// ── 12. ผู้ดูแลเห็นภาพรวม ─────────────────────────────────────────────────
suite('12. ผู้ดูแลเห็นภาพรวมพนักงาน');
{
  happy('มีแท็บภาพรวมพนักงาน', await clickText('ภาพรวมพนักงาน'), '');
  await settle(2400);
  const t = await body();
  happy('เห็นตัวเองในตาราง', t.includes(A.name) || t.includes(A.email), t.slice(0, 100));
  happy('บอกความคืบหน้าเป็นตัวเลข', /27\/27/.test(t), '');
  await shot('13-ภาพรวมพนักงาน');
}

suite('13. ไม่มีข้อผิดพลาดซ่อนอยู่');
bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' | '));

suite('14. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await wipe();
  const left = (await query('select count(*)::int n from ob_progress where profile_id = $1', [A.id])).rows[0].n;
  happy('ลบความคืบหน้าทดสอบหมดแล้ว', left === 0, `${left}`);
}

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
