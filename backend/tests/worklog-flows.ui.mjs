/**
 * บันทึกงานฝ่ายบุคคล + คำขอลา — สถานการณ์ที่ต้องขับหน้าจอจริงจึงจะเห็น
 *
 * คู่กับ worklog-flows.mjs (ฝั่ง API) ชุดนี้จับสิ่งที่ตัดสินกันบนจอ: กล่องเลือก
 * กิจกรรมสองชั้น · การกรองหมวดงานตามรหัสงาน · งานที่ข้ามขั้นที่สอง · คีย์บอร์ด ·
 * ช่องที่กดไม่ได้เพราะยังไม่ถึงกำหนด (ต่างจากช่องที่เลยกำหนด) · ป้ายวันลา ·
 * ป้ายช่องที่แก้ย้อนหลัง มาตรฐานคือ Code.gs (oppOpen/oppRender/oppPick/renderGrid)
 *
 * ข้อมูลจริงของลูกค้าต้องไม่ถูกแตะ — ทุกอย่างอยู่ในไซต์ ZZFLOWUI ที่สร้างเองและ
 * ลบทิ้งทั้งก่อนและหลังรอบ
 */
import puppeteer from 'puppeteer-core';
import { call, suite, happy, bad, report, U, tok, APP, warm, query } from './harness.mjs';

await warm();
const A = U.admin;
const MARK = 'ZZFLOWUI';
const ROOT = '/private/tmp/claude-501/-Users-pok-Desktop-Jobs--------------------/433cbf75-c00f-4cb4-a565-7affda174a77/scratchpad/check';

const clean = async () => {
  const units = (await query('select id from units where name like $1', [`${MARK}%`])).rows.map((r) => r.id);
  const emps = (await query('select id from employees where full_name like $1', [`${MARK}%`])).rows.map((r) => r.id);
  if (emps.length) {
    await query('delete from work_log_audit where employee_id = any($1::uuid[])', [emps]);
    await query('delete from work_logs where employee_id = any($1::uuid[])', [emps]);
    await query('delete from leave_approvers where employee_id = any($1::uuid[])', [emps]);
    await query('delete from leave_requests where employee_id = any($1::uuid[])', [emps]);
    await query('delete from employee_away where employee_id = any($1::uuid[])', [emps]);
    await query('delete from employee_moves where employee_id = any($1::uuid[])', [emps]);
    await query('delete from employees where id = any($1::uuid[])', [emps]);
  }
  if (units.length) {
    await query('delete from work_log_audit where unit_id = any($1::uuid[])', [units]);
    await query('delete from work_logs where unit_id = any($1::uuid[])', [units]);
    await query('delete from leave_requests where unit_id = any($1::uuid[])', [units]);
    await query('delete from units where id = any($1::uuid[])', [units]);
  }
};
await clean();

const site = (await call('/performance/sites', { method: 'POST', user: A, body: { name: `${MARK} ไซต์หน้าจอ` } })).data;
const emp = (await call('/performance/employees', { method: 'POST', user: A,
  body: { site: site.key, fullName: `${MARK} พนักงาน`, kind: 'operation' } })).data;
const sup = (await call('/performance/employees', { method: 'POST', user: A,
  body: { site: site.key, fullName: `${MARK} สายสนับสนุน`, kind: 'support' } })).data;
const boot = await call(`/performance/site-month?site=${site.key}&year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`, { user: A });
const TODAY = boot.today;
const pad = (n) => String(n).padStart(2, '0');
const addDays = (d, n) => { const [y, m, dd] = d.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, dd + n)); return x.toISOString().slice(0, 10); };
/** วันในเดือนที่กำลังดู ที่เลย "พรุ่งนี้" ไปแล้ว (= ยังไม่ถึงกำหนด) */
const FUTURE = (boot.days || []).map((d) => d.date).find((x) => x > addDays(TODAY, 1)) || null;
/** วันในเดือนที่เลยระยะล็อกไปแล้ว */
const LOCKED = (boot.days || []).map((d) => d.date).reverse().find((x) => x < addDays(TODAY, -(boot.lockDays ?? 3))) || null;

/**
 * เปิดเบราว์เซอร์ — ลองซ้ำได้
 *
 * โปรไฟล์ของ Chrome ถูกล็อกไว้ตอนที่รอบก่อนยังปิดไม่เสร็จ รันชุดนี้ต่อท้ายชุดอื่น
 * ในคำสั่งเดียวจึงเคยล้มทั้งชุดตั้งแต่บรรทัดนี้ โดยไม่มีผลทดสอบออกมาเลยแม้ข้อเดียว
 * ซึ่งอ่านเหมือนชุดทดสอบเสีย — รอแล้วลองใหม่ ดีกว่าให้รอบตรวจทั้งรอบหายไป
 */
const launch = async () => {
  for (let i = 0; i < 3; i += 1) {
    try {
      return await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: 'new', userDataDir: `${ROOT}/chrome-flows`, defaultViewport: { width: 1440, height: 900 },
        args: ['--no-first-run', '--no-default-browser-check'],
      });
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return null;
};
const browser = await launch();
const page = (await browser.pages())[0];
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const bodyText = () => page.evaluate(() => document.body.innerText);

const openEntry = async () => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((tk) => { localStorage.clear(); localStorage.setItem('hr_access_token', tk); }, tok(A));
  await page.goto(`${APP}/performance?tab=entry`, { waitUntil: 'networkidle2' });
  await page.waitForFunction((k) => {
    const s = document.querySelector('select[aria-label="เลือกไซต์งาน"]');
    return Boolean(s && [...s.options].some((o) => o.value === k));
  }, { timeout: 60000 }, site.key);
  await page.select('select[aria-label="เลือกไซต์งาน"]', site.key);
  await page.waitForFunction(() => [...document.querySelectorAll('button')]
    .some((x) => x.innerText.trim() === 'รายอาทิตย์'), { timeout: 60000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'รายอาทิตย์');
    if (b) b.click();
  });
  await page.waitForFunction(() => document.querySelectorAll('td[data-cell] [data-slot]').length > 0, { timeout: 60000 });
  await wait(600);
};

/** ไปสัปดาห์ที่มีวันที่นี้อยู่ คืน true เมื่อหาเจอ */
const gotoWeekOf = async (date) => {
  for (let i = 0; i < 8; i += 1) {
    if (await page.evaluate((d) => Boolean(document.querySelector(`td[data-cell="${d}"]`)), date)) return true;
    const moved = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '') === 'สัปดาห์ถัดไป' && !x.disabled);
      if (!b) return false; b.click(); return true;
    });
    if (!moved) break;
    await wait(350);
  }
  return page.evaluate((d) => Boolean(document.querySelector(`td[data-cell="${d}"]`)), date);
};
const gotoWeekBack = async (date) => {
  for (let i = 0; i < 8; i += 1) {
    if (await page.evaluate((d) => Boolean(document.querySelector(`td[data-cell="${d}"]`)), date)) return true;
    const moved = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '') === 'สัปดาห์ก่อนหน้า' && !x.disabled);
      if (!b) return false; b.click(); return true;
    });
    if (!moved) break;
    await wait(350);
  }
  return page.evaluate((d) => Boolean(document.querySelector(`td[data-cell="${d}"]`)), date);
};

const clickCell = (date, slot = 0) => page.evaluate((d, s) => {
  const el = [...document.querySelectorAll(`td[data-cell="${d}"] [data-slot]`)][s];
  if (!el) return false;
  el.click();
  return true;
}, date, slot);
/** กล่องเลือกเปิดอยู่ไหม */
const pickerOpen = () => page.evaluate(() =>
  Boolean([...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('ค้นหา'))));
/** หัวกล่อง (แถบบนสุด) ทั้งแถบ — ไม่ใช่แค่สองสามบรรทัดแรก เพราะรหัสงานที่เลือกไว้
 *  กับจำนวนหมวดที่ใช้ได้อยู่ท้ายแถบ */
const pickerHeader = () => page.evaluate(() => {
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('ค้นหา'));
  let box = inp; while (box && getComputedStyle(box).position !== 'fixed') box = box.parentElement;
  if (!box) return '';
  // แถบหัวคือลูกตัวแรกที่ไม่ใช่แถบเตือน (แถบเตือนมีคำว่า "เหมือนกัน"/"หมวดงาน —")
  const head = [...box.children].find((c) => /1\/2|2\/2/.test(c.innerText));
  return (head ? head.innerText : box.innerText).replace(/\n/g, ' | ');
});
const pickerText = () => page.evaluate(() => {
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('ค้นหา'));
  let box = inp; while (box && getComputedStyle(box).position !== 'fixed') box = box.parentElement;
  return box ? box.innerText : '';
});
const pickCodes = () => page.evaluate(() =>
  [...document.querySelectorAll('[data-pick-code]')].map((x) => x.getAttribute('data-pick-code')));
/** แถวในกล่องผูกกับ mousedown (กันกล่องปิดก่อนเลือก) — .click() อย่างเดียวไม่ทำงาน */
const pickCode = (code) => page.evaluate((c) => {
  const row = document.querySelector(`[data-pick-code="${c}"]`);
  if (!row) return false;
  for (const type of ['mousedown', 'mouseup', 'click']) {
    row.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
  return true;
}, code);
const typeSearch = async (s) => {
  await page.evaluate(() => {
    const i = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('ค้นหา'));
    if (i) i.focus();
  });
  await page.keyboard.type(s, { delay: 20 });
  await wait(350);
};
const cellValue = async (date, slot = 0) => page.evaluate((d, s) => {
  const el = [...document.querySelectorAll(`td[data-cell="${d}"] [data-slot]`)][s];
  return el ? el.innerText.trim() : null;
}, date, slot);
const dbCell = async (eid, date) => (await query(
  'select team, detail, pm, note from work_logs where employee_id = $1 and ymd = $2 and deleted_at is null',
  [eid, date])).rows[0] || null;

await openEntry();
const acts = boot.teams || [];
const oneToMany = acts.find((a) => a.mapping !== 'one-to-one' && String(a.allowed_cost || '').split(',').filter(Boolean).length > 1);
const oneToOne = acts.find((a) => a.mapping === 'one-to-one');

// ===========================================================================
suite('1. กล่องเลือกกิจกรรมสองชั้น');
{
  await clickCell(TODAY);
  await wait(700);
  happy('คลิกช่องว่างแล้วกล่องเปิดที่ขั้นที่หนึ่ง', await pickerOpen());
  const h1 = await pickerHeader();
  happy('หัวกล่องบอกว่าเป็นขั้น 1/2 และให้เลือกกิจกรรม', /1\/2/.test(h1) && /กิจกรรม/.test(h1), h1);
  happy('รายการจัดกลุ่มตามหมวดหมู่', /·/.test(await pickerText()));
  happy('มีตัวนับว่าแสดงกี่จากทั้งหมด', /\d+\/\d+/.test(await pickerHeader() + await pickerText()));

  if (oneToMany) {
    await pickCode(oneToMany.code);
    await wait(500);
    const h2 = await pickerHeader();
    happy('เลือกกิจกรรมที่ใช้ได้หลายหมวด → ไปขั้นที่สอง', /2\/2/.test(h2), h2);
    happy('หัวกล่องขั้นที่สองบอกรหัสงานที่เลือกไว้', h2.includes(oneToMany.code), h2);
    const allowed = String(oneToMany.allowed_cost).split(',').map((x) => x.trim()).filter(Boolean);
    const shown = await pickCodes();
    happy('ขั้นที่สองเหลือเฉพาะหมวดงานที่รหัสนี้ใช้ได้',
      shown.length === allowed.length && shown.every((c) => allowed.includes(c)),
      `แสดง ${shown.join(',')} · อนุญาต ${allowed.join(',')}`);
    happy('หัวกล่องบอกจำนวนหมวดที่ใช้ได้', new RegExp(`ใช้ได้ ${allowed.length} หมวด`).test(h2) || /ใช้ได้ \d+ หมวด/.test(h2), h2);
    // กดหัวกล่องขั้นที่สองคือย้อนกลับขั้นที่หนึ่ง (ของเขาทำแบบเดียวกัน)
    await page.evaluate(() => {
      const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('ค้นหา'));
      let box = inp; while (box && getComputedStyle(box).position !== 'fixed') box = box.parentElement;
      const head = box?.firstElementChild?.innerText?.includes('2/2') ? box.firstElementChild : box?.children[0];
      head?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    });
    await wait(400);
    happy('กดหัวกล่องย้อนกลับไปขั้นที่หนึ่งได้', /1\/2/.test(await pickerHeader()), await pickerHeader());
    await pickCode(oneToMany.code);
    await wait(400);
    const cat = (await pickCodes())[0];
    await pickCode(cat);
    await wait(900);
    happy('เลือกหมวดงานแล้วกล่องปิด', !(await pickerOpen()));
    happy('ค่าในช่องเป็นคู่ "กิจกรรม / หมวดงาน"',
      (await dbCell(emp.eid, TODAY))?.team === `${oneToMany.code} / ${cat}`, JSON.stringify(await dbCell(emp.eid, TODAY)));
  }
}

suite('2. กิจกรรมที่ข้ามขั้นที่สอง');
{
  await clickCell(TODAY, 1);   // ช่องงานที่ 2
  await wait(700);
  if (oneToOne) {
    happy('กล่องเปิดสำหรับช่องงานที่ 2', await pickerOpen());
    await pickCode(oneToOne.code);
    await wait(900);
    bad('งานแบบขั้นตอนเดียวไม่ถามหมวดงานอีก กล่องปิดทันที', !(await pickerOpen()));
    const v = await dbCell(emp.eid, TODAY);
    happy('และลงค่าให้เลย', String(v?.pm || '').startsWith(oneToOne.code), JSON.stringify(v));
  }
}

suite('3. ห้ามลงงานเดียวกันทั้งสองช่องของวันเดียว');
{
  const cur = await dbCell(emp.eid, TODAY);
  const head = String(cur?.team || '').split('/')[0].trim();
  if (head) {
    await clickCell(TODAY, 1);
    await wait(700);
    await pickCode(head);
    await wait(500);
    const txt = await pickerText();
    bad('เลือกงานซ้ำกับช่องแรก → กล่องเตือน ไม่ลงค่า', /งานทั้งสองช่องเหมือนกัน/.test(txt), txt.slice(0, 120));
    happy('และกล่องยังเปิดอยู่ให้เลือกใหม่', await pickerOpen());
    await page.keyboard.press('Escape');
    await wait(300);
  }
}

suite('4. ค้นหาและล้างค่าในกล่อง');
{
  await clickCell(TODAY);
  await wait(700);
  const before = (await pickCodes()).length;
  await typeSearch('zzzzไม่มีจริง');
  const txt = await pickerText();
  happy('ค้นหาที่ไม่เจออะไร → บอกว่าไม่พบรายการที่ตรงกับคำค้น',
    /ไม่พบรายการที่ตรงกับ/.test(txt), txt.slice(0, 140));
  bad('และไม่เหลือแถวให้กดผิด', (await pickCodes()).length === 0);
  await page.keyboard.press('Escape');
  await wait(300);
  await clickCell(TODAY);
  await wait(700);
  await typeSearch(String(acts[0].code));
  happy('ค้นหาด้วยรหัสงานเจอ', (await pickCodes()).includes(acts[0].code), (await pickCodes()).join(','));
  happy('ค้นหาแบบไม่สนตัวพิมพ์', await (async () => {
    await page.keyboard.press('Escape'); await wait(250);
    await clickCell(TODAY); await wait(700);
    await typeSearch(String(acts[0].code).toLowerCase());
    const ok = (await pickCodes()).includes(acts[0].code);
    return ok;
  })(), '');
  happy('กดปุ่มล้างแล้วช่องว่างจริง', await (async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'ล้าง');
      b?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    });
    await wait(1000);
    return (await dbCell(emp.eid, TODAY))?.team == null;
  })(), '');
}

suite('5. คีย์บอร์ดในกล่องเลือก (ลูกศร + Enter)');
{
  await clickCell(TODAY);
  await wait(700);
  const codes = await pickCodes();
  happy('กล่องเปิดและมีรายการให้เลื่อน', codes.length > 1, String(codes.length));
  const first = await page.evaluate(() => document.querySelector('[data-kbd="1"]')?.getAttribute('data-pick-code') || null);
  happy('แถวแรกถูกชี้ไว้ตั้งแต่เปิด', first === codes[0], `${first} vs ${codes[0]}`);
  await page.keyboard.press('ArrowDown');
  await wait(250);
  const second = await page.evaluate(() => document.querySelector('[data-kbd="1"]')?.getAttribute('data-pick-code') || null);
  happy('ลูกศรลงเลื่อนไปแถวถัดไป', second === codes[1], `${second} vs ${codes[1]}`);
  await page.keyboard.press('ArrowUp');
  await wait(250);
  happy('ลูกศรขึ้นเลื่อนกลับ',
    (await page.evaluate(() => document.querySelector('[data-kbd="1"]')?.getAttribute('data-pick-code'))) === codes[0]);
  await page.keyboard.press('Enter');
  await wait(1000);
  const after = await dbCell(emp.eid, TODAY);
  const picked = acts.find((a) => a.code === codes[0]);
  const wentToStep2 = await pickerOpen();
  happy('กด Enter แล้วเลือกแถวที่ชี้อยู่จริง',
    wentToStep2 ? /2\/2/.test(await pickerHeader()) : String(after?.team || '').startsWith(codes[0]),
    `step2=${wentToStep2} db=${JSON.stringify(after)} picked=${picked?.mapping}`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await wait(400);
}

suite('6. ช่องที่ยังไม่ถึงกำหนด ต่างจากช่องที่เลยกำหนด');
{
  if (FUTURE && await gotoWeekOf(FUTURE)) {
    bad('ช่องของวันข้างหน้ากดไม่ได้', await (async () => {
      await clickCell(FUTURE); await wait(600); return !(await pickerOpen());
    })(), FUTURE);
    const tip = await page.evaluate((d) => {
      const el = [...document.querySelectorAll(`td[data-cell="${d}"] [data-slot]`)][0];
      return el?.getAttribute('title') || '';
    }, FUTURE);
    happy('และบอกว่ายังไม่ถึงกำหนด ไม่ใช่ว่าเลยกำหนด', /ยังไม่ถึงกำหนด/.test(tip), tip);
    // เปิดโหมดแก้ย้อนหลังของผู้ดูแลระบบแล้วต้องยังกดไม่ได้ เพราะขอบบนไม่มีใครปลดได้
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /แก้ไขย้อนหลัง/.test(x.innerText));
      if (b) b.click();
    });
    await wait(500);
    happy('เปิดโหมดแก้ย้อนหลังแล้วป้ายเปลี่ยน', /แก้ไขย้อนหลังเปิดอยู่/.test(await bodyText()));
    bad('แต่ช่องของวันข้างหน้ายังกดไม่ได้ (เซิร์ฟเวอร์ปฏิเสธทุกคน)', await (async () => {
      await clickCell(FUTURE); await wait(600); const open = await pickerOpen();
      if (open) await page.keyboard.press('Escape');
      return !open;
    })(), FUTURE);
    happy('และไม่มีข้อความผิดพลาดเด้งขึ้นมาให้คนกรอกเสียเวลา', !/บันทึกล่วงหน้า/.test(await bodyText()));
  } else {
    happy('เดือนนี้ไม่มีวันข้างหน้าในตาราง — ข้ามการตรวจนี้', true);
    happy('เดือนนี้ไม่มีวันข้างหน้าในตาราง — ข้ามการตรวจนี้ (2)', true);
    happy('เดือนนี้ไม่มีวันข้างหน้าในตาราง — ข้ามการตรวจนี้ (3)', true);
    happy('เดือนนี้ไม่มีวันข้างหน้าในตาราง — ข้ามการตรวจนี้ (4)', true);
  }
}

suite('7. ช่องที่เลยกำหนดแล้ว และป้ายช่องที่แก้ย้อนหลัง');
{
  const unlockOn = /แก้ไขย้อนหลังเปิดอยู่/.test(await bodyText());
  if (unlockOn) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /แก้ไขย้อนหลัง/.test(x.innerText));
      if (b) b.click();
    });
    await wait(400);
  }
  if (LOCKED && await gotoWeekBack(LOCKED)) {
    bad('โหมดปิดอยู่ → ช่องที่เลยกำหนดกดไม่ได้', await (async () => {
      await clickCell(LOCKED); await wait(600); return !(await pickerOpen());
    })(), LOCKED);
    const tip = await page.evaluate((d) => {
      const el = [...document.querySelectorAll(`td[data-cell="${d}"] [data-slot]`)][0];
      return el?.getAttribute('title') || '';
    }, LOCKED);
    happy('และบอกว่าผู้ดูแลระบบเปิดโหมดแก้ย้อนหลังได้', /เลยกำหนดแก้ไขแล้ว/.test(tip), tip);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /แก้ไขย้อนหลัง/.test(x.innerText));
      if (b) b.click();
    });
    await wait(500);
    happy('เปิดโหมดแล้วช่องที่เลยกำหนดกดได้', await (async () => {
      await clickCell(LOCKED); await wait(700); const open = await pickerOpen();
      return open;
    })(), LOCKED);
    // เลือกค่าจริงเพื่อให้เกิดการแก้ย้อนหลัง แล้วป้ายต้องขึ้นพร้อมวันที่
    const code = (await pickCodes())[0];
    await pickCode(code);
    await wait(600);
    if (await pickerOpen()) { await pickCode((await pickCodes())[0]); await wait(900); }
    happy('บันทึกย้อนหลังลงฐานข้อมูลจริง', Boolean((await dbCell(emp.eid, LOCKED))?.team), LOCKED);
    // โหลดหน้าใหม่แล้วหน้าจอไม่เลือกหน่วยงานให้เอง (ตามระบบจริง) — ต้องเปิดเข้าไปใหม่
    await openEntry();
    await gotoWeekBack(LOCKED);
    const chip = await page.evaluate((d) => {
      const td = document.querySelector(`td[data-cell="${d}"]`);
      return td ? td.innerText : '';
    }, LOCKED);
    happy('ช่องขึ้นป้ายว่าถูกแก้ย้อนหลัง', /แก้ย้อนหลัง/.test(chip), chip.replace(/\n/g, ' | ').slice(0, 120));
    happy('และป้ายบอกวันที่แก้บนตัวป้ายเลย ไม่ต้องเอาเมาส์จี้', /แก้ย้อนหลัง\s+\d{2}-\d{2}/.test(chip),
      chip.replace(/\n/g, ' | ').slice(0, 120));
  } else {
    for (let i = 0; i < 6; i += 1) happy(`เดือนนี้ไม่มีวันที่เลยกำหนดในตาราง — ข้ามการตรวจนี้ (${i + 1})`, true);
  }
}

suite('8. สายสนับสนุนใช้กล่องเลือกเดียวกัน');
{
  await openEntry();
  await gotoWeekOf(TODAY);
  const rowCount = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
  happy('ตารางมีทั้งสายปฏิบัติการและสายสนับสนุน', rowCount >= 2, String(rowCount));
  const tags = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].map((r) => r.innerText.slice(0, 6)));
  happy('แถวบอกสายงานด้วยป้าย OP / SUP', tags.some((x) => x.includes('OP')) && tags.some((x) => x.includes('SUP')), tags.join(' / '));
  // ระบบจริงใช้กล่องเลือกกับทั้งสองสาย (ไม่มีช่องพิมพ์อิสระอีกแล้ว)
  const opened = await page.evaluate(async (d) => {
    const rows = [...document.querySelectorAll('tbody tr')];
    const supRow = rows.find((r) => r.innerText.startsWith('SUP'));
    if (!supRow) return 'no-sup-row';
    const el = supRow.querySelector(`td[data-cell="${d}"] [data-slot]`);
    if (!el) return 'no-cell';
    el.click();
    return 'clicked';
  }, TODAY);
  await wait(700);
  happy('ช่องของสายสนับสนุนเปิดกล่องเลือกกิจกรรมเหมือนกัน',
    opened === 'clicked' ? await pickerOpen() : false, String(opened));
  happy('ไม่มีช่องพิมพ์อิสระในตาราง (ของเขาก็ไม่มีแล้ว)',
    (await page.evaluate(() => document.querySelectorAll('td[data-cell] input').length)) === 0);
  await page.keyboard.press('Escape');
  await wait(300);
}

suite('9. ป้ายวันลาใต้ช่อง หลังอนุมัติคำขอ');
{
  const le = (await call('/performance/employees', { method: 'POST', user: A,
    body: { site: site.key, fullName: `${MARK} คนลา`, kind: 'operation' } })).data;
  const r = await call('/performance/leave', { method: 'POST', user: A,
    body: { employeeId: le.eid, from: TODAY, to: TODAY, leaveType: 'sick', reason: MARK } });
  await call(`/performance/leave/approvers/${U.exec.id}`, { method: 'PUT', user: A, body: { employeeIds: [le.eid] } });
  const dec = await call(`/performance/leave/${r.row.id}/decide`, { method: 'POST', user: U.exec, body: { approve: true } });
  happy('อนุมัติคำขอลาได้', dec.status === 200, `${dec.status} ${dec.error || ''}`);
  await openEntry();
  await gotoWeekOf(TODAY);
  const td = await page.evaluate((d) => {
    const rows = [...document.querySelectorAll('tbody tr')];
    const row = rows.find((x) => x.innerText.includes('คนลา'));
    const cell = row?.querySelector(`td[data-cell="${d}"]`);
    // ป้ายวันลาคือ div ที่ขึ้นต้นด้วย ✓ — ไม่ใช่ div ตัวแรกที่มี title (นั่นคือช่องงาน)
    const badge = [...(cell?.querySelectorAll('div[title]') || [])].find((x) => x.innerText.trim().startsWith('✓'));
    return { text: cell?.innerText || '', title: badge?.getAttribute('title') || '' };
  }, TODAY);
  happy('ช่องแสดงรหัส Z-2 เหมือนที่ฝ่ายบุคคลพิมพ์มือ', /Z-2|ลา/.test(td.text), td.text.replace(/\n/g, ' | '));
  happy('และมีป้ายวันลากำกับใต้ช่อง ว่ามาจากคำขอที่อนุมัติแล้ว', /✓/.test(td.text), td.text.replace(/\n/g, ' | '));
  happy('ป้ายอธิบายที่มาเมื่อเอาเมาส์ชี้', /บันทึกอัตโนมัติจากคำขอลา/.test(td.title), td.title);
  // แก้ค่าในช่องเป็นงานอื่นแล้วป้ายวันลาต้องหายไป ไม่ค้างกำกับงานที่ไม่ใช่วันลา
  await call('/performance/cell', { method: 'POST', user: A,
    body: { site: site.key, eid: le.eid, date: TODAY, field: 'team', value: `${acts[0].code} / ${String(acts[0].allowed_cost).split(',')[0] || '5'}` } });
  await openEntry();
  await gotoWeekOf(TODAY);
  const td2 = await page.evaluate((d) => {
    const row = [...document.querySelectorAll('tbody tr')].find((x) => x.innerText.includes('คนลา'));
    return row?.querySelector(`td[data-cell="${d}"]`)?.innerText || '';
  }, TODAY);
  bad('แก้ช่องเป็นงานอื่นแล้วป้ายวันลาหายไป ไม่ค้างกำกับผิด', !/✓/.test(td2), td2.replace(/\n/g, ' | '));
}

suite('9b. รหัสพนักงานซ้ำ — ถามยืนยัน ไม่ปฏิเสธและไม่รับเงียบ');
{
  await openEntry();
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /จัดการพนักงาน/.test(x.innerText));
    if (b) b.click();
  });
  await page.waitForFunction(() => [...document.querySelectorAll('input')]
    .some((i) => /ชื่อ-นามสกุล/.test(i.placeholder || '')), { timeout: 60000 });
  await wait(600);
  const CODE = `${MARK}-DUP`;
  // เพิ่มคนแรกด้วยรหัสนี้ ต้องผ่านไปเลย ไม่ถามอะไร
  const fill = async (name, code) => page.evaluate((n, c) => {
    const set = (el, v) => {
      const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const ins = [...document.querySelectorAll('input')];
    const nameIn = ins.find((i) => /ชื่อ-นามสกุล/.test(i.placeholder || ''));
    const codeIn = ins.find((i) => /รหัส/.test(i.placeholder || ''));
    if (!nameIn || !codeIn) return false;
    set(nameIn, n); set(codeIn, c);
    return true;
  }, name, code);
  const submit = () => page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'เพิ่ม');
    if (b) b.click();
  });
  happy('เปิดหน้าจัดการพนักงานได้', await fill(`${MARK} คนแรกของรหัส`, CODE));
  await submit();
  await wait(1600);
  bad('คนแรกที่ใช้รหัสนี้ไม่ถูกถามอะไร', !/เป็นคนละคนใช่หรือไม่/.test(await bodyText()));
  happy('เพิ่มสำเร็จ', (await query('select count(*)::int n from employees where employee_code = $1', [CODE])).rows[0].n === 1);

  await fill(`${MARK} คนที่สองของรหัส`, CODE);
  await submit();
  await page.waitForFunction(() => /เป็นคนละคนใช่หรือไม่/.test(document.body.innerText), { timeout: 20000 })
    .catch(() => {});
  await wait(500);
  const ask = await bodyText();
  happy('รหัสซ้ำ → ถามยืนยันว่าเป็นคนละคน', /เป็นคนละคนใช่หรือไม่/.test(ask), ask.match(/[^\n]*เป็นคนละคน[^\n]*/)?.[0] || '');
  happy('และบอกว่ารหัสนี้ตอนนี้เป็นของใครที่ไซต์ไหน',
    /คนแรกของรหัส/.test(ask) && /ไซต์หน้าจอ/.test(ask), ask.match(/[^\n]*มีอยู่แล้วที่[^\n]*/)?.[0] || '');
  happy('และบอกว่ายืนยันแล้วจะยังเห็นรหัสเดิมทั้งบนจอและในไฟล์ Excel',
    /ยังแสดงรหัสนี้ตามเดิม/.test(ask), '');
  bad('ยังไม่ยืนยัน = ยังไม่บันทึก',
    (await query('select count(*)::int n from employees where full_name = $1', [`${MARK} คนที่สองของรหัส`])).rows[0].n === 0);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /เป็นคนละคน/.test(x.innerText));
    if (b) b.click();
  });
  await wait(1800);
  const rows = (await query(
    'select employee_code, live_emp_code from employees where full_name = $1', [`${MARK} คนที่สองของรหัส`])).rows;
  happy('ยืนยันแล้วบันทึกให้', rows.length === 1, JSON.stringify(rows));
  happy('เก็บรหัสจริงไว้ และเติมตัวแยกเฉพาะคอลัมน์ภายใน',
    rows[0]?.live_emp_code === CODE && rows[0]?.employee_code === `${CODE}#2`, JSON.stringify(rows[0]));
  const shown = await page.evaluate(() => [...document.querySelectorAll('table td')].map((x) => x.innerText.trim()));
  bad('รายชื่อบนหน้าจอไม่มีตัวแยก "#" ให้คนเห็น', !shown.some((x) => x.includes('#')), shown.filter((x) => x.includes('#')).join(','));
  happy('และยังแสดงรหัสจริงทั้งสองแถว', shown.filter((x) => x === CODE).length === 2, shown.filter((x) => x.includes(MARK)).join(' | '));
}

suite('10. หน้าคำขอลา');
{
  await page.goto(`${APP}/performance?tab=leave`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => /คำขอ/.test(document.body.innerText), { timeout: 60000 });
  await wait(900);
  const txt = await bodyText();
  happy('มีฟอร์มขอลาใหม่', /ขอลาใหม่/.test(txt));
  happy('มีช่องเลือกชื่อพนักงาน ประเภทการลา และช่วงวันที่',
    /ชื่อพนักงาน/.test(txt) && /ประเภทการลา/.test(txt) && /วันที่เริ่มลา/.test(txt) && /วันที่สิ้นสุด/.test(txt));
  const types = await page.evaluate(() => {
    const sels = [...document.querySelectorAll('select')];
    const s = sels.find((x) => [...x.options].some((o) => o.text === 'ลาป่วย'));
    return s ? [...s.options].map((o) => o.text) : [];
  });
  happy('ประเภทการลาครบ 6 แบบตามระบบจริง', types.length === 6, types.join(','));
  happy('มีแท็บคำขอของฉัน / รออนุมัติ / ประวัติการพิจารณา',
    /คำขอของฉัน/.test(txt) && /รออนุมัติ/.test(txt) && /ประวัติการพิจารณา/.test(txt));
  // ป้ายสถานะต้องใช้คำเดียวกับบรรทัดสรุป ไม่ใช่สองชื่อในหน้าเดียว
  const chips = await page.evaluate(() => [...document.querySelectorAll('.chip')].map((x) => x.innerText.trim()));
  bad('ป้ายสถานะไม่ใช้คำว่า "รออนุมัติ" ซ้อนกับชื่อแท็บ', !chips.includes('รออนุมัติ'), chips.join(','));

  // กรอกวันที่แล้วต้องบอกจำนวนวันรวม (นับวันปฏิทินรวมหัวรวมท้าย)
  await page.evaluate(() => {
    const ins = [...document.querySelectorAll('input[type="date"]')];
    const set = (el, v) => {
      const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    if (ins[0]) set(ins[0], '2027-04-01');
    if (ins[1]) set(ins[1], '2027-04-05');
  });
  await wait(500);
  happy('บอกจำนวนวันรวมเป็นวันปฏิทิน (1–5 เม.ย. = 5 วัน)', /รวม\s*5\s*วัน/.test(await bodyText()),
    (await bodyText()).match(/รวม[^\n]*/)?.[0] || '');
  // ส่งโดยไม่เลือกชื่อ ต้องบอกให้เลือกชื่อก่อน ไม่ใช่เงียบ
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'ส่งคำขอลา');
    if (b) b.click();
  });
  await wait(600);
  bad('ส่งคำขอโดยไม่เลือกชื่อ → บอกให้เลือกชื่อพนักงาน', /กรุณาเลือกชื่อพนักงาน/.test(await bodyText()));
}

suite('11. ไม่มีข้อผิดพลาดซ่อนอยู่ และเก็บกวาด');
{
  bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.join(' · '));
  await browser.close();
  await query('delete from leave_approvers where approver_id = $1', [U.exec.id]);
  await clean();
  const left = (await query(
    `select (select count(*)::int from employees where full_name like $1) e,
            (select count(*)::int from units where name like $1) u`, [`${MARK}%`])).rows[0];
  happy('ลบข้อมูลทดสอบหมดแล้ว', left.e === 0 && left.u === 0, JSON.stringify(left));
}

process.exit(report('/private/tmp/claude-501/-Users-pok-Desktop-Jobs--------------------/433cbf75-c00f-4cb4-a565-7affda174a77/scratchpad/check/worklog-flows-ui.json') ? 1 : 0);
