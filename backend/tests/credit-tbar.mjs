/**
 * แผนการเงิน (T-bar) · หักค่างานตามจริง · ผลต่าง — ชุดทดสอบฝั่ง API
 *
 * ระบบของลูกค้าเป็น read-only สำหรับเรา ชุดนี้จึงไม่ยิงไปที่ระบบเขาเลย แต่เอา
 * "ตรรกะ" จากซอร์สของเขามาเป็นเกณฑ์ แล้วพิสูจน์ว่าของเราได้เลขเดียวกัน
 * เลขที่คาดหวังทุกตัวคำนวณมือจากสูตรใน index.html ของเขา (planIncomeCalc ·
 * renderPlanPeriodCard · planRefreshDeductionCells · planInterestBlock ·
 * planTotalsForPeriods) ไม่ได้เอาผลลัพธ์ของเราเองมาเป็นคำตอบ:
 *
 *   ค่างาน 1,000,000 · segment 200,000 · PN ขายไว้ 100,000 · RT 500,000
 *     เพดาน 80%      = 800,000
 *     segment 60%    = 120,000
 *     เหลือค่างวด    = 1,000,000 − 120,000 = 880,000
 *     ฐานที่ขายได้   = MIN(800,000 , 880,000) = 800,000
 *     จะคงเหลือ P/N  = 800,000 − 100,000 = 700,000
 *     P/N RT 80%     = 400,000
 *     รวม P/N ที่ขาย = 1,100,000
 *     ดอกเบี้ย 90 วัน @6.35%/ปี = 10,960.27 + 6,263.01 = 17,223.28
 *   รับเงินค่างาน 2,000,000
 *     หัก TL 15%           = 300,000
 *     หัก ML 1.5%          = 30,000
 *     หัก PN (กรอกมือ)      = 300,000
 *     หัก PN ขอเบิกใหม่     = 1,100,000  (auto = รวม P/N ของส่วน income ส่วนแรก)
 *     หัก Segment CVE      = 50,000
 *     รวมหัก 1,780,000 · คงเหลือ 220,000
 *
 * โครงการทดสอบใช้ TEST_PROJECT ('kda') เท่านั้น ห้ามหยิบโครงการด้วย limit 1 —
 * โครงการจริงมีเงินอยู่ และวันครบกำหนดของตั๋วทดสอบตั้งไว้ปี 2027 เพื่อไม่ให้ไป
 * กระทบการ์ด "ครบกำหนดเดือนนี้ / เดือนหน้า" ของแดชบอร์ด
 */
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { call as rawCall, suite, happy, bad, report, U, warm, query, tok, API, TEST_PROJECT, sleep } from './harness.mjs';

/**
 * เซิร์ฟเวอร์ dev รีสตาร์ตเองทุกครั้งที่มีใครเซฟไฟล์ (node --watch) และคืนนี้มี
 * งานคู่ขนานอยู่หลายชุด การ์ดนี้ลองใหม่เมื่อการเชื่อมต่อขาดกลางคัน ไม่ให้ทั้งชุด
 * ล้มเพราะจังหวะรีสตาร์ต — ไม่ปิดความผิดพลาดจริง เพราะ HTTP ที่ตอบมาแล้วไม่ถูกลองซ้ำ
 */
const call = async (path, opts) => {
  for (let i = 0; i < 5; i += 1) {
    try { return await rawCall(path, opts); } catch (e) {
      if (i === 4) throw e;
      await sleep(1500);
    }
  }
  return null;
};

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
await warm();
const { admin: A, hr: H } = U;
const MARK = 'ZZTBAR';
const MONTH = '2027-05';
const NEXT = '2027-06';
const project = (await query('select id, code from projects where code = $1', [TEST_PROJECT])).rows[0];
const made = { fac: [], led: [] };
const near = (a, b, tol = 0.02) => Math.abs(Number(a) - Number(b)) <= tol;

/** ล้างแผนของโครงการทดสอบในเดือนที่ชุดนี้ใช้ ทั้งสองฉบับ */
const wipe = () => query('delete from cash_plans where project_id = $1 and month = any($2)',
  [project.id, [MONTH, NEXT]]);
/** กวาดของที่รันก่อนหน้าทิ้งค้างไว้ก่อนเริ่ม — ชุดที่ล้มกลางคันทำให้ตั๋วทดสอบซ้อนกัน */
const sweep = async () => {
  // โครงการทดสอบไม่มีข้อมูลจริง — ล้างแผนของมันทั้งหมด ไม่ใช่แค่สองเดือนที่ชุดนี้ใช้
  await query('delete from cash_plans where project_id = $1', [project.id]);
  await query('delete from cash_plans where note like $1', [`%${MARK}%`]);
  await query(`delete from credit_ledger where ref like $1`, [`${MARK}%`]);
  await query(`delete from credit_ledger where facility_id in (select id from facilities where notes = $1)`, [MARK]);
  await query('delete from facilities where notes = $1', [MARK]);
};
await sweep();

// ── ข้อมูลตั้งต้น: วงเงิน + ตั๋วสามใบ (สองใบครบเดือนนี้ หนึ่งใบเดือนหน้า) ────
const fac = await call('/credit/facilities', { method: 'POST', user: A, body: {
  projectId: project.id, company: `${MARK} ทดสอบ T-bar`, bank: 'ธนาคารทดสอบ',
  facilityNo: 6, limit: 20000000, notes: MARK } });
made.fac.push(fac.data.id);
const mkLedger = async (amount, due, ref) => {
  const r = await call('/credit/ledger', { method: 'POST', user: A, body: {
    facilityId: fac.data.id, amount, dueDate: due, startDate: `${MONTH}-01`,
    status: 'อนุมัติแล้ว', ref: `${MARK}-${ref}`, counterparty: `${MARK} คู่ค้า ${ref}` } });
  made.led.push(r.data.id);
  return r.data;
};
const L1 = await mkLedger(400000, `${MONTH}-15`, 'A');
const L2 = await mkLedger(250000, `${MONTH}-28`, 'B');
const L3 = await mkLedger(180000, `${NEXT}-10`, 'C');   // ล่วงหน้า — ยังไม่ครบเดือนนี้

const tbar = (month = MONTH, kind = 'plan') =>
  call(`/credit/cash-plan/tbar?month=${month}&kind=${kind}`, { user: A });
const ofProject = (data) => (data?.periods || []).filter((p) => p.project_id === project.id)
  .sort((a, b) => a.period_idx - b.period_idx);

// ── 1. เปิดเดือนที่ยังไม่มีแผน ──────────────────────────────────────────────
suite('1. เปิดแผนของเดือนที่ยังว่าง');
{
  const r = await tbar();
  happy('อ่านเดือนว่างได้ ไม่ต้องมีแถวก่อน', r.status === 200 && Array.isArray(r.data?.periods), `${r.status}`);
  happy('ยังไม่มีส่วนของโครงการทดสอบ', ofProject(r.data).length === 0, '');
  happy('ส่งตั๋วที่ยังต้องจ่ายมาให้ด้วย',
    (r.data?.outstanding || []).some((o) => o.id === L1.id), `${(r.data?.outstanding || []).length} รายการ`);
  const mine = (r.data.outstanding || []).find((o) => o.id === L1.id);
  happy('ตั๋วบอกประเภทเป็นป้ายสั้นแบบเดียวกับของเขา (B/E)', mine?.kind_short === 'B/E', String(mine?.kind_short));
  bad('เดือนผิดรูปแบบ → 400', (await call('/credit/cash-plan/tbar?month=พฤษภาคม', { user: A })).status === 400, '');
  bad('ไม่ส่งเดือนมาเลย → 400', (await call('/credit/cash-plan/tbar', { user: A })).status === 400, '');
}

// ── 2. เพิ่มโครงการเข้าแผน → ได้สามส่วนแบบระบบจริง ─────────────────────────
suite('2. เพิ่มโครงการแล้วได้สามส่วนตามระบบจริง');
let P = [];
{
  const r = await call('/credit/cash-plan/tbar/project', { method: 'POST', user: A, body: {
    projectId: project.id, month: MONTH } });
  happy('เพิ่มโครงการเข้าแผนได้', r.status === 201, `${r.status}`);
  P = ofProject((await tbar()).data);
  happy('ได้สามส่วน', P.length === 3, `${P.length} ส่วน`);
  happy('ลำดับส่วนตามของเขา: หักหนี้ → P/N ค่างาน → P/N Workdone',
    P.map((p) => p.period_type).join(',') === 'deduction,income,income', P.map((p) => p.period_type).join(','));
  happy('ส่วน P/N ส่วนแรกเป็นโหมดค่างาน ส่วนที่สองเป็น Workdone',
    P[1].income_break?.kind === 'work' && P[2].income_break?.kind === 'progress',
    `${P[1].income_break?.kind} / ${P[2].income_break?.kind}`);
  happy('ส่วนหักหนี้มีห้าแถวหักตาม T-bar ของธนาคาร',
    P[0].deductions.map((d) => d.label).join('|') === 'หัก TL|หัก ML|หัก PN|หัก PN ขอเบิกใหม่|หัก Segment CVE',
    P[0].deductions.map((d) => d.label).join('|'));
  happy('ส่วน P/N ส่วนแรกรับตั๋วที่ครบกำหนดเดือนนี้ไปทั้งสองใบ',
    P[1].paid_ids.length === 2 && P[1].paid_ids.includes(L1.id) && P[1].paid_ids.includes(L2.id),
    JSON.stringify(P[1].paid_ids));
  bad('ตั๋วที่ครบเดือนหน้าไม่ถูกดึงเข้ามาเอง', !P[1].paid_ids.includes(L3.id), '');
  bad('เพิ่มโครงการเดิมซ้ำ → 409',
    (await call('/credit/cash-plan/tbar/project', { method: 'POST', user: A, body: {
      projectId: project.id, month: MONTH } })).status === 409, '');
}

// ── 3. สูตรของส่วน "ขอเบิก P/N" ─────────────────────────────────────────────
suite('3. ขอเบิก P/N — เพดาน 80% · segment 60% · PN ขายไว้ · RT 80%');
{
  const r = await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    id: P[1].id, projectId: project.id, month: MONTH, periodIdx: P[1].period_idx,
    periodType: 'income', periodLabel: '5', periodDate: `${MONTH}-10`,
    incomeBreak: { kind: 'work', work: 1000000, segment: 200000, pnSold: 100000, rt: 500000, daysNew: 90, daysRT: 90 },
    paidIds: P[1].paid_ids } });
  happy('บันทึกส่วน P/N ได้', r.status === 200, `${r.status}`);
  const c = r.data?.calc || {};
  happy('เพดาน 80% ของค่างาน = 800,000', c.ceil1 === 800000, String(c.ceil1));
  happy('หัก segment 60% = 120,000', c.seg60 === 120000, String(c.seg60));
  happy('เหลือค่างวด = 880,000', c.remain === 880000, String(c.remain));
  happy('ฐานที่ขายได้ = MIN(เพดาน, เหลือค่างวด) = 800,000', c.sellBase === 800000, String(c.sellBase));
  happy('จะคงเหลือ P/N ที่ขายได้ = 700,000', c.newPN === 700000, String(c.newPN));
  happy('P/N RT 80% = 400,000', c.rtPN === 400000, String(c.rtPN));
  happy('รวม P/N ที่ขาย = 1,100,000', c.totalPN === 1100000, String(c.totalPN));
  const int = r.data?.interest || {};
  happy('ดอกเบี้ย P/N ที่ขายได้ 90 วัน = 10,960.27', near(int.rows?.[0]?.interest, 10960.27), String(int.rows?.[0]?.interest));
  happy('ดอกเบี้ย P/N RT 90 วัน = 6,263.01', near(int.rows?.[1]?.interest, 6263.01), String(int.rows?.[1]?.interest));
  happy('รวมดอกเบี้ยที่ต้องจ่าย = 17,223.28', near(int.total, 17223.28), String(int.total));
  happy('รับของส่วนนี้ = รวม P/N ที่ขาย', r.data?.totals?.cash_in === 1100000, String(r.data?.totals?.cash_in));
  happy('จ่ายของส่วนนี้ = ยอดตั๋วสองใบที่ส่วนนี้จ่าย (650,000)',
    r.data?.totals?.cash_out === 650000, String(r.data?.totals?.cash_out));
  bad('ดอกเบี้ยไม่ถูกบวกเข้ารวมจ่าย (แสดงอย่างเดียว เหมือนของเขา)',
    r.data?.totals?.cash_out === 650000, String(r.data?.totals?.cash_out));

  // โหมด Workdone — ขาย 50% ตรง ๆ ไม่มีรายการหัก
  const g = await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    id: P[2].id, projectId: project.id, month: MONTH, periodIdx: P[2].period_idx,
    periodType: 'income', incomeBreak: { kind: 'progress', work: 600000, daysNew: 90, daysRT: 90 }, paidIds: [] } });
  happy('Workdone: ผลงาน 600,000 → P/N 300,000', g.data?.calc?.totalPN === 300000, String(g.data?.calc?.totalPN));
  bad('Workdone ไม่มี segment / PN ขายไว้ มาเกี่ยว',
    g.data?.calc?.seg60 === 0 && g.data?.calc?.pnSold === 0, JSON.stringify(g.data?.calc));
}

// ── 4. สูตรของส่วน "รับเงินค่างาน + หักหนี้" ────────────────────────────────
suite('4. หักหนี้ — TL 15% · ML 1.5% · PN งวดก่อน · PN ขอเบิกใหม่ · Segment');
{
  const r = await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    id: P[0].id, projectId: project.id, month: MONTH, periodIdx: P[0].period_idx,
    periodType: 'deduction', income: 2000000,
    deductions: [
      { label: 'หัก TL', amount: 0 }, { label: 'หัก ML', amount: 0 },
      { label: 'หัก PN', amount: 300000 }, { label: 'หัก PN ขอเบิกใหม่', amount: 0 },
      { label: 'หัก Segment CVE', amount: 50000 }],
    paidIds: [] } });
  happy('บันทึกส่วนหักหนี้ได้', r.status === 200, `${r.status}`);
  const rows = Object.fromEntries((r.data?.deduction_rows || []).map((d) => [d.label, d.amount]));
  happy('หัก TL = 15% ของรับเงินค่างาน = 300,000', rows['หัก TL'] === 300000, String(rows['หัก TL']));
  happy('หัก ML = 1.5% ของรับเงินค่างาน = 30,000', rows['หัก ML'] === 30000, String(rows['หัก ML']));
  happy('หัก PN (งวดก่อน) เป็นค่าที่กรอกมือ = 300,000', rows['หัก PN'] === 300000, String(rows['หัก PN']));
  happy('หัก PN ขอเบิกใหม่ = รวม P/N ที่ขายของส่วน P/N ส่วนแรก = 1,100,000',
    rows['หัก PN ขอเบิกใหม่'] === 1100000, String(rows['หัก PN ขอเบิกใหม่']));
  happy('หัก Segment CVE เป็นค่าที่กรอกมือ = 50,000', rows['หัก Segment CVE'] === 50000, String(rows['หัก Segment CVE']));
  happy('รวมหัก = 1,780,000', r.data?.totals?.ded_sum === 1780000, String(r.data?.totals?.ded_sum));
  happy('คงเหลือ = 2,000,000 − 1,780,000 = 220,000', r.data?.totals?.balance === 220000, String(r.data?.totals?.balance));
  bad('TL/ML ที่ส่งค่ามั่วมาให้ ต้องถูกคำนวณทับ ไม่ใช่เชื่อค่าที่ส่งมา',
    rows['หัก TL'] === 300000 && rows['หัก ML'] === 30000, '');

  // แก้รับเงินค่างานแล้ว TL/ML ต้องขยับตาม
  const r2 = await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    id: P[0].id, projectId: project.id, month: MONTH, periodIdx: P[0].period_idx,
    periodType: 'deduction', income: 1000000,
    deductions: r.data.deduction_rows.map((d) => ({ label: d.label, amount: d.amount })), paidIds: [] } });
  const rows2 = Object.fromEntries((r2.data?.deduction_rows || []).map((d) => [d.label, d.amount]));
  happy('ลดรับเงินค่างานครึ่งหนึ่ง → TL 150,000 · ML 15,000',
    rows2['หัก TL'] === 150000 && rows2['หัก ML'] === 15000, `${rows2['หัก TL']} / ${rows2['หัก ML']}`);
  // คืนค่าเดิมไว้ใช้ต่อในชุดถัดไป
  await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    id: P[0].id, projectId: project.id, month: MONTH, periodIdx: P[0].period_idx,
    periodType: 'deduction', income: 2000000,
    deductions: [
      { label: 'หัก TL', amount: 0 }, { label: 'หัก ML', amount: 0 },
      { label: 'หัก PN', amount: 300000 }, { label: 'หัก PN ขอเบิกใหม่', amount: 0 },
      { label: 'หัก Segment CVE', amount: 50000 }], paidIds: [] } });
}

// ── 5. ย้ายตั๋วระหว่างส่วน · ไม่ชำระงวดนี้ · ดึงตั๋วล่วงหน้าเข้ามา ──────────
suite('5. จัดตั๋วเข้าส่วน — ย้าย · ตัดออก · ดึงล่วงหน้า');
{
  P = ofProject((await tbar()).data);
  const inc = P.find((p) => p.period_type === 'income' && p.period_idx === 2);
  const ded = P.find((p) => p.period_type === 'deduction');
  // ย้าย L1 จากส่วน P/N ไปส่วนหักหนี้ (ปุ่ม ↑ ของเขา = บันทึกสองส่วน)
  await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    id: inc.id, projectId: project.id, month: MONTH, periodIdx: inc.period_idx,
    periodType: 'income', incomeBreak: inc.income_break, paidIds: inc.paid_ids.filter((x) => x !== L1.id) } });
  await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    id: ded.id, projectId: project.id, month: MONTH, periodIdx: ded.period_idx,
    periodType: 'deduction', income: 2000000,
    deductions: ded.deductions, paidIds: [L1.id] } });
  let now = ofProject((await tbar()).data);
  const incN = now.find((p) => p.period_idx === 2); const dedN = now.find((p) => p.period_idx === 1);
  happy('ตั๋วอยู่ได้ส่วนเดียว — ย้ายแล้วต้นทางเหลือใบเดียว',
    incN.paid_ids.length === 1 && incN.paid_ids[0] === L2.id, JSON.stringify(incN.paid_ids));
  happy('ปลายทางได้ตั๋วไป', dedN.paid_ids.includes(L1.id), JSON.stringify(dedN.paid_ids));
  happy('จ่ายของส่วนหักหนี้ = รวมหัก + ตั๋วที่ย้ายมา (1,780,000 + 400,000)',
    dedN.totals.cash_out === 2180000, String(dedN.totals.cash_out));
  happy('จ่ายของส่วน P/N ลดลงเหลือ 250,000', incN.totals.cash_out === 250000, String(incN.totals.cash_out));

  // ดึงตั๋วที่ครบเดือนหน้าเข้ามาชำระก่อน (กลุ่ม "ล่วงหน้า" ของ picker)
  await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    id: incN.id, projectId: project.id, month: MONTH, periodIdx: incN.period_idx,
    periodType: 'income', incomeBreak: incN.income_break, paidIds: [L2.id, L3.id] } });
  now = ofProject((await tbar()).data);
  happy('ดึงตั๋วล่วงหน้าเข้าส่วนได้ (250,000 + 180,000)',
    now.find((p) => p.period_idx === 2).totals.cash_out === 430000,
    String(now.find((p) => p.period_idx === 2).totals.cash_out));

  // "ไม่ชำระงวดนี้" — ตัดออกจากส่วน
  await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    id: incN.id, projectId: project.id, month: MONTH, periodIdx: incN.period_idx,
    periodType: 'income', incomeBreak: incN.income_break, paidIds: [L2.id] } });
  now = ofProject((await tbar()).data);
  happy('ตัดตั๋วออกจากส่วนแล้วยอดจ่ายลดตาม',
    now.find((p) => p.period_idx === 2).totals.cash_out === 250000,
    String(now.find((p) => p.period_idx === 2).totals.cash_out));
  bad('ตั๋วของโครงการอื่นใส่เข้าส่วนนี้ไม่ได้', await (async () => {
    const other = (await query(
      `select id from credit_ledger where project_id <> $1 and amount > 0 limit 1`, [project.id])).rows[0];
    if (!other) return true;
    const w = await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
      id: incN.id, projectId: project.id, month: MONTH, periodIdx: incN.period_idx,
      periodType: 'income', incomeBreak: incN.income_break, paidIds: [L2.id, other.id] } });
    return (w.data?.paid_ids || []).length === 1;
  })(), '');
}

// ── 6. เพิ่มส่วน · Aval · รายรับจากแหล่งอื่น · เพดานห้าส่วน ────────────────
suite('6. เพิ่มส่วนได้ถึงห้าส่วน · Aval · รายรับจากแหล่งอื่น');
{
  const aval = await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    projectId: project.id, month: MONTH, periodIdx: 4, periodType: 'aval', avalAmount: 750000 } });
  happy('เพิ่มส่วน ขอออก Aval จัดสรร ได้', aval.status === 201, `${aval.status}`);
  happy('Aval เป็นเงินจ่าย 750,000', aval.data?.totals?.cash_out === 750000, String(aval.data?.totals?.cash_out));

  const extra = await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    projectId: project.id, month: MONTH, periodIdx: 5, periodType: 'mixed',
    extraRows: [{ label: `${MARK} เงินคืนภาษี`, amount: 120000 }, { label: `${MARK} ขายเศษเหล็ก`, amount: 30000 }] } });
  happy('รายรับจากแหล่งอื่นรวมเข้าเป็นเงินรับ 150,000',
    extra.data?.totals?.cash_in === 150000, String(extra.data?.totals?.cash_in));

  happy('ครบห้าส่วนพอดี', ofProject((await tbar()).data).length === 5,
    String(ofProject((await tbar()).data).length));
  bad('ส่วนที่หก (ไอดีใหม่ ในเดือนที่มีครบห้าส่วนแล้ว) → 400',
    (await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
      id: '00000000-0000-4000-8000-000000000000',
      projectId: project.id, month: MONTH, periodIdx: 3, periodType: 'aval', avalAmount: 1 } })).status === 400, '');
  bad('เลขส่วนเกินห้า → 400',
    (await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
      projectId: project.id, month: MONTH, periodIdx: 9, periodType: 'aval' } })).status === 400, '');
  bad('เลขส่วนศูนย์ → 400',
    (await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
      projectId: project.id, month: MONTH, periodIdx: 0, periodType: 'aval' } })).status === 400, '');
  bad('ประเภทส่วนที่ระบบไม่รู้จัก → 400',
    (await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
      projectId: project.id, month: MONTH, periodIdx: 3, periodType: 'อะไรก็ไม่รู้' } })).status === 400, '');
}

// ── 7. ยอดรวมของโครงการ = ผลบวกของทุกส่วน ──────────────────────────────────
suite('7. ยอดรวมท้ายการ์ดตรงกับผลบวกของทุกส่วน');
let planTotals = null;
{
  const r = await tbar();
  const list = ofProject(r.data);
  const sumIn = list.reduce((s, p) => s + p.totals.cash_in, 0);
  const sumOut = list.reduce((s, p) => s + p.totals.cash_out, 0);
  const proj = (r.data.projects || []).find((x) => x.project_id === project.id);
  planTotals = proj;
  happy('รวมรับของโครงการ = ผลบวกรับของทุกส่วน', near(proj.cash_in, sumIn), `${proj.cash_in} / ${sumIn}`);
  happy('รวมจ่ายของโครงการ = ผลบวกจ่ายของทุกส่วน', near(proj.cash_out, sumOut), `${proj.cash_out} / ${sumOut}`);
  happy('คงเหลือ = รับ − จ่าย', near(proj.net, proj.cash_in - proj.cash_out), String(proj.net));
  // 2,000,000 (หักหนี้) + 1,100,000 (P/N ค่างาน) + 300,000 (Workdone) + 0 (Aval) + 150,000 (แหล่งอื่น)
  happy('รวมรับ = 3,550,000 ตามเลขที่กรอก', near(proj.cash_in, 3550000), String(proj.cash_in));
  // 2,180,000 (หัก+ตั๋ว) + 250,000 (ตั๋วในส่วน P/N) + 0 + 750,000 (Aval) + 0
  happy('รวมจ่าย = 3,180,000 ตามเลขที่กรอก', near(proj.cash_out, 3180000), String(proj.cash_out));
}

// ── 8. คัดลอกไปเดือนถัดไป ───────────────────────────────────────────────────
suite('8. คัดลอกจากเดือนก่อน');
{
  const r = await call('/credit/cash-plan/tbar/copy', { method: 'POST', user: A, body: {
    projectId: project.id, month: NEXT } });
  happy('คัดลอกได้', r.status === 201, `${r.status}`);
  const next = ofProject((await tbar(NEXT)).data);
  const cur = ofProject((await tbar(MONTH)).data);
  happy('จำนวนส่วนเท่าเดิม', next.length === cur.length, `${next.length} / ${cur.length}`);
  happy('ประเภทและลำดับส่วนเหมือนเดิม',
    next.map((p) => p.period_type).join(',') === cur.map((p) => p.period_type).join(','),
    next.map((p) => p.period_type).join(','));
  happy('ยอดที่กรอกไว้ถูกลอกมาด้วย (รับเงินค่างาน 2,000,000)',
    next.find((p) => p.period_type === 'deduction').income === 2000000, '');
  happy('ตารางซ้ายของส่วน P/N ถูกลอกมาด้วย (ค่างาน 1,000,000)',
    next.find((p) => p.period_idx === 2)?.calc?.work === 1000000, '');
  bad('ตั๋วที่จ่ายไม่ถูกลอกมา — เดือนใหม่มีตั๋วคนละชุด',
    next.every((p) => (p.paid_ids || []).length === 0), JSON.stringify(next.map((p) => p.paid_ids)));
  bad('วันที่ส่งงานไม่ถูกลอกมา', next.every((p) => !p.period_date), JSON.stringify(next.map((p) => p.period_date)));
  bad('คัดลอกเดือนที่ไม่มีแผนมาก่อน → 404',
    (await call('/credit/cash-plan/tbar/copy', { method: 'POST', user: A, body: {
      projectId: project.id, month: '2027-01' } })).status === 404, '');

  // แก้ในเดือนที่คัดลอกมา แล้วเดือนต้นทางต้องไม่ขยับ
  const target = next.find((p) => p.period_type === 'deduction');
  await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    id: target.id, projectId: project.id, month: NEXT, periodIdx: target.period_idx,
    periodType: 'deduction', income: 900000, deductions: target.deductions, paidIds: [] } });
  const after = ofProject((await tbar(NEXT)).data).find((p) => p.period_type === 'deduction');
  happy('แก้เดือนถัดไปแล้ว TL คิดใหม่เป็น 135,000',
    (after.deduction_rows || []).find((d) => d.label === 'หัก TL')?.amount === 135000, '');
  const keep = ofProject((await tbar(MONTH)).data).find((p) => p.period_type === 'deduction');
  happy('เดือนต้นทางไม่ถูกแก้ตาม', keep.income === 2000000, String(keep.income));
}

// ── 9. ลบส่วน · ลบทั้งโครงการ ───────────────────────────────────────────────
suite('9. ลบส่วน และลบ T-bar ทั้งโครงการ');
{
  const next = ofProject((await tbar(NEXT)).data);
  const victim = next[next.length - 1];
  const r = await call(`/credit/cash-plan/tbar/period/${victim.id}`, { method: 'DELETE', user: A });
  happy('ลบส่วนเดียวได้', r.status === 200, `${r.status}`);
  happy('เหลือส่วนน้อยลงหนึ่ง', ofProject((await tbar(NEXT)).data).length === next.length - 1, '');
  bad('ลบส่วนที่ไม่มีอยู่จริง → 404',
    (await call(`/credit/cash-plan/tbar/period/${victim.id}`, { method: 'DELETE', user: A })).status === 404, '');

  const del = await call(`/credit/cash-plan/tbar/project?projectId=${project.id}&month=${NEXT}`,
    { method: 'DELETE', user: A });
  happy('ลบ T-bar ของโครงการทั้งเดือนได้', del.status === 200, `${del.status}`);
  happy('เดือนนั้นไม่มีส่วนของโครงการเหลือ', ofProject((await tbar(NEXT)).data).length === 0, '');
  happy('เดือนอื่นไม่ถูกลบตาม', ofProject((await tbar(MONTH)).data).length === 5, '');
  bad('ลบทั้งโครงการโดยไม่ระบุเดือน → 400',
    (await call(`/credit/cash-plan/tbar/project?projectId=${project.id}`, { method: 'DELETE', user: A })).status === 400, '');
}

// ── 10. ส่งออก T-bar เป็น Excel ─────────────────────────────────────────────
suite('10. ส่งออก T-bar เป็น Excel');
{
  let res = null;
  for (let i = 0; i < 5 && !res; i += 1) {
    try {
      res = await fetch(`${API}/credit/cash-plan/tbar/export?month=${MONTH}&kind=plan`,
        { headers: { Authorization: `Bearer ${tok(A)}` } });
    } catch { await sleep(1500); }
  }
  happy('ดาวน์โหลดไฟล์ได้', res.ok, `${res.status}`);
  happy('เป็นไฟล์ xlsx จริง',
    String(res.headers.get('content-type')).includes('spreadsheetml'), String(res.headers.get('content-type')));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
  const ws = wb.worksheets[0];
  happy('ชื่อชีตเป็นชื่อฉบับ (แผนการเงิน)', ws.name === 'แผนการเงิน', ws.name);
  const cells = [];
  ws.eachRow((row) => row.eachCell((c) => cells.push(typeof c.value === 'object' && c.value
    ? String(c.value.result ?? c.value.text ?? '') : String(c.value ?? ''))));
  const text = cells.join('\n');
  happy('มีหัวไฟล์บอกเดือน', text.includes(`เดือน ${MONTH}`), '');
  happy('มีชื่อโครงการทดสอบ', text.includes(project.code), '');
  happy('มีแถวห้ารายการหักครบ',
    ['หัก TL', 'หัก ML', 'หัก PN', 'หัก PN ขอเบิกใหม่', 'หัก Segment CVE'].every((l) => text.includes(l)), '');
  happy('มีตารางดอกเบี้ย P/N ที่ต้องจ่าย', text.includes('ดอกเบี้ย P/N ที่ต้องจ่าย'), '');
  happy('มีบรรทัดรวมทุก T-bar', text.includes('รวมทุก T-bar (Total all)'), '');
  const nums = cells.map(Number).filter((n) => Number.isFinite(n));
  happy('ตัวเลขรวมรับในไฟล์ตรงกับที่ API คิด (3,550,000)', nums.some((n) => near(n, planTotals.cash_in)), '');
  happy('ตัวเลขรวม P/N ที่ขายอยู่ในไฟล์ (1,100,000)', nums.some((n) => near(n, 1100000)), '');
  bad('ส่งออกเดือนผิดรูปแบบ → 400',
    (await call('/credit/cash-plan/tbar/export?month=2027', { user: A })).status === 400, '');
}

// ── 10ข. ฉบับจริงตั้งต้นจากฉบับแผน ──────────────────────────────────────────
suite('10ข. เปิดหักค่างานตามจริงครั้งแรก ตั้งต้นจากแผนให้เอง');
{
  happy('ยังไม่มีฉบับจริงของเดือนนี้', ofProject((await tbar(MONTH, 'actual')).data).length === 0, '');
  const m = await call('/credit/cash-plan/tbar/mirror', { method: 'POST', user: A, body: { month: MONTH } });
  happy('สั่งตั้งต้นได้', m.status === 200, `${m.status}`);
  const act = ofProject((await tbar(MONTH, 'actual')).data);
  const plan = ofProject((await tbar(MONTH, 'plan')).data);
  happy('ได้ส่วนเท่าฉบับแผน', act.length === plan.length, `${act.length} / ${plan.length}`);
  happy('ยอดถูกลอกมาเป็นจุดตั้งต้น (ค่างาน 1,000,000 · รับเงินค่างาน 2,000,000)',
    act.find((p) => p.period_idx === 2)?.calc?.work === 1000000
    && act.find((p) => p.period_type === 'deduction')?.income === 2000000, '');
  happy('ตั๋วที่จัดเข้าส่วนไว้ก็ถูกลอกมาด้วย',
    act.reduce((n, p) => n + (p.paid_ids || []).length, 0)
    === plan.reduce((n, p) => n + (p.paid_ids || []).length, 0), '');
  // แก้ฉบับจริงแล้วสั่งตั้งต้นซ้ำ ต้องไม่ทับของที่แก้ไว้และไม่เกิดของซ้ำ
  const aInc0 = act.find((p) => p.period_idx === 2);
  await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    id: aInc0.id, projectId: project.id, month: MONTH, kind: 'actual', periodIdx: 2, periodType: 'income',
    incomeBreak: { kind: 'work', work: 950000 }, paidIds: [] } });
  const again = await call('/credit/cash-plan/tbar/mirror', { method: 'POST', user: A, body: { month: MONTH } });
  const act2 = ofProject((await tbar(MONTH, 'actual')).data);
  bad('สั่งซ้ำแล้วไม่เกิดส่วนซ้ำ', act2.length === act.length, `${act2.length} / ${act.length}`);
  bad('สั่งซ้ำแล้วไม่ทับยอดที่แก้ไว้',
    act2.find((p) => p.period_idx === 2)?.calc?.work === 950000,
    String(act2.find((p) => p.period_idx === 2)?.calc?.work));
  happy('บอกกลับมาว่าไม่ได้ตั้งต้นให้ใครเพิ่ม', (again.data?.projects || []).length === 0, '');
  bad('เดือนผิดรูปแบบ → 400',
    (await call('/credit/cash-plan/tbar/mirror', { method: 'POST', user: A, body: { month: 'xx' } })).status === 400, '');
}

// ── 11. ผลต่าง (แผน vs จริง) ────────────────────────────────────────────────
suite('11. ผลต่าง — แผน vs จริง รายโครงการ');
{
  // ฉบับจริง: ค่างานที่ส่งน้อยกว่าแผน และรับเงินค่างานน้อยกว่าแผน
  const act = ofProject((await tbar(MONTH, 'actual')).data);
  const aInc = act.find((p) => p.period_idx === 2);
  const aDed = act.find((p) => p.period_type === 'deduction');
  await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    id: aInc.id, projectId: project.id, month: MONTH, kind: 'actual', periodIdx: aInc.period_idx,
    periodType: 'income', incomeBreak: { kind: 'work', work: 800000, segment: 200000, pnSold: 100000, rt: 500000 },
    paidIds: [] } });
  await call('/credit/cash-plan/tbar/period', { method: 'POST', user: A, body: {
    id: aDed.id, projectId: project.id, month: MONTH, kind: 'actual', periodIdx: aDed.period_idx,
    periodType: 'deduction', income: 1500000,
    deductions: [
      { label: 'หัก TL', amount: 0 }, { label: 'หัก ML', amount: 0 },
      { label: 'หัก PN', amount: 300000 }, { label: 'หัก PN ขอเบิกใหม่', amount: 0 },
      { label: 'หัก Segment CVE', amount: 50000 }], paidIds: [] } });

  const v = await call(`/credit/cash-plan/tbar/variance?month=${MONTH}`, { user: A });
  happy('อ่านผลต่างได้', v.status === 200, `${v.status}`);
  const row = (v.data || []).find((x) => x.project_id === project.id);
  happy('มีแถวของโครงการทดสอบ', Boolean(row), '');
  // รับเงิน (Received) = ผลรวม "ค่างานที่ส่ง" ของทุกส่วน income (เกณฑ์ของเขา)
  happy('รับเงินตามแผน = 1,000,000 + 600,000 = 1,600,000', near(row.received.plan, 1600000), String(row.received.plan));
  // ฉบับจริงถูกตั้งต้นจากแผน (Workdone 600,000 ติดมาด้วย) แล้วแก้ค่างานเป็น 800,000
  happy('รับเงินตามจริง = 800,000 + 600,000 = 1,400,000', near(row.received.actual, 1400000), String(row.received.actual));
  happy('ผลต่างรับเงิน = จริง − แผน = −200,000', near(row.received.diff, -200000), String(row.received.diff));
  // หักจ่ายตามแผน: TL 300,000 + ML 30,000 + PN 300,000 + PN ใหม่ (รวมทุกส่วน income = 1,100,000 + 300,000)
  //               + Segment 50,000 + ตั๋วที่ส่วนหักหนี้จ่าย 400,000 + Aval 750,000
  happy('หักจ่ายตามแผน = 3,230,000 ตามเกณฑ์หน้าผลต่างของเขา',
    near(row.deducted.plan, 3230000), String(row.deducted.plan));
  happy('คงเหลือสุทธิ = รับ − หัก ทั้งสองฉบับ',
    near(row.net.plan, row.received.plan - row.deducted.plan)
    && near(row.net.actual, row.received.actual - row.deducted.actual),
    `${row.net.plan} / ${row.net.actual}`);
  happy('ผลต่างสุทธิ = สุทธิจริง − สุทธิแผน',
    near(row.net.diff, row.net.actual - row.net.plan), String(row.net.diff));
  happy('บอกว่ามีทั้งฉบับแผนและฉบับจริง', row.has_plan && row.has_actual, '');
  bad('ผลต่างเดือนผิดรูปแบบ → 400',
    (await call('/credit/cash-plan/tbar/variance?month=xx', { user: A })).status === 400, '');
  bad('สองฉบับไม่ปนกัน — ฉบับจริงไม่โผล่ในฉบับแผน',
    ofProject((await tbar(MONTH, 'plan')).data).every((p) => p.kind === 'plan'), '');
}

// ── 12. endpoint เดิมต้องไม่พัง ─────────────────────────────────────────────
suite('12. เส้นทางเดิมของแผนเงินสดยังใช้ได้');
{
  const old = await call(`/credit/cash-plan?projectId=${project.id}&month=${MONTH}`, { user: A });
  happy('GET /cash-plan เดิมยังอ่านได้', old.status === 200 && Array.isArray(old.data), `${old.status}`);
  happy('แถวที่สร้างด้วยโครงใหม่ยังอ่านได้จาก endpoint เดิม',
    (old.data || []).length === 5, `${(old.data || []).length} แถว`);
  const ded = (old.data || []).find((c) => Number(c.income) === 2000000);
  happy('คอลัมน์เดิมยังมีค่าที่มีความหมาย (ยอดหักรวม 1,780,000)',
    ded && near(ded.deductions, 1780000), String(ded?.deductions));
  const cp = await call('/credit/cash-plan', { method: 'POST', user: A, body: {
    projectId: project.id, month: '2027-07', income: 500000, note: MARK } });
  happy('POST /cash-plan โครงเดิมยังบันทึกได้', [200, 201].includes(cp.status), `${cp.status}`);
  bad('โครงเดิมยังกันรายรับติดลบ',
    (await call('/credit/cash-plan', { method: 'POST', user: A, body: {
      projectId: project.id, month: '2027-07', income: -1 } })).status === 400, '');
  const v = await call('/credit/cash-plan/variance', { user: A });
  happy('หน้าผลต่างเดิมยังตอบได้', v.status === 200, `${v.status}`);
}

// ── 13. สิทธิ์ ──────────────────────────────────────────────────────────────
suite('13. สิทธิ์ — แผนการเงินคือข้อมูลการเงิน');
{
  const hrPerms = (await query('select permissions from profiles where id = $1', [H.id])).rows[0].permissions;
  const without = { ...(hrPerms || {}) };
  delete without.credit;
  await query('update profiles set permissions = $2 where id = $1', [H.id, JSON.stringify(without)]);
  bad('คนที่ไม่มีสิทธิ์อ่านแผนไม่ได้',
    (await call(`/credit/cash-plan/tbar?month=${MONTH}`, { user: H })).status === 403, '');
  bad('คนที่ไม่มีสิทธิ์เขียนส่วนไม่ได้',
    (await call('/credit/cash-plan/tbar/period', { method: 'POST', user: H, body: {
      projectId: project.id, month: MONTH, periodIdx: 1, periodType: 'aval' } })).status === 403, '');
  bad('คนที่ไม่มีสิทธิ์ส่งออกไฟล์ไม่ได้',
    (await call(`/credit/cash-plan/tbar/export?month=${MONTH}`, { user: H })).status === 403, '');
  bad('ไม่ล็อกอินเลยก็ไม่ได้',
    (await call(`/credit/cash-plan/tbar?month=${MONTH}`)).status === 401, '');
  await query('update profiles set permissions = $2 where id = $1', [H.id, hrPerms]);
}

// ── 14. เก็บกวาด แล้วยืนยันว่าตัวเลขแดชบอร์ดยังตรง ─────────────────────────
suite('14. เก็บกวาดและแดชบอร์ดไม่เพี้ยน');
{
  await wipe();
  await query('delete from cash_plans where note like $1', [`%${MARK}%`]);
  await query('delete from credit_ledger where ref like $1', [`${MARK}%`]);
  await query('delete from credit_ledger where facility_id = any($1)', [made.fac]);
  await query('delete from facilities where notes = $1', [MARK]);
  const left = await query(
    `select (select count(*) from facilities where notes = $1)::int f,
            (select count(*) from credit_ledger where ref like $2)::int l,
            (select count(*) from cash_plans where project_id = $3)::int c`,
    [MARK, `${MARK}%`, project.id]);
  happy('ไม่ทิ้งข้อมูลทดสอบไว้',
    left.rows[0].f === 0 && left.rows[0].l === 0 && left.rows[0].c === 0, JSON.stringify(left.rows[0]));

  // การ์ดเก้าค่าบนแดชบอร์ด — ตัวเลขชุดที่ตรวจแล้วว่าตรงกับระบบจริงของลูกค้า
  const o = (await call('/credit/overview', { user: A })).data;
  const box = (type) => (o.byType || []).find((x) => x.type === type) || {};
  const b = Math.round;
  happy('T/L คงเหลือ ฿70,526,685', b(box('T/L').available) === 70526685, String(box('T/L').available));
  happy('BG คงเหลือ ฿233,721,997', b(box('BG').available) === 233721997, String(box('BG').available));
  happy('B/E คงเหลือ ฿93,525,463', b(box('B/E').available) === 93525463, String(box('B/E').available));
  happy('P/N คงเหลือ ฿283,274,287', b(box('P/N').available) === 283274287, String(box('P/N').available));
  happy('ครบกำหนดเดือนนี้ ฿0', b(o.buckets.thisMonth.amount) === 0 && o.buckets.thisMonth.count === 0, '');
  happy('เกินกำหนดค้าง ฿150,163,817', b(o.buckets.overdue.amount) === 150163817, String(o.buckets.overdue.amount));
  happy('เดือนหน้า ฿7,374,934 · 2 รายการ',
    b(o.buckets.nextMonth.amount) === 7374934 && o.buckets.nextMonth.count === 2,
    `${o.buckets.nextMonth.amount} / ${o.buckets.nextMonth.count}`);
  happy('เสนออนุมัติ 0 รายการ', o.pendingCount === 0, String(o.pendingCount));
  happy('อนุมัติ 65 รายการ ฿158,059,797',
    o.approvedCount === 65 && b(o.approvedAmount) === 158059797, `${o.approvedCount} / ${o.approvedAmount}`);
}

process.exit(report(`${ROOT}/credit-tbar.json`) ? 1 : 0);
