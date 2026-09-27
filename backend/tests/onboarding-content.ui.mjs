/**
 * หน้าเนื้อหาของพอร์ทัลปฐมนิเทศ — เปิดทุกหน้าอย่างที่พนักงานใหม่คนหนึ่งจะเปิด
 *
 *   API=http://localhost:4000/api APP=http://localhost:5173 node tests/onboarding-content.ui.mjs
 *
 * ชุด onboarding.ui.mjs เดินเส้นทางเช็กลิสต์ (เจ็ดขั้น) ชุดนี้ถามเรื่องที่ชุดนั้น
 * ไม่ได้ถามเลย เพราะรอบก่อนหน้าเนื้อหาพวกนี้ยังไม่มี:
 *
 *   · หน้าแนะนำแผนกทั้งห้า ขึ้นครบสี่ส่วนตามของเขาไหม (หัวหน้างาน · ภาพรวมแผนก ·
 *     กระบวนการใน Mango Anywhere ERP · สามระยะ)
 *   · รู้จักทีมของเรา / ชีวิตในไซต์งาน / ผังองค์กร / คารูเซลผลงาน
 *   · **รูปโหลดขึ้นจริงไหม** — ข้อนี้สำคัญที่สุดและเป็นข้อที่ API ทดสอบแทนไม่ได้:
 *     รูปอยู่หลังล็อกอิน ดึงเป็น blob ผ่าน API ถ้า storage_key ผิด แถวหาย หรือ
 *     ไฟล์ไม่ได้ถูกอัป หน้าจอจะขึ้นกรอบเทาว่าง ๆ ซึ่ง "ดูเหมือนยังโหลดอยู่"
 *     ไม่ใช่ดูเหมือนพัง จึงต้องวัดที่ naturalWidth ของ <img> จริง
 *   · คารูเซลเลื่อนได้ · ผังองค์กรสลับสองมุมมองได้ · ไม่มี error ในคอนโซล
 *
 * ไม่แตะความคืบหน้าของใครเลย: ชุดนี้อ่านล้วน ไม่ติ๊ก ไม่อัปโหลด ไม่เลือกแผนก
 * (แผนกของผู้ใช้ทดสอบเป็นอะไรอยู่ก่อนก็ปล่อยไว้อย่างนั้น)
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { suite, happy, bad, report, U, warm, APP, tok, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
const SHOTS = `${ROOT}/onboarding-content`;
fs.mkdirSync(SHOTS, { recursive: true });
await warm();

const A = U.admin;

fs.rmSync(`${ROOT}/chrome-ob-content`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, userDataDir: `${ROOT}/chrome-ob-content`,
  defaultViewport: { width: 1440, height: 950 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(90000);
const settle = (ms = 1500) => new Promise((r) => setTimeout(r, ms));
const body = () => page.evaluate(() => document.body.innerText);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160));
});

const waitText = (s, ms = 45000) => page
  .waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms, polling: 300 }, s)
  .then(() => true).catch(() => false);

/** เปิด view หนึ่งของโมดูลด้วยบัญชีทดสอบ */
const open = async (view) => {
  await page.goto(`${APP}/onboarding/program?v=${encodeURIComponent(view)}`, { waitUntil: 'networkidle2' })
    .catch(() => {});
  await waitText('ความคืบหน้าการปฐมนิเทศของคุณ');
  await settle(1800);
};

/**
 * รูปทุกใบในหน้านี้โหลดขึ้นจริงไหม
 *
 * ObImage โหลดตอนเลื่อนมาถึง (IntersectionObserver) จึงต้องเลื่อนถึงท้ายหน้าก่อน
 * แล้วรอ — ไม่งั้น "รูปยังไม่โหลด" กับ "รูปโหลดไม่ได้" แยกกันไม่ออก
 *
 * วัดที่ naturalWidth ไม่ใช่แค่ว่ามีแท็ก <img> อยู่: src ที่เป็น blob เสียหรือชี้
 * ไปที่ไม่มีอะไร ยังให้แท็ก img ที่มี src ครบเหมือนกัน แต่ naturalWidth เป็น 0
 */
const scrollThrough = async () => {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await settle(2500);
};
const imageStats = () => page.evaluate(() => {
  const boxes = [...document.querySelectorAll('[data-ob-image]')];
  const imgs = boxes.map((b) => {
    const img = b.querySelector('img');
    return {
      key: b.getAttribute('data-ob-image'),
      state: b.getAttribute('data-ob-image-state'),
      w: img ? img.naturalWidth : 0,
    };
  });
  return {
    total: imgs.length,
    loaded: imgs.filter((x) => x.w > 0).length,
    broken: imgs.filter((x) => x.w === 0).map((x) => `${x.key}:${x.state}`),
  };
});

// ── 1. เมนูหน้าเนื้อหาทั้งเจ็ด ─────────────────────────────────────────────
suite('1. ชั้นวางมีกลุ่มหน้าเนื้อหาครบเจ็ดหน้า');
{
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('hr_access_token', t); }, tok(A));
  await open('welcome');
  const t = await body();
  happy('มีหัวข้อกลุ่ม "ทำความรู้จักบริษัท"', t.includes('ทำความรู้จักบริษัท'), t.slice(0, 120));
  // ชื่อหน้าในชั้นวางขึ้นตามภาษาของผู้ใช้ — โหมดไทยจึงเป็นคำแปลของเขาเอง
  // (ทีมบัญชี ไม่ใช่ Accounting Team) ที่เขาแปลไว้ครบทั้งเจ็ดหน้าใน TH_DICT
  const wanted = ['ทีมบัญชี', 'ทีมการเงิน', 'ทีมจัดซื้อ',
    'ทีมบริหารทรัพย์สิน', 'ทีมวิศวกรรม', 'รู้จักทีมของเรา', 'ชีวิตในไซต์งาน'];
  const missing = wanted.filter((w) => !t.includes(w));
  happy('ลิงก์หน้าเนื้อหาครบทั้งเจ็ด', missing.length === 0, `ขาด ${missing.join(', ')}`);
  await shot('01-ชั้นวาง');
}

// ── 2. หน้าแรก: คารูเซลผลงาน + ผังองค์กร ───────────────────────────────────
suite('2. หน้าแรกมีผลงานของเรา ค่านิยมพร้อมไอคอน และผังองค์กร');
{
  await open('welcome');
  const t = await body();
  happy('มีคารูเซล "ผลงานของเรา"', t.includes('ผลงานของเรา'), '');
  happy('caption ที่เขามีคำแปลไทยขึ้นเป็นไทย', t.includes('อาคารโรงไฟฟ้า') && t.includes('ทางระบายน้ำล้น'),
    '');
  happy('มีสารต้อนรับและค่านิยมของเขา',
    t.includes('สารต้อนรับจากท่านกรรมการผู้จัดการ') && t.includes('วัฒนธรรมและค่านิยมของ VCB'), '');
  happy('ชื่อค่านิยมยังเป็นคำแปลของเขา', t.includes('ความซื่อสัตย์') && t.includes('ความประณีต'), '');
  happy('มีผังองค์กร (Company Structure)',
    t.includes('Company Structure') || t.includes('ผังองค์กร'), '');

  await scrollThrough();
  const im = await imageStats();
  happy(`รูปในหน้าแรกโหลดขึ้นจริง ${im.loaded}/${im.total}`, im.total > 0 && im.broken.length === 0,
    im.broken.slice(0, 5).join(' | '));
  await shot('02-หน้าแรก');
}

// ── 3. คารูเซลเลื่อนได้ ─────────────────────────────────────────────────────
suite('3. คารูเซลเลื่อนได้');
{
  const before = await page.evaluate(() =>
    document.querySelector('[data-ob-carousel]')?.getAttribute('data-carousel-index'));
  const clicked = await page.evaluate(() => {
    const b = document.querySelector('[data-ob-carousel-next]');
    if (b) { b.click(); return true; } return false;
  });
  happy('มีปุ่มเลื่อนภาพ (ผลงานของเรามีสี่ภาพ เกินสามที่มองเห็น)', clicked, '');
  const moved = clicked && await page.waitForFunction((b) =>
    document.querySelector('[data-ob-carousel]')?.getAttribute('data-carousel-index') !== b,
  { timeout: 8000, polling: 150 }, before).then(() => true).catch(() => false);
  happy('กดแล้วเลื่อนจริง', Boolean(moved),
    `ก่อน ${before} → ${await page.evaluate(() => document.querySelector('[data-ob-carousel]')?.getAttribute('data-carousel-index'))}`);
}

// ── 4. ผังองค์กรสลับสองมุมมองได้ ───────────────────────────────────────────
suite('4. ผังองค์กรสลับมุมมองได้ และกางดูคนได้');
{
  const hasChart = await page.$('[data-org-panel="chart"]');
  happy('เปิดมาอยู่ที่มุมมองผังองค์กร', Boolean(hasChart), '');
  // ป้ายสองแถบนี้ถูก CSS uppercase — innerText ของ Chrome คืนค่าที่ transform แล้ว
  // ("HEAD OFFICE") จึงเทียบแบบไม่สนตัวพิมพ์ ไม่ใช่เทียบสตริงตรงตัว
  const t0 = (await body()).toLowerCase();
  happy('มีสองแถบ: สำนักงานใหญ่และไซต์งาน',
    t0.includes('head office') && t0.includes('project sites'), '');

  // กางฝ่ายหนึ่งฝ่าย แล้วต้องเห็นชื่อคนที่อยู่ข้างใน
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[data-org-panel="chart"] button')];
    const b = btns.find((x) => x.innerText.includes('Engineering Team') || x.innerText.includes('ทีมวิศวกรรม'));
    b?.click();
  });
  await settle(700);
  const t1 = await body();
  happy('กางฝ่ายแล้วเห็นรายชื่อคนข้างใน', t1.includes('Mr. Thanawat Placeholder'), '');

  // กดชื่อคนแล้วต้องเห็นหน้าที่ของคนนั้นกางออกมา
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[data-org-panel="chart"] li button')]
      .find((x) => x.innerText.includes('Mr. Thanawat Placeholder'));
    b?.click();
  });
  await settle(600);
  happy('กดชื่อคนแล้วเห็นหน้าที่ของเขา',
    (await body()).includes('owns execution accuracy and revenue realization'), '');

  // ไซต์งาน: ป้าย "Reports to" ของฝ่ายบุคคล-ธุรการต้องไม่ใช่ฝ่ายจัดซื้อ (ข้อที่
  // ต้นฉบับผูกผิดไว้ hqDept: 'procurement' ทั้งห้าโครงการ)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[data-org-panel="chart"] button')]
      .find((x) => x.innerText.trim().startsWith('Project A'));
    b?.click();
  });
  await settle(700);
  const t2 = await body();
  happy('เปิดไซต์งานแล้วเห็นสองสายงาน',
    /site operations/i.test(t2) && /site administration/i.test(t2), '');
  const hrLine = /HR - Administration[\s\S]{0,120}?Reports to\s*([^\n]+)/.exec(t2);
  bad('ฝ่ายบุคคล-ธุรการที่ไซต์ไม่ได้รายงานต่อฝ่ายจัดซื้อ (แก้จุดที่ต้นฉบับผิด)',
    Boolean(hrLine) && !/Procurement|จัดซื้อ/.test(hrLine[1]), hrLine ? hrLine[1].trim() : 'ไม่พบป้าย');
  happy('ป้ายชี้ไปฝ่ายทรัพยากรบุคคล',
    Boolean(hrLine) && /Human Resources|ทรัพยากรบุคคล/.test(hrLine[1]), hrLine ? hrLine[1].trim() : '');
  await shot('04-ผังองค์กร');

  // สลับไปโครงสร้างกลุ่มบริษัท
  await page.evaluate(() => document.querySelector('[data-org-view="group"]')?.click());
  await settle(900);
  const hasGroup = await page.$('[data-org-panel="group"]');
  const goneChart = await page.$('[data-org-panel="chart"]');
  happy('สลับไปมุมมองโครงสร้างกลุ่มบริษัทได้', Boolean(hasGroup) && !goneChart, '');
  const t3 = await body();
  happy('เห็นบริษัทย่อยและกิจการร่วมค้า', t3.includes('บริษัทย่อย') && t3.includes('กิจการร่วมค้า'), '');
  happy('เห็นผู้ถือหุ้นและ VCB เป็นการ์ดหลัก',
    t3.includes('Chavananand Family') || t3.includes('ตระกูลชวนะนันท์'), '');
  bad('คำบรรยาย CVN ไม่ใช้คำแปลไทยที่ความหมายไม่ตรง (เรื่องขึ้นทะเบียนชั้นพิเศษ)',
    !t3.includes('ขึ้นทะเบียนชั้นหนึ่งพิเศษ'), '');
  await shot('05-โครงสร้างกลุ่มบริษัท');

  // สลับกลับได้ด้วย
  await page.evaluate(() => document.querySelector('[data-org-view="chart"]')?.click());
  await settle(700);
  happy('สลับกลับมาผังองค์กรได้', Boolean(await page.$('[data-org-panel="chart"]')), '');
}

// ── 5. หน้าแนะนำแผนกทั้งห้า ────────────────────────────────────────────────
suite('5. หน้าแนะนำแผนกทั้งห้า ครบสี่ส่วนตามของเขา');
{
  // ชื่อหน้าและคำคมปิดท้ายขึ้นเป็นคำแปลไทยของเขา (ทั้งห้าแผนกมีครบใน TH_DICT)
  const DEPTS = [
    ['accounting-team', 'ทีมบัญชี', 'ความถูกต้องคือการปกป้อง'],
    ['finance-team', 'ทีมการเงิน', 'ฝ่ายการเงินปกป้องสภาพคล่อง'],
    ['procurement-team', 'ทีมจัดซื้อ', 'การควบคุมต้นทุนไม่ใช่ทางเลือก'],
    ['property-asset-management', 'ทีมบริหารทรัพย์สิน', 'การควบคุมช่วยรักษามูลค่า'],
    ['engineering-team', 'ทีมวิศวกรรม', 'ความแม่นยำในการปฏิบัติงานคือการปกป้องรายได้'],
  ];
  for (const [key, title, quote] of DEPTS) {
    await open(`page:${key}`);
    const t = await body();
    const four = ['รู้จักหัวหน้างานของคุณ', 'ภาพรวมของแผนก',
      'กระบวนการทำงานภายในระบบ Mango Anywhere ERP', 'ช่วงเวลาการปฐมนิเทศ'];
    const missing = four.filter((h) => !t.includes(h));
    happy(`${key}: ครบสี่ส่วน`, missing.length === 0, `ขาด ${missing.join(' / ')}`);
    happy(`${key}: หัวหน้าถูกหน้า`, t.includes(title), '');
    happy(`${key}: คำคมปิดท้ายภาพรวมแผนกขึ้นครบ`, t.includes(quote), '');
    happy(`${key}: การ์ดสามระยะขึ้นครบ`,
      t.includes('วันที่ 1–30') && t.includes('วันที่ 31–60') && t.includes('วันที่ 61–90'), '');
    await scrollThrough();
    const im = await imageStats();
    happy(`${key}: รูปผังกระบวนการ ERP โหลดขึ้นจริง (${im.loaded}/${im.total})`,
      im.total > 0 && im.broken.length === 0, im.broken.slice(0, 3).join(' | '));
  }
  await shot('06-แนะนำแผนก');
}

// ── 6. รู้จักทีมของเรา ─────────────────────────────────────────────────────
suite('6. รู้จักทีมของเรา — สามคารูเซลกับแกลเลอรี');
{
  await open('page:meet-our-team');
  const t = await body();
  happy('หัวหน้า "Meet Our Team"', t.includes('Meet Our Team') || t.includes('รู้จักทีมของเรา'), '');
  happy('มี Life at Vichitbhan Construction', t.includes('Life at Vichitbhan Construction'), '');
  const groups = ['New Year Party 2019', 'Company Celebration', 'Christmas Gathering'];
  const miss = groups.filter((g) => !t.includes(g));
  happy('มีสามชุดภาพตามของเขา', miss.length === 0, `ขาด ${miss.join(', ')}`);
  await scrollThrough();
  const im = await imageStats();
  happy(`รูปงานเลี้ยงโหลดขึ้นจริง ${im.loaded}/${im.total}`, im.total >= 10 && im.broken.length === 0,
    im.broken.slice(0, 5).join(' | '));
  await shot('07-รู้จักทีมของเรา');
}

// ── 7. ชีวิตในไซต์งาน ──────────────────────────────────────────────────────
suite('7. ชีวิตในไซต์งาน — เจ็ดแกลเลอรี');
{
  await open('page:life-on-site');
  const t = await body();
  const seven = ['การบรรยายความปลอดภัย', 'Tool Box Talk', 'การฝึกอบรมหน้างาน',
    'การดูแลความเป็นระเบียบเรียบร้อย', 'งานระหว่างดำเนินการ', 'Site Facilities', 'การทำงานเป็นทีม'];
  const miss = seven.filter((h) => !t.includes(h));
  happy('มีเจ็ดหัวข้อครบ', miss.length === 0, `ขาด ${miss.join(' / ')}`);
  happy('caption ของ Site Facilities ขึ้นเป็นไทยที่เขาแปลไว้',
    t.includes('ประตูเรือสัญจร') && t.includes('อาคารโรงไฟฟ้า'), '');
  await scrollThrough();
  const im = await imageStats();
  happy(`รูปหน้างานโหลดขึ้นจริง ${im.loaded}/${im.total}`, im.total >= 12 && im.broken.length === 0,
    im.broken.slice(0, 5).join(' | '));
  await shot('08-ชีวิตในไซต์งาน');
}

// ── 8. ไปหน้าอื่นด้วยลิงก์ในเนื้อหา ────────────────────────────────────────
suite('8. ลิงก์ในเนื้อหาพาไปถูกหน้า');
{
  await open('page:accounting-team');
  // การ์ดสามระยะของแผนกบัญชี: กดแล้วต้องไปหน้าเฟส (ของคนที่ประจำแผนกนี้) หรือ
  // ไปหน้าเลือกแผนก (ของคนที่ยังไม่ได้เลือก/ประจำแผนกอื่น) — ห้ามเป็นหน้าเปล่า
  await page.evaluate(() => {
    // ป้ายการ์ดขึ้นเป็นคำแปลไทยของเขา ("บัญชี – วันที่ 1–30") ไม่ใช่อังกฤษ
    const b = [...document.querySelectorAll('button')]
      .find((x) => /บัญชี – วันที่ 1–30|ACCOUNTING – DAY 1–30/i.test(x.innerText));
    b?.click();
  });
  await settle(2000);
  const t = await body();
  happy('กดการ์ดระยะแล้วไม่เจอหน้าเปล่า',
    t.includes('เลือกแผนกที่จะไปประจำก่อน') || t.includes('Chart of Accounts Structure')
    || t.includes('เอกสารที่ต้องศึกษา') || t.includes('Required Reading'), t.slice(0, 160));
  await shot('09-ลิงก์ในเนื้อหา');
}

// ── 9. หน้าจบ ──────────────────────────────────────────────────────────────
suite('9. หน้าสำเร็จการปฐมนิเทศ');
{
  await open('done');
  const t = await body();
  const finished = t.includes('ยินดีต้อนรับสู่ทีมของเราอย่างเป็นทางการ!');
  if (finished) {
    happy('มีการ์ดรู้จักทีมของเรา / ชีวิตในไซต์งาน',
      t.includes('Meet Our Team') || t.includes('รู้จักทีมของเรา'), '');
    happy('มีปุ่มพิมพ์แบบประเมินและกลับพอร์ทัล',
      t.includes('พิมพ์แบบประเมินการปฐมนิเทศ') && t.includes('กลับไปหน้าหลัก VCB Connect'), '');
  } else {
    happy('ยังไม่ครบ: ขึ้นส่วน "ยังไม่เสร็จ"', t.includes('ยังไม่เสร็จ'), t.slice(0, 120));
    happy('ยังไม่ครบ: มีทางกลับไปที่เช็กลิสต์', t.includes('กลับไปที่เช็กลิสต์ของคุณ'), '');
  }
  await shot('10-หน้าจบ');
}

// ── 10. โหมดอังกฤษ ─────────────────────────────────────────────────────────
suite('10. โหมดอังกฤษ — เนื้อหาที่ต้นฉบับเป็นอังกฤษยังเป็นอังกฤษ');
{
  await page.evaluate(() => { localStorage.setItem('vcb_lang', 'en'); });
  await page.goto(`${APP}/onboarding/program?v=page:life-on-site`, { waitUntil: 'networkidle2' }).catch(() => {});
  await waitText('Your Onboarding Progress');
  await settle(1800);
  const t = await body();
  happy('หัวข้อแกลเลอรีกลับเป็นอังกฤษ', t.includes('Safety Talk') && t.includes('House Keeping'), '');
  bad('ไม่มีไทยปนในโหมดอังกฤษ', !t.includes('การบรรยายความปลอดภัย'), '');
  await shot('11-โหมดอังกฤษ');
  await page.evaluate(() => { localStorage.setItem('vcb_lang', 'th'); });
}

// ── 11. มือถือ ─────────────────────────────────────────────────────────────
suite('11. หน้าจอมือถือ — เนื้อหาไม่ล้นออกนอกจอ');
{
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  // ตรวจสามหน้าที่แน่นที่สุด ไม่ใช่หน้าเดียว — ผังองค์กร (ตารางคนสองคอลัมน์ซ้อน
  // ในกล่องที่ซ้อนกันสามชั้น) คือหน้าที่ล้นขอบง่ายที่สุด ไม่ใช่แกลเลอรีรูป
  for (const [v, name] of [['welcome', '12-มือถือ-หน้าแรก'],
    ['page:meet-our-team', '12-มือถือ-ทีม'], ['page:accounting-team', '12-มือถือ-แผนก']]) {
    await open(v);
    await scrollThrough();
    const over = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    bad(`ไม่มีการเลื่อนแนวนอนบนมือถือ (${v})`, over.scroll <= over.client + 2,
      `${over.scroll} > ${over.client}`);
    await shot(name);
  }
  await page.setViewport({ width: 1440, height: 950 });
}

// ── 12. รูปทุกใบในฐานข้อมูลเสิร์ฟได้จริง ───────────────────────────────────
suite('12. ทุกคีย์รูปที่เนื้อหาอ้างถึงมีไฟล์ในที่เก็บ');
{
  const used = new Set();
  const { rows } = await query("select data::text d from ob_sections");
  // jsonb::text ของ Postgres ใส่ช่องว่างหลังโคลอน — regex ที่ไม่เผื่อไว้จับได้ศูนย์ข้อ
  // แล้วชุดทดสอบจะ "ผ่าน" เพราะไม่มีอะไรให้ตรวจ ซึ่งแย่กว่าไม่มีข้อนี้เลย
  for (const r of rows) for (const m of r.d.matchAll(/"imageKey":\s*"([^"]+)"/g)) used.add(m[1]);
  const heroes = await query('select hero_image from ob_pages where hero_image is not null');
  for (const h of heroes.rows) used.add(h.hero_image);
  const have = new Set((await query('select key from ob_images')).rows.map((r) => r.key));
  const missing = [...used].filter((k) => !have.has(k));
  happy(`เนื้อหาอ้างถึงรูป ${used.size} คีย์ · มีไฟล์ครบ`, missing.length === 0, missing.join(', '));
}

suite('13. ไม่มีข้อผิดพลาดซ่อนอยู่');
bad('ไม่มี error บนหน้าจอตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
process.exit(report(`${SHOTS}/result.json`) ? 1 : 0);
