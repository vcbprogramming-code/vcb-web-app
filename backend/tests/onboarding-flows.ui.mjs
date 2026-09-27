/**
 * โปรแกรมปฐมนิเทศ — ขับหน้าจอทีละสถานการณ์ เทียบกับ progress.html / admin.html
 *
 * สามอย่างที่ชุด API มองไม่เห็นและพังได้จริง:
 *   · ประตูกั้นเอกสารที่ปฏิเสธการกดแต่ไม่บอกว่าขาดฉบับไหน (= ทางตัน)
 *   · เปอร์เซ็นต์ต่อบล็อกที่ต้องเดินแยกจากเปอร์เซ็นต์ต่อเฟส
 *   · จอผู้ดูแลที่คนไม่ใช่ผู้ดูแลต้องไปไม่ถึงทั้งเมนูและทั้งเนื้อจอ ไม่ใช่แค่ API 403
 * บวกกับรูปในหน้าเนื้อหาที่ต้องขึ้นจริง (ดึงเป็น blob หลังล็อกอิน — ถ้าพลาดจะได้
 * กรอบเปล่าโดยไม่มีอะไรบอก)
 *
 * รันคู่กับหน้าเว็บที่กำลังพัฒนา: APP=http://localhost:5173 API=http://localhost:4000/api
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query, call } from './harness.mjs';
import { clickInDialog } from './tools/ui.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/onboarding-flows-ui`;
fs.mkdirSync(SHOTS, { recursive: true });

await warm();
const A = U.admin;
const H = U.hr;

{
  const probe = await call('/onboarding-program/bootstrap', { user: A });
  if (probe.status === 404) {
    console.log('\nข้าม — โมดูลปฐมนิเทศยังปิดอยู่ (รัน API ด้วย DISABLED_MODULES= เพื่อทดสอบ)');
    process.exit(report());
  }
}

const wipe = async (id) => {
  for (const t of ['ob_progress', 'ob_doc_submissions', 'ob_enrollments']) {
    await query(`delete from ${t} where profile_id = $1`, [id]);
  }
};
await wipe(A.id);

const boot = (await call('/onboarding-program/bootstrap', { user: A })).data;
const documents = boot.documents;
const dept = boot.departments[0];
const p1 = dept.phases[0];
const jrItems = (blk) => blk.items.filter((i) => i.level === 'junior');

fs.rmSync(`${ROOT}/chrome-ob-flows`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false,
  userDataDir: `${ROOT}/chrome-ob-flows`,
  defaultViewport: { width: 1440, height: 980 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 2200) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
/**
 * รอจนกว่าข้อความจะโผล่บนหน้า แล้วคืนว่าเจอหรือไม่
 *
 * settle() เป็นเวลาคงที่ ซึ่งพอเครื่องรันชุดอื่นขับ Chrome อยู่พร้อมกันก็สั้นเกิน
 * แล้วชุดนี้แดงยกแผงทั้งที่หน้าจอถูก — จุดเปลี่ยนหน้าสำคัญ ๆ จึงรอ "จนเห็นของ"
 * ไม่ใช่รอครบเวลา
 */
const waitForText = async (needle, ms = 15000) => {
  const until = Date.now() + ms;
  for (;;) {
    if ((await body()).includes(needle)) return true;
    if (Date.now() > until) return false;
    await settle(400);
  }
};
const as = async (user, path = '/onboarding/program') => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(user));
  await page.goto(`${APP}${path}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await settle(1500);
  // ชั้นวางขั้นตอนคือสิ่งที่โผล่หลังสุดของหน้านี้ เห็นแล้วแปลว่าโหลดครบ
  await waitForText('เลือกแผนก', 20000);
  await settle(800);
};
/** ชื่อขั้นทั้งหมดบนชั้นวางด้านซ้าย */
const steps = () => page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label]');
  return nav ? [...nav.querySelectorAll('ol > li > button')].map((b) => b.innerText.trim()) : [];
});
const clickStep = (label) => page.evaluate((l) => {
  const nav = document.querySelector('nav[aria-label]');
  const b = nav && [...nav.querySelectorAll('button')].find((x) => x.innerText.trim().includes(l));
  if (b) { b.click(); return true; } return false;
}, label);
const clickText = (label) => page.evaluate((l) => {
  const list = [...document.querySelectorAll('button, a')];
  const el = list.find((x) => x.innerText.trim() === l) || list.find((x) => x.innerText.trim().includes(l));
  if (el) { el.click(); return true; } return false;
}, label);
const dialogText = () => page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText || '');
// ป้ายชื่อระยะบนจอเขียนด้วยขีดยาว ("วันที่ 1–30") ไม่ใช่ขีดสั้น — เทียบแบบยอมทั้งสอง
// แบบ ไม่งั้นเทสต์จะหาปุ่มไม่เจอแล้วไปรายงานว่าหน้าจอพัง ทั้งที่หน้าจอถูก
const DASH = '[-–—]';
const phaseRx = (range) => new RegExp(range.replace('-', `\\s*${DASH}\\s*`));
const clickPhase = (range) => page.evaluate(([r, d]) => {
  const rx = new RegExp(r.replace('-', `\\s*${d}\\s*`));
  const nav = document.querySelector('nav[aria-label]');
  const b = nav && [...nav.querySelectorAll('ol > li > button')].find((x) => rx.test(x.innerText));
  if (b) { b.click(); return b.innerText.trim(); } return null;
}, [range, DASH]);

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });

// ───────────────────────────────────────────────────────────────────────────
suite('1. ชั้นวางขั้นตอนและประตูกั้นเอกสาร');
{
  await as(A);
  const st = await steps();
  happy('ชั้นวางเริ่มที่เตรียมความพร้อม ตามด้วยเอกสารและเลือกแผนก',
    st[0]?.includes('เตรียมความพร้อม') && st[1]?.includes('เอกสารที่จำเป็น') && st[2]?.includes('เลือกแผนก'),
    st.slice(0, 3).join(' → '));
  happy('ผู้ดูแลเห็นขั้นภาพรวมพนักงานและแก้เช็กลิสต์ท้ายชั้นวาง',
    st.some((x) => x.includes('ภาพรวมพนักงาน')) && st.some((x) => x.includes('แก้เช็กลิสต์')), st.join(' · '));
  await shot('01-ชั้นวาง');

  happy('เข้าหน้าเลือกแผนกได้', await clickStep('เลือกแผนก'), '');
  await settle(2600);
  const picked = await clickText(dept.name_th || dept.name);
  happy('กดการ์ดแผนกได้', picked, String(dept.name_th || dept.name));
  await waitForText('เอกสารที่จำเป็นให้ครบก่อน', 12000);
  const gate = await dialogText();
  happy('เอกสารยังไม่ครบ → ขึ้นกล่องกั้น ไม่ใช่เงียบ ๆ ไม่ทำอะไร',
    /เอกสารที่จำเป็นให้ครบก่อน/.test(gate), gate.split('\n')[0] || '(ไม่มีกล่อง)');
  happy('กล่องบอกเหตุผลด้วยคำของเขา',
    /การเลือกแผนกจะถูกล็อกไว้จนกว่าเอกสารที่จำเป็นทุกฉบับ/.test(gate), '');
  const listed = documents.filter((d) => gate.includes(d.title_th || d.title)).length;
  happy('และไล่ชื่อเอกสารที่ยังขาดให้ครบ', listed === documents.length, `${listed}/${documents.length}`);
  happy('มีปุ่มพาไปหน้าเอกสาร ไม่ใช่ปิดแล้วจบ', /ไปที่เอกสารที่จำเป็น/.test(gate), '');
  await shot('01ข-กล่องกั้นเอกสาร');

  happy('กดปุ่มแล้วไปหน้าเอกสารจริง', await clickText('ไปที่เอกสารที่จำเป็น'), '');
  await waitForText('เอกสารที่จำเป็น', 12000);
  await settle(1200);
  happy('อยู่ที่หน้าเอกสารที่จำเป็นแล้ว', (await body()).includes('เอกสารที่จำเป็น'), '');
  const stillDept = (await call('/onboarding-program/bootstrap', { user: A })).data.status.department;
  bad('และยังไม่ถูกลงทะเบียนเข้าแผนกใด', stillDept == null, String(stillDept));
}

// ───────────────────────────────────────────────────────────────────────────
suite('2. อัปโหลดเอกสารจากหน้าจอ');
{
  const t = await body();
  happy('การ์ดเอกสารบอกจำนวนที่ยังขาด', /\d+/.test(t) && t.includes('เอกสารที่จำเป็น'), '');
  const files = await page.evaluate(() => {
    const i = document.querySelector('input[type="file"]');
    return i ? { accept: i.accept || '' } : null;
  });
  happy('ช่องเลือกไฟล์จำกัดสกุลไว้ตั้งแต่กล่องเลือกไฟล์',
    Boolean(files) && /pdf/i.test(files.accept), String(files?.accept));
  happy('สกุลที่ยอมครบหกแบบเหมือนของเขา',
    ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'].every((e) => new RegExp(e, 'i').test(files?.accept || '')),
    String(files?.accept));

  // ไฟล์ใหญ่เกิน 10MB — ตรวจที่หน้าจอก่อน เพื่อให้คนได้คำตอบทันทีไม่ต้องรออัป
  const big = `${ROOT}/ob-big.pdf`;
  fs.writeFileSync(big, Buffer.alloc(11 * 1024 * 1024, 1));
  const chooser = page.waitForFileChooser({ timeout: 20000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /อัปโหลด|แนบไฟล์|เลือกไฟล์/.test(x.innerText));
    if (b) b.click();
  });
  const fc = await chooser.catch(() => null);
  if (fc) {
    await fc.accept([big]);
    await settle(2600);
    happy('ไฟล์ใหญ่เกิน 10MB → ถูกทักทันทีที่หน้าจอ',
      /ใหญ่เกิน|ขนาดใหญ่เกินกำหนด/.test(await body()), (await body()).split('\n').slice(-4).join(' / ').slice(0, 120));
    await shot('02-ไฟล์ใหญ่เกิน');
    happy('และไม่มีใบเสร็จการส่งเกิดขึ้น',
      (await query('select count(*)::int c from ob_doc_submissions where profile_id = $1', [A.id])).rows[0].c === 0, '');
  } else {
    happy('เปิดกล่องเลือกไฟล์ได้', false, 'ไม่พบปุ่มอัปโหลดบนการ์ดเอกสาร');
  }
  fs.rmSync(big, { force: true });

  // ไฟล์ขนาดปกติ — ต้องขึ้นใบเสร็จพร้อมชื่อไฟล์ และติ๊กเอกสารนั้นให้
  const good = `${ROOT}/ob-ok.pdf`;
  fs.writeFileSync(good, Buffer.from('%PDF-1.4 ทดสอบหน้าจอ'));
  const chooser2 = page.waitForFileChooser({ timeout: 20000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /อัปโหลด|แนบไฟล์|เลือกไฟล์/.test(x.innerText));
    if (b) b.click();
  });
  const fc2 = await chooser2.catch(() => null);
  if (fc2) {
    await fc2.accept([good]);
    await settle(4000);
    const rows = (await query('select doc_id, file_name from ob_doc_submissions where profile_id = $1', [A.id])).rows;
    happy('อัปไฟล์แล้วเกิดใบเสร็จหนึ่งแถว', rows.length === 1, `${rows.length}`);
    happy('ใบเสร็จเก็บชื่อไฟล์จริง', rows[0]?.file_name === 'ob-ok.pdf', String(rows[0]?.file_name));
    happy('หน้าจอขึ้นว่าอัปใหม่จะแทนไฟล์เดิม', /อัปโหลดใหม่จะแทนไฟล์เดิม/.test(await body()), '');
    await shot('02ข-อัปไฟล์แล้ว');
  }
  fs.rmSync(good, { force: true });

  // ที่เหลือติ๊กมือ (ของเขาก็มีทางนี้ — ไม่ใช่ทุกฉบับต้องอัปไฟล์)
  for (const d of documents) await call(`/onboarding-program/documents/${d.id}`, { method: 'POST', user: A, body: {} });
  await as(A);
  happy('ส่งครบแล้วขั้นเอกสารขึ้นเครื่องหมายถูกบนชั้นวาง',
    await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label]');
      const li = nav && [...nav.querySelectorAll('ol > li')].find((x) => x.innerText.includes('เอกสารที่จำเป็น'));
      return Boolean(li && li.querySelector('svg'));
    }), '');
}

// ───────────────────────────────────────────────────────────────────────────
suite('3. เลือกแผนกแล้วเข้าระยะแรกทันที');
{
  await clickStep('เลือกแผนก');
  await settle(2600);
  happy('กดการ์ดแผนกผ่านแล้ว ไม่มีกล่องกั้นอีก', await clickText(dept.name_th || dept.name), '');
  await waitForText('เสร็จสมบูรณ์', 18000);
  await settle(1500);
  bad('ไม่มีกล่องกั้นขึ้นมา', !/เอกสารที่จำเป็นให้ครบก่อน/.test(await dialogText()), '');
  const now = (await call('/onboarding-program/bootstrap', { user: A })).data.status;
  happy('ลงทะเบียนเข้าแผนกแล้ว', now.department === dept.slug, String(now.department));
  happy('และหน้าจอเด้งไปที่ระยะแรกเลย', phaseRx('1-30').test(await body()),
    ((await body()).match(new RegExp(`วันที่ ?1 ?${DASH} ?30`)) || ['ไม่พบชื่อระยะบนหน้า'])[0]);
  await shot('03-เข้าระยะแรก');
}

// ───────────────────────────────────────────────────────────────────────────
suite('4. เปอร์เซ็นต์ต่อบล็อกเดินแยกจากเปอร์เซ็นต์ต่อเฟส');
{
  const pct = () => page.evaluate(() => [...document.body.innerText.matchAll(/(\d+)% เสร็จสมบูรณ์/g)].map((m) => Number(m[1])));
  const before = await pct();
  happy('หน้าระยะขึ้นเปอร์เซ็นต์รายบล็อกสามชุด พร้อมของทั้งโปรแกรม',
    before.length >= 4, `${before.length} ตัว: ${before.join(', ')}`);
  happy('ทุกบล็อกเริ่มที่ศูนย์', before.slice(1).every((x) => x === 0) || before.every((x) => x === 0), before.join(', '));

  const blk = p1.blocks[0];
  const items = jrItems(blk);
  const ticked = await page.evaluate((txt) => {
    const lbl = [...document.querySelectorAll('label')].find((l) => l.innerText.includes(txt));
    const box = lbl && lbl.querySelector('input[type="checkbox"]');
    if (box) { box.click(); return true; } return false;
  }, (items[0].text_th || items[0].text).slice(0, 25));
  happy('ติ๊กข้อแรกของบล็อกแรกได้', ticked, '');
  await settle(3200);
  const mid = await pct();
  happy('เปอร์เซ็นต์ของบล็อกนั้นขยับ ไม่ใช่ค้างศูนย์', mid.some((x) => x > 0), mid.join(', '));
  bad('บล็อกอื่นยังศูนย์ (ตัวหารแยกกันจริง)', mid.filter((x) => x === 0).length >= 1, mid.join(', '));
  await shot('04-เปอร์เซ็นต์รายบล็อก');

  // ติ๊กจนครบบล็อกแรก → บล็อกนั้นต้องเป็นร้อย ส่วนเฟสยังไม่ครบ
  for (const it of items) await call(`/onboarding-program/progress/${it.id}`, { method: 'PUT', user: A, body: { done: true } });
  await as(A);
  happy('กลับเข้าหน้าระยะแรกได้', Boolean(await clickPhase('1-30')), '');
  await waitForText('เสร็จสมบูรณ์', 15000);
  await settle(1500);
  const full = await pct();
  happy('บล็อกแรกเต็มร้อย', full.includes(100), full.join(', '));
  bad('แต่ยังมีบล็อกที่ไม่ถึงร้อย — เฟสยังไม่จบ', full.some((x) => x < 100), full.join(', '));
  happy('บรรทัดย่อยใต้ขั้นบนชั้นวางขึ้นเครื่องหมายถูกของบล็อกที่ครบ',
    await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label]');
      const li = nav && [...nav.querySelectorAll('ol > li')].find((x) => /1\s*[-–—]\s*30/.test(x.innerText));
      const subs = li ? [...li.querySelectorAll('ul li')] : [];
      return subs.length === 3;
    }), '');

  // ยกเลิกติ๊กแล้วเปอร์เซ็นต์ต้องลดลงจริง ไม่ใช่ค้างค่าเดิมไว้บนจอ
  const unticked = await page.evaluate((txt) => {
    const lbl = [...document.querySelectorAll('label')].find((l) => l.innerText.includes(txt));
    const box = lbl && lbl.querySelector('input[type="checkbox"]');
    if (box && box.checked) { box.click(); return true; } return false;
  }, (items[0].text_th || items[0].text).slice(0, 25));
  happy('ยกเลิกติ๊กได้', unticked, '');
  await settle(3200);
  bad('บล็อกที่เคยเต็มร้อยไม่เต็มร้อยแล้ว', !(await pct()).includes(100) || (await pct()).filter((x) => x === 100).length === 0,
    (await pct()).join(', '));
  await call(`/onboarding-program/progress/${items[0].id}`, { method: 'PUT', user: A, body: { done: true } });
}

// ───────────────────────────────────────────────────────────────────────────
suite('5. ระยะที่ยังไม่ปลดล็อก อ่านได้แต่ติ๊กไม่ได้');
{
  await as(A);
  const opened = await clickPhase('61-90');
  happy('เปิดระยะที่สามได้ ไม่ถูกปิดกั้นทั้งหน้า', Boolean(opened), String(opened));
  await waitForText('เสร็จสมบูรณ์', 15000);
  await settle(1200);
  const t = await body();
  happy('มีแถบอธิบายว่าติดอะไร', /ระยะก่อนหน้า|ปลดล็อก/.test(t), (t.match(/.*ปลดล็อก.*/) || [''])[0].slice(0, 110));
  happy('ยังอ่านเนื้อหาของระยะนั้นได้', (await page.evaluate(() =>
    document.querySelectorAll('input[type="checkbox"]').length)) > 0, '');
  const boxes = await page.evaluate(() => {
    const all = [...document.querySelectorAll('input[type="checkbox"]')];
    return { total: all.length, disabled: all.filter((x) => x.disabled).length };
  });
  happy('แต่ทุกช่องติ๊กถูกปิดไว้', boxes.total > 0 && boxes.disabled === boxes.total,
    `${boxes.disabled}/${boxes.total}`);
  await shot('05-ระยะที่ยังล็อก');
}

// ───────────────────────────────────────────────────────────────────────────
suite('6. จอผู้ดูแลแก้เช็กลิสต์');
{
  await as(A);
  happy('เข้าจอแก้เช็กลิสต์ได้', await clickStep('แก้เช็กลิสต์'), '');
  await waitForText('เพิ่มข้อใหม่', 18000);
  await settle(1200);
  const t = await body();
  happy('มีฟอร์มเพิ่มข้อใหม่', t.includes('เพิ่มข้อใหม่'), '');
  const inputs = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => i.placeholder || '').filter(Boolean));
  happy('รับทั้งข้อความอังกฤษและไทย',
    inputs.some((p) => /อังกฤษ/.test(p)) && inputs.some((p) => /ไทย/.test(p)), inputs.join(' | '));
  const moves = await page.evaluate(() => [...document.querySelectorAll('button')]
    .map((b) => b.getAttribute('aria-label') || '').filter((x) => /เลื่อน/.test(x)));
  happy('มีปุ่มเลื่อนขึ้น-ลงให้จัดลำดับ', moves.length >= 2, moves.slice(0, 4).join(' / '));
  await shot('06-จอแก้เช็กลิสต์');

  // ทุกแถวในบล็อกมีช่อง "ข้อความ (อังกฤษ)" ของตัวเอง — ต้องเจาะเฉพาะการ์ด
  // "เพิ่มข้อใหม่" ไม่ใช่หยิบช่องแรกที่เจอ (ซึ่งเป็นของข้อที่มีอยู่แล้ว)
  const add = await page.evaluate((txt) => {
    const card = [...document.querySelectorAll('div')]
      .filter((d) => d.querySelector('h3')?.innerText.trim() === 'เพิ่มข้อใหม่'
        && d.querySelectorAll('input').length >= 2)
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0];
    if (!card) return 'ไม่พบการ์ดเพิ่มข้อใหม่';
    const en = [...card.querySelectorAll('input')].find((i) => /อังกฤษ/.test(i.placeholder || ''));
    const th = [...card.querySelectorAll('input')].find((i) => /ไทย/.test(i.placeholder || ''));
    if (!en || !th) return 'ไม่พบช่องกรอกในการ์ด';
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(en, `${txt} en`); en.dispatchEvent(new Event('input', { bubbles: true }));
    set.call(th, `${txt} ไทย`); th.dispatchEvent(new Event('input', { bubbles: true }));
    const b = [...card.querySelectorAll('button')].find((x) => /เพิ่มข้อใหม่/.test(x.innerText));
    if (!b) return 'ไม่พบปุ่มเพิ่ม';
    if (b.disabled) return 'ปุ่มเพิ่มยังถูกปิดอยู่';
    b.click();
    return 'ok';
  }, 'ZZUIOB');
  happy('กรอกแล้วกดเพิ่มได้', add === 'ok', String(add));
  // ข้อความแจ้งผลลอยอยู่ไม่กี่วินาที — อ่านก่อนรอโหลดรายการใหม่ ไม่ใช่หลัง
  await settle(1200);
  happy('ขึ้นข้อความว่าเพิ่มข้อใหม่แล้ว', /เพิ่มข้อใหม่แล้ว/.test(await body()),
    (await body()).split('\n').slice(-3).join(' / ').slice(0, 120));
  await settle(3000);
  const row = (await query("select id, text, text_th, is_active from ob_items where text like 'ZZUIOB%'")).rows[0];
  happy('ข้อใหม่ถูกบันทึกลงทะเบียนจริง', Boolean(row), String(row?.id));
  happy('เก็บคำแปลไทยไว้ด้วย', /ไทย$/.test(String(row?.text_th || '')), String(row?.text_th));

  if (row) {
    // ข้อความของแต่ละข้ออยู่ใน value ของ input ซึ่งไม่นับเป็น innerText — หาแถวจาก
    // รหัสข้อที่จอแสดงไว้ใน <code> แทน
    const off = await page.evaluate((id) => {
      const code = [...document.querySelectorAll('code')].find((c) => c.innerText.trim() === id);
      if (!code) return 'ไม่พบแถวของข้อนี้บนจอ';
      const holder = code.closest('div')?.parentElement || code.parentElement;
      const b = holder && [...holder.querySelectorAll('button')].find((x) => /ปิดใช้งาน/.test(x.innerText));
      if (!b) return 'ไม่พบปุ่มปิดใช้งานในแถวนั้น';
      b.click();
      return b.innerText.trim();
    }, row.id);
    happy('มีปุ่มปิดการใช้งานข้อ', off === 'ปิดใช้งาน', String(off));
    // ปิดข้อเป็นการถามยืนยันก่อน — ข้อที่มีคนติ๊กไว้แล้วจะหายจากจอพนักงาน
    await settle(1600);
    const ask = await dialogText();
    happy('ถามยืนยันก่อน และบอกว่าเครื่องหมายถูกเดิมยังอยู่',
      /เครื่องหมายถูกที่มีคนติ๊กไว้แล้วยังอยู่/.test(ask), ask.split('\n')[0] || '(ไม่มีกล่อง)');
    happy('กดยืนยันปิดใช้งานได้', await clickInDialog(page, 'ปิดใช้งาน'), '');
    await settle(3200);
    const after = (await query('select is_active from ob_items where id = $1', [row.id])).rows[0];
    happy('ปิดแล้วข้อนั้น is_active = false', after?.is_active === false, String(after?.is_active));
    happy('แต่ยังอยู่บนจอผู้ดูแล จึงเปิดกลับได้',
      await page.evaluate((id) => {
        const code = [...document.querySelectorAll('code')].find((c) => c.innerText.trim() === id);
        const holder = code && (code.closest('div')?.parentElement || code.parentElement);
        return Boolean(holder && [...holder.querySelectorAll('button')].some((x) => /เปิดใช้งาน/.test(x.innerText)));
      }, row.id), '');
    await shot('06ข-ปิดข้อแล้ว');
  }
  await query("delete from ob_progress where item_id in (select id from ob_items where text like 'ZZUIOB%')");
  await query("delete from ob_items where text like 'ZZUIOB%'");
  happy('ทะเบียนกลับเป็น 180 ข้อ', (await query('select count(*)::int c from ob_items')).rows[0].c === 180,
    String((await query('select count(*)::int c from ob_items')).rows[0].c));
}

// ───────────────────────────────────────────────────────────────────────────
suite('7. คนไม่ใช่ผู้ดูแลต้องไปไม่ถึงจอผู้ดูแล');
{
  await as(H);
  const st = await steps();
  happy('เปิดโปรแกรมปฐมนิเทศได้ตามปกติ', st.length > 0, `${st.length} ขั้น`);
  bad('ไม่มีขั้น "แก้เช็กลิสต์" บนชั้นวาง', !st.some((x) => x.includes('แก้เช็กลิสต์')), st.join(' · '));
  bad('ไม่มีขั้น "ภาพรวมพนักงาน" บนชั้นวาง', !st.some((x) => x.includes('ภาพรวมพนักงาน')), st.join(' · '));
  await shot('07-ชั้นวางของคนทั่วไป');
  const t = await body();
  bad('ทั้งหน้าไม่มีฟอร์มเพิ่มข้อเช็กลิสต์ให้เห็นเลย', !t.includes('เพิ่มข้อใหม่'), '');
  const r = await call('/onboarding-program/items?blockId=' + p1.blocks[0].id, { user: H });
  bad('และ API ก็ปฏิเสธด้วย ไม่ใช่กั้นแต่ที่จอ', r.status === 403, `${r.status}`);
}

// ───────────────────────────────────────────────────────────────────────────
suite('8. หน้าเนื้อหาสิบหน้า — เปิดได้และรูปขึ้นจริง');
{
  await as(A);
  const links = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label]');
    return nav ? [...nav.querySelectorAll('ul button')].map((b) => b.innerText.trim()).filter(Boolean) : [];
  });
  happy('เมนู "ทำความรู้จักบริษัท" มีหน้าให้อ่าน', links.length >= 7, `${links.length}: ${links.join(' · ')}`);

  let opened = 0; const blanks = []; let imgs = 0; let brokenImgs = 0;
  for (const label of links) {
    const ok = await page.evaluate((l) => {
      const nav = document.querySelector('nav[aria-label]');
      const b = nav && [...nav.querySelectorAll('ul button')].find((x) => x.innerText.trim() === l);
      if (b) { b.click(); return true; } return false;
    }, label);
    if (!ok) continue;
    await settle(3200);
    const txt = await body();
    if (txt.length < 400 || /ไม่พบหน้านี้/.test(txt)) { blanks.push(label); continue; }
    opened += 1;
    // รูปดึงเป็น blob หลังล็อกอิน — ถ้าพลาดจะได้กรอบเปล่า naturalWidth = 0
    const shots = await page.evaluate(() => [...document.querySelectorAll('img')]
      .map((i) => ({ w: i.naturalWidth, src: (i.src || '').slice(0, 12) })));
    imgs += shots.length;
    brokenImgs += shots.filter((s) => s.w === 0).length;
  }
  happy('ทุกหน้าในเมนูเปิดได้และมีเนื้อหา', blanks.length === 0 && opened === links.length,
    `เปิดได้ ${opened}/${links.length}${blanks.length ? ` · ว่าง: ${blanks.join(', ')}` : ''}`);
  happy('หน้าเนื้อหามีรูปจริง', imgs > 0, `${imgs} รูป`);
  bad('ไม่มีรูปที่โหลดไม่ขึ้น', brokenImgs === 0, `${brokenImgs}/${imgs}`);
  await shot('08-หน้าเนื้อหา');
}

// ───────────────────────────────────────────────────────────────────────────
suite('9. ไม่มีข้อผิดพลาดซ่อนอยู่');
{
  const real = errors.filter((e) => !/40[139]|413/.test(e));
  happy('ไม่มี error จากหน้าจอหรือคำขอที่ล้ม', real.length === 0, real.slice(0, 4).join(' | ').slice(0, 300));
}

suite('10. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await browser.close();
  await wipe(A.id);
  await query("delete from ob_progress where item_id in (select id from ob_items where text like 'ZZUIOB%')");
  await query("delete from ob_items where text like 'ZZUIOB%'");
  const left = (await query(
    `select (select count(*) from ob_progress where profile_id = $1)
          + (select count(*) from ob_doc_submissions where profile_id = $1)
          + (select count(*) from ob_enrollments where profile_id = $1)
          + (select count(*) from ob_items where text like 'ZZUIOB%') n`, [A.id])).rows[0].n;
  happy('ลบร่องรอยทดสอบหมดแล้ว', Number(left) === 0, `เหลือ ${left}`);
  happy('ข้อเช็กลิสต์จริงยังครบ 180 ข้อ', (await query('select count(*)::int c from ob_items')).rows[0].c === 180,
    String((await query('select count(*)::int c from ob_items')).rows[0].c));
}

process.exit(report(`${new URL('./.out/onboarding-flows-ui.json', import.meta.url).pathname}`) ? 1 : 0);
